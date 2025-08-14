/**
 * Advanced Twitter/X Extractor for PegaTudo
 * Comprehensive Twitter content extraction including tweets, videos, spaces,
 * threads, and media with support for both Twitter and X domains
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

export class AdvancedTwitterExtractor {
  constructor(options = {}) {
    this.id = 'twitter';
    this.name = 'Twitter/X Extractor';
    this.platforms = [Platform.TWITTER];
    this.priority = 80;

    this.config = {
      enableVideos: options.enableVideos !== false,
      enableImages: options.enableImages !== false,
      enableGIFs: options.enableGIFs !== false,
      enableSpaces: options.enableSpaces || false,
      enableThreads: options.enableThreads !== false,
      enableLiveStreams: options.enableLiveStreams || false,
      preferredQuality: options.preferredQuality || 'highest',
      extractAudioFromVideos: options.extractAudioFromVideos || false,
      bypassPrivateRestriction: options.bypassPrivateRestriction || false,
      useAlternativeAPIs: options.useAlternativeAPIs !== false,
      supportLegacyTwitter: options.supportLegacyTwitter !== false,
      ...options
    };

    // Twitter/X URL patterns
    this.patterns = {
      tweet: /(?:https?:\/\/)?(?:www\.)?(twitter\.com|x\.com)\/[^\/]+\/status\/(\d+)/,
      profile: /(?:https?:\/\/)?(?:www\.)?(twitter\.com|x\.com)\/([^\/\?]+)/,
      space: /(?:https?:\/\/)?(?:www\.)?(twitter\.com|x\.com)\/i\/spaces\/([A-Za-z0-9]+)/,
      moments: /(?:https?:\/\/)?(?:www\.)?(twitter\.com|x\.com)\/i\/moments\/(\d+)/,
      list: /(?:https?:\/\/)?(?:www\.)?(twitter\.com|x\.com)\/i\/lists\/(\d+)/,
      video: /(?:https?:\/\/)?video\.twimg\.com\/([^?]+)/,
      media: /(?:https?:\/\/)?pbs\.twimg\.com\/media\/([^?]+)/
    };

    // Twitter API endpoints and configurations
    this.endpoints = {
      // New X API endpoints
      apiV2: 'https://api.twitter.com/2/',
      graphql: 'https://x.com/i/api/graphql/',
      tweetDetail: 'https://x.com/i/api/graphql/VWxGj2thSAVlR0Q5MtjkEw/TweetDetail',
      userTweets: 'https://x.com/i/api/graphql/V7H7jF_LoaOr7PVqfM9xWA/UserTweets',
      
      // Legacy Twitter endpoints
      legacyApi: 'https://api.twitter.com/1.1/',
      legacyWeb: 'https://twitter.com/i/api/1.1/',
      
      // Media endpoints
      videoApi: 'https://video.twimg.com/v1/',
      mediaApi: 'https://pbs.twimg.com/',
      adaptiveVideo: 'https://video.twimg.com/amplify_video/',
      
      // Guest token endpoint
      guestToken: 'https://api.twitter.com/1.1/guest/activate.json'
    };

    // User agents for different contexts
    this.userAgents = {
      web: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      app: 'TwitterAndroid/10.10.0 (310100000-r-1 2023-08-18) Nokia3310/5.3.1 (API29) gzip'
    };

    // GraphQL operation IDs for X API
    this.operationIds = {
      TweetDetail: 'VWxGj2thSAVlR0Q5MtjkEw',
      UserTweets: 'V7H7jF_LoaOr7PVqfM9xWA',
      UserByScreenName: 'sLVLhk0bGj3MVFEKTdax1w',
      AudioSpaceById: 'D6XFYFm6tzSSNhWvFPj1-Q',
      VideoDetails: 'EhEhfZ9_8VlG8E5_FTqKjA'
    };

    // Twitter media variant preferences
    this.variantOrder = [
      { contentType: 'video/mp4', preference: 100 },
      { contentType: 'video/webm', preference: 90 },
      { contentType: 'application/x-mpegURL', preference: 80 }, // HLS
      { contentType: 'video/quicktime', preference: 70 }
    ];

    this.cache = new Map();
    this.guestTokenCache = new Map();
    this.bearerTokenCache = new Map();

    this.metrics = {
      extractionsPerformed: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      tweetsExtracted: 0,
      videosExtracted: 0,
      imagesExtracted: 0,
      gifsExtracted: 0,
      spacesExtracted: 0,
      threadsExtracted: 0,
      apiCalls: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    this.init();
  }

  init() {
    logger.info('Advanced Twitter/X Extractor initialized', {
      platforms: this.platforms,
      features: {
        videos: this.config.enableVideos,
        images: this.config.enableImages,
        spaces: this.config.enableSpaces,
        threads: this.config.enableThreads
      }
    });
  }

  canExtract(url) {
    return Object.values(this.patterns).some(pattern => pattern.test(url));
  }

  async extract(url, options = {}) {
    try {
      this.metrics.extractionsPerformed++;
      logger.info(`Extracting Twitter/X content: ${url}`);

      // Parse URL to determine content type
      const contentInfo = this.parseUrl(url);
      if (!contentInfo) {
        throw new Error('Could not parse Twitter/X URL');
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
      eventSystem.emit('twitter:extractionCompleted', { 
        type: contentInfo.type, 
        id: contentInfo.id, 
        url, 
        result 
      });
      
      return result;
    } catch (error) {
      this.metrics.failedExtractions++;
      logger.error(`Twitter/X extraction failed for ${url}`, error);
      throw error;
    }
  }

  parseUrl(url) {
    for (const [type, pattern] of Object.entries(this.patterns)) {
      const match = url.match(pattern);
      if (match) {
        switch (type) {
          case 'tweet':
            return { type, id: match[2], domain: match[1] };
          case 'profile':
            return { type, username: match[2], domain: match[1] };
          case 'space':
            return { type, id: match[2], domain: match[1] };
          case 'moments':
            return { type, id: match[2], domain: match[1] };
          case 'list':
            return { type, id: match[2], domain: match[1] };
          case 'video':
            return { type, id: match[1] };
          case 'media':
            return { type, id: match[1] };
        }
      }
    }
    return null;
  }

  async extractContent(contentInfo, originalUrl, options = {}) {
    switch (contentInfo.type) {
      case 'tweet':
        return this.extractTweet(contentInfo.id, originalUrl, options);
      case 'space':
        return this.extractSpace(contentInfo.id, originalUrl, options);
      case 'profile':
        return this.extractProfile(contentInfo.username, originalUrl, options);
      case 'video':
        return this.extractDirectVideo(contentInfo.id, originalUrl, options);
      case 'media':
        return this.extractDirectMedia(contentInfo.id, originalUrl, options);
      default:
        throw new Error(`Unsupported Twitter/X content type: ${contentInfo.type}`);
    }
  }

  async extractTweet(tweetId, originalUrl, options = {}) {
    try {
      // Try GraphQL API first (X's current method)
      let tweetData = await this.getTweetDataGraphQL(tweetId);
      
      if (!tweetData) {
        // Fallback to legacy API
        tweetData = await this.getTweetDataLegacy(tweetId);
      }

      if (!tweetData) {
        // Last resort: web scraping
        tweetData = await this.getTweetDataFromWeb(originalUrl);
      }

      if (tweetData) {
        this.metrics.tweetsExtracted++;
        return this.parseTweetData(tweetData);
      }

      throw new Error('Failed to extract tweet data from all methods');
    } catch (error) {
      logger.error(`Failed to extract tweet ${tweetId}`, error);
      throw error;
    }
  }

  async getTweetDataGraphQL(tweetId) {
    try {
      const guestToken = await this.getGuestToken();
      const bearerToken = await this.getBearerToken();
      
      if (!guestToken || !bearerToken) {
        throw new Error('Failed to get authentication tokens');
      }

      const variables = {
        tweetId: tweetId,
        withCommunity: false,
        includePromotedContent: false,
        withVoice: true
      };

      const features = {
        creator_subscriptions_tweet_preview_api_enabled: true,
        tweetypie_unmention_optimization_enabled: true,
        responsive_web_edit_tweet_api_enabled: true,
        graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
        view_counts_everywhere_api_enabled: true,
        longform_notetweets_consumption_enabled: true,
        responsive_web_twitter_article_tweet_consumption_enabled: false,
        tweet_awards_web_tipping_enabled: false,
        freedom_of_speech_not_reach_fetch_enabled: true,
        standardized_nudges_misinfo: true,
        tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
        longform_notetweets_rich_text_read_enabled: true,
        longform_notetweets_inline_media_enabled: true,
        responsive_web_graphql_exclude_directive_enabled: true,
        verified_phone_label_enabled: false,
        responsive_web_media_download_video_enabled: false,
        responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
        responsive_web_graphql_timeline_navigation_enabled: true,
        responsive_web_enhance_cards_enabled: false
      };

      const url = `${this.endpoints.tweetDetail}?variables=${encodeURIComponent(JSON.stringify(variables))}&features=${encodeURIComponent(JSON.stringify(features))}`;

      const response = await networkManager.get(url, {
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'X-Guest-Token': guestToken,
          'User-Agent': this.userAgents.web,
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.5',
          'Referer': 'https://x.com/',
          'X-Twitter-Client-Language': 'en',
          'X-Twitter-Active-User': 'yes'
        }
      });

      if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.status}`);
      }

      const data = await response.json();
      this.metrics.apiCalls++;

      if (data.data && data.data.tweetResult && data.data.tweetResult.result) {
        return data.data.tweetResult.result;
      }

      return null;
    } catch (error) {
      logger.warn('GraphQL tweet extraction failed', error);
      return null;
    }
  }

  async getTweetDataLegacy(tweetId) {
    try {
      const guestToken = await this.getGuestToken();
      const bearerToken = await this.getBearerToken();
      
      if (!guestToken || !bearerToken) {
        return null;
      }

      const url = `${this.endpoints.legacyWeb}statuses/show.json?id=${tweetId}&include_ext_alt_text=true&include_ext_media_color=true&include_ext_media_availability=true&include_ext_sensitive_media_warning=true&include_quote_count=true`;

      const response = await networkManager.get(url, {
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'X-Guest-Token': guestToken,
          'User-Agent': this.userAgents.web,
          'Accept': '*/*',
          'Referer': 'https://x.com/'
        }
      });

      if (!response.ok) {
        throw new Error(`Legacy API request failed: ${response.status}`);
      }

      const data = await response.json();
      this.metrics.apiCalls++;
      
      return data;
    } catch (error) {
      logger.warn('Legacy tweet extraction failed', error);
      return null;
    }
  }

  async getTweetDataFromWeb(url) {
    try {
      const response = await networkManager.get(url, {
        headers: {
          'User-Agent': this.userAgents.web,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Referer': 'https://x.com/',
          'Upgrade-Insecure-Requests': '1'
        }
      });

      if (!response.ok) {
        throw new Error(`Web request failed: ${response.status}`);
      }

      const html = await response.text();
      return this.parseTweetFromHTML(html);
    } catch (error) {
      logger.warn('Web tweet extraction failed', error);
      return null;
    }
  }

  parseTweetFromHTML(html) {
    try {
      // Extract initial state data
      const initialStateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});/);
      if (initialStateMatch) {
        const initialState = JSON.parse(initialStateMatch[1]);
        
        // Find tweet data in the initial state
        if (initialState.tweets && initialState.tweets.entities) {
          const tweets = Object.values(initialState.tweets.entities);
          if (tweets.length > 0) {
            return tweets[0];
          }
        }
      }

      // Try alternative patterns
      const additionalDataMatch = html.match(/"tweet":\s*({.+?})(?=,"quote_tweet"|,"retweet"|,"reply"|,"|$)/);
      if (additionalDataMatch) {
        return JSON.parse(additionalDataMatch[1]);
      }

      return null;
    } catch (error) {
      logger.error('Failed to parse tweet from HTML', error);
      return null;
    }
  }

  parseTweetData(tweetData) {
    const parsed = {
      id: tweetData.id_str || tweetData.rest_id,
      text: this.extractTweetText(tweetData),
      createdAt: new Date(tweetData.created_at || tweetData.legacy?.created_at),
      user: this.extractUserInfo(tweetData),
      engagement: this.extractEngagement(tweetData),
      mediaUrls: [],
      isRetweet: false,
      isReply: false,
      isQuote: false,
      lang: tweetData.lang || tweetData.legacy?.lang
    };

    // Extract media
    const media = this.extractMediaFromTweet(tweetData);
    parsed.mediaUrls = media;

    // Count media types
    const videos = media.filter(m => m.type === 'video');
    const images = media.filter(m => m.type === 'photo');
    const gifs = media.filter(m => m.type === 'animated_gif');

    this.metrics.videosExtracted += videos.length;
    this.metrics.imagesExtracted += images.length;
    this.metrics.gifsExtracted += gifs.length;

    // Check tweet type
    parsed.isRetweet = tweetData.retweeted_status || tweetData.legacy?.retweeted_status_result;
    parsed.isReply = tweetData.in_reply_to_status_id_str || tweetData.legacy?.in_reply_to_status_id_str;
    parsed.isQuote = tweetData.quoted_status || tweetData.legacy?.quoted_status_result;

    return parsed;
  }

  extractTweetText(tweetData) {
    // Handle both new and legacy data structures
    if (tweetData.note_tweet && tweetData.note_tweet.note_tweet_results) {
      return tweetData.note_tweet.note_tweet_results.result.text;
    }
    
    if (tweetData.legacy && tweetData.legacy.full_text) {
      return tweetData.legacy.full_text;
    }
    
    if (tweetData.full_text) {
      return tweetData.full_text;
    }
    
    return tweetData.text || '';
  }

  extractUserInfo(tweetData) {
    let user = tweetData.user || tweetData.core?.user_results?.result;
    
    if (!user && tweetData.legacy) {
      user = tweetData.legacy.user || tweetData.legacy;
    }

    if (!user) return {};

    return {
      id: user.id_str || user.rest_id,
      screenName: user.screen_name || user.legacy?.screen_name,
      name: user.name || user.legacy?.name,
      profileImageUrl: user.profile_image_url_https || user.legacy?.profile_image_url_https,
      verified: user.verified || user.legacy?.verified,
      followersCount: user.followers_count || user.legacy?.followers_count
    };
  }

  extractEngagement(tweetData) {
    const stats = tweetData.public_metrics || tweetData.legacy;
    
    if (!stats) return {};

    return {
      retweets: stats.retweet_count || 0,
      likes: stats.favorite_count || stats.favourites_count || 0,
      replies: stats.reply_count || 0,
      quotes: stats.quote_count || 0,
      views: stats.view_count || 0
    };
  }

  extractMediaFromTweet(tweetData) {
    const mediaUrls = [];
    
    // Handle different data structures
    let mediaEntities = null;
    
    if (tweetData.legacy && tweetData.legacy.entities && tweetData.legacy.entities.media) {
      mediaEntities = tweetData.legacy.entities.media;
    } else if (tweetData.legacy && tweetData.legacy.extended_entities && tweetData.legacy.extended_entities.media) {
      mediaEntities = tweetData.legacy.extended_entities.media;
    } else if (tweetData.entities && tweetData.entities.media) {
      mediaEntities = tweetData.entities.media;
    } else if (tweetData.extended_entities && tweetData.extended_entities.media) {
      mediaEntities = tweetData.extended_entities.media;
    }

    if (!mediaEntities) return mediaUrls;

    for (const media of mediaEntities) {
      if (media.type === 'photo' && this.config.enableImages) {
        mediaUrls.push(...this.extractImageUrls(media));
      } else if (media.type === 'video' && this.config.enableVideos) {
        mediaUrls.push(...this.extractVideoUrls(media));
      } else if (media.type === 'animated_gif' && this.config.enableGIFs) {
        mediaUrls.push(...this.extractGifUrls(media));
      }
    }

    return mediaUrls;
  }

  extractImageUrls(media) {
    const imageUrls = [];
    
    // Original size
    if (media.media_url_https) {
      imageUrls.push({
        url: media.media_url_https + ':orig',
        type: 'photo',
        quality: 'original',
        width: media.original_info?.width,
        height: media.original_info?.height,
        size: 'orig'
      });
    }

    // Additional sizes
    const sizes = ['large', 'medium', 'small'];
    for (const size of sizes) {
      if (media.sizes && media.sizes[size] && media.media_url_https) {
        imageUrls.push({
          url: media.media_url_https + ':' + size,
          type: 'photo',
          quality: size,
          width: media.sizes[size].w,
          height: media.sizes[size].h,
          size: size
        });
      }
    }

    return imageUrls;
  }

  extractVideoUrls(media) {
    const videoUrls = [];
    
    if (!media.video_info || !media.video_info.variants) {
      return videoUrls;
    }

    // Sort variants by preference and quality
    const sortedVariants = media.video_info.variants
      .filter(variant => variant.content_type !== 'application/x-mpegURL') // Filter out HLS for now
      .sort((a, b) => {
        // Sort by content type preference first
        const aPreference = this.variantOrder.find(v => v.contentType === a.content_type)?.preference || 0;
        const bPreference = this.variantOrder.find(v => v.contentType === b.content_type)?.preference || 0;
        
        if (aPreference !== bPreference) {
          return bPreference - aPreference;
        }
        
        // Then by bitrate (higher is better)
        return (b.bitrate || 0) - (a.bitrate || 0);
      });

    for (const variant of sortedVariants) {
      if (variant.url) {
        videoUrls.push({
          url: variant.url,
          type: 'video',
          quality: variant.bitrate ? `${variant.bitrate}bps` : 'unknown',
          contentType: variant.content_type,
          bitrate: variant.bitrate,
          width: media.video_info.aspect_ratio ? this.calculateWidth(media.video_info.aspect_ratio, media.original_info?.height) : undefined,
          height: media.original_info?.height,
          duration: media.video_info.duration_millis
        });
      }
    }

    // Add HLS variant if available
    const hlsVariant = media.video_info.variants.find(v => v.content_type === 'application/x-mpegURL');
    if (hlsVariant) {
      videoUrls.push({
        url: hlsVariant.url,
        type: 'video',
        quality: 'hls',
        contentType: hlsVariant.content_type,
        isHLS: true,
        duration: media.video_info.duration_millis
      });
    }

    return videoUrls;
  }

  extractGifUrls(media) {
    // Animated GIFs are treated similar to videos
    return this.extractVideoUrls(media).map(video => ({
      ...video,
      type: 'animated_gif'
    }));
  }

  calculateWidth(aspectRatio, height) {
    if (!aspectRatio || aspectRatio.length < 2 || !height) return undefined;
    return Math.round((aspectRatio[0] / aspectRatio[1]) * height);
  }

  async extractSpace(spaceId, originalUrl, options = {}) {
    if (!this.config.enableSpaces) {
      throw new Error('Spaces extraction is disabled');
    }

    try {
      const spaceData = await this.getSpaceData(spaceId);
      if (spaceData) {
        this.metrics.spacesExtracted++;
        return this.parseSpaceData(spaceData);
      }

      throw new Error('Failed to extract space data');
    } catch (error) {
      logger.error(`Failed to extract Twitter Space ${spaceId}`, error);
      throw error;
    }
  }

  async getSpaceData(spaceId) {
    // Spaces require special handling and authentication
    // This is a placeholder for the actual implementation
    throw new Error('Spaces extraction not fully implemented');
  }

  parseSpaceData(spaceData) {
    return {
      id: spaceData.id,
      type: 'space',
      title: spaceData.title,
      mediaUrls: []
    };
  }

  async extractProfile(username, originalUrl, options = {}) {
    // Profile extraction would get recent tweets from a user
    throw new Error('Profile extraction not fully implemented');
  }

  async extractDirectVideo(videoId, originalUrl, options = {}) {
    // Direct video URL extraction
    const videoUrls = [{
      url: `https://video.twimg.com/${videoId}`,
      type: 'video',
      quality: 'original'
    }];

    return {
      id: videoId,
      type: 'direct_video',
      mediaUrls: videoUrls
    };
  }

  async extractDirectMedia(mediaId, originalUrl, options = {}) {
    // Direct media URL extraction
    const mediaUrls = [{
      url: `https://pbs.twimg.com/media/${mediaId}:orig`,
      type: 'photo',
      quality: 'original'
    }];

    return {
      id: mediaId,
      type: 'direct_media',
      mediaUrls: mediaUrls
    };
  }

  async getGuestToken() {
    const cached = this.guestTokenCache.get('token');
    if (cached && (Date.now() - cached.timestamp) < 7200000) { // 2 hours cache
      return cached.token;
    }

    try {
      const bearerToken = await this.getBearerToken();
      
      const response = await networkManager.post(this.endpoints.guestToken, '', {
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'User-Agent': this.userAgents.web,
          'Accept': '*/*',
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (!response.ok) {
        throw new Error(`Guest token request failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.guest_token) {
        this.guestTokenCache.set('token', {
          token: data.guest_token,
          timestamp: Date.now()
        });
        return data.guest_token;
      }
    } catch (error) {
      logger.warn('Failed to get guest token', error);
    }

    return null;
  }

  async getBearerToken() {
    const cached = this.bearerTokenCache.get('token');
    if (cached && (Date.now() - cached.timestamp) < 86400000) { // 24 hours cache
      return cached.token;
    }

    try {
      // This bearer token is publicly available and used by Twitter's web client
      const bearerToken = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
      
      this.bearerTokenCache.set('token', {
        token: bearerToken,
        timestamp: Date.now()
      });
      
      return bearerToken;
    } catch (error) {
      logger.warn('Failed to get bearer token', error);
      return null;
    }
  }

  async convertToDetectionResult(contentData, originalUrl, options = {}) {
    const sources = [];

    // Process all media URLs
    for (const mediaData of contentData.mediaUrls) {
      let mediaType;
      
      switch (mediaData.type) {
        case 'video':
          mediaType = MediaType.VIDEO;
          break;
        case 'animated_gif':
          mediaType = MediaType.VIDEO; // Treat animated GIFs as videos
          break;
        case 'photo':
        default:
          mediaType = MediaType.IMAGE;
          break;
      }

      const source = createMediaSource(mediaData.url, mediaType);
      source.format = this.getFormatFromUrl(mediaData.url, mediaData.contentType);
      source.title = this.generateMediaTitle(contentData, mediaData);
      
      if (mediaData.width && mediaData.height) {
        source.quality = {
          width: mediaData.width,
          height: mediaData.height,
          bitrate: mediaData.bitrate,
          quality: mediaData.quality
        };
      }

      source.metadata = {
        id: contentData.id,
        text: contentData.text,
        user: contentData.user,
        createdAt: contentData.createdAt,
        engagement: contentData.engagement,
        mediaType: mediaData.type,
        contentType: mediaData.contentType,
        isHLS: mediaData.isHLS,
        duration: mediaData.duration
      };

      sources.push(source);
    }

    const result = createDetectionResult(sources, Platform.TWITTER);
    result.detectionMethod = DetectionMethod.API_EXTRACTION;
    result.confidence = 0.85;

    // Add comprehensive metadata
    result.metadata = {
      id: contentData.id,
      text: contentData.text,
      createdAt: contentData.createdAt,
      user: contentData.user,
      engagement: contentData.engagement,
      isRetweet: contentData.isRetweet,
      isReply: contentData.isReply,
      isQuote: contentData.isQuote,
      lang: contentData.lang
    };

    return result;
  }

  generateMediaTitle(contentData, mediaData) {
    let title = contentData.text || 'Twitter Media';
    
    // Truncate long tweets
    if (title.length > 50) {
      title = title.substring(0, 50) + '...';
    }
    
    // Add media type info
    if (mediaData.type === 'video') {
      title += ' [Video]';
    } else if (mediaData.type === 'animated_gif') {
      title += ' [GIF]';
    } else if (mediaData.type === 'photo') {
      title += ' [Image]';
    }
    
    // Add quality info
    if (mediaData.quality !== 'unknown') {
      title += ` [${mediaData.quality}]`;
    }
    
    return title;
  }

  getFormatFromUrl(url, contentType) {
    if (contentType) {
      if (contentType.includes('mp4')) return 'mp4';
      if (contentType.includes('webm')) return 'webm';
      if (contentType.includes('mpegURL')) return 'm3u8';
    }
    
    if (!url) return 'jpg';
    
    if (url.includes('.mp4')) return 'mp4';
    if (url.includes('.webm')) return 'webm';
    if (url.includes('.m3u8')) return 'm3u8';
    if (url.includes('.gif')) return 'gif';
    if (url.includes('.png')) return 'png';
    if (url.includes('.webp')) return 'webp';
    
    return 'jpg'; // Default for Twitter images
  }

  // Cache management
  clearCache() {
    this.cache.clear();
    this.guestTokenCache.clear();
    this.bearerTokenCache.clear();
    logger.info('Twitter/X extractor cache cleared');
  }

  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      guestTokenCacheSize: this.guestTokenCache.size,
      bearerTokenCacheSize: this.bearerTokenCache.size,
      supportedPatterns: Object.keys(this.patterns).length,
      operationIds: Object.keys(this.operationIds).length
    };
  }

  destroy() {
    this.clearCache();
    logger.info('Twitter/X extractor destroyed');
  }
}

// Export default instance
export const twitterExtractor = new AdvancedTwitterExtractor();

export default AdvancedTwitterExtractor;