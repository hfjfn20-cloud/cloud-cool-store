const express = require('express');
const router = express.Router();
const { db, nextId } = require('../database');
const { verifyAdmin } = require('./auth');

// POST /api/orders - Place a new order
router.post('/', (req, res) => {
    const { customer_name, customer_address, customer_phone, items } = req.body;
    if (!customer_name || !customer_phone || !items || !items.length) {
        return res.status(400).json({ error: 'بيانات الطلب غير مكتملة' });
    }

    let total = 0;
    const enrichedItems = [];

    for (const item of items) {
        const product = db.get('products').find({ id: item.product_id }).value();
        if (!product) continue;
        const price = product.is_offer && product.discount_percent > 0
            ? Math.round(product.price * (1 - product.discount_percent / 100))
            : product.price;
        total += price * item.quantity;
        enrichedItems.push({
            product_id: item.product_id,
            product_name: product.name,
            product_price: price,
            quantity: item.quantity
        });
    }

    const orderId = nextId('orders');
    const order = {
        id: orderId,
        customer_name,
        customer_address: customer_address || '',
        customer_phone,
        total,
        status: 'جديد',
        created_at: new Date().toISOString()
    };
    db.get('orders').push(order).write();

    // Save order items
    for (const item of enrichedItems) {
        const itemId = nextId('order_items');
        db.get('order_items').push({ id: itemId, order_id: orderId, ...item }).write();
    }

    res.status(201).json({
        ...order,
        items: enrichedItems,
        message: 'تم إرسال طلبك بنجاح، سيتم التواصل معك عبر الواتساب قريباً.'
    });
});

// GET /api/orders/stats (admin only)
router.get('/stats', verifyAdmin, (req, res) => {
    const totalOrders = db.get('orders').value().length;
    const newOrders = db.get('orders').filter({ status: 'جديد' }).value().length;
    const totalProducts = db.get('products').value().length;
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = db.get('orders').filter(o => o.created_at && o.created_at.startsWith(today)).value().length;
    res.json({ totalOrders, newOrders, totalProducts, todayOrders });
});

// GET /api/orders (admin only)
router.get('/', verifyAdmin, (req, res) => {
    const orders = db.get('orders').value().slice().reverse();
    const ordersWithItems = orders.map(order => {
        const items = db.get('order_items').filter({ order_id: order.id }).value();
        return { ...order, items };
    });
    res.json(ordersWithItems);
});

// PUT /api/orders/:id/status (admin only)
router.put('/:id/status', verifyAdmin, (req, res) => {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    const validStatuses = ['جديد', 'قيد المعالجة', 'تم الشحن', 'تم التسليم', 'ملغى'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'حالة غير صالحة' });

    const order = db.get('orders').find({ id }).value();
    if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });

    db.get('orders').find({ id }).assign({ status }).write();
    res.json(db.get('orders').find({ id }).value());
});

module.exports = router;
