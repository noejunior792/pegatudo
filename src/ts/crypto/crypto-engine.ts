/**
 * PegaTudo Advanced Cryptography Module
 * Handles decryption of encrypted video streams including AES-128, SAMPLE-AES, and other encryption methods
 */

import {
  EncryptionKey,
  EncryptionMethod,
  MediaSegment,
  CryptoInterface,
  DebugConfig
} from '../types/index.js';

export class AdvancedCryptoEngine implements CryptoInterface {
  private keyCache: Map<string, CryptoKey> = new Map();
  private ivCache: Map<string, Uint8Array> = new Map();
  private debugConfig: DebugConfig;

  constructor(debugConfig?: DebugConfig) {
    this.debugConfig = debugConfig || this.getDefaultDebugConfig();
    this.log('AdvancedCryptoEngine initialized', 'INFO');
  }

  /**
   * Decrypt data using the provided encryption key
   */
  public async decrypt(data: ArrayBuffer, key: EncryptionKey): Promise<ArrayBuffer> {
    try {
      this.log(`Starting decryption with method: ${key.method}`, 'DEBUG');
      
      switch (key.method) {
        case EncryptionMethod.AES_128:
          return await this.decryptAES128(data, key);
        case EncryptionMethod.AES_128_CTR:
          return await this.decryptAES128CTR(data, key);
        case EncryptionMethod.SAMPLE_AES:
          return await this.decryptSampleAES(data, key);
        case EncryptionMethod.SAMPLE_AES_CTR:
          return await this.decryptSampleAESCTR(data, key);
        default:
          throw new Error(`Unsupported encryption method: ${key.method}`);
      }
    } catch (error) {
      this.log(`Decryption failed: ${error}`, 'ERROR');
      throw error;
    }
  }

  /**
   * Derive cryptographic key from URI and IV
   */
  public async deriveKey(keyUri: string, iv?: string): Promise<CryptoKey> {
    const cacheKey = `${keyUri}:${iv || 'no-iv'}`;
    
    if (this.keyCache.has(cacheKey)) {
      this.log(`Using cached key for ${keyUri}`, 'DEBUG');
      return this.keyCache.get(cacheKey)!;
    }

    try {
      this.log(`Deriving key from URI: ${keyUri}`, 'DEBUG');
      
      // Fetch key from URI
      const response = await fetch(keyUri);
      if (!response.ok) {
        throw new Error(`Failed to fetch encryption key: ${response.status}`);
      }

      const keyData = await response.arrayBuffer();
      
      // Import the key for AES decryption
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'AES-CBC' },
        false,
        ['decrypt']
      );

      this.keyCache.set(cacheKey, cryptoKey);
      this.log(`Key derived and cached for ${keyUri}`, 'DEBUG');
      
      return cryptoKey;
    } catch (error) {
      this.log(`Key derivation failed for ${keyUri}: ${error}`, 'ERROR');
      throw error;
    }
  }

  /**
   * Decrypt a media segment with appropriate method
   */
  public async decryptSegment(segment: MediaSegment, data: ArrayBuffer): Promise<ArrayBuffer> {
    if (!segment.encrypted || !segment.key) {
      return data; // No decryption needed
    }

    try {
      this.log(`Decrypting segment ${segment.sequence}`, 'DEBUG');
      
      const decryptedData = await this.decrypt(data, segment.key);
      
      this.log(`Successfully decrypted segment ${segment.sequence}`, 'DEBUG');
      return decryptedData;
      
    } catch (error) {
      this.log(`Failed to decrypt segment ${segment.sequence}: ${error}`, 'ERROR');
      throw error;
    }
  }

  /**
   * AES-128 CBC decryption
   */
  private async decryptAES128(data: ArrayBuffer, key: EncryptionKey): Promise<ArrayBuffer> {
    try {
      const cryptoKey = await this.deriveKey(key.uri, key.iv);
      const iv = this.parseIV(key.iv, 16);

      this.log('Performing AES-128 CBC decryption', 'DEBUG');

      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-CBC',
          iv: iv
        },
        cryptoKey,
        data
      );

      return decrypted;
    } catch (error) {
      this.log(`AES-128 decryption failed: ${error}`, 'ERROR');
      throw error;
    }
  }

  /**
   * AES-128 CTR decryption
   */
  private async decryptAES128CTR(data: ArrayBuffer, key: EncryptionKey): Promise<ArrayBuffer> {
    try {
      const cryptoKey = await this.deriveKey(key.uri, key.iv);
      const iv = this.parseIV(key.iv, 16);

      this.log('Performing AES-128 CTR decryption', 'DEBUG');

      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-CTR',
          counter: iv as Uint8Array,
          length: 64
        },
        cryptoKey,
        data
      );

      return decrypted;
    } catch (error) {
      this.log(`AES-128 CTR decryption failed: ${error}`, 'ERROR');
      throw error;
    }
  }

  /**
   * SAMPLE-AES decryption for audio/video samples
   */
  private async decryptSampleAES(data: ArrayBuffer, key: EncryptionKey): Promise<ArrayBuffer> {
    try {
      this.log('Performing SAMPLE-AES decryption', 'DEBUG');
      
      // SAMPLE-AES requires special handling for MPEG-TS containers
      const tsPackets = this.parseTSPackets(data);
      const decryptedPackets: ArrayBuffer[] = [];

      for (const packet of tsPackets) {
        if (this.isEncryptedTSPacket(packet)) {
          const decryptedPacket = await this.decryptTSPacket(packet, key);
          decryptedPackets.push(decryptedPacket);
        } else {
          decryptedPackets.push(packet);
        }
      }

      return this.combineTSPackets(decryptedPackets);
    } catch (error) {
      this.log(`SAMPLE-AES decryption failed: ${error}`, 'ERROR');
      throw error;
    }
  }

  /**
   * SAMPLE-AES CTR decryption
   */
  private async decryptSampleAESCTR(data: ArrayBuffer, key: EncryptionKey): Promise<ArrayBuffer> {
    try {
      this.log('Performing SAMPLE-AES CTR decryption', 'DEBUG');
      
      // Similar to SAMPLE-AES but with CTR mode
      const cryptoKey = await this.deriveKey(key.uri, key.iv);
      const iv = this.parseIV(key.iv, 16);

      // Implementation would handle CTR mode for SAMPLE-AES
      // This is a simplified version
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-CTR',
          counter: iv as Uint8Array,
          length: 64
        },
        cryptoKey,
        data
      );

      return decrypted;
    } catch (error) {
      this.log(`SAMPLE-AES CTR decryption failed: ${error}`, 'ERROR');
      throw error;
    }
  }

  /**
   * Parse initialization vector from various formats
   */
  private parseIV(ivString?: string, length: number = 16): Uint8Array {
    if (!ivString) {
      return new Uint8Array(length);
    }

    try {
      if (ivString.startsWith('0x') || ivString.startsWith('0X')) {
        const hexIV = ivString.slice(2);
        const buffer = new ArrayBuffer(hexIV.length / 2);
        const view = new Uint8Array(buffer);
        for (let i = 0; i < hexIV.length; i += 2) {
          view[i / 2] = parseInt(hexIV.substr(i, 2), 16);
        }
        return view;
      }

      const binaryString = atob(ivString);
      const buffer = new ArrayBuffer(binaryString.length);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < binaryString.length; i++) {
        view[i] = binaryString.charCodeAt(i);
      }
      return view;
    } catch (error) {
      this.log(`Failed to parse IV: ${error}`, 'WARN');
      return new Uint8Array(length);
    }
  }

  /**
   * Parse MPEG-TS packets from data
   */
  private parseTSPackets(data: ArrayBuffer): ArrayBuffer[] {
    const packets: ArrayBuffer[] = [];
    const view = new Uint8Array(data);
    const packetSize = 188; // Standard TS packet size

    for (let i = 0; i < view.length; i += packetSize) {
      if (i + packetSize <= view.length) {
        // Check for sync byte (0x47)
        if (view[i] === 0x47) {
          packets.push(data.slice(i, i + packetSize));
        }
      }
    }

    this.log(`Parsed ${packets.length} TS packets`, 'DEBUG');
    return packets;
  }

  /**
   * Check if TS packet is encrypted
   */
  private isEncryptedTSPacket(packet: ArrayBuffer): boolean {
    const view = new Uint8Array(packet);
    // Check transport_scrambling_control bits (bits 6-7 of byte 3)
    const scramblingControl = (view[3] & 0xC0) >> 6;
    return scramblingControl !== 0;
  }

  /**
   * Decrypt individual TS packet
   */
  private async decryptTSPacket(packet: ArrayBuffer, key: EncryptionKey): Promise<ArrayBuffer> {
    try {
      // This is a simplified implementation
      // Real SAMPLE-AES would decrypt only the encrypted portions
      const cryptoKey = await this.deriveKey(key.uri, key.iv);
      const iv = this.parseIV(key.iv, 16);

      // For this implementation, we'll decrypt the payload
      const view = new Uint8Array(packet);
      const headerSize = this.getTSHeaderSize(view);
      const payload = packet.slice(headerSize);

      if (payload.byteLength === 0) {
        return packet; // No payload to decrypt
      }

      const decryptedPayload = await crypto.subtle.decrypt(
        {
          name: 'AES-CBC',
          iv: iv
        },
        cryptoKey,
        payload
      );

      // Combine header with decrypted payload
      const result = new ArrayBuffer(headerSize + decryptedPayload.byteLength);
      const resultView = new Uint8Array(result);
      resultView.set(view.slice(0, headerSize), 0);
      resultView.set(new Uint8Array(decryptedPayload), headerSize);

      return result;
    } catch (error) {
      this.log(`TS packet decryption failed: ${error}`, 'ERROR');
      return packet; // Return original packet if decryption fails
    }
  }

  /**
   * Get TS packet header size
   */
  private getTSHeaderSize(packet: Uint8Array): number {
    let headerSize = 4; // Basic header size

    // Check for adaptation field
    const adaptationFieldControl = (packet[3] & 0x30) >> 4;
    if (adaptationFieldControl === 2 || adaptationFieldControl === 3) {
      const adaptationFieldLength = packet[4];
      headerSize += 1 + adaptationFieldLength;
    }

    return Math.min(headerSize, packet.length);
  }

  /**
   * Combine TS packets back into a single buffer
   */
  private combineTSPackets(packets: ArrayBuffer[]): ArrayBuffer {
    const totalLength = packets.reduce((sum, packet) => sum + packet.byteLength, 0);
    const result = new ArrayBuffer(totalLength);
    const resultView = new Uint8Array(result);

    let offset = 0;
    for (const packet of packets) {
      resultView.set(new Uint8Array(packet), offset);
      offset += packet.byteLength;
    }

    return result;
  }

  /**
   * Advanced key derivation for complex scenarios
   */
  public async deriveAdvancedKey(
    keyData: ArrayBuffer,
    salt: Uint8Array,
    iterations: number = 1000
  ): Promise<CryptoKey> {
    try {
      this.log('Performing advanced key derivation', 'DEBUG');

      // Import key material
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );

      // Derive key using PBKDF2
      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: iterations,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-CBC', length: 128 },
        false,
        ['decrypt']
      );

      return derivedKey;
    } catch (error) {
      this.log(`Advanced key derivation failed: ${error}`, 'ERROR');
      throw error;
    }
  }

  /**
   * Extract encryption keys from M3U8 playlists
   */
  public extractKeysFromM3U8(playlist: string): EncryptionKey[] {
    const keys: EncryptionKey[] = [];
    const lines = playlist.split('\n');

    for (const line of lines) {
      if (line.startsWith('#EXT-X-KEY:')) {
        try {
          const key = this.parseEXTXKey(line);
          if (key) {
            keys.push(key);
          }
        } catch (error) {
          this.log(`Failed to parse EXT-X-KEY: ${error}`, 'WARN');
        }
      }
    }

    this.log(`Extracted ${keys.length} keys from M3U8 playlist`, 'DEBUG');
    return keys;
  }

  /**
   * Parse EXT-X-KEY tag from M3U8 playlist
   */
  private parseEXTXKey(line: string): EncryptionKey | null {
    const keyRegex = /#EXT-X-KEY:(.+)/;
    const match = line.match(keyRegex);
    if (!match) return null;

    const params = this.parseM3U8Params(match[1]);
    
    const method = params.METHOD as EncryptionMethod;
    const uri = params.URI?.replace(/"/g, '');
    const iv = params.IV;
    const keyFormat = params.KEYFORMAT?.replace(/"/g, '');
    const keyFormatVersions = params.KEYFORMATVERSIONS?.replace(/"/g, '');

    if (!method || method === EncryptionMethod.NONE || !uri) {
      return null;
    }

    return {
      uri,
      method,
      iv,
      keyFormat,
      keyFormatVersions
    };
  }

  /**
   * Parse M3U8 parameter string
   */
  private parseM3U8Params(paramString: string): Record<string, string> {
    const params: Record<string, string> = {};
    const regex = /([A-Z-]+)=([^,]+)/g;
    let match;

    while ((match = regex.exec(paramString)) !== null) {
      params[match[1]] = match[2];
    }

    return params;
  }

  /**
   * Clear encryption key cache
   */
  public clearKeyCache(): void {
    this.keyCache.clear();
    this.ivCache.clear();
    this.log('Encryption key cache cleared', 'DEBUG');
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { keyCount: number; ivCount: number } {
    return {
      keyCount: this.keyCache.size,
      ivCount: this.ivCache.size
    };
  }

  private getDefaultDebugConfig(): DebugConfig {
    return {
      enabled: false,
      level: 'INFO',
      logNetworkRequests: false,
      logDetectionResults: false,
      logCryptoOperations: true,
      saveToFile: false
    };
  }

  private log(message: string, level: keyof { DEBUG: 0; INFO: 1; WARN: 2; ERROR: 3 }): void {
    if (!this.debugConfig.enabled || !this.debugConfig.logCryptoOperations) return;
    
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] Crypto: ${message}`;
    
    switch (level) {
      case 'DEBUG':
        console.debug(logMessage);
        break;
      case 'INFO':
        console.info(logMessage);
        break;
      case 'WARN':
        console.warn(logMessage);
        break;
      case 'ERROR':
        console.error(logMessage);
        break;
    }
  }
}

/**
 * Utility functions for cryptographic operations
 */
export class CryptoUtils {
  /**
   * Convert hex string to ArrayBuffer
   */
  static hexToArrayBuffer(hex: string): ArrayBuffer {
    const cleanHex = hex.replace(/[^0-9A-Fa-f]/g, '');
    const buffer = new ArrayBuffer(cleanHex.length / 2);
    const view = new Uint8Array(buffer);
    
    for (let i = 0; i < cleanHex.length; i += 2) {
      view[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
    }
    
    return buffer;
  }

  /**
   * Convert ArrayBuffer to hex string
   */
  static arrayBufferToHex(buffer: ArrayBuffer): string {
    const view = new Uint8Array(buffer);
    return Array.from(view)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Generate random IV
   */
  static generateRandomIV(length: number = 16): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(length));
  }

  /**
   * XOR two arrays
   */
  static xorArrays(a: Uint8Array, b: Uint8Array): Uint8Array {
    const result = new Uint8Array(Math.min(a.length, b.length));
    for (let i = 0; i < result.length; i++) {
      result[i] = a[i] ^ b[i];
    }
    return result;
  }
}