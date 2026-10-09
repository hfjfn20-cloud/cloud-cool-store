const express = require('express');
const router = express.Router();
const { db, nextId, isMongo, models, getNextSequence } = require('../database');
const { verifyAdmin } = require('./auth');

// POST /api/orders - Place a new order
router.post('/', async (req, res) => {
    try {
        const { customer_name, customer_address, customer_phone, items } = req.body;
        if (!customer_name || !customer_phone || !items || !items.length) {
            return res.status(400).json({ error: 'بيانات الطلب غير مكتملة' });
        }

        let total = 0;
        const enrichedItems = [];

        for (const item of items) {
            let product;
            if (isMongo()) {
                product = await models.Product.findOne({ id: item.product_id }).lean();
            } else {
                product = db.get('products').find({ id: item.product_id }).value();
            }

            if (!product) continue;
            const price = product.is_offer && product.discount_percent > 0
                ? Math.round(product.price * (1 - product.discount_percent / 100))
                : product.price;

            const qty = parseInt(item.quantity) || 1;
            total += price * qty;
            enrichedItems.push({
                product_id: item.product_id,
                product_name: product.name,
                product_price: price,
                quantity: qty
            });
        }

        const orderData = {
            customer_name,
            customer_address: customer_address || '',
            customer_phone,
            total,
            status: 'جديد',
            items: enrichedItems,
            created_at: new Date()
        };

        if (isMongo()) {
            const orderId = await getNextSequence('orders');
            const order = await models.Order.create({ id: orderId, ...orderData });
            return res.status(201).json({
                ...order.toObject(),
                message: 'تم إرسال طلبك بنجاح، سيتم التواصل معك عبر الواتساب قريباً.'
            });
        } else {
            const orderId = nextId('orders');
            const order = { id: orderId, ...orderData, created_at: orderData.created_at.toISOString() };
            db.get('orders').push(order).write();

            for (const item of enrichedItems) {
                const itemId = nextId('order_items');
                db.get('order_items').push({ id: itemId, order_id: orderId, ...item }).write();
            }

            return res.status(201).json({
                ...order,
                message: 'تم إرسال طلبك بنجاح، سيتم التواصل معك عبر الواتساب قريباً.'
            });
        }
    } catch (err) {
        console.error('Orders POST error:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء حفظ الطلب' });
    }
});

// GET /api/orders/stats (admin only)
router.get('/stats', verifyAdmin, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (isMongo()) {
            const totalOrders = await models.Order.countDocuments();
            const newOrders = await models.Order.countDocuments({ status: 'جديد' });
            const totalProducts = await models.Product.countDocuments();
            const todayOrders = await models.Order.countDocuments({ created_at: { $gte: today } });

            return res.json({ totalOrders, newOrders, totalProducts, todayOrders });
        } else {
            const totalOrders = db.get('orders').value().length;
            const newOrders = db.get('orders').filter({ status: 'جديد' }).value().length;
            const totalProducts = db.get('products').value().length;
            const todayStr = new Date().toISOString().split('T')[0];
            const todayOrders = db.get('orders').filter(o => o.created_at && o.created_at.startsWith(todayStr)).value().length;

            return res.json({ totalOrders, newOrders, totalProducts, todayOrders });
        }
    } catch (err) {
        console.error('Orders stats error:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب الإحصائيات' });
    }
});

// GET /api/orders (admin only)
router.get('/', verifyAdmin, async (req, res) => {
    try {
        if (isMongo()) {
            const orders = await models.Order.find().sort({ id: -1 }).lean();
            return res.json(orders);
        } else {
            const orders = db.get('orders').value().slice().reverse();
            const ordersWithItems = orders.map(order => {
                const items = db.get('order_items').filter({ order_id: order.id }).value();
                return { ...order, items };
            });
            return res.json(ordersWithItems);
        }
    } catch (err) {
        console.error('Orders GET error:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب الطلبات' });
    }
});

// PUT /api/orders/:id/status (admin only)
router.put('/:id/status', verifyAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { status } = req.body;
        const validStatuses = ['جديد', 'قيد المعالجة', 'تم الشحن', 'تم التسليم', 'ملغى'];
        if (!validStatuses.includes(status)) return res.status(400).json({ error: 'حالة غير صالحة' });

        if (isMongo()) {
            const updated = await models.Order.findOneAndUpdate({ id }, { status }, { new: true }).lean();
            if (!updated) return res.status(404).json({ error: 'الطلب غير موجود' });
            return res.json(updated);
        } else {
            const order = db.get('orders').find({ id }).value();
            if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });

            db.get('orders').find({ id }).assign({ status }).write();
            return res.json(db.get('orders').find({ id }).value());
        }
    } catch (err) {
        console.error('Order status PUT error:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء تحديث حالة الطلب' });
    }
});

// DELETE /api/orders/:id (admin only)
router.delete('/:id', verifyAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isMongo()) {
            const deleted = await models.Order.findOneAndDelete({ id });
            if (!deleted) return res.status(404).json({ error: 'الطلب غير موجود' });
            return res.json({ message: 'تم حذف الطلب بنجاح' });
        } else {
            const order = db.get('orders').find({ id }).value();
            if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
            db.get('orders').remove({ id }).write();
            db.get('order_items').remove({ order_id: id }).write();
            return res.json({ message: 'تم حذف الطلب بنجاح' });
        }
    } catch (err) {
        console.error('Order DELETE error:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء حذف الطلب' });
    }
});

module.exports = router;
