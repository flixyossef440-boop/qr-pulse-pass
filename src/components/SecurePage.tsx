import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { validateToken, storeSessionToken, hasValidSession, clearSession } from '@/lib/tokenUtils';
import { ShieldCheck, ShieldX, Loader2, Lock, Unlock, Home, LogOut, Server, Database, Wifi, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';

type AccessState = 'validating' | 'granted' | 'denied' | 'expired';

const SecurePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [accessState, setAccessState] = useState<AccessState>('validating');
  const [validationMessage, setValidationMessage] = useState<string>('');

  useEffect(() => {
    // Check if user already has a valid session
    if (hasValidSession()) {
      setAccessState('granted');
      setValidationMessage('SESSION_RESTORED');
      return;
    }

    const token = searchParams.get('token');
    
    if (!token) {
      setAccessState('denied');
      setValidationMessage('NO_TOKEN_PROVIDED');
      return;
    }

    // Simulate validation delay for effect
    const validationTimer = setTimeout(() => {
      const result = validateToken(token);
      
      if (result.valid) {
        storeSessionToken();
        setAccessState('granted');
        setValidationMessage('ACCESS_GRANTED');
      } else {
        setAccessState('expired');
        setValidationMessage('TOKEN_EXPIRED');
      }
    }, 1500);

    return () => clearTimeout(validationTimer);
  }, [searchParams]);

  const handleLogout = () => {
    clearSession();
    navigate('/');
  };

  const handleRetry = () => {
    navigate('/');
  };

  // Validating state
  if (accessState === 'validating') {
    return (
      <div className="min-h-screen bg-background cyber-grid flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-cyber-green/20 rounded-full blur-xl animate-pulse" />
            <Loader2 className="w-20 h-20 text-primary animate-spin relative" />
          </div>
          <h1 className="font-display text-2xl text-glow mb-4">جاري التحقق</h1>
          <div className="flex flex-col gap-2 font-mono text-sm text-muted-foreground">
            <p className="animate-pulse">VALIDATING TOKEN...</p>
            <p className="animate-pulse delay-100">CHECKING TIMESTAMP...</p>
            <p className="animate-pulse delay-200">DECRYPTING ACCESS KEY...</p>
          </div>
        </div>
      </div>
    );
  }

  // Denied or Expired state
  if (accessState === 'denied' || accessState === 'expired') {
    return (
      <div className="min-h-screen bg-background cyber-grid flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-destructive/20 rounded-full blur-xl" />
            <ShieldX className="w-20 h-20 text-destructive relative" />
          </div>
          
          <h1 className="font-display text-3xl text-destructive mb-4">
            {accessState === 'expired' ? 'انتهت الصلاحية' : 'الوصول مرفوض'}
          </h1>
          
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-6">
            <p className="font-mono text-sm text-destructive mb-2">
              ERROR: {validationMessage}
            </p>
            <p className="text-sm text-muted-foreground" dir="rtl">
              {accessState === 'expired' 
                ? 'الـ QR Code انتهت صلاحيته. يرجى مسح QR Code جديد خلال 5 ثواني.'
                : 'لم يتم العثور على رمز الوصول. يرجى مسح QR Code صالح.'}
            </p>
          </div>

          <Button 
            onClick={handleRetry}
            className="gap-2"
            variant="outline"
          >
            <Home className="w-4 h-4" />
            العودة للمسح
          </Button>
        </div>
      </div>
    );
  }

  // Granted state - Main secure content
  return (
    <div className="min-h-screen bg-background cyber-grid">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary" />
            <div>
              <h1 className="font-display text-xl text-glow">SECURE ZONE</h1>
              <p className="text-xs text-muted-foreground font-mono">{validationMessage}</p>
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLogout}
            className="gap-2 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="w-4 h-4" />
            خروج
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 border border-primary/30 rounded-2xl p-8 mb-8 box-glow">
          <div className="flex items-center gap-4 mb-4">
            <Unlock className="w-12 h-12 text-primary" />
            <div>
              <h2 className="font-display text-2xl md:text-3xl text-glow" dir="rtl">
                مرحباً بك في المنطقة الآمنة
              </h2>
              <p className="text-muted-foreground font-mono text-sm">
                تم التحقق من هويتك بنجاح
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <Lock className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">مشفر</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <Wifi className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">متصل</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <Activity className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">نشط</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <ShieldCheck className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">آمن</p>
            </div>
          </div>
        </div>

        {/* Content Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="bg-card border border-border rounded-xl p-6 hover:box-glow transition-all duration-300">
            <Server className="w-10 h-10 text-primary mb-4" />
            <h3 className="font-display text-lg mb-2">الخادم الآمن</h3>
            <p className="text-sm text-muted-foreground" dir="rtl">
              جميع البيانات محمية بتشفير من الدرجة العسكرية
            </p>
            <div className="mt-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyber-green animate-pulse" />
              <span className="text-xs text-primary font-mono">ONLINE</span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-card border border-border rounded-xl p-6 hover:box-glow transition-all duration-300">
            <Database className="w-10 h-10 text-primary mb-4" />
            <h3 className="font-display text-lg mb-2">قاعدة البيانات</h3>
            <p className="text-sm text-muted-foreground" dir="rtl">
              تخزين آمن لجميع المعلومات الحساسة
            </p>
            <div className="mt-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyber-green animate-pulse" />
              <span className="text-xs text-primary font-mono">SYNCED</span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-card border border-border rounded-xl p-6 hover:box-glow transition-all duration-300">
            <Activity className="w-10 h-10 text-primary mb-4" />
            <h3 className="font-display text-lg mb-2">المراقبة الحية</h3>
            <p className="text-sm text-muted-foreground" dir="rtl">
              تتبع جميع الأنشطة في الوقت الفعلي
            </p>
            <div className="mt-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyber-green animate-pulse" />
              <span className="text-xs text-primary font-mono">MONITORING</span>
            </div>
          </div>
        </div>

        {/* Session Info */}
        <div className="mt-8 bg-muted/30 border border-border rounded-lg p-4">
          <h4 className="font-mono text-sm text-primary mb-3">معلومات الجلسة</h4>
          <div className="grid md:grid-cols-3 gap-4 text-xs font-mono">
            <div>
              <span className="text-muted-foreground">STATUS:</span>
              <span className="text-primary ml-2">AUTHENTICATED</span>
            </div>
            <div>
              <span className="text-muted-foreground">ENCRYPTION:</span>
              <span className="text-primary ml-2">AES-256</span>
            </div>
            <div>
              <span className="text-muted-foreground">SESSION:</span>
              <span className="text-primary ml-2">ACTIVE</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Status */}
      <footer className="fixed bottom-0 left-0 right-0 bg-muted/80 backdrop-blur border-t border-border py-2 px-4">
        <div className="flex items-center justify-center gap-4 text-xs font-mono">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyber-green animate-pulse" />
            SECURE CONNECTION
          </span>
          <span className="text-muted-foreground">|</span>
          <span className="text-muted-foreground">يمكنك التصفح بحرية</span>
        </div>
      </footer>
    </div>
  );
};

export default SecurePage;
