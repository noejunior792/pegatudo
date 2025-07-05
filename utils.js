async function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function dataURLToBlob(dataURL) {
    const res = await fetch(dataURL);
    return await res.blob();
}

async function blobToArrayBuffer(blob) {
    return await blob.arrayBuffer();
}

function arrayBufferToBlob(buffer, type) {
    return new Blob([buffer], { type });
}

function getFileExtension(mimeType) {
    const mimeMap = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'video/mp4': 'mp4',
        'video/webm': 'webm',
        'video/ogg': 'ogv',
        'audio/mpeg': 'mp3',
        'audio/ogg': 'ogg',
        'audio/wav': 'wav',
        'application/pdf': 'pdf',
    };
    return mimeMap[mimeType] || 'bin';
}