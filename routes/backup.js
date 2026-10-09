const express = require('express');
const router = express.Router();
const { db, isMongo, models } = require('../database');
const { verifyAdmin } = require('./auth');
const { Counter } = require('../models/Counter');

// GET /api/backup - Export complete database backup
router.get('/', verifyAdmin, async (req, res) => {
    try {
        let backupData = {};
        const dateStr = new Date().toISOString().split('T')[0];

        if (isMongo()) {
            const { Product, Category, Subcategory, ItemType, Banner, Order } = models;
            backupData = {
                export_date: new Date().toISOString(),
                store: 'Baby Moon',
                database: 'MongoDB Atlas',
                products: await Product.find().lean(),
                categories: await Category.find().lean(),
                subcategories: await Subcategory.find().lean(),
                item_types: ItemType ? await ItemType.find().lean() : [],
                banners: await Banner.find().lean(),
                orders: await Order.find().lean()
            };
        } else {
            db.read();
            backupData = {
                export_date: new Date().toISOString(),
                store: 'Baby Moon',
                database: 'Local db.json',
                products: db.get('products').value() || [],
                categories: db.get('categories').value() || [],
                subcategories: db.get('subcategories').value() || [],
                item_types: db.get('item_types').value() || [],
                banners: db.get('banners').value() || [],
                orders: db.get('orders').value() || [],
                order_items: db.get('order_items').value() || []
            };
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="babymoon_backup_${dateStr}.json"`);
        return res.send(JSON.stringify(backupData, null, 2));
    } catch (err) {
        console.error('Backup export error:', err);
        res.status(500).json({ error: 'خطأ أثناء تصدير النسخة الاحتياطية' });
    }
});

// POST /api/backup/restore - Restore database from backup JSON
router.post('/restore', verifyAdmin, async (req, res) => {
    try {
        const data = req.body;
        if (!data || (!data.products && !data.categories)) {
            return res.status(400).json({ error: 'ملف النسخة الاحتياطية غير صالح' });
        }

        let restoredProducts = 0;
        let restoredBanners = 0;

        if (isMongo()) {
            const { Product, Category, Subcategory, ItemType, Banner } = models;

            // Restore categories
            if (Array.isArray(data.categories)) {
                for (const cat of data.categories) {
                    await Category.findOneAndUpdate({ id: cat.id }, cat, { upsert: true });
                }
            }

            // Restore subcategories
            if (Array.isArray(data.subcategories)) {
                for (const sub of data.subcategories) {
                    await Subcategory.findOneAndUpdate({ id: sub.id }, sub, { upsert: true });
                }
            }

            // Restore item types
            if (ItemType && Array.isArray(data.item_types)) {
                for (const itype of data.item_types) {
                    await ItemType.findOneAndUpdate({ id: itype.id }, itype, { upsert: true });
                }
            }

            // Restore products
            if (Array.isArray(data.products)) {
                for (const prod of data.products) {
                    await Product.findOneAndUpdate({ id: prod.id }, prod, { upsert: true });
                    restoredProducts++;
                }
                const maxProdId = Math.max(...data.products.map(p => p.id || 0), 0);
                await Counter.findByIdAndUpdate('products', { seq: maxProdId }, { upsert: true });
            }

            // Restore banners
            if (Array.isArray(data.banners)) {
                for (const b of data.banners) {
                    await Banner.findOneAndUpdate({ id: b.id }, b, { upsert: true });
                    restoredBanners++;
                }
            }
        } else {
            db.read();
            if (Array.isArray(data.products)) {
                db.set('products', data.products).write();
                restoredProducts = data.products.length;
            }
            if (Array.isArray(data.categories)) db.set('categories', data.categories).write();
            if (Array.isArray(data.subcategories)) db.set('subcategories', data.subcategories).write();
            if (Array.isArray(data.item_types)) db.set('item_types', data.item_types).write();
            if (Array.isArray(data.banners)) {
                db.set('banners', data.banners).write();
                restoredBanners = data.banners.length;
            }
        }

        return res.json({
            message: 'تم استرجاع النسخة الاحتياطية بنجاح!',
            restored: {
                products: restoredProducts,
                banners: restoredBanners
            }
        });
    } catch (err) {
        console.error('Backup restore error:', err);
        res.status(500).json({ error: 'خطأ أثناء استرجاع النسخة الاحتياطية: ' + err.message });
    }
});

module.exports = router;
