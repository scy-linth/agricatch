/**
 * Browser Parser Service
 * 
 * Parses user agent strings to extract browser, OS, and device type information.
 * This is a backend-only service - data is stored in activity_logs but not exposed in UI.
 * 
 * No external dependencies - uses regex-based parsing for reliability.
 */

class BrowserParserService {
    constructor() {
        // Browser patterns
        this.browserPatterns = [
            { name: 'Edge', pattern: /Edg\/([0-9.]+)/ },
            { name: 'Chrome', pattern: /Chrome\/([0-9.]+)/ },
            { name: 'Firefox', pattern: /Firefox\/([0-9.]+)/ },
            { name: 'Safari', pattern: /Safari\/([0-9.]+)/ },
            { name: 'Opera', pattern: /Opera\/([0-9.]+)/ },
            { name: 'IE', pattern: /MSIE ([0-9.]+)/ },
            { name: 'IE', pattern: /Trident\/.*rv:([0-9.]+)/ }
        ];

        // OS patterns
        this.osPatterns = [
            { name: 'Windows', pattern: /Windows NT ([0-9.]+)/ },
            { name: 'Mac OS', pattern: /Mac OS X ([0-9_.]+)/ },
            { name: 'Linux', pattern: /Linux/ },
            { name: 'Android', pattern: /Android ([0-9.]+)/ },
            { name: 'iOS', pattern: /iPhone OS ([0-9_]+)/ },
            { name: 'iOS', pattern: /iPad; CPU OS ([0-9_]+)/ }
        ];

        // Device type patterns
        this.mobilePatterns = [
            /Mobile/i,
            /Android/i,
            /iPhone/i,
            /iPad/i,
            /iPod/i,
            /BlackBerry/i,
            /Opera Mini/i,
            /IEMobile/i
        ];

        this.tabletPatterns = [
            /iPad/i,
            /Tablet/i,
            /Kindle/i,
            /PlayBook/i
        ];
    }

    /**
     * Parse user agent string
     * @param {string} userAgent - User agent string
     * @returns {Object|null} Parsed browser info or null if invalid
     */
    parse(userAgent) {
        if (!userAgent || typeof userAgent !== 'string') {
            return null;
        }

        const browser = this.parseBrowser(userAgent);
        const os = this.parseOS(userAgent);
        const deviceType = this.parseDeviceType(userAgent);

        return {
            browser_name: browser?.name || null,
            browser_version: browser?.version || null,
            os_name: os?.name || null,
            os_version: os?.version || null,
            device_type: deviceType || null
        };
    }

    /**
     * Parse browser name and version
     * @param {string} userAgent - User agent string
     * @returns {Object|null} Browser info
     */
    parseBrowser(userAgent) {
        for (const { name, pattern } of this.browserPatterns) {
            const match = userAgent.match(pattern);
            if (match) {
                return {
                    name,
                    version: match[1] || null
                };
            }
        }
        return null;
    }

    /**
     * Parse OS name and version
     * @param {string} userAgent - User agent string
     * @returns {Object|null} OS info
     */
    parseOS(userAgent) {
        for (const { name, pattern } of this.osPatterns) {
            const match = userAgent.match(pattern);
            if (match) {
                let version = match[1] || null;
                
                // Clean up version format
                if (version) {
                    version = version.replace(/_/g, '.');
                }

                return {
                    name,
                    version
                };
            }
        }
        return null;
    }

    /**
     * Parse device type
     * @param {string} userAgent - User agent string
     * @returns {string} Device type: 'mobile', 'tablet', or 'desktop'
     */
    parseDeviceType(userAgent) {
        // Check for tablet first
        for (const pattern of this.tabletPatterns) {
            if (pattern.test(userAgent)) {
                return 'tablet';
            }
        }

        // Check for mobile
        for (const pattern of this.mobilePatterns) {
            if (pattern.test(userAgent)) {
                return 'mobile';
            }
        }

        // Default to desktop
        return 'desktop';
    }

    /**
     * Format OS version for display
     * @param {string} osName - OS name
     * @param {string} version - Version string
     * @returns {string} Formatted version
     */
    formatOSVersion(osName, version) {
        if (!version) return null;

        if (osName === 'Windows') {
            const winVersions = {
                '10.0': '10',
                '6.3': '8.1',
                '6.2': '8',
                '6.1': '7',
                '6.0': 'Vista',
                '5.1': 'XP'
            };
            return winVersions[version] || version;
        }

        return version;
    }
}

// Export singleton instance
module.exports = new BrowserParserService();
