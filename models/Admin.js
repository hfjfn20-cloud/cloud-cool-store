const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

module.exports = mongoose.model('Admin', adminSchema);
