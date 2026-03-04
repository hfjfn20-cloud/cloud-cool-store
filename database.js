const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const bcrypt = require('bcryptjs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const adapter = new FileSync(path.join(__dirname, 'db.json'));
const db = low(adapter);

function initializeDatabase() {
  // Set defaults
  db.defaults({
    admins: [],
    categories: [],
    subcategories: [],
    products: [],
    orders: [],
    order_items: [],
    _counters: { products: 0, orders: 0, order_items: 0 }
  }).write();

  // Seed admin
  if (!db.get('admins').find({ username: 'admin' }).value()) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.get('admins').push({ id: 1, username: 'admin', password: hashedPassword }).write();
  }

  // Seed categories
  if (db.get('categories').value().length === 0) {
    db.get('categories').push(
      { id: 1, name: 'boys', label: 'ولادي' },
      { id: 2, name: 'girls', label: 'بناتي' }
    ).write();

    db.get('subcategories').push(
      // Boys
      { id: 1, category_id: 1, name: 'tshirt', label: 'تيشيرت' },
      { id: 2, category_id: 1, name: 'jeans', label: 'جينز' },
      { id: 3, category_id: 1, name: 'shorts', label: 'شورت' },
      { id: 4, category_id: 1, name: 'suit', label: 'بدلة' },
      { id: 5, category_id: 1, name: 'overall', label: 'أوفر' },
      { id: 6, category_id: 1, name: 'pants', label: 'بنطلون' },
      // Girls
      { id: 7, category_id: 2, name: 'dress', label: 'فستان' },
      { id: 8, category_id: 2, name: 'skirt', label: 'تنورة' },
      { id: 9, category_id: 2, name: 'blouse', label: 'بلوز' },
      { id: 10, category_id: 2, name: 'jeans', label: 'جينز' },
      { id: 11, category_id: 2, name: 'suit', label: 'بدلة' },
      { id: 12, category_id: 2, name: 'overall', label: 'أوفر' }
    ).write();
  }

  console.log('✅ Database initialized successfully');
}

// Helper: auto-increment IDs
function nextId(collection) {
  const items = db.get(collection).value();
  if (!items.length) return 1;
  return Math.max(...items.map(i => i.id || 0)) + 1;
}

module.exports = { db, initializeDatabase, nextId };
