'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { API } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import TenantLogo from '@/components/TenantLogo';
import { CheckCircle, XCircle, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { validatePassword } from '@/utils/registrationValidation';

const RequirementItem = ({ met, text }) => (
  <div className={`flex items-center gap-2 text-xs ${met ? 'text-success' : 'text-muted-foreground'}`}>
    {met ? <CheckCircle size={14} /> : <div className="w-3.5 h-3.5 border border-border rounded-full" />}
    <span>{text}</span>
  </div>
);

function SetupPasswordInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [userInfo, setUserInfo] = useState(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setTokenError('No setup token provided. Please use the link from your invitation email.');
        setValidating(false);
        setLoading(false);
        return;
      }
      try {
        const response = await axios.get(`${API}/auth/validate-setup-token?token=${token}`);
        setUserInfo(response.data);
        setTokenValid(true);
      } catch (error) {
        const message = error.response?.data?.detail || 'Invalid or expired setup token';
        setTokenError(message);
        setTokenValid(false);
      } finally {
        setValidating(false);
        setLoading(false);
      }
    };
    validateToken();
  }, [token]);

  const validation = validatePassword(password);
  const passwordsMatch = password && confirmPassword && password === confirmPassword;
  const canSubmit = validation.isValid && passwordsMatch && !submitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await axios.post(`${API}/auth/setup-password`, { token, password });
      setSuccess(true);
      toast.success('Password set successfully! You can now log in.');
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to set password';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted via-background to-muted">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Validating your invitation...</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted via-background to-muted p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Invalid Link</h1>
          <p className="text-muted-foreground mb-6">{tokenError}</p>
          <p className="text-sm text-muted-foreground mb-6">
            If you believe this is an error, please contact your college administrator to resend the invitation.
          </p>
          <Button onClick={() => router.push('/login')} variant="outline">Go to Login</Button>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted via-background to-muted p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">You're All Set!</h1>
          <p className="text-muted-foreground mb-6">
            Your password has been set successfully. You can now log in to your Quadley account.
          </p>
          <Button onClick={() => router.push('/login')} className="w-full bg-primary hover:bg-primary">
            Go to Login
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted via-background to-muted p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <TenantLogo size={60} />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Set Up Your Password</h1>
          <p className="text-muted-foreground">
            Welcome{userInfo?.first_name ? `, ${userInfo.first_name}` : ''}! Create a password to complete your account setup.
          </p>
          {userInfo?.email && <p className="text-sm text-primary mt-2">{userInfo.email}</p>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a strong password" className="pr-10" data-testid="setup-password-input" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {password && (
              <div className="mt-3 p-3 bg-muted rounded-lg space-y-1.5">
                <p className="text-xs font-medium text-foreground mb-2">Password requirements:</p>
                <RequirementItem met={validation.minLength} text="At least 8 characters" />
                <RequirementItem met={validation.hasUpperCase} text="One uppercase letter" />
                <RequirementItem met={validation.hasLowerCase} text="One lowercase letter" />
                <RequirementItem met={validation.hasNumber} text="One number" />
                <RequirementItem met={validation.hasSpecialChar} text="One special character (!@#$%^&*)" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm your password" className="pr-10" data-testid="setup-confirm-password-input" />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground">
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmPassword && !passwordsMatch && (
              <p className="text-sm text-destructive flex items-center gap-1"><XCircle size={14} /> Passwords do not match</p>
            )}
            {passwordsMatch && (
              <p className="text-sm text-success flex items-center gap-1"><CheckCircle size={14} /> Passwords match</p>
            )}
          </div>

          <Button type="submit" className="w-full bg-success hover:bg-success" disabled={!canSubmit} data-testid="setup-submit-btn">
            {submitting ? (<><Loader2 className="w-4 h-4 animate-spin mr-2" />Setting up...</>) : 'Set Password & Activate Account'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{' '}
          <button onClick={() => router.push('/login')} className="text-primary hover:underline">Log in</button>
        </p>
      </Card>
    </div>
  );
}

export default function SetupPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <SetupPasswordInner />
    </Suspense>
  );
}
