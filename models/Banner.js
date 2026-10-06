const mongoose = require('mongoose');

const BannerSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    // link_type: 'new' | 'offers' | 'lowstock' | 'category' | 'all'
    link_type: { type: String, default: 'all' },
    link_value: { type: String, default: '' }, // category name if link_type=category
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Banner', BannerSchema);
