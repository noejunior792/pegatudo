import { EncryptionMethod } from '../types/index.js';
export class AdvancedCryptoEngine {
    constructor(debugConfig) {
        this.keyCache = new Map();
        this.ivCache = new Map();
        this.debugConfig = debugConfig || this.getDefaultDebugConfig();
        this.log('AdvancedCryptoEngine initialized', 'INFO');
    }
    async decrypt(data, key) {
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
        }
        catch (error) {
            this.log(`Decryption failed: ${error}`, 'ERROR');
            throw error;
        }
    }
    async deriveKey(keyUri, iv) {
        const cacheKey = `${keyUri}:${iv || 'no-iv'}`;
        if (this.keyCache.has(cacheKey)) {
            this.log(`Using cached key for ${keyUri}`, 'DEBUG');
            return this.keyCache.get(cacheKey);
        }
        try {
            this.log(`Deriving key from URI: ${keyUri}`, 'DEBUG');
            const response = await fetch(keyUri);
            if (!response.ok) {
                throw new Error(`Failed to fetch encryption key: ${response.status}`);
            }
            const keyData = await response.arrayBuffer();
            const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'AES-CBC' }, false, ['decrypt']);
            this.keyCache.set(cacheKey, cryptoKey);
            this.log(`Key derived and cached for ${keyUri}`, 'DEBUG');
            return cryptoKey;
        }
        catch (error) {
            this.log(`Key derivation failed for ${keyUri}: ${error}`, 'ERROR');
            throw error;
        }
    }
    async decryptSegment(segment, data) {
        if (!segment.encrypted || !segment.key) {
            return data;
        }
        try {
            this.log(`Decrypting segment ${segment.sequence}`, 'DEBUG');
            const decryptedData = await this.decrypt(data, segment.key);
            this.log(`Successfully decrypted segment ${segment.sequence}`, 'DEBUG');
            return decryptedData;
        }
        catch (error) {
            this.log(`Failed to decrypt segment ${segment.sequence}: ${error}`, 'ERROR');
            throw error;
        }
    }
    async decryptAES128(data, key) {
        try {
            const cryptoKey = await this.deriveKey(key.uri, key.iv);
            const iv = this.parseIV(key.iv, 16);
            this.log('Performing AES-128 CBC decryption', 'DEBUG');
            const decrypted = await crypto.subtle.decrypt({
                name: 'AES-CBC',
                iv: iv
            }, cryptoKey, data);
            return decrypted;
        }
        catch (error) {
            this.log(`AES-128 decryption failed: ${error}`, 'ERROR');
            throw error;
        }
    }
    async decryptAES128CTR(data, key) {
        try {
            const cryptoKey = await this.deriveKey(key.uri, key.iv);
            const iv = this.parseIV(key.iv, 16);
            this.log('Performing AES-128 CTR decryption', 'DEBUG');
            const decrypted = await crypto.subtle.decrypt({
                name: 'AES-CTR',
                counter: iv,
                length: 64
            }, cryptoKey, data);
            return decrypted;
        }
        catch (error) {
            this.log(`AES-128 CTR decryption failed: ${error}`, 'ERROR');
            throw error;
        }
    }
    async decryptSampleAES(data, key) {
        try {
            this.log('Performing SAMPLE-AES decryption', 'DEBUG');
            const tsPackets = this.parseTSPackets(data);
            const decryptedPackets = [];
            for (const packet of tsPackets) {
                if (this.isEncryptedTSPacket(packet)) {
                    const decryptedPacket = await this.decryptTSPacket(packet, key);
                    decryptedPackets.push(decryptedPacket);
                }
                else {
                    decryptedPackets.push(packet);
                }
            }
            return this.combineTSPackets(decryptedPackets);
        }
        catch (error) {
            this.log(`SAMPLE-AES decryption failed: ${error}`, 'ERROR');
            throw error;
        }
    }
    async decryptSampleAESCTR(data, key) {
        try {
            this.log('Performing SAMPLE-AES CTR decryption', 'DEBUG');
            const cryptoKey = await this.deriveKey(key.uri, key.iv);
            const iv = this.parseIV(key.iv, 16);
            const decrypted = await crypto.subtle.decrypt({
                name: 'AES-CTR',
                counter: iv,
                length: 64
            }, cryptoKey, data);
            return decrypted;
        }
        catch (error) {
            this.log(`SAMPLE-AES CTR decryption failed: ${error}`, 'ERROR');
            throw error;
        }
    }
    parseIV(ivString, length = 16) {
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
        }
        catch (error) {
            this.log(`Failed to parse IV: ${error}`, 'WARN');
            return new Uint8Array(length);
        }
    }
    parseTSPackets(data) {
        const packets = [];
        const view = new Uint8Array(data);
        const packetSize = 188;
        for (let i = 0; i < view.length; i += packetSize) {
            if (i + packetSize <= view.length) {
                if (view[i] === 0x47) {
                    packets.push(data.slice(i, i + packetSize));
                }
            }
        }
        this.log(`Parsed ${packets.length} TS packets`, 'DEBUG');
        return packets;
    }
    isEncryptedTSPacket(packet) {
        const view = new Uint8Array(packet);
        const scramblingControl = (view[3] & 0xC0) >> 6;
        return scramblingControl !== 0;
    }
    async decryptTSPacket(packet, key) {
        try {
            const cryptoKey = await this.deriveKey(key.uri, key.iv);
            const iv = this.parseIV(key.iv, 16);
            const view = new Uint8Array(packet);
            const headerSize = this.getTSHeaderSize(view);
            const payload = packet.slice(headerSize);
            if (payload.byteLength === 0) {
                return packet;
            }
            const decryptedPayload = await crypto.subtle.decrypt({
                name: 'AES-CBC',
                iv: iv
            }, cryptoKey, payload);
            const result = new ArrayBuffer(headerSize + decryptedPayload.byteLength);
            const resultView = new Uint8Array(result);
            resultView.set(view.slice(0, headerSize), 0);
            resultView.set(new Uint8Array(decryptedPayload), headerSize);
            return result;
        }
        catch (error) {
            this.log(`TS packet decryption failed: ${error}`, 'ERROR');
            return packet;
        }
    }
    getTSHeaderSize(packet) {
        let headerSize = 4;
        const adaptationFieldControl = (packet[3] & 0x30) >> 4;
        if (adaptationFieldControl === 2 || adaptationFieldControl === 3) {
            const adaptationFieldLength = packet[4];
            headerSize += 1 + adaptationFieldLength;
        }
        return Math.min(headerSize, packet.length);
    }
    combineTSPackets(packets) {
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
    async deriveAdvancedKey(keyData, salt, iterations = 1000) {
        try {
            this.log('Performing advanced key derivation', 'DEBUG');
            const keyMaterial = await crypto.subtle.importKey('raw', keyData, { name: 'PBKDF2' }, false, ['deriveKey']);
            const derivedKey = await crypto.subtle.deriveKey({
                name: 'PBKDF2',
                salt: salt,
                iterations: iterations,
                hash: 'SHA-256'
            }, keyMaterial, { name: 'AES-CBC', length: 128 }, false, ['decrypt']);
            return derivedKey;
        }
        catch (error) {
            this.log(`Advanced key derivation failed: ${error}`, 'ERROR');
            throw error;
        }
    }
    extractKeysFromM3U8(playlist) {
        const keys = [];
        const lines = playlist.split('\n');
        for (const line of lines) {
            if (line.startsWith('#EXT-X-KEY:')) {
                try {
                    const key = this.parseEXTXKey(line);
                    if (key) {
                        keys.push(key);
                    }
                }
                catch (error) {
                    this.log(`Failed to parse EXT-X-KEY: ${error}`, 'WARN');
                }
            }
        }
        this.log(`Extracted ${keys.length} keys from M3U8 playlist`, 'DEBUG');
        return keys;
    }
    parseEXTXKey(line) {
        const keyRegex = /#EXT-X-KEY:(.+)/;
        const match = line.match(keyRegex);
        if (!match)
            return null;
        const params = this.parseM3U8Params(match[1]);
        const method = params.METHOD;
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
    parseM3U8Params(paramString) {
        const params = {};
        const regex = /([A-Z-]+)=([^,]+)/g;
        let match;
        while ((match = regex.exec(paramString)) !== null) {
            params[match[1]] = match[2];
        }
        return params;
    }
    clearKeyCache() {
        this.keyCache.clear();
        this.ivCache.clear();
        this.log('Encryption key cache cleared', 'DEBUG');
    }
    getCacheStats() {
        return {
            keyCount: this.keyCache.size,
            ivCount: this.ivCache.size
        };
    }
    getDefaultDebugConfig() {
        return {
            enabled: false,
            level: 'INFO',
            logNetworkRequests: false,
            logDetectionResults: false,
            logCryptoOperations: true,
            saveToFile: false
        };
    }
    log(message, level) {
        if (!this.debugConfig.enabled || !this.debugConfig.logCryptoOperations)
            return;
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
export class CryptoUtils {
    static hexToArrayBuffer(hex) {
        const cleanHex = hex.replace(/[^0-9A-Fa-f]/g, '');
        const buffer = new ArrayBuffer(cleanHex.length / 2);
        const view = new Uint8Array(buffer);
        for (let i = 0; i < cleanHex.length; i += 2) {
            view[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
        }
        return buffer;
    }
    static arrayBufferToHex(buffer) {
        const view = new Uint8Array(buffer);
        return Array.from(view)
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join('');
    }
    static generateRandomIV(length = 16) {
        return crypto.getRandomValues(new Uint8Array(length));
    }
    static xorArrays(a, b) {
        const result = new Uint8Array(Math.min(a.length, b.length));
        for (let i = 0; i < result.length; i++) {
            result[i] = a[i] ^ b[i];
        }
        return result;
    }
}
