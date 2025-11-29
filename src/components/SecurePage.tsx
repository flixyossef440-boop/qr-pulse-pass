import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { validateToken, storeSessionToken, hasValidSession, clearSession } from '@/lib/tokenUtils';
import { getDeviceFingerprint } from '@/lib/deviceFingerprint';
import { ShieldCheck, ShieldX, Loader2, Lock, Home, LogOut, User, IdCard, Send, Clock, AlertTriangle, BookOpen, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

type AccessState = 'validating' | 'granted' | 'denied' | 'expired' | 'cooldown' | 'checking';

const COOLDOWN_DURATION = 30 * 60 * 1000; // 30 دقيقة

// ============= Server Cooldown Check (Vercel API) =============
const checkServerCooldown = async (deviceId: string): Promise<{ inCooldown: boolean; remaining: number }> => {
  try {
    console.log('[Server] Checking cooldown for device:', deviceId);
    
    const response = await fetch('/api/check-device-cooldown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId, action: 'check' })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('[Server] Cooldown check error:', data);
      return { inCooldown: false, remaining: 0 };
    }

    console.log('[Server] Cooldown response:', data);
    return { 
      inCooldown: data.inCooldown || false, 
      remaining: data.remaining || 0 
    };
  } catch (e) {
    console.error('[Server] Cooldown check failed:', e);
    return { inCooldown: false, remaining: 0 };
  }
};

const recordServerSubmission = async (deviceId: string, name: string, userId: string): Promise<boolean> => {
  try {
    console.log('[Server] Recording submission for device:', deviceId);
    
    const response = await fetch('/api/check-device-cooldown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        device_id: deviceId, 
        action: 'submit',
        name,
        user_id_field: userId
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Server] Submit error:', data);
      return false;
    }

    console.log('[Server] Submit response:', data);
    return data.success || false;
  } catch (e) {
    console.error('[Server] Submit failed:', e);
    return false;
  }
};

const SecurePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [accessState, setAccessState] = useState<AccessState>('checking');
  const [validationMessage, setValidationMessage] = useState<string>('');
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [deviceId, setDeviceId] = useState<string>('');
  
  // Form state
  const [subjectName, setSubjectName] = useState('');
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const [weekNumber, setWeekNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Initialize device ID and check server cooldown FIRST
  useEffect(() => {
    const initializeAndCheck = async () => {
      console.log('[Init] Starting initialization...');
      
      // Use FingerprintJS for accurate device identification
      const id = await getDeviceFingerprint();
      setDeviceId(id);
      console.log('[Init] Device fingerprint:', id);
      
      // Check server cooldown FIRST
      const { inCooldown, remaining } = await checkServerCooldown(id);
      
      if (inCooldown) {
        console.log('[Init] Device in cooldown from server');
        setAccessState('cooldown');
        setCooldownRemaining(remaining);
        setValidationMessage('COOLDOWN_ACTIVE');
        return;
      }
      
      // Check if user already has a valid session
      if (hasValidSession()) {
        console.log('[Init] Valid session found');
        setAccessState('granted');
        setValidationMessage('SESSION_RESTORED');
        return;
      }
      
      // Now validate token
      const token = searchParams.get('token');
      
      if (!token) {
        console.log('[Init] No token provided');
        setAccessState('denied');
        setValidationMessage('NO_TOKEN_PROVIDED');
        return;
      }
      
      // Validate token
      setAccessState('validating');
      
      // Simulate validation delay
      setTimeout(async () => {
        // Double-check server cooldown before granting access
        const recheck = await checkServerCooldown(id);
        if (recheck.inCooldown) {
          setAccessState('cooldown');
          setCooldownRemaining(recheck.remaining);
          setValidationMessage('COOLDOWN_ACTIVE');
          return;
        }
        
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
    };
    
    initializeAndCheck();
  }, [searchParams]);

  // Update countdown timer
  useEffect(() => {
    if (accessState !== 'cooldown') return;
    
    const timer = setInterval(async () => {
      const { inCooldown, remaining } = await checkServerCooldown(deviceId);
      if (!inCooldown) {
        setAccessState('granted');
        setCooldownRemaining(0);
      } else {
        setCooldownRemaining(remaining);
      }
    }, 5000);
    
    const localTimer = setInterval(() => {
      setCooldownRemaining(prev => Math.max(0, prev - 1000));
    }, 1000);
    
    return () => {
      clearInterval(timer);
      clearInterval(localTimer);
    };
  }, [accessState, deviceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Double-check server cooldown before submit
    const { inCooldown, remaining } = await checkServerCooldown(deviceId);
    if (inCooldown) {
      setAccessState('cooldown');
      setCooldownRemaining(remaining);
      toast({
        title: "غير مسموح",
        description: "يجب الانتظار قبل إرسال بيانات جديدة",
        variant: "destructive",
      });
      return;
    }
    
    if (!subjectName.trim() || !name.trim() || !userId.trim() || !weekNumber.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Record submission on server FIRST
      const recorded = await recordServerSubmission(deviceId, name.trim(), userId.trim());
      
      if (!recorded) {
        throw new Error('Failed to record submission');
      }
      
      // Send to Telegram via Vercel API
      const response = await fetch('/api/send-to-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          subjectName: subjectName.trim(),
          name: name.trim(), 
          id: userId.trim(),
          weekNumber: weekNumber.trim()
        }),
      });

      const data = await response.json();
      
      console.log('API Response:', { status: response.status, data });
      
      if (!response.ok || !data.success) {
        const errorMessage = data.error || 'Failed to send data';
        console.error('API Error:', errorMessage);
        throw new Error(errorMessage);
      }

      console.log('[Submit] Submission successful');
      
      setIsSubmitted(true);
      toast({
        title: "تم بنجاح",
        description: "تم إرسال البيانات بنجاح",
      });
    } catch (error) {
      console.error('Error submitting form:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "خطأ",
        description: errorMessage.includes('configuration') 
          ? "خطأ في إعدادات الخادم"
          : "حدث خطأ أثناء إرسال البيانات",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    navigate('/');
  };

  const handleRetry = () => {
    navigate('/');
  };

  const formatRemainingTime = (ms: number): string => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Checking/Validating state
  if (accessState === 'checking' || accessState === 'validating') {
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
            <p className="animate-pulse delay-100">CHECKING DEVICE...</p>
            <p className="animate-pulse delay-200">VERIFYING ACCESS...</p>
          </div>
        </div>
      </div>
    );
  }

  // Cooldown state
  if (accessState === 'cooldown') {
    return (
      <div className="min-h-screen bg-background cyber-grid flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-yellow-500/20 rounded-full blur-xl animate-pulse" />
            <AlertTriangle className="w-20 h-20 text-yellow-500 relative mx-auto" />
          </div>
          
          <h1 className="font-display text-3xl text-yellow-500 mb-4">فترة انتظار</h1>
          
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Clock className="w-6 h-6 text-yellow-500" />
              <span className="font-display text-4xl text-yellow-500">
                {formatRemainingTime(cooldownRemaining)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground" dir="rtl">
              لقد قمت بإرسال بيانات مؤخراً من هذا الجهاز. يرجى الانتظار حتى انتهاء فترة الانتظار (30 دقيقة).
            </p>
          </div>

          <div className="w-full bg-muted rounded-full h-2 mb-6 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 transition-all duration-1000"
              style={{ width: `${((COOLDOWN_DURATION - cooldownRemaining) / COOLDOWN_DURATION) * 100}%` }}
            />
          </div>

          <Button onClick={handleRetry} className="gap-2" variant="outline">
            <Home className="w-4 h-4" />
            العودة للرئيسية
          </Button>
        </div>

        <footer className="fixed bottom-0 left-0 right-0 bg-muted/80 backdrop-blur border-t border-border py-2 px-4">
          <div className="flex items-center justify-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              COOLDOWN ACTIVE
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">DEVICE: {deviceId.substring(0, 8)}...</span>
          </div>
        </footer>
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

          <Button onClick={handleRetry} className="gap-2" variant="outline">
            <Home className="w-4 h-4" />
            العودة للمسح
          </Button>
        </div>
      </div>
    );
  }

  // Granted state - Form
  return (
    <div className="min-h-screen bg-background cyber-grid">
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

      <main className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[calc(100vh-80px)]">
        {isSubmitted ? (
          <div className="text-center max-w-md">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-cyber-green/30 rounded-full blur-xl animate-pulse" />
              <ShieldCheck className="w-24 h-24 text-primary relative mx-auto" />
            </div>
            <h2 className="font-display text-3xl text-glow mb-4">تم بنجاح!</h2>
            <p className="text-muted-foreground mb-6" dir="rtl">
              تم إرسال بياناتك بنجاح. شكراً لك.
            </p>
            <div className="bg-muted/50 border border-border rounded-lg p-4 mb-6">
              <p className="text-sm text-muted-foreground" dir="rtl">
                <Clock className="w-4 h-4 inline-block ml-1" />
                يمكنك إرسال بيانات جديدة بعد 30 دقيقة
              </p>
            </div>
            <Button onClick={handleLogout} variant="outline" className="gap-2">
              <Home className="w-4 h-4" />
              العودة للرئيسية
            </Button>
          </div>
        ) : (
          <div className="w-full max-w-md">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/5 rounded-2xl blur-xl" />
              <div className="relative bg-card/80 backdrop-blur border border-border rounded-2xl p-8">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
                    <Lock className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="font-display text-2xl text-glow mb-2">بياناتك</h2>
                  <p className="text-sm text-muted-foreground" dir="rtl">
                    يرجى إدخال البيانات المطلوبة
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="subjectName" className="flex items-center gap-2 text-foreground">
                      <BookOpen className="w-4 h-4 text-primary" />
                      <span>اسم المادة</span>
                    </Label>
                    <Input
                      id="subjectName"
                      type="text"
                      placeholder="أدخل اسم المادة"
                      value={subjectName}
                      onChange={(e) => setSubjectName(e.target.value)}
                      className="bg-background/50 border-border focus:border-primary transition-colors"
                      dir="rtl"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name" className="flex items-center gap-2 text-foreground">
                      <User className="w-4 h-4 text-primary" />
                      <span>الاسم</span>
                    </Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="أدخل اسمك الكامل"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-background/50 border-border focus:border-primary transition-colors"
                      dir="rtl"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="userId" className="flex items-center gap-2 text-foreground">
                      <IdCard className="w-4 h-4 text-primary" />
                      <span>رقم الهوية</span>
                    </Label>
                    <Input
                      id="userId"
                      type="text"
                      placeholder="أدخل رقم الهوية"
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      className="bg-background/50 border-border focus:border-primary transition-colors"
                      dir="rtl"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="weekNumber" className="flex items-center gap-2 text-foreground">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span>الأسبوع الكام</span>
                    </Label>
                    <Input
                      id="weekNumber"
                      type="text"
                      placeholder="أدخل رقم الأسبوع"
                      value={weekNumber}
                      onChange={(e) => setWeekNumber(e.target.value)}
                      className="bg-background/50 border-border focus:border-primary transition-colors"
                      dir="rtl"
                      disabled={isSubmitting}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-300"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        جاري الإرسال...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        إرسال البيانات
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-6 p-3 bg-muted/50 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground text-center" dir="rtl">
                    🔒 بياناتك محمية ومشفرة
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-muted/80 backdrop-blur border-t border-border py-2 px-4">
        <div className="flex items-center justify-center gap-4 text-xs font-mono">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyber-green animate-pulse" />
            SECURE CONNECTION
          </span>
          <span className="text-muted-foreground">|</span>
          <span className="text-muted-foreground">DEVICE: {deviceId.substring(0, 8)}...</span>
        </div>
      </footer>
    </div>
  );
};

export default SecurePage;
