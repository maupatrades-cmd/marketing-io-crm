import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [captchaQuestion, setCaptchaQuestion] = useState(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  useState(() => {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    setCaptchaQuestion({ num1, num2, answer: num1 + num2 });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate CAPTCHA
    if (!captchaQuestion || parseInt(captchaAnswer) !== captchaQuestion.answer) {
      setError('CAPTCHA answer is incorrect');
      
      try {
        await base44.entities.SecurityEvent.create({
          event_type: 'captcha_failed',
          email,
          details: 'Failed CAPTCHA during password reset request'
        });
      } catch (err) {
        console.error('Failed to log security event:', err);
      }
      
      return;
    }

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      // Check if user exists (but don't reveal to user)
      const users = await base44.entities.User.filter({ email });
      
      if (users && users.length > 0) {
        // Generate reset token (32-char random string)
        const resetToken = Math.random().toString(36).substring(2, 34);
        
        // Save OTPCode with purpose=password_reset
        await base44.entities.OTPCode.create({
          email,
          code: resetToken,
          purpose: 'password_reset',
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
          generated_at: new Date().toISOString()
        });

        // Send reset email
        await base44.integrations.Core.SendEmail({
          to: email,
          subject: 'Reset your Marketing iO password',
          body: `Click the link below to reset your password:\n\n${window.location.origin}/reset-password?token=${resetToken}\n\nThis link expires in 1 hour.\n\nIf you did not request a password reset, please ignore this email.`
        });

        // Log security event
        await base44.entities.SecurityEvent.create({
          event_type: 'password_reset_requested',
          email,
          details: 'Password reset requested'
        });
      } else {
        // Still log but don't reveal
        await base44.entities.SecurityEvent.create({
          event_type: 'password_reset_requested',
          email,
          details: 'Password reset requested for non-existent email'
        });
      }

      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'An error occurred');
      console.error('Forgot password error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="w-full max-w-md">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Check Your Email</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 p-3 bg-success/10 border border-success/30 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                <p className="text-sm text-success">
                  If an account exists for that email, a reset link has been sent.
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Check your email for a password reset link. The link expires in 1 hour.
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => navigate('/login')}
              >
                Back to Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img
            src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png"
            alt="Marketing iO"
            className="h-8 object-contain mx-auto"
            style={{ filter: 'invert(1) brightness(2)', mixBlendMode: 'screen' }}
          />
          <h1 className="text-2xl font-bold mt-4">Forgot Your Password?</h1>
        </div>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Reset Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-2 block">Email Address</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  disabled={loading}
                  required
                  autoFocus
                />
              </div>

              {captchaQuestion && (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    CAPTCHA: What is {captchaQuestion.num1} + {captchaQuestion.num2}?
                  </label>
                  <Input
                    type="number"
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                    placeholder="Answer"
                    disabled={loading}
                    required
                  />
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={loading}
                onClick={() => navigate('/login')}
              >
                Back to Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}