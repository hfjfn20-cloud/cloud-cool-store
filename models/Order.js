const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    id: { type: Number },
    product_id: { type: Number },
    product_name: { type: String },
    product_price: { type: Number },
    quantity: { type: Number }
}, { _id: false });

const orderSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    customer_name: { type: String, required: true },
    customer_address: { type: String, default: '' },
    customer_phone: { type: String, required: true },
    total: { type: Number, required: true },
    status: { type: String, default: 'جديد' },
    items: [orderItemSchema],
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);
