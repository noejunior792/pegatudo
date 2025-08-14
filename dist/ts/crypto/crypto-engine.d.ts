/**
 * PegaTudo Advanced Cryptography Module
 * Handles decryption of encrypted video streams including AES-128, SAMPLE-AES, and other encryption methods
 */
import { EncryptionKey, MediaSegment, CryptoInterface, DebugConfig } from '../types/index.js';
export declare class AdvancedCryptoEngine implements CryptoInterface {
    private keyCache;
    private ivCache;
    private debugConfig;
    constructor(debugConfig?: DebugConfig);
    /**
     * Decrypt data using the provided encryption key
     */
    decrypt(data: ArrayBuffer, key: EncryptionKey): Promise<ArrayBuffer>;
    /**
     * Derive cryptographic key from URI and IV
     */
    deriveKey(keyUri: string, iv?: string): Promise<CryptoKey>;
    /**
     * Decrypt a media segment with appropriate method
     */
    decryptSegment(segment: MediaSegment, data: ArrayBuffer): Promise<ArrayBuffer>;
    /**
     * AES-128 CBC decryption
     */
    private decryptAES128;
    /**
     * AES-128 CTR decryption
     */
    private decryptAES128CTR;
    /**
     * SAMPLE-AES decryption for audio/video samples
     */
    private decryptSampleAES;
    /**
     * SAMPLE-AES CTR decryption
     */
    private decryptSampleAESCTR;
    /**
     * Parse initialization vector from various formats
     */
    private parseIV;
    /**
     * Parse MPEG-TS packets from data
     */
    private parseTSPackets;
    /**
     * Check if TS packet is encrypted
     */
    private isEncryptedTSPacket;
    /**
     * Decrypt individual TS packet
     */
    private decryptTSPacket;
    /**
     * Get TS packet header size
     */
    private getTSHeaderSize;
    /**
     * Combine TS packets back into a single buffer
     */
    private combineTSPackets;
    /**
     * Advanced key derivation for complex scenarios
     */
    deriveAdvancedKey(keyData: ArrayBuffer, salt: Uint8Array, iterations?: number): Promise<CryptoKey>;
    /**
     * Extract encryption keys from M3U8 playlists
     */
    extractKeysFromM3U8(playlist: string): EncryptionKey[];
    /**
     * Parse EXT-X-KEY tag from M3U8 playlist
     */
    private parseEXTXKey;
    /**
     * Parse M3U8 parameter string
     */
    private parseM3U8Params;
    /**
     * Clear encryption key cache
     */
    clearKeyCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        keyCount: number;
        ivCount: number;
    };
    private getDefaultDebugConfig;
    private log;
}
/**
 * Utility functions for cryptographic operations
 */
export declare class CryptoUtils {
    /**
     * Convert hex string to ArrayBuffer
     */
    static hexToArrayBuffer(hex: string): ArrayBuffer;
    /**
     * Convert ArrayBuffer to hex string
     */
    static arrayBufferToHex(buffer: ArrayBuffer): string;
    /**
     * Generate random IV
     */
    static generateRandomIV(length?: number): Uint8Array;
    /**
     * XOR two arrays
     */
    static xorArrays(a: Uint8Array, b: Uint8Array): Uint8Array;
}
//# sourceMappingURL=crypto-engine.d.ts.map