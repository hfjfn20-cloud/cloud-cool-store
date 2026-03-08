const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { db, nextId } = require('../database');
const { verifyAdmin } = require('./auth');

// Multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `product_${Date.now()}${ext}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Helper: get category/subcategory labels
function enrichProduct(p) {
    const cat = db.get('categories').find({ id: p.category_id }).value();
    const sub = db.get('subcategories').find({ id: p.subcategory_id }).value();
    return { ...p, category_label: cat?.label || '', subcategory_label: sub?.label || '' };
}

// GET /api/products
router.get('/', (req, res) => {
    const { category, subcategory, type, search } = req.query;

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

    // Sort newest first
    products = products.sort((a, b) => b.id - a.id);

    res.json(products.map(enrichProduct));
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
    const product = db.get('products').find({ id: parseInt(req.params.id) }).value();
    if (!product) return res.status(404).json({ error: 'المنتج غير موجود' });
    res.json(enrichProduct(product));
});

// POST /api/products (admin only)
router.post('/', verifyAdmin, upload.single('image'), (req, res) => {
    const { name, description, price, category_id, subcategory_id, is_new, is_offer, discount_percent, is_low_stock, stock_qty, image_url } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'الاسم والسعر مطلوبان' });

    const image = req.file ? `/uploads/${req.file.filename}` : (image_url || null);
    const id = nextId('products');
    const product = {
        id,
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
    db.get('products').push(product).write();
    res.status(201).json(enrichProduct(product));
});

// PUT /api/products/:id (admin only)
router.put('/:id', verifyAdmin, upload.single('image'), (req, res) => {
    const id = parseInt(req.params.id);
    const existing = db.get('products').find({ id }).value();
    if (!existing) return res.status(404).json({ error: 'المنتج غير موجود' });

    const { name, description, price, category_id, subcategory_id, is_new, is_offer, discount_percent, is_low_stock, stock_qty, image_url } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : (image_url || existing.image);

    const updated = {
        ...existing,
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

    db.get('products').find({ id }).assign(updated).write();
    res.json(enrichProduct(updated));
});

// DELETE /api/products/:id (admin only)
router.delete('/:id', verifyAdmin, (req, res) => {
    const id = parseInt(req.params.id);
    const existing = db.get('products').find({ id }).value();
    if (!existing) return res.status(404).json({ error: 'المنتج غير موجود' });
    db.get('products').remove({ id }).write();
    res.json({ message: 'تم حذف المنتج بنجاح' });
});

module.exports = router;
