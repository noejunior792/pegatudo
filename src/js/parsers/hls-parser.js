/**
 * Advanced HLS Parser for PegaTudo
 * Comprehensive HTTP Live Streaming playlist parser with full specification support
 * Supports HLS version 1-13, including DVR, live, and VOD streams
 */

import { logger } from '../core/logger.js';
import { config } from '../core/config.js';
import { eventSystem } from '../core/events.js';
import { networkManager } from '../network/network-manager.js';
import { 
  MediaType, 
  EncryptionMethod,
  createMediaSource,
  createMediaSegment,
  createEncryptionKey
} from '../core/types.js';

export class AdvancedHLSParser {
  constructor(options = {}) {
    this.config = {
      maxRedirects: options.maxRedirects || 10,
      enableVariantSelection: options.enableVariantSelection !== false,
      enableAlternativeAudio: options.enableAlternativeAudio !== false,
      enableSubtitles: options.enableSubtitles !== false,
      enableByteRanges: options.enableByteRanges !== false,
      enableDateRanges: options.enableDateRanges !== false,
      enableProgramDateTime: options.enableProgramDateTime !== false,
      strictParsing: options.strictParsing || false,
      allowInvalidTags: options.allowInvalidTags || true,
      defaultSegmentDuration: options.defaultSegmentDuration || 10,
      ...options
    };

    this.supportedTags = new Set([
      // Basic Tags
      'EXTM3U', 'EXT-X-VERSION',
      
      // Playlist Tags  
      'EXT-X-TARGETDURATION', 'EXT-X-MEDIA-SEQUENCE', 'EXT-X-DISCONTINUITY-SEQUENCE',
      'EXT-X-ENDLIST', 'EXT-X-PLAYLIST-TYPE', 'EXT-X-I-FRAMES-ONLY',
      
      // Segment Tags
      'EXTINF', 'EXT-X-BYTERANGE', 'EXT-X-DISCONTINUITY', 'EXT-X-KEY',
      'EXT-X-MAP', 'EXT-X-PROGRAM-DATE-TIME', 'EXT-X-DATERANGE',
      
      // Master Playlist Tags
      'EXT-X-STREAM-INF', 'EXT-X-I-FRAME-STREAM-INF', 'EXT-X-SESSION-DATA',
      'EXT-X-SESSION-KEY', 'EXT-X-INDEPENDENT-SEGMENTS', 'EXT-X-START',
      
      // Media Tags
      'EXT-X-MEDIA',
      
      // Encryption/DRM Tags
      'EXT-X-CONTENT-STEERING', 'EXT-X-SERVER-CONTROL',
      
      // Advanced Tags
      'EXT-X-PART-INF', 'EXT-X-PART', 'EXT-X-SKIP', 'EXT-X-PRELOAD-HINT',
      'EXT-X-RENDITION-REPORT', 'EXT-X-GAP'
    ]);

    this.keyFormats = new Map([
      ['identity', this.parseIdentityKey.bind(this)],
      ['com.apple.streamingkeydelivery', this.parseAppleKey.bind(this)],
      ['com.microsoft.playready', this.parsePlayReadyKey.bind(this)],
      ['urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed', this.parseWidevineKey.bind(this)]
    ]);

    this.cache = new Map();
    this.variantCache = new Map();
    this.alternativeMediaCache = new Map();

    this.metrics = {
      playlistsParsed: 0,
      masterPlaylistsParsed: 0,
      mediaPlaylistsParsed: 0,
      segmentsParsed: 0,
      keysParsed: 0,
      parseErrors: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    this.init();
  }

  init() {
    logger.info('Advanced HLS Parser initialized', {
      supportedTags: this.supportedTags.size,
      keyFormats: this.keyFormats.size,
      strictParsing: this.config.strictParsing
    });
  }

  // Main parsing entry point
  async parsePlaylist(url, content = null) {
    try {
      logger.debug(`Parsing HLS playlist: ${url}`);
      
      const cacheKey = this.generateCacheKey(url);
      const cached = this.cache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp) < 30000) { // 30 second cache
        this.metrics.cacheHits++;
        return cached.playlist;
      }
      
      this.metrics.cacheMisses++;
      
      // Fetch content if not provided
      if (!content) {
        content = await this.fetchPlaylistContent(url);
      }
      
      // Validate basic M3U format
      if (!this.validatePlaylist(content)) {
        throw new Error('Invalid HLS playlist format');
      }
      
      const playlist = await this.parsePlaylistContent(content, url);
      
      // Cache the result
      this.cache.set(cacheKey, {
        playlist,
        timestamp: Date.now()
      });
      
      this.metrics.playlistsParsed++;
      
      if (playlist.type === 'master') {
        this.metrics.masterPlaylistsParsed++;
      } else {
        this.metrics.mediaPlaylistsParsed++;
      }
      
      eventSystem.emit('hls:playlistParsed', { url, playlist });
      
      return playlist;
    } catch (error) {
      this.metrics.parseErrors++;
      logger.error(`HLS playlist parsing failed: ${url}`, error);
      throw error;
    }
  }

  async fetchPlaylistContent(url) {
    const response = await networkManager.get(url, {
      headers: {
        'Accept': 'application/vnd.apple.mpegurl, application/x-mpegURL, */*'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.text();
  }

  validatePlaylist(content) {
    const lines = content.split('\n');
    if (lines.length === 0) return false;
    
    const firstLine = lines[0].trim();
    return firstLine === '#EXTM3U';
  }

  async parsePlaylistContent(content, baseUrl) {
    const lines = this.preprocessLines(content);
    const playlist = this.createBasePlaylist(baseUrl);
    
    // First pass: determine playlist type and parse metadata
    this.parseMetadata(lines, playlist);
    
    // Second pass: parse content based on type
    if (playlist.type === 'master') {
      await this.parseMasterPlaylist(lines, playlist);
    } else {
      await this.parseMediaPlaylist(lines, playlist);
    }
    
    // Post-processing
    this.postProcessPlaylist(playlist);
    
    return playlist;
  }

  preprocessLines(content) {
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }

  createBasePlaylist(baseUrl) {
    return {
      type: 'media', // Will be determined during parsing
      version: 1,
      baseUrl,
      targetDuration: null,
      mediaSequence: 0,
      discontinuitySequence: 0,
      endlist: false,
      playlistType: null,
      iframesOnly: false,
      segments: [],
      keys: [],
      dateRanges: [],
      sessionData: [],
      sessionKeys: [],
      independentSegments: false,
      start: null,
      
      // Master playlist specific
      variants: [],
      alternativeAudio: [],
      alternativeVideo: [],
      alternativeSubtitles: [],
      iframeVariants: [],
      
      // Advanced features
      lowLatency: false,
      partialSegments: [],
      preloadHints: [],
      renditionReports: [],
      serverControl: {},
      contentSteering: null,
      
      // Metadata
      totalDuration: 0,
      isLive: false,
      isDVR: false,
      allowCache: true,
      
      // Parsing info
      parseTime: Date.now(),
      warnings: [],
      errors: []
    };
  }

  parseMetadata(lines, playlist) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (!line.startsWith('#')) continue;
      
      if (line.startsWith('#EXT-X-VERSION:')) {
        playlist.version = this.parseVersion(line);
      } else if (line.startsWith('#EXT-X-STREAM-INF:') || 
                 line.startsWith('#EXT-X-I-FRAME-STREAM-INF:') ||
                 line.startsWith('#EXT-X-MEDIA:')) {
        playlist.type = 'master';
      } else if (line.startsWith('#EXT-X-TARGETDURATION:')) {
        playlist.targetDuration = this.parseTargetDuration(line);
      } else if (line.startsWith('#EXT-X-PLAYLIST-TYPE:')) {
        playlist.playlistType = this.parsePlaylistType(line);
        playlist.isLive = playlist.playlistType !== 'VOD';
      } else if (line.startsWith('#EXT-X-ENDLIST')) {
        playlist.endlist = true;
        playlist.isLive = false;
      } else if (line.startsWith('#EXT-X-I-FRAMES-ONLY')) {
        playlist.iframesOnly = true;
      } else if (line.startsWith('#EXT-X-INDEPENDENT-SEGMENTS')) {
        playlist.independentSegments = true;
      } else if (line.startsWith('#EXT-X-PART-INF:')) {
        playlist.lowLatency = true;
      }
    }
  }

  async parseMasterPlaylist(lines, playlist) {
    let currentVariant = null;
    let currentMedia = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        currentVariant = this.parseStreamInf(line);
      } else if (line.startsWith('#EXT-X-I-FRAME-STREAM-INF:')) {
        const iframeVariant = this.parseIFrameStreamInf(line);
        playlist.iframeVariants.push(iframeVariant);
      } else if (line.startsWith('#EXT-X-MEDIA:')) {
        currentMedia = this.parseMedia(line);
        this.categorizeAlternativeMedia(currentMedia, playlist);
      } else if (line.startsWith('#EXT-X-SESSION-DATA:')) {
        const sessionData = this.parseSessionData(line);
        playlist.sessionData.push(sessionData);
      } else if (line.startsWith('#EXT-X-SESSION-KEY:')) {
        const sessionKey = this.parseSessionKey(line);
        playlist.sessionKeys.push(sessionKey);
      } else if (line.startsWith('#EXT-X-START:')) {
        playlist.start = this.parseStart(line);
      } else if (line.startsWith('#EXT-X-CONTENT-STEERING:')) {
        playlist.contentSteering = this.parseContentSteering(line);
      } else if (!line.startsWith('#') && currentVariant) {
        // This is the URL for the current variant
        currentVariant.url = this.resolveUrl(line, playlist.baseUrl);
        playlist.variants.push(currentVariant);
        currentVariant = null;
      }
    }
    
    // Sort variants by bandwidth for easier selection
    playlist.variants.sort((a, b) => (b.bandwidth || 0) - (a.bandwidth || 0));
    
    // If variant selection is enabled, load and parse variant playlists
    if (this.config.enableVariantSelection && playlist.variants.length > 0) {
      await this.loadVariantPlaylists(playlist);
    }
  }

  async parseMediaPlaylist(lines, playlist) {
    let currentSegment = null;
    let currentKey = null;
    let currentByteRange = null;
    let currentMap = null;
    let sequence = playlist.mediaSequence;
    let discontinuity = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
        sequence = this.parseMediaSequence(line);
        playlist.mediaSequence = sequence;
      } else if (line.startsWith('#EXT-X-DISCONTINUITY-SEQUENCE:')) {
        playlist.discontinuitySequence = this.parseDiscontinuitySequence(line);
      } else if (line.startsWith('#EXT-X-KEY:')) {
        currentKey = this.parseKey(line);
        playlist.keys.push(currentKey);
      } else if (line.startsWith('#EXTINF:')) {
        currentSegment = this.parseExtInf(line, sequence++);
      } else if (line.startsWith('#EXT-X-BYTERANGE:')) {
        currentByteRange = this.parseByteRange(line);
      } else if (line.startsWith('#EXT-X-DISCONTINUITY')) {
        discontinuity = true;
      } else if (line.startsWith('#EXT-X-MAP:')) {
        currentMap = this.parseMap(line);
      } else if (line.startsWith('#EXT-X-PROGRAM-DATE-TIME:')) {
        if (currentSegment) {
          currentSegment.programDateTime = this.parseProgramDateTime(line);
        }
      } else if (line.startsWith('#EXT-X-DATERANGE:')) {
        const dateRange = this.parseDateRange(line);
        playlist.dateRanges.push(dateRange);
      } else if (line.startsWith('#EXT-X-GAP')) {
        if (currentSegment) {
          currentSegment.gap = true;
        }
      } else if (line.startsWith('#EXT-X-PART:')) {
        const part = this.parsePart(line);
        playlist.partialSegments.push(part);
      } else if (line.startsWith('#EXT-X-PRELOAD-HINT:')) {
        const hint = this.parsePreloadHint(line);
        playlist.preloadHints.push(hint);
      } else if (line.startsWith('#EXT-X-RENDITION-REPORT:')) {
        const report = this.parseRenditionReport(line);
        playlist.renditionReports.push(report);
      } else if (line.startsWith('#EXT-X-SERVER-CONTROL:')) {
        playlist.serverControl = this.parseServerControl(line);
      } else if (!line.startsWith('#') && currentSegment) {
        // This is the segment URL
        currentSegment.url = this.resolveUrl(line, playlist.baseUrl);
        currentSegment.key = currentKey;
        currentSegment.encrypted = currentKey && currentKey.method !== EncryptionMethod.NONE;
        currentSegment.byteRange = currentByteRange;
        currentSegment.map = currentMap;
        currentSegment.discontinuity = discontinuity;
        
        playlist.segments.push(currentSegment);
        playlist.totalDuration += currentSegment.duration;
        this.metrics.segmentsParsed++;
        
        // Reset per-segment state
        currentSegment = null;
        currentByteRange = null;
        discontinuity = false;
      }
    }
    
    // Determine if this is a DVR stream
    playlist.isDVR = playlist.isLive && playlist.segments.length > 0 && 
                    playlist.segments[0].programDateTime;
  }

  // Tag parsing methods
  parseVersion(line) {
    const match = line.match(/#EXT-X-VERSION:(\d+)/);
    return match ? parseInt(match[1], 10) : 1;
  }

  parseTargetDuration(line) {
    const match = line.match(/#EXT-X-TARGETDURATION:(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  parsePlaylistType(line) {
    const match = line.match(/#EXT-X-PLAYLIST-TYPE:(.+)/);
    return match ? match[1].trim() : null;
  }

  parseMediaSequence(line) {
    const match = line.match(/#EXT-X-MEDIA-SEQUENCE:(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  parseDiscontinuitySequence(line) {
    const match = line.match(/#EXT-X-DISCONTINUITY-SEQUENCE:(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  parseExtInf(line, sequence) {
    const match = line.match(/#EXTINF:([\d.]+),?(.*)/);
    if (!match) {
      throw new Error(`Invalid EXTINF tag: ${line}`);
    }
    
    const duration = parseFloat(match[1]);
    const title = match[2] || '';
    
    const segment = createMediaSegment('', duration, sequence);
    segment.title = title.trim();
    
    return segment;
  }

  parseKey(line) {
    const attributes = this.parseAttributeList(line.substring(11)); // Remove "#EXT-X-KEY:"
    
    const method = attributes.METHOD || EncryptionMethod.NONE;
    const uri = attributes.URI ? this.unquoteString(attributes.URI) : '';
    
    const key = createEncryptionKey(uri, method);
    key.iv = attributes.IV;
    key.keyFormat = attributes.KEYFORMAT;
    key.keyFormatVersions = attributes.KEYFORMATVERSIONS;
    
    // Parse key based on format
    const keyFormat = key.keyFormat || 'identity';
    const parser = this.keyFormats.get(keyFormat);
    if (parser) {
      parser(key, attributes);
    }
    
    this.metrics.keysParsed++;
    return key;
  }

  parseByteRange(line) {
    const match = line.match(/#EXT-X-BYTERANGE:(\d+)(?:@(\d+))?/);
    if (!match) return null;
    
    return {
      length: parseInt(match[1], 10),
      offset: match[2] ? parseInt(match[2], 10) : null
    };
  }

  parseMap(line) {
    const attributes = this.parseAttributeList(line.substring(11)); // Remove "#EXT-X-MAP:"
    
    return {
      uri: this.unquoteString(attributes.URI || ''),
      byteRange: attributes.BYTERANGE ? this.parseByteRangeValue(attributes.BYTERANGE) : null
    };
  }

  parseByteRangeValue(value) {
    const match = value.match(/(\d+)(?:@(\d+))?/);
    if (!match) return null;
    
    return {
      length: parseInt(match[1], 10),
      offset: match[2] ? parseInt(match[2], 10) : null
    };
  }

  parseProgramDateTime(line) {
    const match = line.match(/#EXT-X-PROGRAM-DATE-TIME:(.+)/);
    return match ? new Date(match[1].trim()) : null;
  }

  parseStreamInf(line) {
    const attributes = this.parseAttributeList(line.substring(17)); // Remove "#EXT-X-STREAM-INF:"
    
    const variant = {
      bandwidth: parseInt(attributes.BANDWIDTH || '0', 10),
      averageBandwidth: attributes['AVERAGE-BANDWIDTH'] ? 
        parseInt(attributes['AVERAGE-BANDWIDTH'], 10) : null,
      codecs: this.unquoteString(attributes.CODECS || ''),
      resolution: this.parseResolution(attributes.RESOLUTION),
      frameRate: parseFloat(attributes['FRAME-RATE'] || '0') || null,
      hdcpLevel: attributes['HDCP-LEVEL'],
      audio: this.unquoteString(attributes.AUDIO || ''),
      video: this.unquoteString(attributes.VIDEO || ''),
      subtitles: this.unquoteString(attributes.SUBTITLES || ''),
      closedCaptions: this.unquoteString(attributes['CLOSED-CAPTIONS'] || ''),
      url: null // Will be set when URL line is encountered
    };
    
    return variant;
  }

  parseIFrameStreamInf(line) {
    const attributes = this.parseAttributeList(line.substring(25)); // Remove "#EXT-X-I-FRAME-STREAM-INF:"
    
    return {
      bandwidth: parseInt(attributes.BANDWIDTH || '0', 10),
      averageBandwidth: attributes['AVERAGE-BANDWIDTH'] ? 
        parseInt(attributes['AVERAGE-BANDWIDTH'], 10) : null,
      codecs: this.unquoteString(attributes.CODECS || ''),
      resolution: this.parseResolution(attributes.RESOLUTION),
      hdcpLevel: attributes['HDCP-LEVEL'],
      video: this.unquoteString(attributes.VIDEO || ''),
      uri: this.unquoteString(attributes.URI || '')
    };
  }

  parseMedia(line) {
    const attributes = this.parseAttributeList(line.substring(12)); // Remove "#EXT-X-MEDIA:"
    
    return {
      type: attributes.TYPE,
      uri: attributes.URI ? this.unquoteString(attributes.URI) : null,
      groupId: this.unquoteString(attributes['GROUP-ID'] || ''),
      language: this.unquoteString(attributes.LANGUAGE || ''),
      assocLanguage: this.unquoteString(attributes['ASSOC-LANGUAGE'] || ''),
      name: this.unquoteString(attributes.NAME || ''),
      default: attributes.DEFAULT === 'YES',
      autoselect: attributes.AUTOSELECT === 'YES',
      forced: attributes.FORCED === 'YES',
      instreamId: attributes['INSTREAM-ID'],
      characteristics: this.unquoteString(attributes.CHARACTERISTICS || ''),
      channels: this.unquoteString(attributes.CHANNELS || '')
    };
  }

  parseSessionData(line) {
    const attributes = this.parseAttributeList(line.substring(18)); // Remove "#EXT-X-SESSION-DATA:"
    
    return {
      dataId: this.unquoteString(attributes['DATA-ID'] || ''),
      value: this.unquoteString(attributes.VALUE || ''),
      uri: this.unquoteString(attributes.URI || ''),
      language: this.unquoteString(attributes.LANGUAGE || '')
    };
  }

  parseSessionKey(line) {
    // Similar to parseKey but for session-level keys
    return this.parseKey(line.replace('#EXT-X-SESSION-KEY:', '#EXT-X-KEY:'));
  }

  parseStart(line) {
    const attributes = this.parseAttributeList(line.substring(12)); // Remove "#EXT-X-START:"
    
    return {
      timeOffset: parseFloat(attributes['TIME-OFFSET'] || '0'),
      precise: attributes.PRECISE === 'YES'
    };
  }

  parseDateRange(line) {
    const attributes = this.parseAttributeList(line.substring(16)); // Remove "#EXT-X-DATERANGE:"
    
    return {
      id: this.unquoteString(attributes.ID || ''),
      class: this.unquoteString(attributes.CLASS || ''),
      startDate: new Date(this.unquoteString(attributes['START-DATE'] || '')),
      endDate: attributes['END-DATE'] ? new Date(this.unquoteString(attributes['END-DATE'])) : null,
      duration: parseFloat(attributes.DURATION || '0') || null,
      plannedDuration: parseFloat(attributes['PLANNED-DURATION'] || '0') || null,
      endOnNext: attributes['END-ON-NEXT'] === 'YES',
      scte35Cmd: attributes['SCTE35-CMD'],
      scte35Out: attributes['SCTE35-OUT'],
      scte35In: attributes['SCTE35-IN']
    };
  }

  parsePart(line) {
    const attributes = this.parseAttributeList(line.substring(11)); // Remove "#EXT-X-PART:"
    
    return {
      duration: parseFloat(attributes.DURATION || '0'),
      uri: this.unquoteString(attributes.URI || ''),
      byteRange: attributes.BYTERANGE ? this.parseByteRangeValue(attributes.BYTERANGE) : null,
      independent: attributes.INDEPENDENT === 'YES',
      gap: attributes.GAP === 'YES'
    };
  }

  parsePreloadHint(line) {
    const attributes = this.parseAttributeList(line.substring(18)); // Remove "#EXT-X-PRELOAD-HINT:"
    
    return {
      type: attributes.TYPE,
      uri: this.unquoteString(attributes.URI || ''),
      byteRangeStart: parseInt(attributes['BYTERANGE-START'] || '0', 10),
      byteRangeLength: parseInt(attributes['BYTERANGE-LENGTH'] || '0', 10)
    };
  }

  parseRenditionReport(line) {
    const attributes = this.parseAttributeList(line.substring(22)); // Remove "#EXT-X-RENDITION-REPORT:"
    
    return {
      uri: this.unquoteString(attributes.URI || ''),
      lastMsn: parseInt(attributes['LAST-MSN'] || '0', 10),
      lastPart: parseInt(attributes['LAST-PART'] || '0', 10)
    };
  }

  parseServerControl(line) {
    const attributes = this.parseAttributeList(line.substring(20)); // Remove "#EXT-X-SERVER-CONTROL:"
    
    return {
      canBlockReload: attributes['CAN-BLOCK-RELOAD'] === 'YES',
      canSkipUntil: parseFloat(attributes['CAN-SKIP-UNTIL'] || '0') || null,
      canSkipDateRanges: attributes['CAN-SKIP-DATERANGES'] === 'YES',
      holdBack: parseFloat(attributes['HOLD-BACK'] || '0') || null,
      partHoldBack: parseFloat(attributes['PART-HOLD-BACK'] || '0') || null
    };
  }

  parseContentSteering(line) {
    const attributes = this.parseAttributeList(line.substring(21)); // Remove "#EXT-X-CONTENT-STEERING:"
    
    return {
      serverUri: this.unquoteString(attributes['SERVER-URI'] || ''),
      pathwayId: this.unquoteString(attributes['PATHWAY-ID'] || '')
    };
  }

  // Key format parsers
  parseIdentityKey(key, attributes) {
    // Standard identity key format - no additional processing needed
    return key;
  }

  parseAppleKey(key, attributes) {
    // Apple FairPlay key format
    key.fairplayKeySystem = true;
    return key;
  }

  parsePlayReadyKey(key, attributes) {
    // Microsoft PlayReady key format
    key.playreadyKeySystem = true;
    return key;
  }

  parseWidevineKey(key, attributes) {
    // Google Widevine key format
    key.widevineKeySystem = true;
    return key;
  }

  // Utility methods
  parseAttributeList(attributeString) {
    const attributes = {};
    const regex = /([A-Z-]+)=([^,]*?)(?:,|$)/g;
    let match;
    
    while ((match = regex.exec(attributeString)) !== null) {
      const key = match[1];
      let value = match[2];
      
      // Handle quoted values
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      
      attributes[key] = value;
    }
    
    return attributes;
  }

  parseResolution(resolutionString) {
    if (!resolutionString) return null;
    
    const match = resolutionString.match(/(\d+)x(\d+)/);
    if (!match) return null;
    
    return {
      width: parseInt(match[1], 10),
      height: parseInt(match[2], 10)
    };
  }

  unquoteString(str) {
    if (!str) return str;
    if (str.startsWith('"') && str.endsWith('"')) {
      return str.slice(1, -1);
    }
    return str;
  }

  resolveUrl(url, baseUrl) {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    try {
      return new URL(url, baseUrl).href;
    } catch (error) {
      logger.warn(`Failed to resolve URL: ${url} with base: ${baseUrl}`);
      return url;
    }
  }

  categorizeAlternativeMedia(media, playlist) {
    switch (media.type) {
      case 'AUDIO':
        playlist.alternativeAudio.push(media);
        break;
      case 'VIDEO':
        playlist.alternativeVideo.push(media);
        break;
      case 'SUBTITLES':
        playlist.alternativeSubtitles.push(media);
        break;
      case 'CLOSED-CAPTIONS':
        // Closed captions are typically embedded in video streams
        break;
    }
  }

  async loadVariantPlaylists(playlist) {
    // Load a subset of variant playlists to get more information
    const variantsToLoad = playlist.variants.slice(0, 3); // Load top 3 variants
    
    for (const variant of variantsToLoad) {
      try {
        const variantPlaylist = await this.parsePlaylist(variant.url);
        variant.segmentCount = variantPlaylist.segments.length;
        variant.totalDuration = variantPlaylist.totalDuration;
        variant.isLive = variantPlaylist.isLive;
        
        this.variantCache.set(variant.url, variantPlaylist);
      } catch (error) {
        logger.warn(`Failed to load variant playlist: ${variant.url}`, error);
        playlist.warnings.push(`Failed to load variant: ${variant.url}`);
      }
    }
  }

  postProcessPlaylist(playlist) {
    // Calculate additional metadata
    if (playlist.type === 'media') {
      // Validate segment sequences
      this.validateSegmentSequences(playlist);
      
      // Calculate bitrate estimates
      this.calculateBitrateEstimates(playlist);
      
      // Detect stream characteristics
      this.detectStreamCharacteristics(playlist);
    } else {
      // Sort alternative media groups
      this.sortAlternativeMedia(playlist);
      
      // Validate variant references
      this.validateVariantReferences(playlist);
    }
    
    // Add quality labels
    this.addQualityLabels(playlist);
  }

  validateSegmentSequences(playlist) {
    if (playlist.segments.length === 0) return;
    
    let expectedSequence = playlist.mediaSequence;
    for (const segment of playlist.segments) {
      if (segment.sequence !== expectedSequence) {
        playlist.warnings.push(`Unexpected segment sequence: expected ${expectedSequence}, got ${segment.sequence}`);
      }
      expectedSequence++;
    }
  }

  calculateBitrateEstimates(playlist) {
    if (playlist.segments.length === 0) return;
    
    const totalDuration = playlist.segments.reduce((sum, seg) => sum + seg.duration, 0);
    if (totalDuration > 0) {
      // This is an estimate - actual bitrate calculation would require segment sizes
      playlist.estimatedBitrate = Math.round((playlist.segments.length * this.config.defaultSegmentDuration * 1000000) / totalDuration);
    }
  }

  detectStreamCharacteristics(playlist) {
    // Detect if stream has audio/video/subtitles
    playlist.hasAudio = playlist.segments.some(seg => 
      seg.codecs && seg.codecs.includes('mp4a'));
    playlist.hasVideo = playlist.segments.some(seg => 
      seg.codecs && (seg.codecs.includes('avc1') || seg.codecs.includes('hev1')));
    
    // Detect encryption usage
    playlist.hasEncryption = playlist.keys.some(key => 
      key.method !== EncryptionMethod.NONE);
    
    // Detect discontinuities
    playlist.hasDiscontinuities = playlist.segments.some(seg => seg.discontinuity);
  }

  sortAlternativeMedia(playlist) {
    // Sort by priority: default, autoselect, then by name
    const sortMedia = (a, b) => {
      if (a.default !== b.default) return b.default - a.default;
      if (a.autoselect !== b.autoselect) return b.autoselect - a.autoselect;
      return a.name.localeCompare(b.name);
    };
    
    playlist.alternativeAudio.sort(sortMedia);
    playlist.alternativeVideo.sort(sortMedia);
    playlist.alternativeSubtitles.sort(sortMedia);
  }

  validateVariantReferences(playlist) {
    const mediaGroups = new Set();
    
    // Collect all media group IDs
    playlist.alternativeAudio.forEach(media => mediaGroups.add(media.groupId));
    playlist.alternativeVideo.forEach(media => mediaGroups.add(media.groupId));
    playlist.alternativeSubtitles.forEach(media => mediaGroups.add(media.groupId));
    
    // Check variant references
    for (const variant of playlist.variants) {
      if (variant.audio && !mediaGroups.has(variant.audio)) {
        playlist.warnings.push(`Variant references unknown audio group: ${variant.audio}`);
      }
      if (variant.video && !mediaGroups.has(variant.video)) {
        playlist.warnings.push(`Variant references unknown video group: ${variant.video}`);
      }
      if (variant.subtitles && !mediaGroups.has(variant.subtitles)) {
        playlist.warnings.push(`Variant references unknown subtitles group: ${variant.subtitles}`);
      }
    }
  }

  addQualityLabels(playlist) {
    if (playlist.type === 'master') {
      for (const variant of playlist.variants) {
        variant.qualityLabel = this.generateQualityLabel(variant);
      }
    }
    
    for (const media of playlist.alternativeAudio) {
      media.qualityLabel = this.generateAudioQualityLabel(media);
    }
  }

  generateQualityLabel(variant) {
    if (variant.resolution) {
      const { width, height } = variant.resolution;
      if (height >= 2160) return '4K';
      if (height >= 1440) return '1440p';
      if (height >= 1080) return '1080p';
      if (height >= 720) return '720p';
      if (height >= 480) return '480p';
      return `${width}x${height}`;
    }
    
    if (variant.bandwidth) {
      const mbps = Math.round(variant.bandwidth / 1000000);
      return `${mbps} Mbps`;
    }
    
    return 'Unknown Quality';
  }

  generateAudioQualityLabel(media) {
    if (media.channels) {
      const channelCount = media.channels.split('/')[0];
      if (channelCount === '6') return '5.1';
      if (channelCount === '8') return '7.1';
      if (channelCount === '2') return 'Stereo';
      if (channelCount === '1') return 'Mono';
    }
    
    if (media.language) {
      return media.language.toUpperCase();
    }
    
    return media.name || 'Audio';
  }

  generateCacheKey(url) {
    // Simple hash function for caching
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  // Public API methods
  async getMasterPlaylist(url) {
    const playlist = await this.parsePlaylist(url);
    if (playlist.type !== 'master') {
      throw new Error('URL does not point to a master playlist');
    }
    return playlist;
  }

  async getMediaPlaylist(url) {
    const playlist = await this.parsePlaylist(url);
    if (playlist.type !== 'media') {
      throw new Error('URL does not point to a media playlist');
    }
    return playlist;
  }

  async getVariantPlaylist(masterPlaylist, variantIndex) {
    if (variantIndex >= masterPlaylist.variants.length) {
      throw new Error('Invalid variant index');
    }
    
    const variant = masterPlaylist.variants[variantIndex];
    const cached = this.variantCache.get(variant.url);
    
    if (cached) {
      return cached;
    }
    
    const playlist = await this.parsePlaylist(variant.url);
    this.variantCache.set(variant.url, playlist);
    
    return playlist;
  }

  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      variantCacheSize: this.variantCache.size,
      alternativeMediaCacheSize: this.alternativeMediaCache.size,
      supportedTagsCount: this.supportedTags.size,
      keyFormatsCount: this.keyFormats.size
    };
  }

  clearCache() {
    this.cache.clear();
    this.variantCache.clear();
    this.alternativeMediaCache.clear();
    logger.info('HLS Parser cache cleared');
  }

  destroy() {
    this.clearCache();
    logger.info('HLS Parser destroyed');
  }
}

// Export default instance
export const hlsParser = new AdvancedHLSParser();

export default AdvancedHLSParser;