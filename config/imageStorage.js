const isImgbbConfigured = () => {
    return !!process.env.IMGBB_API_KEY;
};

const uploadToImgBB = async (fileBuffer, originalName = 'image.jpg') => {
    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) {
        throw new Error('IMGBB_API_KEY is not configured in .env');
    }

    const blob = new Blob([fileBuffer]);
    const formData = new FormData();
    formData.append('image', blob, originalName);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        body: formData
    });

    const result = await response.json();
    if (result && result.success && result.data && result.data.url) {
        return result.data.url;
    }

    throw new Error(result.error?.message || 'ImgBB upload failed');
};

module.exports = {
    isImgbbConfigured,
    uploadToImgBB
};
