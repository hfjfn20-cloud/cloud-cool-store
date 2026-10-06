const express = require('express');
const router = express.Router();
const multer = require('multer');
const { db, nextId, isMongo, models, getNextSequence } = require('../database');
const { verifyAdmin } = require('./auth');
const { isImgbbConfigured, uploadToImgBB } = require('../config/imageStorage');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// Default banners for db.json fallback
const DEFAULT_BANNERS = [
    { id: 1, title: 'عروض وتخفيضات', description: 'خصومات تصل حتى 50% 🏷️', image: '', link_type: 'offers', link_value: '', order: 1, active: true },
    { id: 2, title: 'قد تنفد قريباً', description: 'اشتري قبل ما تنتهي ⚡', image: '', link_type: 'lowstock', link_value: '', order: 2, active: true },
    { id: 3, title: 'ملابس جديدة', description: 'أحدث التصاميم ✨', image: '', link_type: 'new', link_value: '', order: 3, active: true },
];

// GET /api/banners
router.get('/', async (req, res) => {
    try {
        if (isMongo()) {
            const { Banner } = models;
            const banners = await Banner.find({ active: true }).sort({ order: 1 }).lean();
            return res.json(banners);
        } else {
            let banners = db.get('banners').value();
            if (!banners || banners.length === 0) {
                db.set('banners', DEFAULT_BANNERS).write();
                banners = DEFAULT_BANNERS;
            }
            return res.json(banners.filter(b => b.active).sort((a, b) => a.order - b.order));
        }
    } catch (err) {
        console.error('Banners GET error:', err);
        res.status(500).json({ error: 'خطأ في جلب البنرات' });
    }
});

// GET /api/banners/all (admin - includes inactive)
router.get('/all', verifyAdmin, async (req, res) => {
    try {
        if (isMongo()) {
            const { Banner } = models;
            const banners = await Banner.find().sort({ order: 1 }).lean();
            return res.json(banners);
        } else {
            let banners = db.get('banners').value();
            if (!banners || banners.length === 0) {
                db.set('banners', DEFAULT_BANNERS).write();
                banners = DEFAULT_BANNERS;
            }
            return res.json(banners.sort((a, b) => a.order - b.order));
        }
    } catch (err) {
        res.status(500).json({ error: 'خطأ في جلب البنرات' });
    }
});

// POST /api/banners (admin only)
router.post('/', verifyAdmin, upload.single('image'), async (req, res) => {
    try {
        const { title, description, link_type, link_value, order, active } = req.body;
        if (!title) return res.status(400).json({ error: 'العنوان مطلوب' });

        let image = req.body.image_url || '';
        if (req.file) {
            if (isImgbbConfigured()) {
                image = await uploadToImgBB(req.file.buffer, req.file.originalname);
            }
        }

        const bannerData = {
            title,
            description: description || '',
            image,
            link_type: link_type || 'all',
            link_value: link_value || '',
            order: parseInt(order) || 0,
            active: active !== 'false'
        };

        if (isMongo()) {
            const { Banner } = models;
            const id = await getNextSequence('banners');
            const created = await Banner.create({ id, ...bannerData });
            return res.status(201).json(created.toObject());
        } else {
            const id = nextId('banners');
            const banner = { id, ...bannerData };
            db.get('banners').push(banner).write();
            return res.status(201).json(banner);
        }
    } catch (err) {
        console.error('Banner POST error:', err);
        res.status(500).json({ error: 'خطأ في إضافة البنر' });
    }
});

// PUT /api/banners/:id (admin only)
router.put('/:id', verifyAdmin, upload.single('image'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { title, description, link_type, link_value, order, active, image_url } = req.body;

        let image;
        if (req.file && isImgbbConfigured()) {
            image = await uploadToImgBB(req.file.buffer, req.file.originalname);
        } else if (image_url !== undefined) {
            image = image_url;
        }

        const updateData = {
            ...(title !== undefined && { title }),
            ...(description !== undefined && { description }),
            ...(image !== undefined && { image }),
            ...(link_type !== undefined && { link_type }),
            ...(link_value !== undefined && { link_value }),
            ...(order !== undefined && { order: parseInt(order) }),
            ...(active !== undefined && { active: active !== 'false' && active !== false }),
        };

        if (isMongo()) {
            const { Banner } = models;
            const updated = await Banner.findOneAndUpdate({ id }, updateData, { new: true }).lean();
            if (!updated) return res.status(404).json({ error: 'البنر غير موجود' });
            return res.json(updated);
        } else {
            const existing = db.get('banners').find({ id }).value();
            if (!existing) return res.status(404).json({ error: 'البنر غير موجود' });
            const updated = { ...existing, ...updateData };
            db.get('banners').find({ id }).assign(updated).write();
            return res.json(updated);
        }
    } catch (err) {
        console.error('Banner PUT error:', err);
        res.status(500).json({ error: 'خطأ في تعديل البنر' });
    }
});

// DELETE /api/banners/:id (admin only)
router.delete('/:id', verifyAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isMongo()) {
            const { Banner } = models;
            const deleted = await Banner.findOneAndDelete({ id });
            if (!deleted) return res.status(404).json({ error: 'البنر غير موجود' });
            return res.json({ message: 'تم حذف البنر' });
        } else {
            const existing = db.get('banners').find({ id }).value();
            if (!existing) return res.status(404).json({ error: 'البنر غير موجود' });
            db.get('banners').remove({ id }).write();
            return res.json({ message: 'تم حذف البنر' });
        }
    } catch (err) {
        res.status(500).json({ error: 'خطأ في حذف البنر' });
    }
});

module.exports = router;
