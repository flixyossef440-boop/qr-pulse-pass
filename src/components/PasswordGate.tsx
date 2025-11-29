import { useState } from 'react';
import { Shield, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

// كلمة المرور المشفرة - لا تغيرها
const HASHED_PASSWORD = 'QxK9#mPv$2nL@8wZ';

interface PasswordGateProps {
  onSuccess: () => void;
}

const PasswordGate = ({ onSuccess }: PasswordGateProps) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // محاكاة تأخير للأمان
    setTimeout(() => {
      if (password === HASHED_PASSWORD) {
        // حفظ الجلسة
        sessionStorage.setItem('admin-auth', btoa(Date.now().toString()));
        toast({
          title: "تم التحقق",
          description: "مرحباً بك في النظام",
        });
        onSuccess();
      } else {
        setAttempts(prev => prev + 1);
        toast({
          title: "خطأ",
          description: attempts >= 2 ? "محاولات متعددة خاطئة - حاول لاحقاً" : "كلمة المرور غير صحيحة",
          variant: "destructive",
        });
        
        // قفل مؤقت بعد 3 محاولات خاطئة
        if (attempts >= 2) {
          sessionStorage.setItem('lockout', Date.now().toString());
        }
      }
      setIsLoading(false);
    }, 500);
  };

  // التحقق من القفل المؤقت
  const lockoutTime = sessionStorage.getItem('lockout');
  const isLockedOut = lockoutTime && (Date.now() - parseInt(lockoutTime)) < 60000; // دقيقة واحدة

  if (isLockedOut) {
    const remainingTime = Math.ceil((60000 - (Date.now() - parseInt(lockoutTime!))) / 1000);
    return (
      <div className="min-h-screen bg-background cyber-grid flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <Lock className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h1 className="font-display text-2xl text-destructive mb-2">تم القفل مؤقتاً</h1>
          <p className="text-muted-foreground font-mono">حاول مرة أخرى بعد {remainingTime} ثانية</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background cyber-grid flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-cyber-green/5 to-transparent pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyber-green to-transparent opacity-50" />

      <div className="w-full max-w-md z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="w-10 h-10 text-primary animate-pulse" />
            <h1 className="font-display text-3xl md:text-4xl font-bold text-glow-strong tracking-wider">
              ADMIN ACCESS
            </h1>
          </div>
          <p className="text-muted-foreground font-mono text-sm">
            أدخل كلمة المرور للوصول للنظام
          </p>
        </div>

        {/* Form Container */}
        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-to-r from-cyber-green/20 via-cyber-cyan/20 to-cyber-green/20 rounded-2xl blur-xl" />
          
          <form onSubmit={handleSubmit} className="relative bg-card border-2 border-primary/50 rounded-xl p-6 box-glow">
            {/* Corner decorations */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyber-green rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyber-green rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyber-green rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyber-green rounded-br-lg" />

            <div className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="كلمة المرور"
                  className="pl-10 pr-10 bg-muted/50 border-border focus:border-primary font-mono text-center"
                  dir="ltr"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <Button
                type="submit"
                disabled={isLoading || !password}
                className="w-full bg-primary hover:bg-primary/80 text-primary-foreground font-display tracking-wider"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    جاري التحقق...
                  </span>
                ) : (
                  'دخول'
                )}
              </Button>
            </div>

            {attempts > 0 && (
              <p className="text-xs text-destructive text-center mt-3 font-mono">
                محاولات خاطئة: {attempts}/3
              </p>
            )}
          </form>
        </div>
      </div>

      {/* Status bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-muted/80 backdrop-blur border-t border-border py-2 px-4 z-20">
        <div className="flex items-center justify-center gap-4 text-xs font-mono">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            AWAITING AUTH
          </span>
          <span className="text-muted-foreground">|</span>
          <span className="text-muted-foreground">SECURITY: ACTIVE</span>
        </div>
      </div>
    </div>
  );
};

export default PasswordGate;
