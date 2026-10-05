const mongoose = require('mongoose');

const subcategorySchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    category_id: { type: Number, required: true },
    name: { type: String, required: true },
    label: { type: String, required: true }
});

module.exports = mongoose.model('Subcategory', subcategorySchema);
