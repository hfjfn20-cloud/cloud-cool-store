const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db, nextId, isMongo, models, getNextSequence } = require('../database');
const { verifyAdmin } = require('./auth');
const { isImgbbConfigured, uploadToImgBB } = require('../config/imageStorage');

// Multer memory storage (allows streaming directly to ImgBB or disk fallback)
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

// Helper: Handle image saving (ImgBB Cloud or local fallback)
async function handleImageUpload(file, manualUrl = '') {
    if (!file) return manualUrl || null;

    if (isImgbbConfigured()) {
        try {
            console.log('☁️ Uploading product image to ImgBB Cloud...');
            const cloudUrl = await uploadToImgBB(file.buffer, file.originalname);
            console.log('✅ Image uploaded to ImgBB successfully:', cloudUrl);
            return cloudUrl;
        } catch (err) {
            console.error('❌ ImgBB upload failed:', err.message);
            console.log('🔄 Falling back to local disk storage on error.');
        }
    }

    // Local uploads directory fallback
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const ext = path.extname(file.originalname) || '.jpg';
    const filename = `product_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
    const filePath = path.join(uploadsDir, filename);

    fs.writeFileSync(filePath, file.buffer);
    console.log('📁 Saved image locally:', filename);
    return `/uploads/${filename}`;
}

// Helper: enrich product with category labels
async function enrichProduct(p) {
    if (isMongo()) {
        const cat = p.category_id ? await models.Category.findOne({ id: p.category_id }).lean() : null;
        const sub = p.subcategory_id ? await models.Subcategory.findOne({ id: p.subcategory_id }).lean() : null;
        return {
            ...p,
            category_label: cat?.label || '',
            subcategory_label: sub?.label || ''
        };
    } else {
        const cat = db.get('categories').find({ id: p.category_id }).value();
        const sub = db.get('subcategories').find({ id: p.subcategory_id }).value();
        return {
            ...p,
            category_label: cat?.label || '',
            subcategory_label: sub?.label || ''
        };
    }
}

// GET /api/products
router.get('/', async (req, res) => {
    try {
        const { category, subcategory, type, search } = req.query;

        if (isMongo()) {
            const filter = {};

            if (category) {
                const cat = await models.Category.findOne({ name: category }).lean();
                if (cat) filter.category_id = cat.id;
            }
            if (subcategory) {
                const sub = await models.Subcategory.findOne({ name: subcategory }).lean();
                if (sub) filter.subcategory_id = sub.id;
            }
            if (type === 'new') filter.is_new = true;
            else if (type === 'offer') filter.is_offer = true;
            else if (type === 'low_stock') filter.is_low_stock = true;

            if (search) {
                const regex = new RegExp(search, 'i');
                filter.$or = [{ name: regex }, { description: regex }];
            }

            const products = await models.Product.find(filter).sort({ id: -1 }).lean();
            const enriched = await Promise.all(products.map(enrichProduct));
            return res.json(enriched);
        } else {
            let products = db.get('products').value();

            if (category) {
                const cat = db.get('categories').find({ name: category }).value();
                if (cat) products = products.filter(p => p.category_id === cat.id);
            }
            if (subcategory) {
                const sub = db.get('subcategories').find({ name: subcategory }).value();
                if (sub) products = products.filter(p => p.subcategory_id === sub.id);
            }
            if (type === 'new') products = products.filter(p => p.is_new);
            else if (type === 'offer') products = products.filter(p => p.is_offer);
            else if (type === 'low_stock') products = products.filter(p => p.is_low_stock);

            if (search) {
                const q = search.toLowerCase();
                products = products.filter(p =>
                    (p.name || '').toLowerCase().includes(q) ||
                    (p.description || '').toLowerCase().includes(q)
                );
            }

            products = products.sort((a, b) => b.id - a.id);
            const enriched = await Promise.all(products.map(enrichProduct));
            return res.json(enriched);
        }
    } catch (err) {
        console.error('Products GET error:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب المنتجات' });
    }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        let product;

        if (isMongo()) {
            product = await models.Product.findOne({ id }).lean();
        } else {
            product = db.get('products').find({ id }).value();
        }

        if (!product) return res.status(404).json({ error: 'المنتج غير موجود' });
        const enriched = await enrichProduct(product);
        res.json(enriched);
    } catch (err) {
        console.error('Product GET by ID error:', err);
        res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
});

// POST /api/products (admin only)
router.post('/', verifyAdmin, upload.single('image'), async (req, res) => {
    try {
        const { name, description, price, category_id, subcategory_id, is_new, is_offer, discount_percent, is_low_stock, stock_qty, image_url } = req.body;
        if (!name || !price) return res.status(400).json({ error: 'الاسم والسعر مطلوبان' });

        const image = await handleImageUpload(req.file, image_url);

        const productData = {
            name,
            description: description || '',
            price: parseInt(price),
            image,
            category_id: category_id ? parseInt(category_id) : null,
            subcategory_id: subcategory_id ? parseInt(subcategory_id) : null,
            is_new: is_new === 'true' || is_new === '1',
            is_offer: is_offer === 'true' || is_offer === '1',
            discount_percent: parseInt(discount_percent) || 0,
            is_low_stock: is_low_stock === 'true' || is_low_stock === '1',
            stock_qty: parseInt(stock_qty) || 10,
            created_at: new Date().toISOString()
        };

        if (isMongo()) {
            const id = await getNextSequence('products');
            const created = await models.Product.create({ id, ...productData });
            const enriched = await enrichProduct(created.toObject());
            return res.status(201).json(enriched);
        } else {
            const id = nextId('products');
            const product = { id, ...productData };
            db.get('products').push(product).write();
            const enriched = await enrichProduct(product);
            return res.status(201).json(enriched);
        }
    } catch (err) {
        console.error('Product POST error:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء إضافة المنتج' });
    }
});

// PUT /api/products/:id (admin only)
router.put('/:id', verifyAdmin, upload.single('image'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        let existing;

        if (isMongo()) {
            existing = await models.Product.findOne({ id }).lean();
        } else {
            existing = db.get('products').find({ id }).value();
        }

        if (!existing) return res.status(404).json({ error: 'المنتج غير موجود' });

        const { name, description, price, category_id, subcategory_id, is_new, is_offer, discount_percent, is_low_stock, stock_qty, image_url } = req.body;
        
        let image = existing.image;
        if (req.file) {
            image = await handleImageUpload(req.file);
        } else if (image_url !== undefined && image_url !== '') {
            image = image_url;
        }

        const updateData = {
            name: name || existing.name,
            description: description !== undefined ? description : existing.description,
            price: price ? parseInt(price) : existing.price,
            image,
            category_id: category_id ? parseInt(category_id) : existing.category_id,
            subcategory_id: subcategory_id ? parseInt(subcategory_id) : existing.subcategory_id,
            is_new: is_new === 'true' || is_new === '1' ? true : (is_new === 'false' || is_new === '0' ? false : existing.is_new),
            is_offer: is_offer === 'true' || is_offer === '1' ? true : (is_offer === 'false' || is_offer === '0' ? false : existing.is_offer),
            discount_percent: discount_percent !== undefined ? parseInt(discount_percent) : existing.discount_percent,
            is_low_stock: is_low_stock === 'true' || is_low_stock === '1' ? true : (is_low_stock === 'false' || is_low_stock === '0' ? false : existing.is_low_stock),
            stock_qty: stock_qty !== undefined ? parseInt(stock_qty) : existing.stock_qty
        };

        if (isMongo()) {
            const updated = await models.Product.findOneAndUpdate({ id }, updateData, { new: true }).lean();
            const enriched = await enrichProduct(updated);
            return res.json(enriched);
        } else {
            const updated = { ...existing, ...updateData };
            db.get('products').find({ id }).assign(updated).write();
            const enriched = await enrichProduct(updated);
            return res.json(enriched);
        }
    } catch (err) {
        console.error('Product PUT error:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء تعديل المنتج' });
    }
});

// DELETE /api/products/:id (admin only)
router.delete('/:id', verifyAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        if (isMongo()) {
            const deleted = await models.Product.findOneAndDelete({ id });
            if (!deleted) return res.status(404).json({ error: 'المنتج غير موجود' });
            return res.json({ message: 'تم حذف المنتج بنجاح' });
        } else {
            const existing = db.get('products').find({ id }).value();
            if (!existing) return res.status(404).json({ error: 'المنتج غير موجود' });
            db.get('products').remove({ id }).write();
            return res.json({ message: 'تم حذف المنتج بنجاح' });
        }
    } catch (err) {
        console.error('Product DELETE error:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء حذف المنتج' });
    }
});

module.exports = router;
