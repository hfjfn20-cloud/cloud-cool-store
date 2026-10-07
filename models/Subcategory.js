const mongoose = require('mongoose');

const subcategorySchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    category_id: { type: Number, required: true },
    name: { type: String, required: true },
    label: { type: String, required: true },
    gender: { type: String, default: null } // 'boys', 'girls', or null
});

module.exports = mongoose.model('Subcategory', subcategorySchema);

