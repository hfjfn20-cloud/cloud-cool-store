const mongoose = require('mongoose');

const itemTypeSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    category_id: { type: Number, required: true },
    subcategory_id: { type: Number, required: true },
    name: { type: String, required: true },
    label: { type: String, required: true }
});

module.exports = mongoose.model('ItemType', itemTypeSchema);
