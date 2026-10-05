const cloudinary = require('cloudinary').v2;

const isCloudinaryConfigured = () => {
    return !!(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );
};

function setupCloudinary() {
    if (isCloudinaryConfigured()) {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET
        });
        console.log('☁️ Cloudinary configured successfully');
    } else {
        console.log('ℹ️ Cloudinary is not configured yet. Set CLOUDINARY_* in .env to enable cloud image uploads.');
    }
}

setupCloudinary();

const uploadToCloudinary = (fileBuffer, originalName = '') => {
    return new Promise((resolve, reject) => {
        if (!isCloudinaryConfigured()) {
            return reject(new Error('Cloudinary credentials are not configured in .env'));
        }

        const stream = cloudinary.uploader.upload_stream(
            {
                folder: 'cloud_cool_store',
                resource_type: 'image'
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result.secure_url);
            }
        );

        stream.end(fileBuffer);
    });
};

module.exports = { cloudinary, isCloudinaryConfigured, uploadToCloudinary, setupCloudinary };
