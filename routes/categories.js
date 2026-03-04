const express = require('express');
const router = express.Router();
const { db, nextId } = require('../database');
const { verifyAdmin } = require('./auth');

// GET /api/categories
router.get('/', (req, res) => {
    const categories = db.get('categories').value();
    const subcategories = db.get('subcategories').value();

    const result = categories.map(cat => ({
        ...cat,
        subcategories: subcategories.filter(sub => sub.category_id === cat.id)
    }));

    res.json(result);
});

// POST /api/categories (Create or Update)
router.post('/', verifyAdmin, (req, res) => {
    const { id, label } = req.body;
    if (!label) return res.status(400).json({ error: 'الاسم مطلوب' });

    // Simple slug from label for filtering (fallback to timestamp if needed)
    const name = label.replace(/\s+/g, '-').toLowerCase();

    if (id) {
        // Update
        const exists = db.get('categories').find({ id: parseInt(id) }).value();
        if (!exists) return res.status(404).json({ error: 'القسم غير موجود' });

        db.get('categories')
            .find({ id: parseInt(id) })
            .assign({ label, name })
            .write();
        res.json({ message: 'تم التحديث بنجاح' });
    } else {
        // Create
        const newCat = {
            id: nextId('categories'),
            name,
            label
        };
        db.get('categories').push(newCat).write();
        res.json({ message: 'تمت الإضافة بنجاح', category: newCat });
    }
});

// DELETE /api/categories/:id
router.delete('/:id', verifyAdmin, (req, res) => {
    const id = parseInt(req.params.id);
    // Delete subcategories first
    db.get('subcategories').remove({ category_id: id }).write();
    // Delete category
    db.get('categories').remove({ id }).write();
    res.json({ message: 'تم الحذف بنجاح' });
});

// POST /api/categories/subcategory (Create or Update)
router.post('/subcategory', verifyAdmin, (req, res) => {
    const { id, category_id, label } = req.body;
    if (!label || !category_id) return res.status(400).json({ error: 'الاسم والقسم مطلوبان' });

    const name = label.replace(/\s+/g, '-').toLowerCase();

    if (id) {
        // Update
        const exists = db.get('subcategories').find({ id: parseInt(id) }).value();
        if (!exists) return res.status(404).json({ error: 'القسم الفرعي غير موجود' });

        db.get('subcategories')
            .find({ id: parseInt(id) })
            .assign({ label, name, category_id: parseInt(category_id) })
            .write();
        res.json({ message: 'تم التحديث بنجاح' });
    } else {
        // Create
        const newSub = {
            id: nextId('subcategories'),
            category_id: parseInt(category_id),
            name,
            label
        };
        db.get('subcategories').push(newSub).write();
        res.json({ message: 'تمت الإضافة بنجاح', subcategory: newSub });
    }
});

// DELETE /api/categories/subcategory/:id
router.delete('/subcategory/:id', verifyAdmin, (req, res) => {
    const id = parseInt(req.params.id);
    db.get('subcategories').remove({ id }).write();
    res.json({ message: 'تم الحذف بنجاح' });
});

module.exports = router;
