require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initializeDatabase, isMongo } = require('./database');
const { isImgbbConfigured } = require('./config/imageStorage');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure local uploads directory exists (used as fallback)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/orders', require('./routes/orders'));

// Health & Status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        database: isMongo() ? 'MongoDB Atlas (Cloud)' : 'Local db.json (Fallback)',
        storage: isImgbbConfigured() ? 'ImgBB Cloud CDN (Ready)' : 'Local /uploads (Fallback)'
    });
});

// Catch-all for SPA
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
async function startServer() {
    await initializeDatabase();

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n======================================================`);
        console.log(`🚀 Cloud Cool Store running at http://localhost:${PORT}`);
        console.log(`📊 Database: ${isMongo() ? '🟢 MongoDB Atlas (Cloud)' : '🟡 Local db.json (Add MONGODB_URI to .env)'}`);
        console.log(`☁️ Images:   ${isImgbbConfigured() ? '🟢 ImgBB Cloud CDN (Active)' : '🟡 Local /uploads (Add IMGBB_API_KEY to .env)'}`);
        console.log(`======================================================\n`);
    });
}

startServer();
