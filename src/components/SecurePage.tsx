import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { validateToken, storeSessionToken, hasValidSession, clearSession } from '@/lib/tokenUtils';
import { ShieldCheck, ShieldX, Loader2, Lock, Home, LogOut, User, IdCard, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

type AccessState = 'validating' | 'granted' | 'denied' | 'expired';

const SecurePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [accessState, setAccessState] = useState<AccessState>('validating');
  const [validationMessage, setValidationMessage] = useState<string>('');
  
  // Form state
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to send data');
      }

      setIsSubmitted(true);
      toast({
        title: "تم بنجاح",
        description: "تم إرسال البيانات بنجاح",
      });
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إرسال البيانات",
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
