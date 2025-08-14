export var MediaType;
(function (MediaType) {
    MediaType["VIDEO"] = "video";
    MediaType["AUDIO"] = "audio";
    MediaType["IMAGE"] = "image";
    MediaType["LIVE_STREAM"] = "live_stream";
    MediaType["PLAYLIST"] = "playlist";
    MediaType["UNKNOWN"] = "unknown";
})(MediaType || (MediaType = {}));
export var EncryptionMethod;
(function (EncryptionMethod) {
    EncryptionMethod["NONE"] = "NONE";
    EncryptionMethod["AES_128"] = "AES-128";
    EncryptionMethod["AES_128_CTR"] = "AES-128-CTR";
    EncryptionMethod["SAMPLE_AES"] = "SAMPLE-AES";
    EncryptionMethod["SAMPLE_AES_CTR"] = "SAMPLE-AES-CTR";
})(EncryptionMethod || (EncryptionMethod = {}));
export var DetectionMethod;
(function (DetectionMethod) {
    DetectionMethod["DOM_SCAN"] = "dom_scan";
    DetectionMethod["NETWORK_INTERCEPT"] = "network_intercept";
    DetectionMethod["PATTERN_MATCH"] = "pattern_match";
    DetectionMethod["API_EXTRACTION"] = "api_extraction";
    DetectionMethod["SHADOW_DOM"] = "shadow_dom";
    DetectionMethod["WEBSOCKET"] = "websocket";
    DetectionMethod["MANIFEST_PARSE"] = "manifest_parse";
})(DetectionMethod || (DetectionMethod = {}));
export var DownloadStatus;
(function (DownloadStatus) {
    DownloadStatus["PENDING"] = "pending";
    DownloadStatus["DOWNLOADING"] = "downloading";
    DownloadStatus["PROCESSING"] = "processing";
    DownloadStatus["MERGING"] = "merging";
    DownloadStatus["DECRYPTING"] = "decrypting";
    DownloadStatus["COMPLETED"] = "completed";
    DownloadStatus["FAILED"] = "failed";
    DownloadStatus["CANCELLED"] = "cancelled";
})(DownloadStatus || (DownloadStatus = {}));
export var Platform;
(function (Platform) {
    Platform["YOUTUBE"] = "youtube";
    Platform["FACEBOOK"] = "facebook";
    Platform["TIKTOK"] = "tiktok";
    Platform["INSTAGRAM"] = "instagram";
    Platform["TWITTER"] = "twitter";
    Platform["TWITCH"] = "twitch";
    Platform["VIMEO"] = "vimeo";
    Platform["DAILYMOTION"] = "dailymotion";
    Platform["GENERIC"] = "generic";
})(Platform || (Platform = {}));
