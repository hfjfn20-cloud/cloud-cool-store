require('dotenv').config();
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const bcrypt = require('bcryptjs');
const path = require('path');
const mongoose = require('mongoose');
const dns = require('dns');

// Force Node.js to use Google Public DNS for SRV record resolution
// (Fixes ECONNREFUSED on routers that block SRV lookups)
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

// Mongoose Models
const Admin = require('./models/Admin');
const Category = require('./models/Category');
const Subcategory = require('./models/Subcategory');
const ItemType = require('./models/ItemType');
const Product = require('./models/Product');
const Order = require('./models/Order');
const Banner = require('./models/Banner');
const { Counter, getNextSequence } = require('./models/Counter');

// Lowdb fallback
const adapter = new FileSync(path.join(__dirname, 'db.json'));
const db = low(adapter);

let isMongoConnected = false;
let lastMongoError = null;

function isMongo() {
    return isMongoConnected;
}

function getMongoError() {
    return lastMongoError;
}

async function initializeDatabase() {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    console.log('🔍 MONGO_URI active:', !!mongoUri, '| NODE_ENV:', process.env.NODE_ENV);

    const connectOptions = {
        serverSelectionTimeoutMS: 8000,
        dbName: 'cloud_cool_store'
    };

    if (mongoUri) {
        try {
            console.log('⏳ Connecting to MongoDB Atlas...');
            await mongoose.connect(mongoUri, connectOptions);
            isMongoConnected = true;
            lastMongoError = null;
            console.log('✅ Connected to MongoDB Atlas successfully!');
            return;
        } catch (err) {
            console.error('⚠️ Could not connect to MongoDB Atlas:', err.message);
            console.log('🔄 Falling back to local db.json database.');
            isMongoConnected = false;
            lastMongoError = err.message;

            // Start background retry every 30 seconds
            console.log('🔁 Starting background MongoDB retry every 30 seconds...');
            const retryInterval = setInterval(async () => {
                if (isMongoConnected) {
                    clearInterval(retryInterval);
                    return;
                }
                try {
                    console.log('🔁 Retrying MongoDB Atlas connection...');
                    if (mongoose.connection.readyState === 0) {
                        await mongoose.connect(mongoUri, connectOptions);
                    }
                    isMongoConnected = true;
                    lastMongoError = null;
                    console.log('✅ MongoDB Atlas reconnected successfully via retry!');
                    clearInterval(retryInterval);
                } catch (retryErr) {
                    console.log('⚠️ Retry failed:', retryErr.message);
                    lastMongoError = retryErr.message;
                }
            }, 30000);
        }
    } else {
        console.log('ℹ️ MONGO_URI not found in .env. Using local db.json.');
        isMongoConnected = false;
        lastMongoError = 'MONGO_URI not provided';
    }

    // Lowdb initialization (fallback)
    db.defaults({
        admins: [],
        categories: [],
        subcategories: [],
        item_types: [],
        products: [],
        orders: [],
        order_items: [],
        banners: [],
        _counters: { products: 0, orders: 0, order_items: 0, banners: 0 }
    }).write();

    if (!db.get('admins').find({ username: 'admin' }).value()) {
        const hashedPassword = bcrypt.hashSync('admin123', 10);
        db.get('admins').push({ id: 1, username: 'admin', password: hashedPassword }).write();
    }

    if (db.get('categories').value().length === 0) {
        db.get('categories').push(
            { id: 1, name: 'clothes', label: 'ملابس', icon: '👕' },
            { id: 2, name: 'stationery', label: 'قرطاسية', icon: '✏️' },
            { id: 3, name: 'toys', label: 'ألعاب', icon: '🧸' },
            { id: 4, name: 'accessories', label: 'إكسسوارات', icon: '🎀' }
        ).write();

        db.get('subcategories').push(
            // ملابس - ولادي
            { id: 101, category_id: 1, gender: 'boys', name: 'boys-track', label: 'تراك ولادي' },
            { id: 102, category_id: 1, gender: 'boys', name: 'boys-shorts', label: 'شورت ولادي' },
            { id: 103, category_id: 1, gender: 'boys', name: 'boys-tshirt', label: 'تيشيرت ولادي' },
            { id: 104, category_id: 1, gender: 'boys', name: 'boys-jeans', label: 'جينز ولادي' },
            { id: 105, category_id: 1, gender: 'boys', name: 'boys-suit', label: 'بدلة ولادي' },
            { id: 106, category_id: 1, gender: 'boys', name: 'boys-pants', label: 'بنطلون ولادي' },
            { id: 107, category_id: 1, gender: 'boys', name: 'boys-overall', label: 'أوفر ولادي' },
            // ملابس - بناتي
            { id: 201, category_id: 1, gender: 'girls', name: 'girls-dress', label: 'فستان بناتي' },
            { id: 202, category_id: 1, gender: 'girls', name: 'girls-skirt', label: 'تنورة بناتي' },
            { id: 203, category_id: 1, gender: 'girls', name: 'girls-blouse', label: 'بلوز بناتي' },
            { id: 204, category_id: 1, gender: 'girls', name: 'girls-track', label: 'تراك بناتي' },
            { id: 205, category_id: 1, gender: 'girls', name: 'girls-shorts', label: 'شورت بناتي' },
            { id: 206, category_id: 1, gender: 'girls', name: 'girls-suit', label: 'بدلة بناتي' },
            { id: 207, category_id: 1, gender: 'girls', name: 'girls-jeans', label: 'جينز بناتي' },
            { id: 208, category_id: 1, gender: 'girls', name: 'girls-overall', label: 'أوفر بناتي' },
            // قرطاسية
            { id: 301, category_id: 2, name: 'notebooks', label: 'دفاتر وكشاكيل' },
            { id: 302, category_id: 2, name: 'pens', label: 'أقلام وألوان' },
            { id: 303, category_id: 2, name: 'school-bags', label: 'حقائب مدرسية' },
            { id: 304, category_id: 2, name: 'drawing', label: 'أدوات رسم' },
            // ألعاب
            { id: 401, category_id: 3, name: 'cars', label: 'سيارات ومجسمات' },
            { id: 402, category_id: 3, name: 'dolls', label: 'عرائس ودمى' },
            { id: 403, category_id: 3, name: 'educational', label: 'ألعاب ذكاء وتعليمية' },
            { id: 404, category_id: 3, name: 'puzzle', label: 'تركيب وبازل' },
            // إكسسوارات
            { id: 501, category_id: 4, name: 'watches', label: 'ساعات' },
            { id: 502, category_id: 4, name: 'glasses', label: 'نظارات' },
            { id: 503, category_id: 4, name: 'hats', label: 'قبعات' },
            { id: 504, category_id: 4, name: 'bags', label: 'حقائب ومحافظ' },
            { id: 505, category_id: 4, name: 'hair', label: 'إكسسوارات شعر' }
        ).write();
    }

    console.log('✅ Local db.json initialized successfully');
}

function nextId(collection) {
    const items = db.get(collection).value();
    if (!items.length) return 1;
    return Math.max(...items.map(i => i.id || 0)) + 1;
}

module.exports = {
    db,
    initializeDatabase,
    nextId,
    isMongo,
    getMongoError,
    getNextSequence,
    models: {
        Admin,
        Category,
        Subcategory,
        ItemType,
        Product,
        Order,
        Banner,
        Counter
    }
};
