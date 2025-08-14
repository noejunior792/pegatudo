function notifyProgress(tabId, message, isError = false) {
    try {
        chrome.runtime.sendMessage({
            action: 'hlsProgress',
            message,
            tabId,
            isError
        });
    }
    catch (e) {
        console.error('PegaTudo: Failed to notify progress:', e);
    }
}
async function downloadHls(url, filename, tabId) {
    try {
        notifyProgress(tabId, `🎬 Iniciando download HLS: ${filename}`);
        const manifestUrl = new URL(url);
        const manifestResponse = await fetch(manifestUrl);
        if (!manifestResponse.ok) {
            throw new Error(`Falha ao carregar manifesto: ${manifestResponse.status}`);
        }
        const manifestText = await manifestResponse.text();
        notifyProgress(tabId, '📋 Manifesto principal carregado');
        const playlistUrl = findBestQualityPlaylist(manifestText, manifestUrl);
        notifyProgress(tabId, '🔍 Analisando playlist de mídia...');
        const mediaManifestResponse = await fetch(playlistUrl);
        if (!mediaManifestResponse.ok) {
            throw new Error(`Falha ao carregar playlist de mídia: ${mediaManifestResponse.status}`);
        }
        const mediaManifestText = await mediaManifestResponse.text();
        const segmentUrls = parseHlsSegments(mediaManifestText, new URL(playlistUrl));
        if (segmentUrls.length === 0) {
            throw new Error('Nenhum segmento de vídeo encontrado no manifesto');
        }
        notifyProgress(tabId, `📦 Encontrados ${segmentUrls.length} segmentos`);
        const segmentBlobs = await downloadSegmentsWithProgress(segmentUrls, tabId);
        notifyProgress(tabId, '🔧 Combinando segmentos...');
        const combinedBlob = new Blob(segmentBlobs, { type: 'video/mp2t' });
        const finalUrl = URL.createObjectURL(combinedBlob);
        chrome.downloads.download({
            url: finalUrl,
            filename: `${filename}.ts`,
            conflictAction: 'uniquify'
        }, (downloadId) => {
            URL.revokeObjectURL(finalUrl);
            if (chrome.runtime.lastError) {
                console.error('PegaTudo: Download error:', chrome.runtime.lastError);
                notifyProgress(tabId, `❌ Erro no download: ${chrome.runtime.lastError.message}`, true);
            }
            else {
                notifyProgress(tabId, '✅ Download HLS concluído!');
            }
        });
    }
    catch (error) {
        console.error('PegaTudo: HLS download error:', error);
        notifyProgress(tabId, `❌ Erro HLS: ${error.message}`, true);
    }
}
async function downloadDash(url, filename, tabId) {
    try {
        notifyProgress(tabId, `🎬 Iniciando download DASH: ${filename}`);
        const manifestUrl = new URL(url);
        const manifestResponse = await fetch(manifestUrl);
        if (!manifestResponse.ok) {
            throw new Error(`Falha ao carregar manifesto DASH: ${manifestResponse.status}`);
        }
        const manifestText = await manifestResponse.text();
        notifyProgress(tabId, '📋 Manifesto DASH carregado');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(manifestText, 'text/xml');
        const videoAdaptations = xmlDoc.querySelectorAll('AdaptationSet[mimeType*="video"]');
        if (videoAdaptations.length === 0) {
            throw new Error('Nenhuma adaptação de vídeo encontrada no manifesto DASH');
        }
        const videoRepresentation = findBestDashRepresentation(videoAdaptations[0]);
        if (!videoRepresentation) {
            throw new Error('Nenhuma representação de vídeo válida encontrada');
        }
        const segmentUrls = extractDashSegmentUrls(videoRepresentation, manifestUrl);
        if (segmentUrls.length === 0) {
            throw new Error('Nenhum segmento encontrado na representação DASH');
        }
        notifyProgress(tabId, `📦 Encontrados ${segmentUrls.length} segmentos DASH`);
        const segmentBlobs = await downloadSegmentsWithProgress(segmentUrls, tabId);
        notifyProgress(tabId, '🔧 Combinando segmentos DASH...');
        const combinedBlob = new Blob(segmentBlobs, { type: 'video/mp4' });
        const finalUrl = URL.createObjectURL(combinedBlob);
        chrome.downloads.download({
            url: finalUrl,
            filename: `${filename}.mp4`,
            conflictAction: 'uniquify'
        }, (downloadId) => {
            URL.revokeObjectURL(finalUrl);
            if (chrome.runtime.lastError) {
                console.error('PegaTudo: DASH download error:', chrome.runtime.lastError);
                notifyProgress(tabId, `❌ Erro no download DASH: ${chrome.runtime.lastError.message}`, true);
            }
            else {
                notifyProgress(tabId, '✅ Download DASH concluído!');
            }
        });
    }
    catch (error) {
        console.error('PegaTudo: DASH download error:', error);
        notifyProgress(tabId, `❌ Erro DASH: ${error.message}`, true);
    }
}
function findBestQualityPlaylist(manifestText, baseUrl) {
    const lines = manifestText.split('\n');
    let bestBandwidth = 0;
    let bestPlaylistUrl = baseUrl.href;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#EXT-X-STREAM-INF:')) {
            const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);
            const bandwidth = bandwidthMatch ? parseInt(bandwidthMatch[1]) : 0;
            if (i + 1 < lines.length && lines[i + 1].trim().endsWith('.m3u8')) {
                if (bandwidth > bestBandwidth) {
                    bestBandwidth = bandwidth;
                    bestPlaylistUrl = new URL(lines[i + 1].trim(), baseUrl).href;
                }
            }
        }
        else if (line.endsWith('.m3u8') && bestBandwidth === 0) {
            bestPlaylistUrl = new URL(line, baseUrl).href;
        }
    }
    return bestPlaylistUrl;
}
function parseHlsSegments(manifestText, baseUrl) {
    const lines = manifestText.split('\n');
    const segmentUrls = [];
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.length > 0 && !trimmedLine.startsWith('#')) {
            try {
                const segmentUrl = new URL(trimmedLine, baseUrl).href;
                segmentUrls.push(segmentUrl);
            }
            catch (e) {
                console.warn('PegaTudo: Invalid segment URL:', trimmedLine);
            }
        }
    }
    return segmentUrls;
}
function findBestDashRepresentation(adaptationSet) {
    const representations = adaptationSet.querySelectorAll('Representation');
    let bestRepresentation = null;
    let highestBandwidth = 0;
    for (const repr of representations) {
        const bandwidth = parseInt(repr.getAttribute('bandwidth')) || 0;
        if (bandwidth > highestBandwidth) {
            highestBandwidth = bandwidth;
            bestRepresentation = repr;
        }
    }
    return bestRepresentation;
}
function extractDashSegmentUrls(representation, baseUrl) {
    const segmentUrls = [];
    const segmentTemplate = representation.querySelector('SegmentTemplate');
    const segmentList = representation.querySelector('SegmentList');
    if (segmentList) {
        const segmentUrls = segmentList.querySelectorAll('SegmentURL');
        for (const segmentUrl of segmentUrls) {
            const media = segmentUrl.getAttribute('media');
            if (media) {
                segmentUrls.push(new URL(media, baseUrl).href);
            }
        }
    }
    else if (segmentTemplate) {
        const media = segmentTemplate.getAttribute('media');
        const startNumber = parseInt(segmentTemplate.getAttribute('startNumber')) || 1;
        const duration = parseFloat(segmentTemplate.getAttribute('duration')) || 1;
        console.warn('PegaTudo: DASH SegmentTemplate support is limited');
    }
    return segmentUrls;
}
async function downloadSegmentsWithProgress(segmentUrls, tabId) {
    const totalSegments = segmentUrls.length;
    const segmentBlobs = [];
    let downloadedCount = 0;
    const batchSize = 5;
    for (let i = 0; i < segmentUrls.length; i += batchSize) {
        const batch = segmentUrls.slice(i, i + batchSize);
        const batchPromises = batch.map(async (segmentUrl, batchIndex) => {
            try {
                const response = await fetch(segmentUrl);
                if (!response.ok) {
                    throw new Error(`Segment ${i + batchIndex + 1} failed: ${response.status}`);
                }
                const blob = await response.blob();
                return { index: i + batchIndex, blob };
            }
            catch (error) {
                console.warn(`PegaTudo: Failed to download segment ${i + batchIndex + 1}:`, error);
                return { index: i + batchIndex, blob: null };
            }
        });
        const batchResults = await Promise.all(batchPromises);
        for (const result of batchResults) {
            if (result.blob) {
                segmentBlobs[result.index] = result.blob;
            }
            downloadedCount++;
            const progress = Math.round((downloadedCount / totalSegments) * 100);
            notifyProgress(tabId, `⬇️ Baixando segmentos... ${progress}% (${downloadedCount}/${totalSegments})`);
        }
        if (i + batchSize < segmentUrls.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    return segmentBlobs.filter(blob => blob !== null && blob !== undefined);
}
