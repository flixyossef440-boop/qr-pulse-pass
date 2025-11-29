import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { validateToken, storeSessionToken, hasValidSession, clearSession } from '@/lib/tokenUtils';
import { ShieldCheck, ShieldX, Loader2, Lock, Home, LogOut, User, IdCard, Send, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

type AccessState = 'validating' | 'granted' | 'denied' | 'expired' | 'cooldown';

const COOLDOWN_DURATION = 30 * 60 * 1000; // 30 دقيقة
const COOLDOWN_KEY = 'form-submission-cooldown';
const COOKIE_NAME = 'form_cooldown';

// ============= Cookie Utilities =============
const setCookie = (name: string, value: string, minutes: number): void => {
  const expires = new Date();
  expires.setTime(expires.getTime() + minutes * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
  console.log('[Cooldown] Cookie set:', name, value);
};

const getCookie = (name: string): string | null => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) {
      return c.substring(nameEQ.length, c.length);
    }
  }
  return null;
};

const deleteCookie = (name: string): void => {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
};

// ============= Cooldown Management =============
// حفظ الـ cooldown في localStorage و Cookie معاً
const setCooldownTimestamp = (): void => {
  const timestamp = Date.now().toString();
  
  // حفظ في localStorage
  try {
    localStorage.setItem(COOLDOWN_KEY, timestamp);
    console.log('[Cooldown] localStorage set:', timestamp);
  } catch (e) {
    console.error('[Cooldown] localStorage error:', e);
  }
  
  // حفظ في Cookie (30 دقيقة)
  setCookie(COOKIE_NAME, timestamp, 30);
};

// التحقق من فترة الانتظار - من localStorage أو Cookie
const checkCooldown = (): { inCooldown: boolean; remaining: number } => {
  console.log('[Cooldown] Checking cooldown...');
  
  let lastSubmission: string | null = null;
  
  // محاولة القراءة من localStorage أولاً
  try {
    lastSubmission = localStorage.getItem(COOLDOWN_KEY);
    console.log('[Cooldown] localStorage value:', lastSubmission);
  } catch (e) {
    console.error('[Cooldown] localStorage read error:', e);
  }
  
  // إذا لم نجد في localStorage، نحاول من Cookie
  if (!lastSubmission) {
    lastSubmission = getCookie(COOKIE_NAME);
    console.log('[Cooldown] Cookie value:', lastSubmission);
  }
  
  if (!lastSubmission) {
    console.log('[Cooldown] No cooldown found');
    return { inCooldown: false, remaining: 0 };
  }
  
  const lastTime = parseInt(lastSubmission, 10);
  if (isNaN(lastTime)) {
    console.log('[Cooldown] Invalid timestamp, clearing');
    try { localStorage.removeItem(COOLDOWN_KEY); } catch {}
    deleteCookie(COOKIE_NAME);
    return { inCooldown: false, remaining: 0 };
  }
  
  const elapsed = Date.now() - lastTime;
  const remaining = COOLDOWN_DURATION - elapsed;
  
  console.log('[Cooldown] Elapsed:', elapsed, 'Remaining:', remaining);
  
  if (elapsed < COOLDOWN_DURATION) {
    console.log('[Cooldown] ACTIVE - user must wait');
    return { inCooldown: true, remaining };
  }
  
  // انتهت فترة الانتظار - حذف القيم
  console.log('[Cooldown] Expired, clearing');
  try { localStorage.removeItem(COOLDOWN_KEY); } catch {}
  deleteCookie(COOKIE_NAME);
  return { inCooldown: false, remaining: 0 };
};

// تم حذف getInitialState - الفحص يتم مباشرة في الـ component

const SecurePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // فحص الـ cooldown فوراً عند كل render - هذا يضمن عدم تجاوزه أبداً
  const cooldownCheck = checkCooldown();
  const isInCooldown = cooldownCheck.inCooldown;
  
  // تحديد الحالة الأولية
  const [accessState, setAccessState] = useState<AccessState>(() => {
    const { inCooldown } = checkCooldown();
    return inCooldown ? 'cooldown' : 'validating';
  });
  const [validationMessage, setValidationMessage] = useState<string>(() => {
    const { inCooldown } = checkCooldown();
    return inCooldown ? 'COOLDOWN_ACTIVE' : '';
  });
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(cooldownCheck.remaining);
  
  // Form state
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  // تحديث الحالة فوراً إذا كان هناك cooldown نشط (للتعامل مع تغيير URL)
  useEffect(() => {
    if (isInCooldown && accessState !== 'cooldown') {
      console.log('[Cooldown] FORCING cooldown state on URL change');
      setAccessState('cooldown');
      setValidationMessage('COOLDOWN_ACTIVE');
      setCooldownRemaining(cooldownCheck.remaining);
    }
  }, [isInCooldown, accessState, cooldownCheck.remaining]);

  // تحديث العد التنازلي
  useEffect(() => {
    if (accessState !== 'cooldown') return;
    
    const timer = setInterval(() => {
      const { inCooldown, remaining } = checkCooldown();
      if (!inCooldown) {
        setAccessState('granted');
        setCooldownRemaining(0);
      } else {
        setCooldownRemaining(remaining);
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [accessState]);

  useEffect(() => {
    // إذا كان المستخدم في فترة انتظار، لا تفعل شيئاً
    if (accessState === 'cooldown' || isInCooldown) {
      return;
    }

    // التحقق من فترة الانتظار مرة أخرى (للتأكد)
    const { inCooldown, remaining } = checkCooldown();
    if (inCooldown) {
      setAccessState('cooldown');
      setCooldownRemaining(remaining);
      setValidationMessage('COOLDOWN_ACTIVE');
      return;
    }

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
      // تحقق أخير من الـ cooldown قبل منح الوصول
      const cooldownCheck = checkCooldown();
      if (cooldownCheck.inCooldown) {
        setAccessState('cooldown');
        setCooldownRemaining(cooldownCheck.remaining);
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

    return () => clearTimeout(validationTimer);
  }, [searchParams, isInCooldown, accessState]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // التحقق مرة أخرى من فترة الانتظار
    const { inCooldown } = checkCooldown();
    if (inCooldown) {
      toast({
        title: "غير مسموح",
        description: "يجب الانتظار قبل إرسال بيانات جديدة",
        variant: "destructive",
      });
      return;
    }
    
    if (!name.trim() || !userId.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/send-to-telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: name.trim(), id: userId.trim() }),
      });

      const data = await response.json();
      
      console.log('API Response:', { status: response.status, data });
      
      if (!response.ok || !data.success) {
        const errorMessage = data.error || 'Failed to send data';
        console.error('API Error:', errorMessage);
        throw new Error(errorMessage);
      }

      // حفظ وقت الإرسال لفترة الانتظار (localStorage + Cookie)
      setCooldownTimestamp();
      console.log('[Cooldown] Submission successful, cooldown activated');
      
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
          ? "خطأ في إعدادات الخادم - تأكد من إضافة متغيرات البيئة في Vercel"
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

  // تحويل الوقت المتبقي لصيغة مقروءة
  const formatRemainingTime = (ms: number): string => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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

  // Cooldown state - فترة الانتظار
  if (accessState === 'cooldown') {
    return (
      <div className="min-h-screen bg-background cyber-grid flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-yellow-500/20 rounded-full blur-xl animate-pulse" />
            <AlertTriangle className="w-20 h-20 text-yellow-500 relative mx-auto" />
          </div>
          
          <h1 className="font-display text-3xl text-yellow-500 mb-4">
            فترة انتظار
          </h1>
          
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Clock className="w-6 h-6 text-yellow-500" />
              <span className="font-display text-4xl text-yellow-500">
                {formatRemainingTime(cooldownRemaining)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground" dir="rtl">
              لقد قمت بإرسال بيانات مؤخراً. يرجى الانتظار حتى انتهاء فترة الانتظار (30 دقيقة) قبل إرسال بيانات جديدة.
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-2 mb-6 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 transition-all duration-1000"
              style={{ width: `${((COOLDOWN_DURATION - cooldownRemaining) / COOLDOWN_DURATION) * 100}%` }}
            />
          </div>

          <Button 
            onClick={handleRetry}
            className="gap-2"
            variant="outline"
          >
            <Home className="w-4 h-4" />
            العودة للرئيسية
          </Button>
        </div>

        {/* Footer Status */}
        <footer className="fixed bottom-0 left-0 right-0 bg-muted/80 backdrop-blur border-t border-border py-2 px-4">
          <div className="flex items-center justify-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              COOLDOWN ACTIVE
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">RATE LIMITED</span>
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

  // Granted state - Form
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
      <main className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[calc(100vh-80px)]">
        {isSubmitted ? (
          // Success state
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
          // Form
          <div className="w-full max-w-md">
            {/* Form Card */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-secondary/20 to-primary/20 rounded-3xl blur-xl opacity-50" />
              
              <div className="relative bg-card border border-primary/30 rounded-2xl p-8 box-glow">
                {/* Header */}
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 box-glow">
                    <Lock className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="font-display text-2xl text-glow mb-2">تسجيل البيانات</h2>
                  <p className="text-sm text-muted-foreground" dir="rtl">
                    أدخل بياناتك للمتابعة
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Name Field */}
                  <div className="space-y-2">
                    <Label htmlFor="name" className="flex items-center gap-2 text-foreground">
                      <User className="w-4 h-4 text-primary" />
                      الاسم
                    </Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="أدخل اسمك"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-muted/50 border-border focus:border-primary focus:ring-primary/50"
                      dir="rtl"
                      maxLength={100}
                      required
                    />
                  </div>

                  {/* ID Field */}
                  <div className="space-y-2">
                    <Label htmlFor="userId" className="flex items-center gap-2 text-foreground">
                      <IdCard className="w-4 h-4 text-primary" />
                      ID
                    </Label>
                    <Input
                      id="userId"
                      type="text"
                      placeholder="أدخل الـ ID الخاص بك"
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      className="bg-muted/50 border-border focus:border-primary focus:ring-primary/50"
                      dir="rtl"
                      maxLength={50}
                      required
                    />
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    className="w-full gap-2"
                    disabled={isSubmitting}
                    variant="cyber"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        جاري الإرسال...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        إرسال
                      </>
                    )}
                  </Button>
                </form>

                {/* Security Notice */}
                <div className="mt-6 pt-6 border-t border-border">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-2 h-2 rounded-full bg-cyber-green animate-pulse" />
                    <span className="font-mono">ENCRYPTED CONNECTION • SECURE</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer Status */}
      <footer className="fixed bottom-0 left-0 right-0 bg-muted/80 backdrop-blur border-t border-border py-2 px-4">
        <div className="flex items-center justify-center gap-4 text-xs font-mono">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyber-green animate-pulse" />
            SECURE CONNECTION
          </span>
          <span className="text-muted-foreground">|</span>
          <span className="text-muted-foreground">AES-256 ENCRYPTION</span>
        </div>
      </footer>
    </div>
  );
};

export default SecurePage;
