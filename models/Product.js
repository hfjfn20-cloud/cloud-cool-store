const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true },
    image: { type: String, default: null },
    category_id: { type: Number, default: null },
    subcategory_id: { type: Number, default: null },
    item_type_id: { type: Number, default: null },
    is_new: { type: Boolean, default: false },
    is_offer: { type: Boolean, default: false },
    discount_percent: { type: Number, default: 0 },
    is_low_stock: { type: Boolean, default: false },
    stock_qty: { type: Number, default: 10 },
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', productSchema);
