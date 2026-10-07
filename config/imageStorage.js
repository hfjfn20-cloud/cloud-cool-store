const path = require('path');
const fs = require('fs');

const isImgbbConfigured = () => {
    return !!process.env.IMGBB_API_KEY;
};

const uploadToImgBB = async (fileBuffer, originalName = 'image.jpg') => {
    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) {
        throw new Error('IMGBB_API_KEY is not configured in .env');
    }

    const params = new URLSearchParams();
    params.append('image', fileBuffer.toString('base64'));

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        body: params,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
    });

    const result = await response.json();
    if (result && result.success && result.data && result.data.url) {
        return result.data.url;
    }

    throw new Error(result?.error?.message || result?.status_txt || 'ImgBB upload failed');
};

async function handleImageUpload(file, manualUrl = '', prefix = 'img') {
    if (!file) return manualUrl || '';

    if (isImgbbConfigured()) {
        try {
            console.log(`☁️ Uploading ${prefix} image to ImgBB Cloud...`);
            const cloudUrl = await uploadToImgBB(file.buffer, file.originalname);
            console.log(`✅ ${prefix} image uploaded to ImgBB successfully:`, cloudUrl);
            return cloudUrl;
        } catch (err) {
            console.error(`❌ ImgBB upload failed for ${prefix}:`, err.message);
            console.log('🔄 Falling back to local disk storage...');
        }
    }

    // Local uploads directory fallback
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const ext = path.extname(file.originalname || '') || '.jpg';
    const filename = `${prefix}_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
    const filePath = path.join(uploadsDir, filename);

    fs.writeFileSync(filePath, file.buffer);
    console.log(`📁 Saved ${prefix} image locally:`, filename);
    return `/uploads/${filename}`;
}

module.exports = {
    isImgbbConfigured,
    uploadToImgBB,
    handleImageUpload
};
