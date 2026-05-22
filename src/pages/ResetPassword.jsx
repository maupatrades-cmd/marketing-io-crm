import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Loader2, Eye, EyeOff } from 'lucide-react';
import { validatePassword, getPasswordStrength } from '@/lib/passwordValidator';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [valid, setValid] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const token = searchParams.get('token');

  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setError('No reset token provided.');
        setLoading(false);
        return;
      }
      try {
        await base44.functions.invoke('reset-password', { token, action: 'validate' });
        setValid(true);
      } catch (err) {
        const msg = err?.response?.data?.message || 'This reset link is invalid or has expired.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    validateToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    const validation = validatePassword(newPassword);
    if (!validation.valid) { setError(validation.errors[0]); return; }

    setSubmitting(true);
    try {
      await base44.functions.invoke('reset-password', { token, newPassword });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to reset password. Please try again.');
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
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button className="w-full" onClick={() => navigate('/forgot-password')}>
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-success">
                <CheckCircle2 className="w-5 h-5" />
                Password Reset Successfully
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Your password has been updated. Redirecting to login…
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
            src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png"
            alt="Marketing iO"
            className="h-12 mx-auto mb-4 object-contain"
          />
          <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          {error && (
            <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <div className="relative">
              <Input
                type={showPw ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 10 chars, 1 upper, 1 lower, 1 number"
                disabled={submitting}
                required
                autoFocus
                className="bg-white border-gray-200 text-gray-900 pr-10"
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {passwordStrength && (
              <p className={`text-xs mt-1 ${passwordStrength.color}`}>
                Strength: {passwordStrength.level}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your new password"
              disabled={submitting}
              required
              className="bg-white border-gray-200 text-gray-900"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg font-semibold text-white text-sm transition disabled:opacity-60"
            style={{ background: '#0A1F44' }}
            >
            {submitting ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Resetting…</span> : 'Reset Password'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full py-2.5 rounded-lg font-medium text-gray-600 text-sm hover:text-gray-900 transition border border-gray-200 hover:border-gray-400"
          >
            Back to Login
          </button>
        </form>
      </div>
    </div>
  );
}