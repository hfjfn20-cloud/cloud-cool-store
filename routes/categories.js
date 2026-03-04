const express = require('express');
const router = express.Router();
const { db } = require('../database');

// GET /api/categories
router.get('/', (req, res) => {
    const categories = db.get('categories').value();
    const subcategories = db.get('subcategories').value();

    const result = categories.map(cat => ({
        ...cat,
        subcategories: subcategories.filter(sub => sub.category_id === cat.id)
    }));

    res.json(result);
});

module.exports = router;
