import FingerprintJS from '@fingerprintjs/fingerprintjs';

const DEVICE_ID_KEY = 'device-fingerprint-id';
let cachedVisitorId: string | null = null;

// Initialize FingerprintJS and get visitor ID
export const getDeviceFingerprint = async (): Promise<string> => {
  // Return cached ID if available
  if (cachedVisitorId) {
    console.log('[Fingerprint] Using cached visitor ID:', cachedVisitorId);
    return cachedVisitorId;
  }

  // Check localStorage first
  try {
    const storedId = localStorage.getItem(DEVICE_ID_KEY);
    if (storedId) {
      cachedVisitorId = storedId;
      console.log('[Fingerprint] Using stored visitor ID:', storedId);
      return storedId;
    }
  } catch (e) {
    console.warn('[Fingerprint] localStorage not available');
  }

  try {
    // Load FingerprintJS
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    const visitorId = result.visitorId;
    
    console.log('[Fingerprint] Generated new visitor ID:', visitorId);
    console.log('[Fingerprint] Confidence:', result.confidence);
    
    // Store in localStorage for persistence
    try {
      localStorage.setItem(DEVICE_ID_KEY, visitorId);
    } catch (e) {
      console.warn('[Fingerprint] Could not store in localStorage');
    }
    
    cachedVisitorId = visitorId;
    return visitorId;
  } catch (error) {
    console.error('[Fingerprint] Error getting fingerprint:', error);
    
    // Fallback to a generated ID if fingerprinting fails
    const fallbackId = generateFallbackId();
    cachedVisitorId = fallbackId;
    
    try {
      localStorage.setItem(DEVICE_ID_KEY, fallbackId);
    } catch (e) {
      // Ignore
    }
    
    return fallbackId;
  }
};

// Fallback ID generator
const generateFallbackId = (): string => {
  const nav = window.navigator;
  const screen = window.screen;
  
  const fingerprint = [
    nav.userAgent,
    nav.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    nav.hardwareConcurrency || 'unknown',
  ].join('|');
  
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  const random = Math.random().toString(36).substring(2, 15);
  return `fallback-${Math.abs(hash).toString(36)}-${random}`;
};

// Clear cached ID (useful for testing)
export const clearDeviceFingerprint = (): void => {
  cachedVisitorId = null;
  try {
    localStorage.removeItem(DEVICE_ID_KEY);
  } catch (e) {
    // Ignore
  }
};
