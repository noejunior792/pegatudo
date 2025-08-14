function getFileType(url) {
    try {
        const urlObject = new URL(url);
        const extension = urlObject.pathname.split('.').pop().toLowerCase();
        if (extension && extension.length < 8) {
            return extension.split('?')[0];
        }
        return 'unknown';
    }
    catch (e) {
        return 'unknown';
    }
}
function getFileName(url) {
    try {
        const urlObject = new URL(url);
        const pathname = urlObject.pathname;
        const decodedPathname = decodeURIComponent(pathname);
        return decodedPathname.substring(decodedPathname.lastIndexOf('/') + 1) || `media_${Date.now()}`;
    }
    catch (e) {
        return `media_${Date.now()}`;
    }
}
async function dataURLToBlob(dataURL) {
    const response = await fetch(dataURL);
    return await response.blob();
}
