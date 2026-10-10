require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const Admin = require('../models/Admin');
const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { Counter } = require('../models/Counter');

async function migrate() {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error('❌ MONGO_URI is not set in .env');
        return false;
    }

    const dbJsonPath = path.join(__dirname, '../db.json');
    if (!fs.existsSync(dbJsonPath)) {
        console.error('❌ db.json not found');
        return false;
    }

    const rawData = fs.readFileSync(dbJsonPath, 'utf8');
    const localDb = JSON.parse(rawData);

    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB Atlas.');

    // Migrate Admins
    if (localDb.admins && localDb.admins.length) {
        for (const admin of localDb.admins) {
            await Admin.findOneAndUpdate({ id: admin.id }, admin, { upsert: true });
        }
        console.log(`✅ Migrated ${localDb.admins.length} admin(s)`);
    }

    // Migrate Categories
    if (localDb.categories && localDb.categories.length) {
        for (const cat of localDb.categories) {
            await Category.findOneAndUpdate({ id: cat.id }, cat, { upsert: true });
        }
        console.log(`✅ Migrated ${localDb.categories.length} categories`);
        const maxCatId = Math.max(...localDb.categories.map(c => c.id || 0), 0);
        await Counter.findByIdAndUpdate('categories', { seq: maxCatId }, { upsert: true });
    }

    // Migrate Subcategories
    if (localDb.subcategories && localDb.subcategories.length) {
        for (const sub of localDb.subcategories) {
            await Subcategory.findOneAndUpdate({ id: sub.id }, sub, { upsert: true });
        }
        console.log(`✅ Migrated ${localDb.subcategories.length} subcategories`);
        const maxSubId = Math.max(...localDb.subcategories.map(s => s.id || 0), 0);
        await Counter.findByIdAndUpdate('subcategories', { seq: maxSubId }, { upsert: true });
    }

    // Migrate Products
    if (localDb.products && localDb.products.length) {
        for (const p of localDb.products) {
            await Product.findOneAndUpdate({ id: p.id }, p, { upsert: true });
        }
        console.log(`✅ Migrated ${localDb.products.length} products`);
        const maxProdId = Math.max(...localDb.products.map(p => p.id || 0), 0);
        await Counter.findByIdAndUpdate('products', { seq: maxProdId }, { upsert: true });
    }

    // Migrate Orders
    if (localDb.orders && localDb.orders.length) {
        for (const o of localDb.orders) {
            const orderItems = (localDb.order_items || []).filter(item => item.order_id === o.id);
            const orderDoc = { ...o, items: orderItems };
            await Order.findOneAndUpdate({ id: o.id }, orderDoc, { upsert: true });
        }
        console.log(`✅ Migrated ${localDb.orders.length} orders`);
        const maxOrderId = Math.max(...localDb.orders.map(o => o.id || 0), 0);
        await Counter.findByIdAndUpdate('orders', { seq: maxOrderId }, { upsert: true });
    }

    console.log('🎉 All data migrated from db.json to MongoDB Atlas successfully!');
    return true;
}

if (require.main === module) {
    migrate().then(() => {
        mongoose.disconnect();
    }).catch(err => {
        console.error('Migration error:', err);
        process.exit(1);
    });
}

module.exports = migrate;
