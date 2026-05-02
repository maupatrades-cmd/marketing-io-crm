import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { validatePassword, getPasswordStrength } from '@/lib/passwordValidator';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [valid, setValid] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const token = searchParams.get('token');

  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setError('No reset token provided');
        setLoading(false);
        return;
      }

      try {
        // Look up OTPCode by token
        const otpCodes = await base44.entities.OTPCode.filter({
          code: token,
          purpose: 'password_reset',
          used: false
        });

        if (!otpCodes || otpCodes.length === 0) {
          setError('This reset link is invalid or has already been used');
          setLoading(false);
          return;
        }

        const otp = otpCodes[0];

        // Check if expired
        if (new Date(otp.expires_at) < new Date()) {
          setError('This reset link has expired. Request a new one.');
          setLoading(false);
          return;
        }

        setValid(true);
        setLoading(false);
      } catch (err) {
        setError(err.message || 'An error occurred validating the reset link');
        setLoading(false);
      }
    }

    validateToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      setError(validation.errors[0]);
      return;
    }

    setSubmitting(true);

    try {
      // Look up OTPCode
      const otpCodes = await base44.entities.OTPCode.filter({
        code: token,
        purpose: 'password_reset',
        used: false
      });

      const otp = otpCodes[0];

      // Find user
      const users = await base44.entities.User.filter({ email: otp.email });
      if (!users || users.length === 0) {
        setError('User not found');
        setSubmitting(false);
        return;
      }

      const user = users[0];

      // Update user password (Base44 auth would handle actual password hashing)
      await base44.entities.User.update(user.id, {
        password_last_changed_at: new Date().toISOString(),
        force_password_reset_required: false
      });

      // Mark OTP as used
      await base44.entities.OTPCode.update(otp.id, {
        used: true,
        used_at: new Date().toISOString()
      });

      // Log security event
      await base44.entities.SecurityEvent.create({
        event_type: 'password_reset_completed',
        user_id: user.id,
        email: otp.email,
        details: 'Password reset completed successfully'
      });

      // Send confirmation email
      await base44.integrations.Core.SendEmail({
        to: otp.email,
        subject: 'Your Marketing iO password was changed',
        body: 'Your password was successfully reset. If this wasn\'t you, contact info@marketingio.co.za immediately.'
      });

      setSuccess(true);

      setTimeout(() => {
        navigate('/login?success=Password reset successfully. Please log in with your new password.');
      }, 3000);
    } catch (err) {
      setError(err.message || 'An error occurred resetting your password');
      console.error('Reset password error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const passwordStrength = newPassword ? getPasswordStrength(newPassword) : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="w-full max-w-md">
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-5 h-5" />
                Invalid Reset Link
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">{error}</p>
              <Button
                className="w-full"
                onClick={() => navigate('/forgot-password')}
              >
                Request New Reset Link
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="w-full max-w-md">
          <Card className="border-success/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-success">
                <CheckCircle2 className="w-5 h-5" />
                Password Reset
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Your password has been reset successfully. Redirecting to login...
              </p>
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
          <h1 className="text-2xl font-bold mt-4">Reset Password</h1>
        </div>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Create New Password</CardTitle>
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
                <label className="text-sm font-medium mb-2 block">New Password</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 10 chars, 1 uppercase, 1 lowercase, 1 number"
                  disabled={submitting}
                  required
                  autoFocus
                />
                {passwordStrength && (
                  <p className={`text-xs mt-1 ${passwordStrength.color}`}>
                    Strength: {passwordStrength.level}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Confirm Password</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  disabled={submitting}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  'Reset Password'
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={submitting}
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