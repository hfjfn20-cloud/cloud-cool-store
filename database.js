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
const Product = require('./models/Product');
const Order = require('./models/Order');
const Banner = require('./models/Banner');
const { Counter, getNextSequence } = require('./models/Counter');

// Lowdb fallback
const adapter = new FileSync(path.join(__dirname, 'db.json'));
const db = low(adapter);

let isMongoConnected = false;

function isMongo() {
    return isMongoConnected;
}

async function initializeDatabase() {
    const mongoUri = process.env.MONGODB_URI;
    // DEBUG: Log env variable status (will remove after fix)
    console.log('🔍 DEBUG — MONGODB_URI present:', !!mongoUri, '| length:', mongoUri ? mongoUri.length : 0);
    console.log('🔍 DEBUG — NODE_ENV:', process.env.NODE_ENV);

    if (mongoUri) {
        try {
            console.log('⏳ Connecting to MongoDB Atlas...');
            await mongoose.connect(mongoUri);
            isMongoConnected = true;
            console.log('✅ Connected to MongoDB Atlas successfully!');

            // Check if MongoDB is empty and we can auto-migrate from db.json
            const adminCount = await Admin.countDocuments();
            if (adminCount === 0) {
                console.log('📦 Empty MongoDB detected, auto-migrating initial data from db.json...');
                const migrate = require('./scripts/migrate');
                await migrate();
            }

            return;
        } catch (err) {
            console.error('⚠️ Could not connect to MongoDB Atlas:', err.message);
            console.log('🔄 Falling back to local db.json database.');
            isMongoConnected = false;
        }
    } else {
        console.log('ℹ️ MONGODB_URI not found in .env. Using local db.json.');
        isMongoConnected = false;
    }

    // Lowdb initialization (fallback)
    db.defaults({
        admins: [],
        categories: [],
        subcategories: [],
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
            { id: 1, name: 'boys', label: 'ولادي' },
            { id: 2, name: 'girls', label: 'بناتي' }
        ).write();

        db.get('subcategories').push(
            { id: 1, category_id: 1, name: 'tshirt', label: 'تيشيرت' },
            { id: 2, category_id: 1, name: 'jeans', label: 'جينز' },
            { id: 3, category_id: 1, name: 'shorts', label: 'شورت' },
            { id: 4, category_id: 1, name: 'suit', label: 'بدلة' },
            { id: 5, category_id: 1, name: 'overall', label: 'أوفر' },
            { id: 6, category_id: 1, name: 'pants', label: 'بنطلون' },
            { id: 7, category_id: 2, name: 'dress', label: 'فستان' },
            { id: 8, category_id: 2, name: 'skirt', label: 'تنورة' },
            { id: 9, category_id: 2, name: 'blouse', label: 'بلوز' },
            { id: 10, category_id: 2, name: 'jeans', label: 'جينز' },
            { id: 11, category_id: 2, name: 'suit', label: 'بدلة' },
            { id: 12, category_id: 2, name: 'overall', label: 'أوفر' }
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
    getNextSequence,
    models: {
        Admin,
        Category,
        Subcategory,
        Product,
        Order,
        Banner,
        Counter
    }
};
