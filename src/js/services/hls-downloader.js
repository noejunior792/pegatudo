// PegaTudo - Enhanced HLS/DASH Downloader Service
// Improved streaming media downloader with better error handling and DASH support

// Progress notification helper
function notifyProgress(tabId, message, isError = false) {
  try {
    chrome.runtime.sendMessage({ 
      action: 'hlsProgress', 
      message, 
      tabId,
      isError 
    });
  } catch (e) {
    console.error('PegaTudo: Failed to notify progress:', e);
  }
}

// Enhanced HLS downloader with better segment handling
async function downloadHls(url, filename, tabId) {
  try {
    notifyProgress(tabId, `🎬 Iniciando download HLS: ${filename}`);

    // 1. Fetch the main manifest
    const manifestUrl = new URL(url);
    const manifestResponse = await fetch(manifestUrl);
    
    if (!manifestResponse.ok) {
      throw new Error(`Falha ao carregar manifesto: ${manifestResponse.status}`);
    }
    
    const manifestText = await manifestResponse.text();
    notifyProgress(tabId, '📋 Manifesto principal carregado');

    // 2. Parse and find the best quality stream
    const playlistUrl = findBestQualityPlaylist(manifestText, manifestUrl);
    
    notifyProgress(tabId, '🔍 Analisando playlist de mídia...');

    // 3. Fetch media playlist
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

    // 4. Download segments with progress tracking
    const segmentBlobs = await downloadSegmentsWithProgress(segmentUrls, tabId);
    
    notifyProgress(tabId, '🔧 Combinando segmentos...');

    // 5. Combine segments and trigger download
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
      } else {
        notifyProgress(tabId, '✅ Download HLS concluído!');
      }
    });

  } catch (error) {
    console.error('PegaTudo: HLS download error:', error);
    notifyProgress(tabId, `❌ Erro HLS: ${error.message}`, true);
  }
}

// New DASH downloader implementation
async function downloadDash(url, filename, tabId) {
  try {
    notifyProgress(tabId, `🎬 Iniciando download DASH: ${filename}`);

    // 1. Fetch MPD manifest
    const manifestUrl = new URL(url);
    const manifestResponse = await fetch(manifestUrl);
    
    if (!manifestResponse.ok) {
      throw new Error(`Falha ao carregar manifesto DASH: ${manifestResponse.status}`);
    }
    
    const manifestText = await manifestResponse.text();
    notifyProgress(tabId, '📋 Manifesto DASH carregado');

    // 2. Parse DASH manifest (basic implementation)
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(manifestText, 'text/xml');
    
    // Find video representation with highest quality
    const videoAdaptations = xmlDoc.querySelectorAll('AdaptationSet[mimeType*="video"]');
    if (videoAdaptations.length === 0) {
      throw new Error('Nenhuma adaptação de vídeo encontrada no manifesto DASH');
    }

    // Get the best video representation
    const videoRepresentation = findBestDashRepresentation(videoAdaptations[0]);
    if (!videoRepresentation) {
      throw new Error('Nenhuma representação de vídeo válida encontrada');
    }

    // 3. Extract segment URLs
    const segmentUrls = extractDashSegmentUrls(videoRepresentation, manifestUrl);
    
    if (segmentUrls.length === 0) {
      throw new Error('Nenhum segmento encontrado na representação DASH');
    }

    notifyProgress(tabId, `📦 Encontrados ${segmentUrls.length} segmentos DASH`);

    // 4. Download segments
    const segmentBlobs = await downloadSegmentsWithProgress(segmentUrls, tabId);
    
    notifyProgress(tabId, '🔧 Combinando segmentos DASH...');

    // 5. Combine and download
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
      } else {
        notifyProgress(tabId, '✅ Download DASH concluído!');
      }
    });

  } catch (error) {
    console.error('PegaTudo: DASH download error:', error);
    notifyProgress(tabId, `❌ Erro DASH: ${error.message}`, true);
  }
}

// Helper: Find best quality HLS playlist
function findBestQualityPlaylist(manifestText, baseUrl) {
  const lines = manifestText.split('\n');
  let bestBandwidth = 0;
  let bestPlaylistUrl = baseUrl.href; // Fallback to original URL
  
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
    } else if (line.endsWith('.m3u8') && bestBandwidth === 0) {
      // If no bandwidth info, use first playlist found
      bestPlaylistUrl = new URL(line, baseUrl).href;
    }
  }
  
  return bestPlaylistUrl;
}

// Helper: Parse HLS segments
function parseHlsSegments(manifestText, baseUrl) {
  const lines = manifestText.split('\n');
  const segmentUrls = [];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.length > 0 && !trimmedLine.startsWith('#')) {
      try {
        const segmentUrl = new URL(trimmedLine, baseUrl).href;
        segmentUrls.push(segmentUrl);
      } catch (e) {
        console.warn('PegaTudo: Invalid segment URL:', trimmedLine);
      }
    }
  }
  
  return segmentUrls;
}

// Helper: Find best DASH representation
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

// Helper: Extract DASH segment URLs (simplified)
function extractDashSegmentUrls(representation, baseUrl) {
  const segmentUrls = [];
  
  // This is a simplified implementation - real DASH parsing is more complex
  const segmentTemplate = representation.querySelector('SegmentTemplate');
  const segmentList = representation.querySelector('SegmentList');
  
  if (segmentList) {
    // Handle SegmentList
    const segmentUrls = segmentList.querySelectorAll('SegmentURL');
    for (const segmentUrl of segmentUrls) {
      const media = segmentUrl.getAttribute('media');
      if (media) {
        segmentUrls.push(new URL(media, baseUrl).href);
      }
    }
  } else if (segmentTemplate) {
    // Handle SegmentTemplate (basic implementation)
    const media = segmentTemplate.getAttribute('media');
    const startNumber = parseInt(segmentTemplate.getAttribute('startNumber')) || 1;
    const duration = parseFloat(segmentTemplate.getAttribute('duration')) || 1;
    
    // This is a very basic implementation - real DASH would need timeline parsing
    console.warn('PegaTudo: DASH SegmentTemplate support is limited');
  }
  
  return segmentUrls;
}

// Enhanced segment downloader with better progress tracking
async function downloadSegmentsWithProgress(segmentUrls, tabId) {
  const totalSegments = segmentUrls.length;
  const segmentBlobs = [];
  let downloadedCount = 0;
  const batchSize = 5; // Download in batches to avoid overwhelming

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
      } catch (error) {
        console.warn(`PegaTudo: Failed to download segment ${i + batchIndex + 1}:`, error);
        // Return null for failed segments
        return { index: i + batchIndex, blob: null };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    
    // Process batch results in order
    for (const result of batchResults) {
      if (result.blob) {
        segmentBlobs[result.index] = result.blob;
      }
      downloadedCount++;
      
      const progress = Math.round((downloadedCount / totalSegments) * 100);
      notifyProgress(tabId, `⬇️ Baixando segmentos... ${progress}% (${downloadedCount}/${totalSegments})`);
    }
    
    // Small delay between batches to prevent overwhelming the server
    if (i + batchSize < segmentUrls.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Filter out failed segments and return successful ones
  return segmentBlobs.filter(blob => blob !== null && blob !== undefined);
}