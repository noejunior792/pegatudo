function getFileType(url) {
  try {
    const urlObject = new URL(url);
    const extension = urlObject.pathname.split('.').pop().toLowerCase();
    // Limita o tamanho da extensão para evitar strings muito longas
    if (extension && extension.length < 8) {
      return extension.split('?')[0]; // Remove query params
    }
    return 'unknown';
  } catch (e) {
    return 'unknown';
  }
}

function getFileName(url) {
  try {
    const urlObject = new URL(url);
    const pathname = urlObject.pathname;
    // Decodifica o nome do arquivo
    const decodedPathname = decodeURIComponent(pathname);
    return decodedPathname.substring(decodedPathname.lastIndexOf('/') + 1) || `media_${Date.now()}`;
  } catch (e) {
    return `media_${Date.now()}`;
  }
}

// Converte data URLs para Blob (se necessário no futuro)
async function dataURLToBlob(dataURL) {
    const response = await fetch(dataURL);
    return await response.blob();
}
