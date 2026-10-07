const express = require('express');
const router = express.Router();
const { db, nextId, isMongo, models, getNextSequence } = require('../database');
const { verifyAdmin } = require('./auth');

// GET /api/categories
router.get('/', async (req, res) => {
    try {
        let categories, subcategories;

        if (isMongo()) {
            categories = await models.Category.find().lean();
            subcategories = await models.Subcategory.find().lean();
        } else {
            categories = db.get('categories').value();
            subcategories = db.get('subcategories').value();
        }

        const result = categories.map(cat => ({
            ...cat,
            subcategories: subcategories.filter(sub => sub.category_id === cat.id)
        }));

        res.json(result);
    } catch (err) {
        console.error('Categories GET error:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب الأقسام' });
    }
});

// GET /api/categories/:name/subcategories
router.get('/:name/subcategories', async (req, res) => {
    try {
        const catName = req.params.name;
        let cat;
        if (isMongo()) {
            cat = await models.Category.findOne({
                $or: [{ name: catName }, { id: isNaN(catName) ? -1 : parseInt(catName) }]
            }).lean();
            if (!cat) return res.json([]);
            const subs = await models.Subcategory.find({ category_id: cat.id }).lean();
            return res.json(subs);
        } else {
            cat = db.get('categories').find(c => c.name === catName || c.id === parseInt(catName)).value();
            if (!cat) return res.json([]);
            const subs = db.get('subcategories').filter({ category_id: cat.id }).value();
            return res.json(subs);
        }
    } catch (err) {
        console.error('Subcategories by cat error:', err);
        res.status(500).json({ error: 'خطأ في جلب الفئات الفرعية' });
    }
});

// POST /api/categories (Create or Update)
router.post('/', verifyAdmin, async (req, res) => {
    try {
        const { id, label } = req.body;
        if (!label) return res.status(400).json({ error: 'الاسم مطلوب' });

        const name = label.replace(/\s+/g, '-').toLowerCase();

        if (isMongo()) {
            if (id) {
                const updated = await models.Category.findOneAndUpdate(
                    { id: parseInt(id) },
                    { label, name },
                    { new: true }
                ).lean();
                if (!updated) return res.status(404).json({ error: 'القسم غير موجود' });
                return res.json({ message: 'تم التحديث بنجاح', category: updated });
            } else {
                const newId = await getNextSequence('categories');
                const newCat = await models.Category.create({
                    id: newId,
                    name,
                    label
                });
                return res.json({ message: 'تمت الإضافة بنجاح', category: newCat });
            }
        } else {
            if (id) {
                const exists = db.get('categories').find({ id: parseInt(id) }).value();
                if (!exists) return res.status(404).json({ error: 'القسم غير موجود' });

                db.get('categories')
                    .find({ id: parseInt(id) })
                    .assign({ label, name })
                    .write();
                return res.json({ message: 'تم التحديث بنجاح' });
            } else {
                const newCat = {
                    id: nextId('categories'),
                    name,
                    label
                };
                db.get('categories').push(newCat).write();
                return res.json({ message: 'تمت الإضافة بنجاح', category: newCat });
            }
        }
    } catch (err) {
        console.error('Categories POST error:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء حفظ القسم' });
    }
});

// DELETE /api/categories/:id
router.delete('/:id', verifyAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        if (isMongo()) {
            await models.Subcategory.deleteMany({ category_id: id });
            await models.Category.deleteOne({ id });
            return res.json({ message: 'تم الحذف بنجاح' });
        } else {
            db.get('subcategories').remove({ category_id: id }).write();
            db.get('categories').remove({ id }).write();
            return res.json({ message: 'تم الحذف بنجاح' });
        }
    } catch (err) {
        console.error('Categories DELETE error:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء حذف القسم' });
    }
});

// POST /api/categories/subcategory (Create or Update)
router.post('/subcategory', verifyAdmin, async (req, res) => {
    try {
        const { id, category_id, label } = req.body;
        if (!label || !category_id) return res.status(400).json({ error: 'الاسم والقسم مطلوبان' });

        const name = label.replace(/\s+/g, '-').toLowerCase();

        if (isMongo()) {
            if (id) {
                const updated = await models.Subcategory.findOneAndUpdate(
                    { id: parseInt(id) },
                    { label, name, category_id: parseInt(category_id) },
                    { new: true }
                ).lean();
                if (!updated) return res.status(404).json({ error: 'القسم الفرعي غير موجود' });
                return res.json({ message: 'تم التحديث بنجاح', subcategory: updated });
            } else {
                const newId = await getNextSequence('subcategories');
                const newSub = await models.Subcategory.create({
                    id: newId,
                    category_id: parseInt(category_id),
                    name,
                    label
                });
                return res.json({ message: 'تمت الإضافة بنجاح', subcategory: newSub });
            }
        } else {
            if (id) {
                const exists = db.get('subcategories').find({ id: parseInt(id) }).value();
                if (!exists) return res.status(404).json({ error: 'القسم الفرعي غير موجود' });

                db.get('subcategories')
                    .find({ id: parseInt(id) })
                    .assign({ label, name, category_id: parseInt(category_id) })
                    .write();
                return res.json({ message: 'تم التحديث بنجاح' });
            } else {
                const newSub = {
                    id: nextId('subcategories'),
                    category_id: parseInt(category_id),
                    name,
                    label
                };
                db.get('subcategories').push(newSub).write();
                return res.json({ message: 'تمت الإضافة بنجاح', subcategory: newSub });
            }
        }
    } catch (err) {
        console.error('Subcategories POST error:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء حفظ القسم الفرعي' });
    }
});

// DELETE /api/categories/subcategory/:id
router.delete('/subcategory/:id', verifyAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        if (isMongo()) {
            await models.Subcategory.deleteOne({ id });
            return res.json({ message: 'تم الحذف بنجاح' });
        } else {
            db.get('subcategories').remove({ id }).write();
            return res.json({ message: 'تم الحذف بنجاح' });
        }
    } catch (err) {
        console.error('Subcategories DELETE error:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء حذف القسم الفرعي' });
    }
});

module.exports = router;
