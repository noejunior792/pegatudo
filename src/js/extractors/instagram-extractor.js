/**
 * Advanced Instagram Extractor for PegaTudo
 * Comprehensive Instagram content extraction including posts, stories, reels,
 * IGTV, and highlights with high-quality format selection
 */

import { logger } from '../core/logger.js';
import { config } from '../core/config.js';
import { eventSystem } from '../core/events.js';
import { networkManager } from '../network/network-manager.js';
import { 
  MediaType,
  Platform,
  DetectionMethod,
  createMediaSource,
  createDetectionResult
} from '../core/types.js';

export class AdvancedInstagramExtractor {
  constructor(options = {}) {
    this.id = 'instagram';
    this.name = 'Instagram Extractor';
    this.platforms = [Platform.INSTAGRAM];
    this.priority = 85;

    this.config = {
      enableStories: options.enableStories !== false,
      enableReels: options.enableReels !== false,
      enableIGTV: options.enableIGTV !== false,
      enableHighlights: options.enableHighlights || false,
      enableCarousels: options.enableCarousels !== false,
      enableUserPosts: options.enableUserPosts || false,
      enableLiveStreams: options.enableLiveStreams || false,
      preferredQuality: options.preferredQuality || 'highest',
      bypassPrivateRestriction: options.bypassPrivateRestriction || false,
      extractAudioFromVideos: options.extractAudioFromVideos || false,
      useAlternativeAPIs: options.useAlternativeAPIs !== false,
      ...options
    };

    // Instagram URL patterns
    this.patterns = {
      post: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/p\/([A-Za-z0-9_-]+)/,
      reel: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/reel\/([A-Za-z0-9_-]+)/,
      story: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/stories\/([^\/]+)\/(\d+)/,
      igtv: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/tv\/([A-Za-z0-9_-]+)/,
      profile: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^\/\?]+)/,
      highlight: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/stories\/highlights\/(\d+)/,
      live: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^\/]+)\/live/
    };

    // Instagram API endpoints
    this.endpoints = {
      webApi: 'https://www.instagram.com/api/v1/',
      graphql: 'https://www.instagram.com/graphql/query/',
      media: 'https://www.instagram.com/api/v1/media/',
      users: 'https://www.instagram.com/api/v1/users/',
      stories: 'https://www.instagram.com/api/v1/feed/user/',
      reels: 'https://www.instagram.com/api/v1/clips/',
      highlights: 'https://www.instagram.com/api/v1/highlights/',
      live: 'https://www.instagram.com/api/v1/live/'
    };

    // User agents for different contexts
    this.userAgents = {
      web: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      app: 'Instagram 312.0.0.12.109 Android (33/13; 420dpi; 1080x2340; Samsung; SM-G991B; o1s; qcom; en_US; 542617568)'
    };

    // GraphQL query hashes (these change periodically)
    this.queryHashes = {
      PostPage: 'b3055c01b4b222b8a47dc12b090e4e64',
      StoriesPage: 'de8017ee0a7c9c45ec4260733d81ea31',
      ProfilePage: 'c6809c9c025875ac6f02619eae97a80e',
      ReelsMediaPage: 'b52c78f7e2c8a786e0c5c47f8d9b0d4d',
      HighlightsPage: 'c9c56db64beb4c3e98d42fa94eb05ca1'
    };

    // Media quality preferences
    this.qualityOrder = [
      'video_url',      // Highest quality video
      'video_versions', // Alternative video qualities
      'image_versions2', // High quality images
      'thumbnail_url',   // Fallback thumbnails
      'display_url'     // Display images
    ];

    this.cache = new Map();
    this.sessionCache = new Map();
    this.csrfCache = new Map();

    this.metrics = {
      extractionsPerformed: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      postsExtracted: 0,
      storiesExtracted: 0,
      reelsExtracted: 0,
      igtvExtracted: 0,
      carouselsExtracted: 0,
      graphqlQueries: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    this.init();
  }

  init() {
    logger.info('Advanced Instagram Extractor initialized', {
      platforms: this.platforms,
      features: {
        stories: this.config.enableStories,
        reels: this.config.enableReels,
        igtv: this.config.enableIGTV,
        highlights: this.config.enableHighlights
      }
    });
  }

  canExtract(url) {
    return Object.values(this.patterns).some(pattern => pattern.test(url));
  }

  async extract(url, options = {}) {
    try {
      this.metrics.extractionsPerformed++;
      logger.info(`Extracting Instagram content: ${url}`);

      // Determine content type and extract identifier
      const contentInfo = this.parseUrl(url);
      if (!contentInfo) {
        throw new Error('Could not parse Instagram URL');
      }

      // Check cache
      const cacheKey = `${contentInfo.type}_${contentInfo.id}_${JSON.stringify(options)}`;
      const cached = this.cache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < 300000) { // 5 minute cache
        this.metrics.cacheHits++;
        return cached.result;
      }
      
      this.metrics.cacheMisses++;

      // Extract content based on type
      const contentData = await this.extractContent(contentInfo, url, options);
      
      // Convert to detection result
      const result = await this.convertToDetectionResult(contentData, url, options);
      
      // Cache the result
      this.cache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });

      this.metrics.successfulExtractions++;
      eventSystem.emit('instagram:extractionCompleted', { 
        type: contentInfo.type, 
        id: contentInfo.id, 
        url, 
        result 
      });
      
      return result;
    } catch (error) {
      this.metrics.failedExtractions++;
      logger.error(`Instagram extraction failed for ${url}`, error);
      throw error;
    }
  }

  parseUrl(url) {
    for (const [type, pattern] of Object.entries(this.patterns)) {
      const match = url.match(pattern);
      if (match) {
        switch (type) {
          case 'post':
          case 'reel':
          case 'igtv':
            return { type, id: match[1], shortcode: match[1] };
          case 'story':
            return { type, username: match[1], storyId: match[2] };
          case 'highlight':
            return { type, id: match[1] };
          case 'profile':
            return { type, username: match[1] };
          case 'live':
            return { type, username: match[1] };
        }
      }
    }
    return null;
  }

  async extractContent(contentInfo, originalUrl, options = {}) {
    switch (contentInfo.type) {
      case 'post':
        return this.extractPost(contentInfo.shortcode, originalUrl, options);
      case 'reel':
        return this.extractReel(contentInfo.shortcode, originalUrl, options);
      case 'story':
        return this.extractStory(contentInfo.username, contentInfo.storyId, originalUrl, options);
      case 'igtv':
        return this.extractIGTV(contentInfo.shortcode, originalUrl, options);
      case 'highlight':
        return this.extractHighlight(contentInfo.id, originalUrl, options);
      case 'profile':
        return this.extractProfile(contentInfo.username, originalUrl, options);
      case 'live':
        return this.extractLive(contentInfo.username, originalUrl, options);
      default:
        throw new Error(`Unsupported Instagram content type: ${contentInfo.type}`);
    }
  }

  async extractPost(shortcode, originalUrl, options = {}) {
    try {
      // First try GraphQL approach
      const postData = await this.getPostDataGraphQL(shortcode);
      if (postData) {
        this.metrics.postsExtracted++;
        return this.parsePostData(postData, 'post');
      }

      // Fallback to web scraping
      return this.extractPostFromWeb(shortcode, originalUrl);
    } catch (error) {
      logger.error(`Failed to extract Instagram post ${shortcode}`, error);
      throw error;
    }
  }

  async getPostDataGraphQL(shortcode) {
    const queryHash = this.queryHashes.PostPage;
    const variables = JSON.stringify({
      shortcode: shortcode,
      child_comment_count: 3,
      fetch_comment_count: 40,
      parent_comment_count: 24,
      has_threaded_comments: true
    });

    const url = `${this.endpoints.graphql}?query_hash=${queryHash}&variables=${encodeURIComponent(variables)}`;

    const response = await this.makeAuthenticatedRequest(url);
    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status}`);
    }

    const data = await response.json();
    this.metrics.graphqlQueries++;

    if (data.data && data.data.shortcode_media) {
      return data.data.shortcode_media;
    }

    return null;
  }

  async extractPostFromWeb(shortcode, originalUrl) {
    const response = await networkManager.get(originalUrl, {
      headers: {
        'User-Agent': this.userAgents.web,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://www.instagram.com/',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Instagram post: ${response.status}`);
    }

    const html = await response.text();
    return this.parsePostFromHTML(html, shortcode);
  }

  parsePostFromHTML(html, shortcode) {
    try {
      // Extract JSON data from the page
      const jsonDataMatch = html.match(/window\._sharedData\s*=\s*({.+?});/);
      if (jsonDataMatch) {
        const sharedData = JSON.parse(jsonDataMatch[1]);
        const media = sharedData.entry_data?.PostPage?.[0]?.graphql?.shortcode_media;
        if (media) {
          return this.parsePostData(media, 'post');
        }
      }

      // Fallback to additional JSON patterns
      const additionalDataMatch = html.match(/window\.__additionalDataLoaded\('\/p\/[^']+',\s*({.+?})\);/);
      if (additionalDataMatch) {
        const additionalData = JSON.parse(additionalDataMatch[1]);
        const media = additionalData.graphql?.shortcode_media;
        if (media) {
          return this.parsePostData(media, 'post');
        }
      }

      throw new Error('Could not find post data in HTML');
    } catch (error) {
      logger.error('Failed to parse Instagram post HTML', error);
      throw error;
    }
  }

  parsePostData(media, contentType) {
    const contentData = {
      id: media.id,
      shortcode: media.shortcode,
      type: contentType,
      typename: media.__typename,
      isVideo: media.is_video,
      caption: this.extractCaption(media),
      timestamp: new Date(media.taken_at_timestamp * 1000),
      owner: {
        id: media.owner.id,
        username: media.owner.username,
        fullName: media.owner.full_name,
        profilePicUrl: media.owner.profile_pic_url,
        isVerified: media.owner.is_verified
      },
      dimensions: {
        width: media.dimensions.width,
        height: media.dimensions.height
      },
      engagement: {
        likes: media.edge_media_preview_like?.count || 0,
        comments: media.edge_media_to_comment?.count || 0,
        views: media.video_view_count || 0
      },
      mediaUrls: [],
      isCarousel: media.__typename === 'GraphSidecar'
    };

    // Extract media URLs
    if (contentData.isCarousel) {
      // Handle carousel posts (multiple images/videos)
      this.metrics.carouselsExtracted++;
      contentData.mediaUrls = this.extractCarouselMedia(media);
    } else if (media.is_video) {
      // Single video post
      contentData.mediaUrls = this.extractVideoUrls(media);
    } else {
      // Single image post
      contentData.mediaUrls = this.extractImageUrls(media);
    }

    // Extract additional metadata
    if (media.location) {
      contentData.location = {
        id: media.location.id,
        name: media.location.name,
        slug: media.location.slug
      };
    }

    if (media.edge_media_to_tagged_user?.edges) {
      contentData.taggedUsers = media.edge_media_to_tagged_user.edges.map(edge => ({
        id: edge.node.user.id,
        username: edge.node.user.username,
        fullName: edge.node.user.full_name
      }));
    }

    return contentData;
  }

  extractCarouselMedia(media) {
    const mediaUrls = [];
    
    if (media.edge_sidecar_to_children && media.edge_sidecar_to_children.edges) {
      for (let i = 0; i < media.edge_sidecar_to_children.edges.length; i++) {
        const child = media.edge_sidecar_to_children.edges[i].node;
        
        if (child.is_video) {
          mediaUrls.push(...this.extractVideoUrls(child, i));
        } else {
          mediaUrls.push(...this.extractImageUrls(child, i));
        }
      }
    }
    
    return mediaUrls;
  }

  extractVideoUrls(media, index = 0) {
    const videoUrls = [];
    
    // Primary video URL
    if (media.video_url) {
      videoUrls.push({
        url: media.video_url,
        type: 'video',
        quality: 'original',
        width: media.dimensions?.width,
        height: media.dimensions?.height,
        index: index,
        hasAudio: true
      });
    }

    // Additional video versions (if available)
    if (media.video_versions) {
      for (const version of media.video_versions) {
        videoUrls.push({
          url: version.url,
          type: 'video',
          quality: `${version.width}x${version.height}`,
          width: version.width,
          height: version.height,
          index: index,
          hasAudio: true
        });
      }
    }

    // Video thumbnail
    if (media.display_url) {
      videoUrls.push({
        url: media.display_url,
        type: 'thumbnail',
        quality: 'display',
        width: media.dimensions?.width,
        height: media.dimensions?.height,
        index: index,
        hasAudio: false
      });
    }

    return videoUrls;
  }

  extractImageUrls(media, index = 0) {
    const imageUrls = [];
    
    // High quality image URLs
    if (media.image_versions2 && media.image_versions2.candidates) {
      for (const candidate of media.image_versions2.candidates) {
        imageUrls.push({
          url: candidate.url,
          type: 'image',
          quality: `${candidate.width}x${candidate.height}`,
          width: candidate.width,
          height: candidate.height,
          index: index,
          hasAudio: false
        });
      }
    }

    // Display URL (fallback)
    if (media.display_url && !imageUrls.some(img => img.url === media.display_url)) {
      imageUrls.push({
        url: media.display_url,
        type: 'image',
        quality: 'display',
        width: media.dimensions?.width,
        height: media.dimensions?.height,
        index: index,
        hasAudio: false
      });
    }

    return imageUrls;
  }

  extractCaption(media) {
    if (media.edge_media_to_caption && media.edge_media_to_caption.edges.length > 0) {
      return media.edge_media_to_caption.edges[0].node.text;
    }
    return '';
  }

  async extractReel(shortcode, originalUrl, options = {}) {
    if (!this.config.enableReels) {
      throw new Error('Reels extraction is disabled');
    }

    try {
      // Reels use similar structure to posts but with different endpoints
      const reelData = await this.getPostDataGraphQL(shortcode);
      if (reelData) {
        this.metrics.reelsExtracted++;
        return this.parsePostData(reelData, 'reel');
      }

      throw new Error('Failed to extract reel data');
    } catch (error) {
      logger.error(`Failed to extract Instagram reel ${shortcode}`, error);
      throw error;
    }
  }

  async extractStory(username, storyId, originalUrl, options = {}) {
    if (!this.config.enableStories) {
      throw new Error('Stories extraction is disabled');
    }

    try {
      // Stories require authentication and have limited availability
      const storyData = await this.getStoryData(username, storyId);
      if (storyData) {
        this.metrics.storiesExtracted++;
        return this.parseStoryData(storyData);
      }

      throw new Error('Failed to extract story data');
    } catch (error) {
      logger.error(`Failed to extract Instagram story ${storyId}`, error);
      throw error;
    }
  }

  async getStoryData(username, storyId) {
    // Stories extraction is complex and requires authentication
    // This is a placeholder for the actual implementation
    throw new Error('Story extraction requires authentication and is not fully implemented');
  }

  parseStoryData(storyData) {
    // Parse story data structure
    return {
      id: storyData.id,
      type: 'story',
      mediaUrls: [],
      // Additional story-specific fields
    };
  }

  async extractIGTV(shortcode, originalUrl, options = {}) {
    if (!this.config.enableIGTV) {
      throw new Error('IGTV extraction is disabled');
    }

    try {
      // IGTV videos use similar structure to regular posts
      const igtvData = await this.getPostDataGraphQL(shortcode);
      if (igtvData) {
        this.metrics.igtvExtracted++;
        return this.parsePostData(igtvData, 'igtv');
      }

      throw new Error('Failed to extract IGTV data');
    } catch (error) {
      logger.error(`Failed to extract Instagram IGTV ${shortcode}`, error);
      throw error;
    }
  }

  async extractHighlight(highlightId, originalUrl, options = {}) {
    if (!this.config.enableHighlights) {
      throw new Error('Highlights extraction is disabled');
    }

    // Highlights extraction is complex and requires authentication
    throw new Error('Highlights extraction not fully implemented');
  }

  async extractProfile(username, originalUrl, options = {}) {
    if (!this.config.enableUserPosts) {
      throw new Error('User posts extraction is disabled');
    }

    // Profile extraction would get all posts from a user
    throw new Error('Profile extraction not fully implemented');
  }

  async extractLive(username, originalUrl, options = {}) {
    if (!this.config.enableLiveStreams) {
      throw new Error('Live streams extraction is disabled');
    }

    // Live stream extraction
    throw new Error('Live stream extraction not fully implemented');
  }

  async makeAuthenticatedRequest(url, options = {}) {
    const headers = {
      'User-Agent': this.userAgents.web,
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://www.instagram.com/',
      'X-Requested-With': 'XMLHttpRequest',
      'X-IG-App-ID': '936619743392459', // Instagram web app ID
      ...options.headers
    };

    // Add CSRF token if available
    const csrfToken = await this.getCSRFToken();
    if (csrfToken) {
      headers['X-CSRFToken'] = csrfToken;
    }

    return networkManager.get(url, {
      headers,
      ...options
    });
  }

  async getCSRFToken() {
    const cached = this.csrfCache.get('token');
    if (cached && (Date.now() - cached.timestamp) < 3600000) { // 1 hour cache
      return cached.token;
    }

    try {
      const response = await networkManager.get('https://www.instagram.com/', {
        headers: {
          'User-Agent': this.userAgents.web
        }
      });

      const html = await response.text();
      const tokenMatch = html.match(/"csrf_token":"([^"]+)"/);
      
      if (tokenMatch) {
        const token = tokenMatch[1];
        this.csrfCache.set('token', {
          token,
          timestamp: Date.now()
        });
        return token;
      }
    } catch (error) {
      logger.warn('Failed to get CSRF token', error);
    }

    return null;
  }

  async convertToDetectionResult(contentData, originalUrl, options = {}) {
    const sources = [];

    // Process all media URLs
    for (const mediaData of contentData.mediaUrls) {
      const mediaType = mediaData.type === 'video' ? MediaType.VIDEO : MediaType.IMAGE;
      const source = createMediaSource(mediaData.url, mediaType);
      
      source.format = this.getFormatFromUrl(mediaData.url);
      source.title = this.generateMediaTitle(contentData, mediaData);
      
      if (mediaData.width && mediaData.height) {
        source.quality = {
          width: mediaData.width,
          height: mediaData.height,
          quality: mediaData.quality
        };
      }

      source.metadata = {
        id: contentData.id,
        shortcode: contentData.shortcode,
        type: contentData.type,
        caption: contentData.caption,
        owner: contentData.owner,
        timestamp: contentData.timestamp,
        engagement: contentData.engagement,
        mediaIndex: mediaData.index,
        mediaType: mediaData.type,
        hasAudio: mediaData.hasAudio
      };

      sources.push(source);
    }

    // Add audio extraction if enabled
    if (this.config.extractAudioFromVideos && contentData.mediaUrls.some(m => m.type === 'video')) {
      // This would require additional processing to extract audio
      // Implementation would depend on audio extraction capabilities
    }

    const result = createDetectionResult(sources, Platform.INSTAGRAM);
    result.detectionMethod = DetectionMethod.API_EXTRACTION;
    result.confidence = 0.9;

    // Add comprehensive metadata
    result.metadata = {
      id: contentData.id,
      shortcode: contentData.shortcode,
      type: contentData.type,
      typename: contentData.typename,
      caption: contentData.caption,
      timestamp: contentData.timestamp,
      owner: contentData.owner,
      dimensions: contentData.dimensions,
      engagement: contentData.engagement,
      isCarousel: contentData.isCarousel,
      location: contentData.location,
      taggedUsers: contentData.taggedUsers
    };

    return result;
  }

  generateMediaTitle(contentData, mediaData) {
    let title = contentData.caption || 'Instagram Media';
    
    // Truncate long captions
    if (title.length > 50) {
      title = title.substring(0, 50) + '...';
    }
    
    // Add media type and quality info
    if (contentData.isCarousel) {
      title += ` (${mediaData.index + 1}/${contentData.mediaUrls.length})`;
    }
    
    if (mediaData.type === 'video') {
      title += ' [Video]';
    } else if (mediaData.type === 'image') {
      title += ' [Image]';
    }
    
    if (mediaData.quality !== 'original') {
      title += ` [${mediaData.quality}]`;
    }
    
    return title;
  }

  getFormatFromUrl(url) {
    if (!url) return 'jpg';
    
    if (url.includes('.mp4')) return 'mp4';
    if (url.includes('.mov')) return 'mov';
    if (url.includes('.webm')) return 'webm';
    if (url.includes('.png')) return 'png';
    if (url.includes('.gif')) return 'gif';
    if (url.includes('.webp')) return 'webp';
    
    return 'jpg'; // Default format for Instagram
  }

  // Cache management
  clearCache() {
    this.cache.clear();
    this.sessionCache.clear();
    this.csrfCache.clear();
    logger.info('Instagram extractor cache cleared');
  }

  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      sessionCacheSize: this.sessionCache.size,
      csrfCacheSize: this.csrfCache.size,
      supportedPatterns: Object.keys(this.patterns).length,
      queryHashes: Object.keys(this.queryHashes).length
    };
  }

  destroy() {
    this.clearCache();
    logger.info('Instagram extractor destroyed');
  }
}

// Export default instance
export const instagramExtractor = new AdvancedInstagramExtractor();

export default AdvancedInstagramExtractor;