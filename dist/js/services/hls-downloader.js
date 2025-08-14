function notifyProgress(tabId, message) {
    chrome.runtime.sendMessage({ action: 'hlsProgress', message, tabId });
}
async function downloadHls(url, filename, tabId) {
    try {
        notifyProgress(tabId, `Iniciando download do stream: ${filename}`);
        const manifestUrl = new URL(url);
        const manifestResponse = await fetch(manifestUrl);
        const manifestText = await manifestResponse.text();
        const playlistLines = manifestText.split('\n');
        let playlistUrl = null;
        for (let i = playlistLines.length - 1; i >= 0; i--) {
            if (playlistLines[i].trim().endsWith('.m3u8')) {
                playlistUrl = new URL(playlistLines[i].trim(), manifestUrl).href;
                break;
            }
        }
        if (!playlistUrl) {
            playlistUrl = manifestUrl.href;
        }
        notifyProgress(tabId, 'Manifesto da playlist encontrado.');
        const mediaManifestUrl = new URL(playlistUrl);
        const mediaManifestResponse = await fetch(mediaManifestUrl);
        const mediaManifestText = await mediaManifestResponse.text();
        const mediaLines = mediaManifestText.split('\n');
        const segmentUrls = mediaLines
            .filter(line => line.trim().length > 0 && !line.startsWith('#'))
            .map(line => new URL(line.trim(), mediaManifestUrl).href);
        if (segmentUrls.length === 0) {
            throw new Error('Nenhum segmento de vídeo encontrado no manifesto.');
        }
        notifyProgress(tabId, `Encontrados ${segmentUrls.length} segmentos. Baixando...`);
        const totalSegments = segmentUrls.length;
        const segmentBlobs = [];
        let downloadedCount = 0;
        const promises = segmentUrls.map(segmentUrl => fetch(segmentUrl)
            .then(res => res.blob())
            .then(blob => {
            segmentBlobs.push(blob);
            downloadedCount++;
            const progress = Math.round((downloadedCount / totalSegments) * 100);
            notifyProgress(tabId, `Baixando segmentos... ${progress}%`);
        }));
        await Promise.all(promises);
        notifyProgress(tabId, 'Todos os segmentos foram baixados. Juntando...');
        const combinedBlob = new Blob(segmentBlobs, { type: 'video/mp2t' });
        const finalUrl = URL.createObjectURL(combinedBlob);
        chrome.downloads.download({
            url: finalUrl,
            filename: `${filename}.ts`,
            conflictAction: 'uniquify'
        }, (downloadId) => {
            URL.revokeObjectURL(finalUrl);
            notifyProgress(tabId, 'Download concluído!');
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                notifyProgress(tabId, `Erro no download: ${chrome.runtime.lastError.message}`);
            }
        });
    }
    catch (error) {
        console.error('Erro no download HLS:', error);
        notifyProgress(tabId, `Erro: ${error.message}`);
    }
}
