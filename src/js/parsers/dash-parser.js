/**
 * Advanced DASH Parser for PegaTudo
 * Comprehensive Dynamic Adaptive Streaming over HTTP manifest parser
 * Supports DASH profiles, multi-period content, and advanced streaming features
 */

import { logger } from '../core/logger.js';
import { config } from '../core/config.js';
import { eventSystem } from '../core/events.js';
import { networkManager } from '../network/network-manager.js';
import { 
  MediaType,
  createMediaSource,
  createMediaSegment,
  createEncryptionKey
} from '../core/types.js';

export class AdvancedDASHParser {
  constructor(options = {}) {
    this.config = {
      enableMultiPeriod: options.enableMultiPeriod !== false,
      enableAdaptationSets: options.enableAdaptationSets !== false,
      enableSubtitles: options.enableSubtitles !== false,
      enableThumbnails: options.enableThumbnails !== false,
      enableEventStreams: options.enableEventStreams !== false,
      enableContentProtection: options.enableContentProtection !== false,
      strictValidation: options.strictValidation || false,
      allowUnknownElements: options.allowUnknownElements !== false,
      maxSegmentLookAhead: options.maxSegmentLookAhead || 100,
      defaultSegmentDuration: options.defaultSegmentDuration || 4,
      ...options
    };

    this.namespaces = {
      'mpd': 'urn:mpeg:dash:schema:mpd:2011',
      'xlink': 'http://www.w3.org/1999/xlink',
      'xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      'cenc': 'urn:mpeg:cenc:2013',
      'mspr': 'urn:microsoft:playready',
      'mas': 'urn:marlin:mas:1-0:services:schemas:mpd'
    };

    this.profiles = new Set([
      'urn:mpeg:dash:profile:isoff-main:2011',
      'urn:mpeg:dash:profile:isoff-live:2011',
      'urn:mpeg:dash:profile:isoff-on-demand:2011',
      'urn:mpeg:dash:profile:mp2t-main:2011',
      'urn:mpeg:dash:profile:mp2t-simple:2011'
    ]);

    this.codecs = new Map([
      // Video codecs
      ['avc1', { type: 'video', name: 'H.264/AVC' }],
      ['avc3', { type: 'video', name: 'H.264/AVC' }],
      ['hev1', { type: 'video', name: 'H.265/HEVC' }],
      ['hvc1', { type: 'video', name: 'H.265/HEVC' }],
      ['vp09', { type: 'video', name: 'VP9' }],
      ['av01', { type: 'video', name: 'AV1' }],
      
      // Audio codecs
      ['mp4a', { type: 'audio', name: 'AAC' }],
      ['ac-3', { type: 'audio', name: 'AC-3' }],
      ['ec-3', { type: 'audio', name: 'E-AC-3' }],
      ['opus', { type: 'audio', name: 'Opus' }],
      ['flac', { type: 'audio', name: 'FLAC' }],
      
      // Subtitle codecs
      ['wvtt', { type: 'text', name: 'WebVTT' }],
      ['stpp', { type: 'text', name: 'TTML' }]
    ]);

    this.cache = new Map();
    this.periodCache = new Map();
    this.segmentCache = new Map();

    this.metrics = {
      manifestsParsed: 0,
      periodsParsed: 0,
      adaptationSetsParsed: 0,
      representationsParsed: 0,
      segmentsParsed: 0,
      parseErrors: 0,
      validationErrors: 0,
      contentProtectionFound: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    this.init();
  }

  init() {
    logger.info('Advanced DASH Parser initialized', {
      profiles: this.profiles.size,
      codecs: this.codecs.size,
      multiPeriod: this.config.enableMultiPeriod,
      contentProtection: this.config.enableContentProtection
    });
  }

  // Main parsing entry point
  async parseManifest(url, content = null) {
    try {
      logger.debug(`Parsing DASH manifest: ${url}`);
      
      const cacheKey = this.generateCacheKey(url);
      const cached = this.cache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp) < 30000) { // 30 second cache
        this.metrics.cacheHits++;
        return cached.manifest;
      }
      
      this.metrics.cacheMisses++;
      
      // Fetch content if not provided
      if (!content) {
        content = await this.fetchManifestContent(url);
      }
      
      // Parse XML
      const xmlDoc = this.parseXML(content);
      
      // Validate basic structure
      if (!this.validateManifest(xmlDoc)) {
        throw new Error('Invalid DASH manifest structure');
      }
      
      const manifest = await this.parseManifestDocument(xmlDoc, url);
      
      // Cache the result
      this.cache.set(cacheKey, {
        manifest,
        timestamp: Date.now()
      });
      
      this.metrics.manifestsParsed++;
      eventSystem.emit('dash:manifestParsed', { url, manifest });
      
      return manifest;
    } catch (error) {
      this.metrics.parseErrors++;
      logger.error(`DASH manifest parsing failed: ${url}`, error);
      throw error;
    }
  }

  async fetchManifestContent(url) {
    const response = await networkManager.get(url, {
      headers: {
        'Accept': 'application/dash+xml, text/xml, */*'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.text();
  }

  parseXML(content) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(content, 'text/xml');
      
      // Check for parsing errors
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        throw new Error(`XML parsing error: ${parseError.textContent}`);
      }
      
      return xmlDoc;
    } catch (error) {
      throw new Error(`Failed to parse XML: ${error.message}`);
    }
  }

  validateManifest(xmlDoc) {
    const mpdElement = xmlDoc.querySelector('MPD');
    if (!mpdElement) {
      this.metrics.validationErrors++;
      return false;
    }
    
    // Check namespace
    const namespace = mpdElement.getAttribute('xmlns');
    if (namespace && !namespace.includes('urn:mpeg:dash:schema:mpd')) {
      logger.warn('Non-standard DASH namespace detected:', namespace);
    }
    
    return true;
  }

  async parseManifestDocument(xmlDoc, baseUrl) {
    const mpdElement = xmlDoc.querySelector('MPD');
    
    const manifest = {
      type: 'dash',
      baseUrl,
      
      // Basic MPD attributes
      id: mpdElement.getAttribute('id'),
      profiles: this.parseProfiles(mpdElement.getAttribute('profiles')),
      type: mpdElement.getAttribute('type') || 'static',
      availabilityStartTime: this.parseDateTime(mpdElement.getAttribute('availabilityStartTime')),
      availabilityEndTime: this.parseDateTime(mpdElement.getAttribute('availabilityEndTime')),
      publishTime: this.parseDateTime(mpdElement.getAttribute('publishTime')),
      mediaPresentationDuration: this.parseDuration(mpdElement.getAttribute('mediaPresentationDuration')),
      minimumUpdatePeriod: this.parseDuration(mpdElement.getAttribute('minimumUpdatePeriod')),
      minBufferTime: this.parseDuration(mpdElement.getAttribute('minBufferTime')),
      timeShiftBufferDepth: this.parseDuration(mpdElement.getAttribute('timeShiftBufferDepth')),
      suggestedPresentationDelay: this.parseDuration(mpdElement.getAttribute('suggestedPresentationDelay')),
      maxSegmentDuration: this.parseDuration(mpdElement.getAttribute('maxSegmentDuration')),
      maxSubsegmentDuration: this.parseDuration(mpdElement.getAttribute('maxSubsegmentDuration')),
      
      // Calculated properties
      isLive: mpdElement.getAttribute('type') === 'dynamic',
      totalDuration: 0,
      
      // Content
      programInformation: [],
      baseUrls: [],
      locations: [],
      periods: [],
      metrics: [],
      essentialProperties: [],
      supplementalProperties: [],
      
      // Advanced features
      utcTimings: [],
      eventStreams: [],
      
      // Parsing metadata
      parseTime: Date.now(),
      warnings: [],
      errors: []
    };

    // Parse child elements
    await this.parseProgramInformation(mpdElement, manifest);
    await this.parseBaseUrls(mpdElement, manifest);
    await this.parseLocations(mpdElement, manifest);
    await this.parseUTCTimings(mpdElement, manifest);
    await this.parseMetrics(mpdElement, manifest);
    
    if (this.config.enableEventStreams) {
      await this.parseEventStreams(mpdElement, manifest);
    }
    
    // Parse periods (main content)
    await this.parsePeriods(mpdElement, manifest);
    
    // Post-processing
    this.postProcessManifest(manifest);
    
    return manifest;
  }

  async parseProgramInformation(mpdElement, manifest) {
    const programInfoElements = mpdElement.querySelectorAll('ProgramInformation');
    
    for (const element of programInfoElements) {
      const programInfo = {
        lang: element.getAttribute('lang'),
        moreInformationURL: element.getAttribute('moreInformationURL'),
        title: this.getElementText(element.querySelector('Title')),
        source: this.getElementText(element.querySelector('Source')),
        copyright: this.getElementText(element.querySelector('Copyright'))
      };
      
      manifest.programInformation.push(programInfo);
    }
  }

  async parseBaseUrls(element, manifest) {
    const baseUrlElements = element.querySelectorAll('BaseURL');
    
    for (const baseUrlElement of baseUrlElements) {
      const baseUrl = {
        url: baseUrlElement.textContent.trim(),
        serviceLocation: baseUrlElement.getAttribute('serviceLocation'),
        byteRange: baseUrlElement.getAttribute('byteRange'),
        availabilityTimeOffset: parseFloat(baseUrlElement.getAttribute('availabilityTimeOffset') || '0'),
        availabilityTimeComplete: baseUrlElement.getAttribute('availabilityTimeComplete') === 'true'
      };
      
      manifest.baseUrls.push(baseUrl);
    }
  }

  async parseLocations(mpdElement, manifest) {
    const locationElements = mpdElement.querySelectorAll('Location');
    
    for (const element of locationElements) {
      manifest.locations.push(element.textContent.trim());
    }
  }

  async parseUTCTimings(mpdElement, manifest) {
    const utcTimingElements = mpdElement.querySelectorAll('UTCTiming');
    
    for (const element of utcTimingElements) {
      const utcTiming = {
        schemeIdUri: element.getAttribute('schemeIdUri'),
        value: element.getAttribute('value')
      };
      
      manifest.utcTimings.push(utcTiming);
    }
  }

  async parseMetrics(mpdElement, manifest) {
    const metricsElements = mpdElement.querySelectorAll('Metrics');
    
    for (const element of metricsElements) {
      const metrics = {
        metrics: element.getAttribute('metrics'),
        reportings: []
      };
      
      const reportingElements = element.querySelectorAll('Reporting');
      for (const reporting of reportingElements) {
        metrics.reportings.push({
          schemeIdUri: reporting.getAttribute('schemeIdUri'),
          value: reporting.getAttribute('value')
        });
      }
      
      manifest.metrics.push(metrics);
    }
  }

  async parseEventStreams(mpdElement, manifest) {
    const eventStreamElements = mpdElement.querySelectorAll('EventStream');
    
    for (const element of eventStreamElements) {
      const eventStream = {
        schemeIdUri: element.getAttribute('schemeIdUri'),
        value: element.getAttribute('value'),
        timescale: parseInt(element.getAttribute('timescale') || '1', 10),
        events: []
      };
      
      const eventElements = element.querySelectorAll('Event');
      for (const eventElement of eventElements) {
        const event = {
          presentationTime: parseInt(eventElement.getAttribute('presentationTime') || '0', 10),
          duration: parseInt(eventElement.getAttribute('duration') || '0', 10),
          id: eventElement.getAttribute('id'),
          data: eventElement.textContent.trim()
        };
        
        eventStream.events.push(event);
      }
      
      manifest.eventStreams.push(eventStream);
    }
  }

  async parsePeriods(mpdElement, manifest) {
    const periodElements = mpdElement.querySelectorAll('Period');
    
    for (let i = 0; i < periodElements.length; i++) {
      const periodElement = periodElements[i];
      const period = await this.parsePeriod(periodElement, manifest, i);
      manifest.periods.push(period);
      manifest.totalDuration += period.duration || 0;
      this.metrics.periodsParsed++;
    }
  }

  async parsePeriod(periodElement, manifest, index) {
    const period = {
      id: periodElement.getAttribute('id') || `period_${index}`,
      start: this.parseDuration(periodElement.getAttribute('start')) || 0,
      duration: this.parseDuration(periodElement.getAttribute('duration')),
      bitstreamSwitching: periodElement.getAttribute('bitstreamSwitching') === 'true',
      
      // Content
      baseUrls: [],
      segmentBase: null,
      segmentList: null,
      segmentTemplate: null,
      adaptationSets: [],
      eventStreams: [],
      
      // Calculated properties
      totalDuration: 0,
      
      // Metadata
      index
    };

    // Parse child elements
    await this.parseBaseUrls(periodElement, period);
    
    if (this.config.enableEventStreams) {
      await this.parseEventStreams(periodElement, period);
    }
    
    // Parse segment info at period level
    period.segmentBase = this.parseSegmentBase(periodElement.querySelector('SegmentBase'));
    period.segmentList = this.parseSegmentList(periodElement.querySelector('SegmentList'));
    period.segmentTemplate = this.parseSegmentTemplate(periodElement.querySelector('SegmentTemplate'));
    
    // Parse adaptation sets
    await this.parseAdaptationSets(periodElement, period, manifest);
    
    return period;
  }

  async parseAdaptationSets(periodElement, period, manifest) {
    const adaptationSetElements = periodElement.querySelectorAll('AdaptationSet');
    
    for (let i = 0; i < adaptationSetElements.length; i++) {
      const adaptationSetElement = adaptationSetElements[i];
      const adaptationSet = await this.parseAdaptationSet(adaptationSetElement, period, manifest, i);
      period.adaptationSets.push(adaptationSet);
      this.metrics.adaptationSetsParsed++;
    }
  }

  async parseAdaptationSet(adaptationSetElement, period, manifest, index) {
    const adaptationSet = {
      id: adaptationSetElement.getAttribute('id') || `as_${index}`,
      group: parseInt(adaptationSetElement.getAttribute('group') || '0', 10),
      lang: adaptationSetElement.getAttribute('lang'),
      contentType: adaptationSetElement.getAttribute('contentType'),
      par: adaptationSetElement.getAttribute('par'),
      minBandwidth: parseInt(adaptationSetElement.getAttribute('minBandwidth') || '0', 10),
      maxBandwidth: parseInt(adaptationSetElement.getAttribute('maxBandwidth') || '0', 10),
      minWidth: parseInt(adaptationSetElement.getAttribute('minWidth') || '0', 10),
      maxWidth: parseInt(adaptationSetElement.getAttribute('maxWidth') || '0', 10),
      minHeight: parseInt(adaptationSetElement.getAttribute('minHeight') || '0', 10),
      maxHeight: parseInt(adaptationSetElement.getAttribute('maxHeight') || '0', 10),
      minFrameRate: adaptationSetElement.getAttribute('minFrameRate'),
      maxFrameRate: adaptationSetElement.getAttribute('maxFrameRate'),
      segmentAlignment: adaptationSetElement.getAttribute('segmentAlignment') === 'true',
      subsegmentAlignment: adaptationSetElement.getAttribute('subsegmentAlignment') === 'true',
      subsegmentStartsWithSAP: parseInt(adaptationSetElement.getAttribute('subsegmentStartsWithSAP') || '0', 10),
      bitstreamSwitching: adaptationSetElement.getAttribute('bitstreamSwitching') === 'true',
      
      // Content
      mimeType: adaptationSetElement.getAttribute('mimeType'),
      codecs: adaptationSetElement.getAttribute('codecs'),
      width: parseInt(adaptationSetElement.getAttribute('width') || '0', 10),
      height: parseInt(adaptationSetElement.getAttribute('height') || '0', 10),
      frameRate: adaptationSetElement.getAttribute('frameRate'),
      audioSamplingRate: adaptationSetElement.getAttribute('audioSamplingRate'),
      
      // Child elements
      baseUrls: [],
      segmentBase: null,
      segmentList: null,
      segmentTemplate: null,
      contentProtection: [],
      audioChannelConfiguration: [],
      representations: [],
      viewpoints: [],
      roles: [],
      ratings: [],
      accessibilities: [],
      
      // Calculated properties
      mediaType: this.detectMediaType(adaptationSetElement),
      
      // Metadata
      index
    };

    // Parse child elements
    await this.parseBaseUrls(adaptationSetElement, adaptationSet);
    
    // Parse descriptors
    this.parseRoles(adaptationSetElement, adaptationSet);
    this.parseRatings(adaptationSetElement, adaptationSet);
    this.parseViewpoints(adaptationSetElement, adaptationSet);
    this.parseAccessibilities(adaptationSetElement, adaptationSet);
    this.parseAudioChannelConfiguration(adaptationSetElement, adaptationSet);
    
    // Parse content protection
    if (this.config.enableContentProtection) {
      this.parseContentProtection(adaptationSetElement, adaptationSet);
    }
    
    // Parse segment info at adaptation set level
    adaptationSet.segmentBase = this.parseSegmentBase(adaptationSetElement.querySelector('SegmentBase'));
    adaptationSet.segmentList = this.parseSegmentList(adaptationSetElement.querySelector('SegmentList'));
    adaptationSet.segmentTemplate = this.parseSegmentTemplate(adaptationSetElement.querySelector('SegmentTemplate'));
    
    // Parse representations
    await this.parseRepresentations(adaptationSetElement, adaptationSet, period, manifest);
    
    return adaptationSet;
  }

  async parseRepresentations(adaptationSetElement, adaptationSet, period, manifest) {
    const representationElements = adaptationSetElement.querySelectorAll('Representation');
    
    for (let i = 0; i < representationElements.length; i++) {
      const representationElement = representationElements[i];
      const representation = await this.parseRepresentation(representationElement, adaptationSet, period, manifest, i);
      adaptationSet.representations.push(representation);
      this.metrics.representationsParsed++;
    }
  }

  async parseRepresentation(representationElement, adaptationSet, period, manifest, index) {
    const representation = {
      id: representationElement.getAttribute('id') || `rep_${index}`,
      bandwidth: parseInt(representationElement.getAttribute('bandwidth') || '0', 10),
      qualityRanking: parseInt(representationElement.getAttribute('qualityRanking') || '0', 10),
      dependencyId: representationElement.getAttribute('dependencyId'),
      mediaStreamStructureId: representationElement.getAttribute('mediaStreamStructureId'),
      
      // Inherited or overridden attributes
      mimeType: representationElement.getAttribute('mimeType') || adaptationSet.mimeType,
      codecs: representationElement.getAttribute('codecs') || adaptationSet.codecs,
      width: parseInt(representationElement.getAttribute('width') || adaptationSet.width.toString(), 10),
      height: parseInt(representationElement.getAttribute('height') || adaptationSet.height.toString(), 10),
      frameRate: representationElement.getAttribute('frameRate') || adaptationSet.frameRate,
      audioSamplingRate: representationElement.getAttribute('audioSamplingRate') || adaptationSet.audioSamplingRate,
      
      // Child elements
      baseUrls: [],
      segmentBase: null,
      segmentList: null,
      segmentTemplate: null,
      contentProtection: [],
      audioChannelConfiguration: [],
      subRepresentations: [],
      
      // Generated content
      segments: [],
      
      // Calculated properties
      mediaType: adaptationSet.mediaType,
      qualityLabel: null,
      
      // Metadata
      index
    };

    // Parse child elements
    await this.parseBaseUrls(representationElement, representation);
    
    // Parse audio channel configuration
    this.parseAudioChannelConfiguration(representationElement, representation);
    
    // Parse content protection
    if (this.config.enableContentProtection) {
      this.parseContentProtection(representationElement, representation);
    }
    
    // Parse segment info (inheritance hierarchy: Representation > AdaptationSet > Period > MPD)
    representation.segmentBase = this.parseSegmentBase(representationElement.querySelector('SegmentBase')) ||
                                adaptationSet.segmentBase || period.segmentBase;
    representation.segmentList = this.parseSegmentList(representationElement.querySelector('SegmentList')) ||
                                adaptationSet.segmentList || period.segmentList;
    representation.segmentTemplate = this.parseSegmentTemplate(representationElement.querySelector('SegmentTemplate')) ||
                                   adaptationSet.segmentTemplate || period.segmentTemplate;
    
    // Parse sub-representations
    await this.parseSubRepresentations(representationElement, representation);
    
    // Generate segments
    await this.generateSegments(representation, adaptationSet, period, manifest);
    
    // Generate quality label
    representation.qualityLabel = this.generateQualityLabel(representation);
    
    return representation;
  }

  async parseSubRepresentations(representationElement, representation) {
    const subRepElements = representationElement.querySelectorAll('SubRepresentation');
    
    for (const subRepElement of subRepElements) {
      const subRepresentation = {
        level: parseInt(subRepElement.getAttribute('level') || '0', 10),
        dependencyLevel: subRepElement.getAttribute('dependencyLevel'),
        bandwidth: parseInt(subRepElement.getAttribute('bandwidth') || '0', 10),
        contentComponent: subRepElement.getAttribute('contentComponent')
      };
      
      representation.subRepresentations.push(subRepresentation);
    }
  }

  parseSegmentBase(segmentBaseElement) {
    if (!segmentBaseElement) return null;
    
    return {
      timescale: parseInt(segmentBaseElement.getAttribute('timescale') || '1', 10),
      presentationTimeOffset: parseInt(segmentBaseElement.getAttribute('presentationTimeOffset') || '0', 10),
      indexRange: segmentBaseElement.getAttribute('indexRange'),
      indexRangeExact: segmentBaseElement.getAttribute('indexRangeExact') === 'true',
      availabilityTimeOffset: parseFloat(segmentBaseElement.getAttribute('availabilityTimeOffset') || '0'),
      availabilityTimeComplete: segmentBaseElement.getAttribute('availabilityTimeComplete') === 'true',
      
      initialization: this.parseInitialization(segmentBaseElement.querySelector('Initialization')),
      representationIndex: this.parseRepresentationIndex(segmentBaseElement.querySelector('RepresentationIndex'))
    };
  }

  parseSegmentList(segmentListElement) {
    if (!segmentListElement) return null;
    
    const segmentList = {
      timescale: parseInt(segmentListElement.getAttribute('timescale') || '1', 10),
      presentationTimeOffset: parseInt(segmentListElement.getAttribute('presentationTimeOffset') || '0', 10),
      duration: parseInt(segmentListElement.getAttribute('duration') || '0', 10),
      startNumber: parseInt(segmentListElement.getAttribute('startNumber') || '1', 10),
      
      initialization: this.parseInitialization(segmentListElement.querySelector('Initialization')),
      segmentUrls: []
    };
    
    const segmentUrlElements = segmentListElement.querySelectorAll('SegmentURL');
    for (const element of segmentUrlElements) {
      const segmentUrl = {
        media: element.getAttribute('media'),
        mediaRange: element.getAttribute('mediaRange'),
        index: element.getAttribute('index'),
        indexRange: element.getAttribute('indexRange')
      };
      
      segmentList.segmentUrls.push(segmentUrl);
    }
    
    return segmentList;
  }

  parseSegmentTemplate(segmentTemplateElement) {
    if (!segmentTemplateElement) return null;
    
    const segmentTemplate = {
      timescale: parseInt(segmentTemplateElement.getAttribute('timescale') || '1', 10),
      presentationTimeOffset: parseInt(segmentTemplateElement.getAttribute('presentationTimeOffset') || '0', 10),
      duration: parseInt(segmentTemplateElement.getAttribute('duration') || '0', 10),
      startNumber: parseInt(segmentTemplateElement.getAttribute('startNumber') || '1', 10),
      media: segmentTemplateElement.getAttribute('media'),
      index: segmentTemplateElement.getAttribute('index'),
      initialization: segmentTemplateElement.getAttribute('initialization'),
      bitstreamSwitching: segmentTemplateElement.getAttribute('bitstreamSwitching'),
      
      segmentTimeline: this.parseSegmentTimeline(segmentTemplateElement.querySelector('SegmentTimeline')),
      initializationElement: this.parseInitialization(segmentTemplateElement.querySelector('Initialization'))
    };
    
    return segmentTemplate;
  }

  parseSegmentTimeline(segmentTimelineElement) {
    if (!segmentTimelineElement) return null;
    
    const timeline = {
      segments: []
    };
    
    const sElements = segmentTimelineElement.querySelectorAll('S');
    for (const element of sElements) {
      const s = {
        t: parseInt(element.getAttribute('t') || '0', 10),
        d: parseInt(element.getAttribute('d') || '0', 10),
        r: parseInt(element.getAttribute('r') || '0', 10)
      };
      
      timeline.segments.push(s);
    }
    
    return timeline;
  }

  parseInitialization(initializationElement) {
    if (!initializationElement) return null;
    
    return {
      sourceURL: initializationElement.getAttribute('sourceURL'),
      range: initializationElement.getAttribute('range')
    };
  }

  parseRepresentationIndex(representationIndexElement) {
    if (!representationIndexElement) return null;
    
    return {
      sourceURL: representationIndexElement.getAttribute('sourceURL'),
      range: representationIndexElement.getAttribute('range')
    };
  }

  parseContentProtection(element, target) {
    const contentProtectionElements = element.querySelectorAll('ContentProtection');
    
    for (const cpElement of contentProtectionElements) {
      const contentProtection = {
        schemeIdUri: cpElement.getAttribute('schemeIdUri'),
        value: cpElement.getAttribute('value'),
        cencDefaultKID: cpElement.getAttribute('cenc:default_KID'),
        
        // DRM-specific data
        pssh: [],
        laurl: [],
        keyIds: []
      };
      
      // Parse PSSH boxes
      const psshElements = cpElement.querySelectorAll('cenc\\:pssh, pssh');
      for (const pssh of psshElements) {
        contentProtection.pssh.push(pssh.textContent.trim());
      }
      
      // Parse license acquisition URLs
      const laurlElements = cpElement.querySelectorAll('ms\\:laurl, laurl');
      for (const laurl of laurlElements) {
        contentProtection.laurl.push(laurl.getAttribute('licenseUrl'));
      }
      
      target.contentProtection.push(contentProtection);
      this.metrics.contentProtectionFound++;
    }
  }

  parseRoles(element, target) {
    const roleElements = element.querySelectorAll('Role');
    
    for (const roleElement of roleElements) {
      target.roles.push({
        schemeIdUri: roleElement.getAttribute('schemeIdUri'),
        value: roleElement.getAttribute('value')
      });
    }
  }

  parseRatings(element, target) {
    const ratingElements = element.querySelectorAll('Rating');
    
    for (const ratingElement of ratingElements) {
      target.ratings.push({
        schemeIdUri: ratingElement.getAttribute('schemeIdUri'),
        value: ratingElement.getAttribute('value')
      });
    }
  }

  parseViewpoints(element, target) {
    const viewpointElements = element.querySelectorAll('Viewpoint');
    
    for (const viewpointElement of viewpointElements) {
      target.viewpoints.push({
        schemeIdUri: viewpointElement.getAttribute('schemeIdUri'),
        value: viewpointElement.getAttribute('value')
      });
    }
  }

  parseAccessibilities(element, target) {
    const accessibilityElements = element.querySelectorAll('Accessibility');
    
    for (const accessibilityElement of accessibilityElements) {
      target.accessibilities.push({
        schemeIdUri: accessibilityElement.getAttribute('schemeIdUri'),
        value: accessibilityElement.getAttribute('value')
      });
    }
  }

  parseAudioChannelConfiguration(element, target) {
    const accElements = element.querySelectorAll('AudioChannelConfiguration');
    
    for (const accElement of accElements) {
      target.audioChannelConfiguration.push({
        schemeIdUri: accElement.getAttribute('schemeIdUri'),
        value: accElement.getAttribute('value')
      });
    }
  }

  async generateSegments(representation, adaptationSet, period, manifest) {
    if (representation.segmentTemplate) {
      await this.generateSegmentsFromTemplate(representation, adaptationSet, period, manifest);
    } else if (representation.segmentList) {
      await this.generateSegmentsFromList(representation, adaptationSet, period, manifest);
    } else if (representation.segmentBase) {
      await this.generateSegmentsFromBase(representation, adaptationSet, period, manifest);
    } else {
      // Single segment representation
      await this.generateSingleSegment(representation, adaptationSet, period, manifest);
    }
  }

  async generateSegmentsFromTemplate(representation, adaptationSet, period, manifest) {
    const template = representation.segmentTemplate;
    
    if (template.segmentTimeline) {
      await this.generateSegmentsFromTimeline(representation, template, period, manifest);
    } else {
      await this.generateSegmentsFromDuration(representation, template, period, manifest);
    }
  }

  async generateSegmentsFromTimeline(representation, template, period, manifest) {
    const timeline = template.segmentTimeline;
    let segmentNumber = template.startNumber;
    let presentationTime = 0;
    
    for (const s of timeline.segments) {
      const repeatCount = s.r + 1; // r=-1 means repeat until end
      
      for (let i = 0; i < repeatCount; i++) {
        const segment = createMediaSegment(
          this.buildSegmentUrl(template.media, representation, segmentNumber, presentationTime),
          s.d / template.timescale,
          segmentNumber
        );
        
        segment.presentationTime = presentationTime;
        segment.timescale = template.timescale;
        
        if (template.initialization) {
          segment.initializationUrl = this.buildSegmentUrl(template.initialization, representation, segmentNumber, presentationTime);
        }
        
        representation.segments.push(segment);
        this.metrics.segmentsParsed++;
        
        segmentNumber++;
        presentationTime += s.d;
        
        // Limit segment generation for performance
        if (representation.segments.length >= this.config.maxSegmentLookAhead) {
          break;
        }
      }
      
      if (representation.segments.length >= this.config.maxSegmentLookAhead) {
        break;
      }
    }
  }

  async generateSegmentsFromDuration(representation, template, period, manifest) {
    const segmentDuration = template.duration / template.timescale;
    const periodDuration = period.duration || manifest.mediaPresentationDuration || (this.config.maxSegmentLookAhead * segmentDuration);
    const segmentCount = Math.min(Math.ceil(periodDuration / segmentDuration), this.config.maxSegmentLookAhead);
    
    for (let i = 0; i < segmentCount; i++) {
      const segmentNumber = template.startNumber + i;
      const presentationTime = i * template.duration;
      
      const segment = createMediaSegment(
        this.buildSegmentUrl(template.media, representation, segmentNumber, presentationTime),
        segmentDuration,
        segmentNumber
      );
      
      segment.presentationTime = presentationTime;
      segment.timescale = template.timescale;
      
      if (template.initialization) {
        segment.initializationUrl = this.buildSegmentUrl(template.initialization, representation, segmentNumber, presentationTime);
      }
      
      representation.segments.push(segment);
      this.metrics.segmentsParsed++;
    }
  }

  async generateSegmentsFromList(representation, adaptationSet, period, manifest) {
    const segmentList = representation.segmentList;
    
    for (let i = 0; i < segmentList.segmentUrls.length; i++) {
      const segmentUrl = segmentList.segmentUrls[i];
      const segmentNumber = segmentList.startNumber + i;
      const duration = segmentList.duration / segmentList.timescale;
      
      const segment = createMediaSegment(
        this.resolveUrl(segmentUrl.media, manifest.baseUrl),
        duration,
        segmentNumber
      );
      
      segment.mediaRange = segmentUrl.mediaRange;
      segment.indexRange = segmentUrl.indexRange;
      segment.timescale = segmentList.timescale;
      
      if (segmentList.initialization) {
        segment.initializationUrl = this.resolveUrl(segmentList.initialization.sourceURL, manifest.baseUrl);
        segment.initializationRange = segmentList.initialization.range;
      }
      
      representation.segments.push(segment);
      this.metrics.segmentsParsed++;
    }
  }

  async generateSegmentsFromBase(representation, adaptationSet, period, manifest) {
    // Single segment with byte ranges or index-based access
    const segment = createMediaSegment(
      this.resolveUrl(representation.baseUrls[0]?.url || '', manifest.baseUrl),
      period.duration || manifest.mediaPresentationDuration || 0,
      1
    );
    
    const segmentBase = representation.segmentBase;
    if (segmentBase.initialization) {
      segment.initializationUrl = this.resolveUrl(segmentBase.initialization.sourceURL, manifest.baseUrl);
      segment.initializationRange = segmentBase.initialization.range;
    }
    
    segment.indexRange = segmentBase.indexRange;
    segment.timescale = segmentBase.timescale;
    
    representation.segments.push(segment);
    this.metrics.segmentsParsed++;
  }

  async generateSingleSegment(representation, adaptationSet, period, manifest) {
    // Single file representation (e.g., MP4)
    const segment = createMediaSegment(
      this.resolveUrl(representation.baseUrls[0]?.url || manifest.baseUrl, manifest.baseUrl),
      period.duration || manifest.mediaPresentationDuration || 0,
      1
    );
    
    representation.segments.push(segment);
    this.metrics.segmentsParsed++;
  }

  buildSegmentUrl(template, representation, segmentNumber, presentationTime) {
    if (!template) return '';
    
    let url = template
      .replace(/\$RepresentationID\$/g, representation.id)
      .replace(/\$Number\$/g, segmentNumber.toString())
      .replace(/\$Number%0(\d+)d\$/g, (match, width) => segmentNumber.toString().padStart(parseInt(width), '0'))
      .replace(/\$Time\$/g, presentationTime.toString())
      .replace(/\$Bandwidth\$/g, representation.bandwidth.toString());
    
    return url;
  }

  // Utility methods
  parseProfiles(profilesString) {
    if (!profilesString) return [];
    return profilesString.split(',').map(p => p.trim());
  }

  parseDateTime(dateTimeString) {
    if (!dateTimeString) return null;
    return new Date(dateTimeString);
  }

  parseDuration(durationString) {
    if (!durationString) return null;
    
    // Parse ISO 8601 duration format (PT1H2M3.4S)
    const match = durationString.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/);
    if (!match) return parseFloat(durationString) || null;
    
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseFloat(match[3] || '0');
    
    return hours * 3600 + minutes * 60 + seconds;
  }

  detectMediaType(adaptationSetElement) {
    const contentType = adaptationSetElement.getAttribute('contentType');
    if (contentType) {
      if (contentType.includes('video')) return MediaType.VIDEO;
      if (contentType.includes('audio')) return MediaType.AUDIO;
      if (contentType.includes('text')) return MediaType.SUBTITLE;
    }
    
    const mimeType = adaptationSetElement.getAttribute('mimeType');
    if (mimeType) {
      if (mimeType.includes('video')) return MediaType.VIDEO;
      if (mimeType.includes('audio')) return MediaType.AUDIO;
      if (mimeType.includes('text')) return MediaType.SUBTITLE;
    }
    
    const codecs = adaptationSetElement.getAttribute('codecs');
    if (codecs) {
      const codecInfo = this.codecs.get(codecs.split('.')[0]);
      if (codecInfo) {
        switch (codecInfo.type) {
          case 'video': return MediaType.VIDEO;
          case 'audio': return MediaType.AUDIO;
          case 'text': return MediaType.SUBTITLE;
        }
      }
    }
    
    // Check for video-specific attributes
    if (adaptationSetElement.getAttribute('width') || adaptationSetElement.getAttribute('height')) {
      return MediaType.VIDEO;
    }
    
    // Check for audio-specific attributes
    if (adaptationSetElement.getAttribute('audioSamplingRate')) {
      return MediaType.AUDIO;
    }
    
    return MediaType.UNKNOWN;
  }

  generateQualityLabel(representation) {
    if (representation.mediaType === MediaType.VIDEO) {
      if (representation.width && representation.height) {
        const height = representation.height;
        if (height >= 2160) return '4K';
        if (height >= 1440) return '1440p';
        if (height >= 1080) return '1080p';
        if (height >= 720) return '720p';
        if (height >= 480) return '480p';
        return `${representation.width}x${representation.height}`;
      }
    }
    
    if (representation.bandwidth) {
      const mbps = Math.round(representation.bandwidth / 1000000);
      return `${mbps} Mbps`;
    }
    
    return 'Unknown Quality';
  }

  getElementText(element) {
    return element ? element.textContent.trim() : '';
  }

  resolveUrl(url, baseUrl) {
    if (!url) return baseUrl;
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

  postProcessManifest(manifest) {
    // Calculate total duration if not specified
    if (!manifest.mediaPresentationDuration && manifest.periods.length > 0) {
      manifest.mediaPresentationDuration = manifest.totalDuration;
    }
    
    // Add quality labels and sort representations
    for (const period of manifest.periods) {
      for (const adaptationSet of period.adaptationSets) {
        // Sort representations by bandwidth (highest first)
        adaptationSet.representations.sort((a, b) => b.bandwidth - a.bandwidth);
        
        // Detect adaptation set characteristics
        adaptationSet.hasMultipleQualities = adaptationSet.representations.length > 1;
        adaptationSet.maxBandwidth = Math.max(...adaptationSet.representations.map(r => r.bandwidth));
        adaptationSet.minBandwidth = Math.min(...adaptationSet.representations.map(r => r.bandwidth));
      }
    }
    
    // Validate cross-references
    this.validateManifestReferences(manifest);
  }

  validateManifestReferences(manifest) {
    // Validate that referenced content actually exists
    for (const period of manifest.periods) {
      for (const adaptationSet of period.adaptationSets) {
        for (const representation of adaptationSet.representations) {
          if (representation.dependencyId) {
            const dependency = adaptationSet.representations.find(r => r.id === representation.dependencyId);
            if (!dependency) {
              manifest.warnings.push(`Representation ${representation.id} references unknown dependency: ${representation.dependencyId}`);
            }
          }
        }
      }
    }
  }

  generateCacheKey(url) {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  // Public API methods
  async getManifest(url) {
    return this.parseManifest(url);
  }

  async getPeriod(manifest, periodIndex) {
    if (periodIndex >= manifest.periods.length) {
      throw new Error('Invalid period index');
    }
    return manifest.periods[periodIndex];
  }

  async getAdaptationSet(period, adaptationSetIndex) {
    if (adaptationSetIndex >= period.adaptationSets.length) {
      throw new Error('Invalid adaptation set index');
    }
    return period.adaptationSets[adaptationSetIndex];
  }

  async getRepresentation(adaptationSet, representationIndex) {
    if (representationIndex >= adaptationSet.representations.length) {
      throw new Error('Invalid representation index');
    }
    return adaptationSet.representations[representationIndex];
  }

  getVideoAdaptationSets(manifest) {
    const videoSets = [];
    for (const period of manifest.periods) {
      for (const adaptationSet of period.adaptationSets) {
        if (adaptationSet.mediaType === MediaType.VIDEO) {
          videoSets.push(adaptationSet);
        }
      }
    }
    return videoSets;
  }

  getAudioAdaptationSets(manifest) {
    const audioSets = [];
    for (const period of manifest.periods) {
      for (const adaptationSet of period.adaptationSets) {
        if (adaptationSet.mediaType === MediaType.AUDIO) {
          audioSets.push(adaptationSet);
        }
      }
    }
    return audioSets;
  }

  getSubtitleAdaptationSets(manifest) {
    const subtitleSets = [];
    for (const period of manifest.periods) {
      for (const adaptationSet of period.adaptationSets) {
        if (adaptationSet.mediaType === MediaType.SUBTITLE) {
          subtitleSets.push(adaptationSet);
        }
      }
    }
    return subtitleSets;
  }

  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      periodCacheSize: this.periodCache.size,
      segmentCacheSize: this.segmentCache.size,
      supportedProfiles: this.profiles.size,
      supportedCodecs: this.codecs.size
    };
  }

  clearCache() {
    this.cache.clear();
    this.periodCache.clear();
    this.segmentCache.clear();
    logger.info('DASH Parser cache cleared');
  }

  destroy() {
    this.clearCache();
    logger.info('DASH Parser destroyed');
  }
}

// Export default instance
export const dashParser = new AdvancedDASHParser();

export default AdvancedDASHParser;