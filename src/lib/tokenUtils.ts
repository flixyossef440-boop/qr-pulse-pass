// Token encryption utilities
const SECRET_KEY = 'cyber-qr-secret-2024';

// Generate a unique token with timestamp
export const generateToken = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const data = `${timestamp}-${random}`;
  
  // Simple encoding (in production, use proper encryption)
  const encoded = btoa(data + SECRET_KEY);
  return encoded;
};

// Validate token - check if it's less than 5 seconds old
export const validateToken = (token: string): { valid: boolean; timeLeft: number; expired: boolean } => {
  try {
    const decoded = atob(token);
    const dataWithoutKey = decoded.replace(SECRET_KEY, '');
    const parts = dataWithoutKey.split('-');
    const timestamp = parseInt(parts[0], 10);
    
    if (isNaN(timestamp)) {
      return { valid: false, timeLeft: 0, expired: true };
    }
    
    const now = Date.now();
    const age = now - timestamp;
    const maxAge = 10000; // 10 seconds to allow for network latency and scanning time
    const timeLeft = Math.max(0, maxAge - age);
    
    if (age > maxAge) {
      return { valid: false, timeLeft: 0, expired: true };
    }
    
    return { valid: true, timeLeft, expired: false };
  } catch {
    return { valid: false, timeLeft: 0, expired: true };
  }
};

// Store session token in localStorage to maintain access
export const storeSessionToken = (): string => {
  const sessionToken = generateToken() + '-session-' + Date.now();
  localStorage.setItem('cyber-session', sessionToken);
  return sessionToken;
};

// Check if user has valid session
export const hasValidSession = (): boolean => {
  const session = localStorage.getItem('cyber-session');
  return session !== null && session.includes('-session-');
};

// Clear session
export const clearSession = (): void => {
  localStorage.removeItem('cyber-session');
};
