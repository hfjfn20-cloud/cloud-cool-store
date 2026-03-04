const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database');

const JWT_SECRET = 'cloud_cool_secret_2024';

// POST /api/auth/login
router.post('/login', (req, res) => {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'كلمة المرور مطلوبة' });

    const admin = db.get('admins').find({ username: 'admin' }).value();
    if (!admin) return res.status(401).json({ error: 'خطأ في بيانات الدخول' });

    const isValid = bcrypt.compareSync(password, admin.password);
    if (!isValid) return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });

    const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, message: 'تم تسجيل الدخول بنجاح' });
});

function verifyAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'غير مصرح' });
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.admin = decoded;
        next();
    } catch {
        return res.status(401).json({ error: 'جلسة منتهية، أعد تسجيل الدخول' });
    }
}

module.exports = router;
module.exports.verifyAdmin = verifyAdmin;
