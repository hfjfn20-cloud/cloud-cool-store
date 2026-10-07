/**
 * imageStorage.js — Centralized robust image upload handler
 * Priority:
 *   1) Cloudinary (Cloud CDN — permanent, high performance)
 *   2) ImgBB (Free Cloud CDN)
 *   3) Database Data URL (Base64 — permanent, works everywhere, no disk loss on Render restarts)
 *   4) Local /uploads (fallback for very large files)
 */

const path = require('path');
const fs = require('fs');
const cloudinaryLib = require('cloudinary').v2;

// ─── Cloudinary ───────────────────────────────────────────────────────────────
const isCloudinaryConfigured = () => !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured()) {
    cloudinaryLib.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    console.log('☁️ Cloudinary configured — permanent cloud storage ready.');
} else {
    console.warn('ℹ️ Cloudinary not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET for cloud storage.');
}

const uploadToCloudinary = (fileBuffer, prefix = 'store') => {
    return new Promise((resolve, reject) => {
        if (!isCloudinaryConfigured()) return reject(new Error('Cloudinary not configured'));

        const timeout = setTimeout(() => {
            reject(new Error('Cloudinary upload timed out after 10s'));
        }, 10000);

        const stream = cloudinaryLib.uploader.upload_stream(
            {
                folder: `babymoon_store/${prefix}`,
                resource_type: 'image',
                quality: 'auto',
                fetch_format: 'auto'
            },
            (error, result) => {
                clearTimeout(timeout);
                if (error) return reject(error);
                resolve(result.secure_url);
            }
        );
        stream.end(fileBuffer);
    });
};

// ─── ImgBB ────────────────────────────────────────────────────────────────────
const isImgbbConfigured = () => !!process.env.IMGBB_API_KEY;

const uploadToImgBB = async (fileBuffer, originalName = 'image.jpg') => {
    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) throw new Error('IMGBB_API_KEY not configured');

    const params = new URLSearchParams();
    params.append('image', fileBuffer.toString('base64'));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
            method: 'POST',
            body: params,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            },
            signal: controller.signal
        });
        clearTimeout(timeout);

        const result = await response.json();
        if (result?.success && result?.data?.url) return result.data.url;
        throw new Error(result?.error?.message || result?.status_txt || 'ImgBB upload failed');
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
};

// ─── Main handler ─────────────────────────────────────────────────────────────
async function handleImageUpload(file, manualUrl = '', prefix = 'img') {
    if (!file) return manualUrl || '';

    // 1) Cloudinary
    if (isCloudinaryConfigured()) {
        try {
            console.log(`☁️ [Cloudinary] Uploading ${prefix} image...`);
            const url = await uploadToCloudinary(file.buffer, prefix);
            console.log(`✅ [Cloudinary] Uploaded successfully: ${url}`);
            return url;
        } catch (err) {
            console.warn(`⚠️ [Cloudinary] Failed: ${err.message}`);
        }
    }

    // 2) ImgBB
    if (isImgbbConfigured()) {
        try {
            console.log(`☁️ [ImgBB] Uploading ${prefix} image...`);
            const url = await uploadToImgBB(file.buffer, file.originalname);
            console.log(`✅ [ImgBB] Uploaded successfully: ${url}`);
            return url;
        } catch (err) {
            console.warn(`⚠️ [ImgBB] Failed or timed out: ${err.message}`);
        }
    }

    // 3) Permanent Data URL (Base64 saved directly in database)
    // Works across ALL devices, ALL networks, and persists across Render restarts!
    if (file.buffer && file.buffer.length <= 4 * 1024 * 1024) {
        const mime = file.mimetype || 'image/jpeg';
        const dataUrl = `data:${mime};base64,${file.buffer.toString('base64')}`;
        console.log(`💾 [Database-Storage] Saved ${prefix} as permanent Data URL in database (${Math.round(file.buffer.length / 1024)} KB)`);

        // Also save a copy locally
        try {
            const uploadsDir = path.join(__dirname, '../uploads');
            if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
            const ext = path.extname(file.originalname || '') || '.jpg';
            const filename = `${prefix}_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
            fs.writeFileSync(path.join(uploadsDir, filename), file.buffer);
        } catch (_) {}

        return dataUrl;
    }

    // 4) Local disk fallback for very large files > 4MB
    console.warn(`⚠️ [LOCAL] Saving large ${prefix} image to disk:`);
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const ext = path.extname(file.originalname || '') || '.jpg';
    const filename = `${prefix}_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, file.buffer);
    console.log(`📁 [LOCAL] Saved: ${filename}`);
    return `/uploads/${filename}`;
}

module.exports = {
    isCloudinaryConfigured,
    isImgbbConfigured,
    uploadToCloudinary,
    uploadToImgBB,
    handleImageUpload,
};
