require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initializeDatabase, isMongo, getMongoError } = require('./database');
const { isImgbbConfigured, isCloudinaryConfigured } = require('./config/imageStorage');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure local uploads directory exists (used as fallback)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/banners', require('./routes/banners'));
app.use('/api/backup', require('./routes/backup'));

// Health & Status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        database: isMongo() ? 'MongoDB Atlas (Cloud)' : 'Local db.json (Fallback)',
        mongoError: getMongoError(),
        version: 'v2.2-atlas-check',
        storage: isCloudinaryConfigured()
            ? 'Cloudinary (Cloud CDN)'
            : (isImgbbConfigured() ? 'ImgBB Cloud CDN' : 'Database Direct / Base64')
    });
});

// Catch-all for SPA
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Self-ping to keep Render free tier alive (prevents 15-min sleep)
function startKeepAlive() {
    const siteUrl = process.env.RENDER_EXTERNAL_URL || process.env.SITE_URL;
    if (!siteUrl) return; // Only runs in production (Render sets RENDER_EXTERNAL_URL)

    const pingUrl = `${siteUrl}/api/status`;
    console.log(`🔁 Keep-alive started — pinging ${pingUrl} every 25s`);

    setInterval(async () => {
        try {
            await fetch(pingUrl);
        } catch (e) {
            // Silently ignore ping errors
        }
    }, 25 * 1000); // every 25 seconds
}

// Start Server
async function startServer() {
    await initializeDatabase();

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n======================================================`);
        console.log(`🚀 Baby Moon Store running at http://localhost:${PORT}`);
        console.log(`📊 Database: ${isMongo() ? '🟢 MongoDB Atlas (Cloud)' : '🟡 Local db.json (Add MONGO_URI to .env)'}`);
        console.log(`☁️ Images:   ${isImgbbConfigured() ? '🟢 ImgBB Cloud CDN (Active)' : '🟡 Local /uploads (Add IMGBB_API_KEY to .env)'}`);
        console.log(`======================================================\n`);

        // Start keep-alive after server is ready
        startKeepAlive();
    });
}

startServer();
