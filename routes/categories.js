const express = require('express');
const router = express.Router();
const { db, nextId, isMongo, models, getNextSequence } = require('../database');
const { verifyAdmin } = require('./auth');

// GET /api/categories (Full 3-tier hierarchy: Categories -> Subcategories -> ItemTypes)
router.get('/', async (req, res) => {
    try {
        if (!isMongo()) db.read();
        let categories, subcategories, itemTypes;

        if (isMongo()) {
            categories = await models.Category.find().lean();
            subcategories = await models.Subcategory.find().lean();
            itemTypes = await models.ItemType.find().lean();
        } else {
            categories = db.get('categories').value() || [];
            subcategories = db.get('subcategories').value() || [];
            itemTypes = db.get('item_types').value() || [];
        }

        const result = categories.map(cat => ({
            ...cat,
            subcategories: subcategories
                .filter(sub => sub.category_id === cat.id)
                .map(sub => ({
                    ...sub,
                    item_types: itemTypes.filter(it => it.subcategory_id === sub.id)
                }))
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
        if (!isMongo()) db.read();
        const catName = req.params.name;
        let cat;
        if (isMongo()) {
            cat = await models.Category.findOne({
                $or: [{ name: catName }, { id: isNaN(catName) ? -1 : parseInt(catName) }]
            }).lean();
            if (!cat) return res.json([]);
            const subs = await models.Subcategory.find({ category_id: cat.id }).lean();
            const itemTypes = await models.ItemType.find({ category_id: cat.id }).lean();
            return res.json(subs.map(s => ({
                ...s,
                item_types: itemTypes.filter(it => it.subcategory_id === s.id)
            })));
        } else {
            cat = db.get('categories').find(c => c.name === catName || c.id === parseInt(catName)).value();
            if (!cat) return res.json([]);
            const subs = db.get('subcategories').filter({ category_id: cat.id }).value();
            const itemTypes = db.get('item_types').value() || [];
            return res.json(subs.map(s => ({
                ...s,
                item_types: itemTypes.filter(it => it.subcategory_id === s.id)
            })));
        }
    } catch (err) {
        console.error('Subcategories by cat error:', err);
        res.status(500).json({ error: 'خطأ في جلب الفئات الفرعية' });
    }
});

// POST /api/categories (Create or Update Level 1: Category)
router.post('/', verifyAdmin, async (req, res) => {
    try {
        const { id, label, icon } = req.body;
        if (!label) return res.status(400).json({ error: 'الاسم مطلوب' });

        const name = label.replace(/\s+/g, '-').toLowerCase();
        const catIcon = icon || '🛍️';

        if (isMongo()) {
            if (id) {
                const updated = await models.Category.findOneAndUpdate(
                    { id: parseInt(id) },
                    { label, name, icon: catIcon },
                    { new: true }
                ).lean();
                if (!updated) return res.status(404).json({ error: 'القسم غير موجود' });
                return res.json({ message: 'تم التحديث بنجاح', category: updated });
            } else {
                const newId = await getNextSequence('categories');
                const newCat = await models.Category.create({
                    id: newId,
                    name,
                    label,
                    icon: catIcon
                });
                return res.json({ message: 'تمت الإضافة بنجاح', category: newCat });
            }
        } else {
            db.read();
            if (id) {
                const exists = db.get('categories').find({ id: parseInt(id) }).value();
                if (!exists) return res.status(404).json({ error: 'القسم غير موجود' });

                db.get('categories')
                    .find({ id: parseInt(id) })
                    .assign({ label, name, icon: catIcon })
                    .write();
                return res.json({ message: 'تم التحديث بنجاح' });
            } else {
                const newCat = {
                    id: nextId('categories'),
                    name,
                    label,
                    icon: catIcon
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

// DELETE /api/categories/:id (Delete Category + all its subcategories & item types)
router.delete('/:id', verifyAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        if (isMongo()) {
            await models.ItemType.deleteMany({ category_id: id });
            await models.Subcategory.deleteMany({ category_id: id });
            await models.Category.deleteOne({ id });
            return res.json({ message: 'تم الحذف بنجاح' });
        } else {
            db.read();
            db.get('item_types').remove({ category_id: id }).write();
            db.get('subcategories').remove({ category_id: id }).write();
            db.get('categories').remove({ id }).write();
            return res.json({ message: 'تم الحذف بنجاح' });
        }
    } catch (err) {
        console.error('Categories DELETE error:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء حذف القسم' });
    }
});

// POST /api/categories/subcategory (Create or Update Level 2: Secondary Category)
router.post('/subcategory', verifyAdmin, async (req, res) => {
    try {
        const { id, category_id, label, icon } = req.body;
        if (!label || !category_id) return res.status(400).json({ error: 'الاسم والقسم الرئيسي مطلوبان' });

        const name = label.replace(/\s+/g, '-').toLowerCase();
        const subIcon = icon || '';

        if (isMongo()) {
            if (id) {
                const updated = await models.Subcategory.findOneAndUpdate(
                    { id: parseInt(id) },
                    { label, name, category_id: parseInt(category_id), icon: subIcon },
                    { new: true }
                ).lean();
                if (!updated) return res.status(404).json({ error: 'الصنف غير موجود' });
                return res.json({ message: 'تم التحديث بنجاح', subcategory: updated });
            } else {
                const newId = await getNextSequence('subcategories');
                const newSub = await models.Subcategory.create({
                    id: newId,
                    category_id: parseInt(category_id),
                    name,
                    label,
                    icon: subIcon
                });
                return res.json({ message: 'تمت الإضافة بنجاح', subcategory: newSub });
            }
        } else {
            db.read();
            if (id) {
                const exists = db.get('subcategories').find({ id: parseInt(id) }).value();
                if (!exists) return res.status(404).json({ error: 'الصنف غير موجود' });

                db.get('subcategories')
                    .find({ id: parseInt(id) })
                    .assign({ label, name, category_id: parseInt(category_id), icon: subIcon })
                    .write();
                return res.json({ message: 'تم التحديث بنجاح' });
            } else {
                const newSub = {
                    id: nextId('subcategories'),
                    category_id: parseInt(category_id),
                    name,
                    label,
                    icon: subIcon
                };
                db.get('subcategories').push(newSub).write();
                return res.json({ message: 'تمت الإضافة بنجاح', subcategory: newSub });
            }
        }
    } catch (err) {
        console.error('Subcategories POST error:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء حفظ الصنف' });
    }
});

// DELETE /api/categories/subcategory/:id (Delete Subcategory + its item types)
router.delete('/subcategory/:id', verifyAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        if (isMongo()) {
            await models.ItemType.deleteMany({ subcategory_id: id });
            await models.Subcategory.deleteOne({ id });
            return res.json({ message: 'تم الحذف بنجاح' });
        } else {
            db.read();
            db.get('item_types').remove({ subcategory_id: id }).write();
            db.get('subcategories').remove({ id }).write();
            return res.json({ message: 'تم الحذف بنجاح' });
        }
    } catch (err) {
        console.error('Subcategories DELETE error:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء حذف الصنف' });
    }
});

// POST /api/categories/item-type (Create or Update Level 3: Item Type / Sub-branch)
router.post('/item-type', verifyAdmin, async (req, res) => {
    try {
        const { id, category_id, subcategory_id, label } = req.body;
        if (!label || !subcategory_id) return res.status(400).json({ error: 'الاسم والصنف الثانوي مطلوبان' });

        const name = label.replace(/\s+/g, '-').toLowerCase();
        const catId = category_id ? parseInt(category_id) : null;
        const subId = parseInt(subcategory_id);

        if (isMongo()) {
            if (id) {
                const updated = await models.ItemType.findOneAndUpdate(
                    { id: parseInt(id) },
                    { label, name, category_id: catId, subcategory_id: subId },
                    { new: true }
                ).lean();
                if (!updated) return res.status(404).json({ error: 'النوع الفرعي غير موجود' });
                return res.json({ message: 'تم التحديث بنجاح', item_type: updated });
            } else {
                const newId = await getNextSequence('item_types');
                const newType = await models.ItemType.create({
                    id: newId,
                    category_id: catId,
                    subcategory_id: subId,
                    name,
                    label
                });
                return res.json({ message: 'تمت الإضافة بنجاح', item_type: newType });
            }
        } else {
            db.read();
            if (id) {
                const exists = db.get('item_types').find({ id: parseInt(id) }).value();
                if (!exists) return res.status(404).json({ error: 'النوع الفرعي غير موجود' });

                db.get('item_types')
                    .find({ id: parseInt(id) })
                    .assign({ label, name, category_id: catId, subcategory_id: subId })
                    .write();
                return res.json({ message: 'تم التحديث بنجاح' });
            } else {
                const newType = {
                    id: nextId('item_types'),
                    category_id: catId,
                    subcategory_id: subId,
                    name,
                    label
                };
                db.get('item_types').push(newType).write();
                return res.json({ message: 'تمت الإضافة بنجاح', item_type: newType });
            }
        }
    } catch (err) {
        console.error('ItemTypes POST error:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء حفظ النوع الفرعي' });
    }
});

// DELETE /api/categories/item-type/:id (Delete Level 3 item type)
router.delete('/item-type/:id', verifyAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        if (isMongo()) {
            await models.ItemType.deleteOne({ id });
            return res.json({ message: 'تم الحذف بنجاح' });
        } else {
            db.read();
            db.get('item_types').remove({ id }).write();
            return res.json({ message: 'تم الحذف بنجاح' });
        }
    } catch (err) {
        console.error('ItemType DELETE error:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء حذف النوع الفرعي' });
    }
});

module.exports = router;
