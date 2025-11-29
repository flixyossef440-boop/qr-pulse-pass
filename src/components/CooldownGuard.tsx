import { useState, useEffect, ReactNode } from 'react';
import { AlertTriangle, Clock, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

const COOLDOWN_DURATION = 30 * 60 * 1000; // 30 دقيقة
const DEVICE_ID_KEY = 'device-unique-id';

// Generate device fingerprint
const generateDeviceId = (): string => {
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
  const timestamp = Date.now().toString(36);
  
  return `${Math.abs(hash).toString(36)}-${random}-${timestamp}`;
};

const getOrCreateDeviceId = (): string => {
  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = generateDeviceId();
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch {
    return generateDeviceId();
  }
};

// Check server cooldown
const checkServerCooldown = async (deviceId: string): Promise<{ inCooldown: boolean; remaining: number }> => {
  try {
    const response = await fetch('/api/check-device-cooldown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId, action: 'check' })
    });

    const data = await response.json();
    
    if (!response.ok) {
      return { inCooldown: false, remaining: 0 };
    }

    return { 
      inCooldown: data.inCooldown || false, 
      remaining: data.remaining || 0 
    };
  } catch {
    return { inCooldown: false, remaining: 0 };
  }
};

interface CooldownGuardProps {
  children: ReactNode;
}

const CooldownGuard = ({ children }: CooldownGuardProps) => {
  const [isChecking, setIsChecking] = useState(true);
  const [inCooldown, setInCooldown] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [deviceId, setDeviceId] = useState('');

  // Check cooldown on mount
  useEffect(() => {
    const checkCooldown = async () => {
      const id = getOrCreateDeviceId();
      setDeviceId(id);
      
      const { inCooldown: isCooling, remaining } = await checkServerCooldown(id);
      
      setInCooldown(isCooling);
      setCooldownRemaining(remaining);
      setIsChecking(false);
    };

    checkCooldown();
  }, []);

  // Update countdown timer
  useEffect(() => {
    if (!inCooldown) return;
    
    // Check server every 10 seconds
    const serverTimer = setInterval(async () => {
      const { inCooldown: isCooling, remaining } = await checkServerCooldown(deviceId);
      if (!isCooling) {
        setInCooldown(false);
        setCooldownRemaining(0);
      } else {
        setCooldownRemaining(remaining);
      }
    }, 10000);
    
    // Update local countdown every second
    const localTimer = setInterval(() => {
      setCooldownRemaining(prev => {
        const newValue = Math.max(0, prev - 1000);
        if (newValue === 0) {
          setInCooldown(false);
        }
        return newValue;
      });
    }, 1000);
    
    return () => {
      clearInterval(serverTimer);
      clearInterval(localTimer);
    };
  }, [inCooldown, deviceId]);

  const formatRemainingTime = (ms: number): string => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Loading state
  if (isChecking) {
    return (
      <div className="min-h-screen bg-background cyber-grid flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin relative" />
          </div>
          <p className="font-mono text-sm text-muted-foreground animate-pulse">CHECKING ACCESS...</p>
        </div>
      </div>
    );
  }

  // Cooldown active - block entire site
  if (inCooldown) {
    return (
      <div className="min-h-screen bg-background cyber-grid flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-yellow-500/20 rounded-full blur-xl animate-pulse" />
            <AlertTriangle className="w-24 h-24 text-yellow-500 relative mx-auto" />
          </div>
          
          <h1 className="font-display text-4xl text-yellow-500 mb-4">الوصول محظور</h1>
          
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Clock className="w-8 h-8 text-yellow-500" />
              <span className="font-display text-5xl text-yellow-500">
                {formatRemainingTime(cooldownRemaining)}
              </span>
            </div>
            <p className="text-muted-foreground" dir="rtl">
              لقد قمت بإرسال بيانات من هذا الجهاز. الموقع محظور لمدة 30 دقيقة.
            </p>
          </div>

          <div className="w-full bg-muted rounded-full h-3 mb-6 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 transition-all duration-1000"
              style={{ width: `${((COOLDOWN_DURATION - cooldownRemaining) / COOLDOWN_DURATION) * 100}%` }}
            />
          </div>

          <div className="bg-card/50 border border-border rounded-lg p-4 mb-6">
            <p className="text-xs font-mono text-muted-foreground">
              DEVICE ID: {deviceId.substring(0, 12)}...
            </p>
            <p className="text-xs font-mono text-yellow-500 mt-1">
              ACCESS BLOCKED
            </p>
          </div>

          <Button 
            onClick={() => window.location.reload()} 
            className="gap-2" 
            variant="outline"
          >
            <Home className="w-4 h-4" />
            تحديث الصفحة
          </Button>
        </div>

        <footer className="fixed bottom-0 left-0 right-0 bg-muted/80 backdrop-blur border-t border-border py-3 px-4">
          <div className="flex items-center justify-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              SITE BLOCKED
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">REMAINING: {formatRemainingTime(cooldownRemaining)}</span>
          </div>
        </footer>
      </div>
    );
  }

  // No cooldown - render children (the actual site)
  return <>{children}</>;
};

export default CooldownGuard;
