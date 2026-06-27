/**
 * IP Geolocation Service
 * 
 * Provides IP geolocation data using a free, no-API-key service.
 * This is a backend-only service - data is stored in activity_logs but not exposed in UI.
 * 
 * Uses ip-api.com (free tier, no API key required)
 */

const https = require('https');
const http = require('http');

class IPGeolocationService {
    constructor() {
        this.cache = new Map();
        this.cacheTTL = 24 * 60 * 60 * 1000; // 24 hours
    }

    /**
     * Get geolocation data for an IP address
     * @param {string} ipAddress - IP address to geolocate
     * @returns {Promise<Object|null>} Geolocation data or null if failed
     */
    async getGeolocation(ipAddress) {
        if (!ipAddress) {
            return null;
        }

        // Skip private/local IPs
        if (this.isPrivateIP(ipAddress)) {
            return null;
        }

        // Check cache
        const cached = this.cache.get(ipAddress);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
            return cached.data;
        }

        try {
            const data = await this.fetchFromAPI(ipAddress);
            
            if (data) {
                // Cache the result
                this.cache.set(ipAddress, {
                    data,
                    timestamp: Date.now()
                });
                
                // Clean up old cache entries
                this.cleanupCache();
            }
            
            return data;
        } catch (error) {
            console.error('[IPGeolocation] Error fetching geolocation:', error.message);
            return null;
        }
    }

    /**
     * Fetch geolocation data from ip-api.com
     * @param {string} ipAddress - IP address
     * @returns {Promise<Object|null>} Geolocation data
     */
    fetchFromAPI(ipAddress) {
        return new Promise((resolve, reject) => {
            const url = `http://ip-api.com/json/${ipAddress}`;
            
            http.get(url, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        
                        if (parsed.status === 'success') {
                            resolve({
                                country: parsed.country || null,
                                city: parsed.city || null,
                                latitude: parsed.lat || null,
                                longitude: parsed.lon || null,
                                isp: parsed.isp || null,
                                timezone: parsed.timezone || null
                            });
                        } else {
                            resolve(null);
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            }).on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Check if IP is private/local
     * @param {string} ipAddress - IP address
     * @returns {boolean} True if private IP
     */
    isPrivateIP(ipAddress) {
        if (!ipAddress) return true;
        
        // IPv4 private ranges
        const privateRanges = [
            /^10\./,
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
            /^192\.168\./,
            /^127\./,
            /^localhost$/i,
            /^::1$/,
            /^fc00:/i,
            /^fe80:/i
        ];
        
        return privateRanges.some(range => range.test(ipAddress));
    }

    /**
     * Clean up old cache entries
     */
    cleanupCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if ((now - value.timestamp) > this.cacheTTL) {
                this.cache.delete(key);
            }
        }
        
        // Limit cache size
        if (this.cache.size > 1000) {
            const entries = Array.from(this.cache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            
            // Remove oldest 20%
            const toRemove = Math.floor(entries.length * 0.2);
            for (let i = 0; i < toRemove; i++) {
                this.cache.delete(entries[i][0]);
            }
        }
    }

    /**
     * Clear cache (useful for testing)
     */
    clearCache() {
        this.cache.clear();
    }
}

// Export singleton instance
module.exports = new IPGeolocationService();
