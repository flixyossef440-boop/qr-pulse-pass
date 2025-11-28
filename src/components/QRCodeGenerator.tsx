import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { generateToken } from '@/lib/tokenUtils';
import { Shield, RefreshCw, Clock, Lock } from 'lucide-react';

const QRCodeGenerator = () => {
  const [token, setToken] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(5);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const generateNewQR = useCallback(() => {
    setIsGenerating(true);
    const newToken = generateToken();
    setToken(newToken);
    setTimeLeft(5);
    
    setTimeout(() => setIsGenerating(false), 200);
  }, []);

  // Generate new QR code every 5 seconds
  useEffect(() => {
    generateNewQR();
    
    const interval = setInterval(() => {
      generateNewQR();
    }, 5000);

    return () => clearInterval(interval);
  }, [generateNewQR]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) return 5;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const qrUrl = `${window.location.origin}/secure?token=${encodeURIComponent(token)}`;

  return (
    <div className="min-h-screen bg-background cyber-grid flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-cyber-green/5 to-transparent pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyber-green to-transparent opacity-50" />
      
      {/* Header */}
      <div className="text-center mb-8 z-10">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Shield className="w-10 h-10 text-primary animate-pulse" />
          <h1 className="font-display text-4xl md:text-5xl font-bold text-glow-strong tracking-wider">
            QUANTUM LOCK
          </h1>
          <Lock className="w-10 h-10 text-primary animate-pulse" />
        </div>
        <p className="text-muted-foreground font-mono text-sm tracking-widest">
          نظام التشفير الكمي | ENCRYPTED QR ACCESS
        </p>
      </div>

      {/* QR Code Container */}
      <div className="relative z-10">
        {/* Outer glow */}
        <div className="absolute -inset-8 bg-gradient-to-r from-cyber-green/20 via-cyber-cyan/20 to-cyber-green/20 rounded-3xl blur-xl animate-pulse-glow" />
        
        {/* QR Container */}
        <div className={`relative bg-card border-2 border-primary/50 rounded-2xl p-6 box-glow transition-all duration-300 ${isGenerating ? 'scale-95 opacity-80' : 'scale-100 opacity-100'}`}>
          {/* Scan line effect */}
          <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
            <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyber-green to-transparent opacity-60 animate-scan-line" />
          </div>

          {/* Corner decorations */}
          <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-cyber-green rounded-tl-lg" />
          <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-cyber-green rounded-tr-lg" />
          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-cyber-green rounded-bl-lg" />
          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-cyber-green rounded-br-lg" />

          {/* QR Code */}
          <div className="bg-white p-4 rounded-lg">
            <QRCodeSVG
              value={qrUrl}
              size={220}
              level="H"
              includeMargin={false}
              bgColor="#ffffff"
              fgColor="#0a0f14"
            />
          </div>

          {/* Token preview */}
          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground font-mono">TOKEN ID:</p>
            <p className="text-xs text-primary font-mono truncate max-w-[220px]">
              {token.substring(0, 20)}...
            </p>
          </div>
        </div>
      </div>

      {/* Timer Section */}
      <div className="mt-8 flex flex-col items-center z-10">
        {/* Circular countdown */}
        <div className="relative w-24 h-24 mb-4">
          <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="4"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="283"
              strokeDashoffset={283 - (283 * timeLeft) / 5}
              className="transition-all duration-1000 ease-linear drop-shadow-[0_0_10px_hsl(var(--cyber-green))]"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-display text-3xl font-bold text-glow">{timeLeft}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span className="font-mono text-sm">يتجدد كل 5 ثواني</span>
        </div>

        <div className="flex items-center gap-2 mt-2 text-primary/70">
          <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
          <span className="font-mono text-xs">AUTO-REFRESH ACTIVE</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-10 max-w-md text-center z-10">
        <div className="bg-muted/50 border border-border rounded-lg p-4">
          <h3 className="font-display text-sm text-primary mb-2">كيفية الاستخدام</h3>
          <ol className="text-xs text-muted-foreground space-y-1 font-mono text-right" dir="rtl">
            <li>1. امسح الـ QR Code بكاميرا الهاتف</li>
            <li>2. يجب المسح خلال 5 ثواني قبل انتهاء الصلاحية</li>
            <li>3. بعد الدخول يمكنك التصفح بشكل طبيعي</li>
          </ol>
        </div>
      </div>

      {/* Status bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-muted/80 backdrop-blur border-t border-border py-2 px-4 z-20">
        <div className="flex items-center justify-center gap-4 text-xs font-mono">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyber-green animate-pulse" />
            SYSTEM ACTIVE
          </span>
          <span className="text-muted-foreground">|</span>
          <span className="text-muted-foreground">ENCRYPTION: AES-256</span>
          <span className="text-muted-foreground">|</span>
          <span className="text-muted-foreground">STATUS: SECURE</span>
        </div>
      </div>
    </div>
  );
};

export default QRCodeGenerator;
