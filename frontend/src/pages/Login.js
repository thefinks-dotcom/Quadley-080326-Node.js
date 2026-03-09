import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext, API } from '@/App';
import { useTenantTheme } from '@/contexts/TenantThemeContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import TenantLogo from '@/components/TenantLogo';
import { Shield, Key, CheckCircle, ArrowRight, Lock, Users, Calendar, Award, Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);

  // Tenant branding — sourced from TenantThemeContext (theme is also
  // applied globally to CSS variables there; no manual injection needed here)
  const { branding: tenantBranding } = useTenantTheme();

  // Join code flow
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinStep, setJoinStep] = useState('code'); // 'code' | 'register'
  const [joinData, setJoinData] = useState(null); // verified invite data
  const [joinPassword, setJoinPassword] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinAgreedToTerms, setJoinAgreedToTerms] = useState(false);

  const [loginData, setLoginData] = useState({ email: '', password: '' });

  // MFA state
  const [mfaStep, setMfaStep] = useState(null);
  const [mfaToken, setMfaToken] = useState(null);
  const [mfaUser, setMfaUser] = useState(null);
  const [mfaModules, setMfaModules] = useState(null);
  const [mfaSetupData, setMfaSetupData] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showJoinPassword, setShowJoinPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);

  const termsSections = [
    { heading: 'Quadley Terms of Service', content: '' },
    { heading: '1. Acceptance of Terms', content: 'By registering for an account with Quadley, you agree to be bound by these Terms of Service. Quadley provides a centralized communication and compliance platform for residential colleges.' },
    { heading: '2. Eligibility and Account Security', content: 'Authorized Use: Access is restricted to currently enrolled students and authorized staff of participating residential colleges.\n\nCredential Security: You are responsible for maintaining the confidentiality of your credentials. Administrative accounts (Admins/RAs) are required to use Multi-Factor Authentication (MFA).\n\nInternal Governance: Quadley staff manage internal credentials using enterprise-grade password management (Dashlane) and undergo mandatory background checks.' },
    { heading: '3. Acceptable Use', content: 'Professional Conduct: Users must use the platform for college-related communication, including maintenance requests, dining menus, and event RSVPs.\n\nSafe Disclosure Misuse: The Safe Disclosure module is for legitimate reporting of incidents, including gender-based violence. Providing knowingly false information is a violation of these terms.' },
    { heading: '4. Termination of Access', content: "Access to the platform is typically tied to your status at the residential college. Upon graduation or withdrawal, your account will be deactivated in accordance with your institution's provisioning policy." },
    { heading: 'Quadley Privacy Policy', content: '' },
    { heading: '1. Information We Collect', content: 'We collect information necessary to facilitate residential life and maintain legislative compliance:\n\n• Identity Data: Name, email address, student ID, and birthday.\n• Residential Data: Room number and floor assignment.\n• Service Data: Late meal requests, maintenance descriptions, and facility bookings.\n• Sensitive Data: Anonymous or identified disclosures regarding safety incidents or gender-based violence.' },
    { heading: '2. How We Use Your Data', content: '• Operational Necessity: To process maintenance requests, display dining menus, and manage billing.\n• Safety and Compliance: To fulfill mandatory reporting obligations under Australian legislation (F2025L01251), including 48-hour risk assessment deadlines.\n• Community Engagement: Facilitating peer recognition (Shoutouts) and floor-level message groups.' },
    { heading: '3. Data Isolation and Multi-Tenancy', content: 'Quadley utilizes a strict multi-tenant architecture. Your data is tagged with a unique tenant_id to ensure it is logically isolated from other residential colleges. Users from one college cannot access or view data belonging to another institution.' },
    { heading: '4. Data Sovereignty and Security', content: '• Hosting: All data is hosted on AWS Sydney (ap-southeast-2) via MongoDB Atlas.\n• Encryption: Data is encrypted at rest using AES-256 (Atlas managed) and in transit via TLS 1.2+.\n• Auditing: The platform undergoes regular security reviews against the OWASP Top 10 vulnerabilities.' },
    { heading: '5. Retention and Your Rights', content: '• Retention: Data is retained for the duration of your enrollment plus a mandatory buffer for audit and financial records (typically 6 years).\n• Right to Deletion: Users may submit a "Request Data Deletion" via the platform. Quadley will process these requests in coordination with the residential college, subject to legal reporting hold requirements.' },
  ];

  const validatePassword = (password) => {
    const minLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return {
      isValid: minLength && hasUpperCase && hasLowerCase && hasSpecialChar,
      minLength,
      hasUpperCase,
      hasLowerCase,
      hasSpecialChar
    };
  };


  const handleJoinVerify = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoinLoading(true);
    try {
      const res = await axios.post(`${API}/auth/invite-code/verify`, { invite_code: joinCode.trim().toUpperCase() });
      setJoinData(res.data);
      setJoinStep('register');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid invite code');
    } finally {
      setJoinLoading(false);
    }
  };

  const handleJoinRegister = async (e) => {
    e.preventDefault();
    setJoinLoading(true);
    try {
      const res = await axios.post(`${API}/auth/invite-code/register`, {
        invite_code: joinCode.trim().toUpperCase(),
        first_name: joinData.first_name || '',
        last_name: joinData.last_name || '',
        password: joinPassword,
      });
      const { access_token, user } = res.data;
      login(access_token, user);
      toast.success(`Welcome to ${joinData.tenant_name}!`);
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed');
    } finally {
      setJoinLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/login`, loginData);
      const { access_token, user, mfa_required, mfa_enabled, mfa_setup_required, tenant } = response.data;
      const modules = tenant?.enabled_modules || null;

      if (mfa_setup_required) {
        setMfaToken(access_token);
        setMfaUser(user);
        setMfaModules(modules);
        setMfaStep('setup');
        setLoading(false);
        return;
      }

      if (mfa_required && mfa_enabled) {
        setMfaToken(access_token);
        setMfaUser(user);
        setMfaStep('verify');
        setLoading(false);
        return;
      }

      login(access_token, user, modules);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (error) {
      const detail = error.response?.data?.detail;
      const message = typeof detail === 'string' 
        ? detail 
        : Array.isArray(detail) 
          ? detail.map(e => e.msg || e).join(', ')
          : 'Login failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSetupStart = async () => {
    setMfaLoading(true);
    try {
      const response = await axios.post(`${API}/mfa/setup`, {}, {
        headers: { Authorization: `Bearer ${mfaToken}` }
      });
      setMfaSetupData(response.data);
      setMfaStep('setup-verify');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start MFA setup');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaSetupVerify = async () => {
    const clean = mfaCode.replace(/\D/g, '').slice(0, 6);
    if (clean.length !== 6) return;
    setMfaLoading(true);
    try {
      const response = await axios.post(`${API}/mfa/verify`, { code: clean }, {
        headers: { Authorization: `Bearer ${mfaToken}` }
      });
      // Save the fresh token (without mfa_pending)
      if (response.data.access_token) {
        setMfaToken(response.data.access_token);
      }
      setMfaStep('setup-backup');
      setMfaCode('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid verification code');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaSetupComplete = () => {
    login(mfaToken, mfaUser);
    toast.success('MFA enabled! Welcome.');
    navigate('/dashboard');
  };

  const handleMfaVerify = async () => {
    const trimmed = mfaCode.trim().replace(/[- ]/g, '');
    if (useBackupCode ? trimmed.length !== 8 : trimmed.length !== 6) return;
    setMfaLoading(true);
    try {
      await axios.post(`${API}/auth/login/mfa`, {
        mfa_code: trimmed,
        backup_code: useBackupCode
      }, {
        headers: { Authorization: `Bearer ${mfaToken}` }
      });
      login(mfaToken, mfaUser);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid MFA code');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaSkip = () => {
    login(mfaToken, mfaUser, mfaModules);
    toast.info('You can set up 2FA later in Settings.');
    navigate('/dashboard');
  };

  const resetMfaFlow = () => {
    setMfaStep(null);
    setMfaToken(null);
    setMfaUser(null);
    setMfaModules(null);
    setMfaSetupData(null);
    setMfaCode('');
    setUseBackupCode(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    try {
      await axios.post(`${API}/auth/forgot-password`, { email: resetEmail });
      toast.success('Password reset link sent to your email!');
      setShowForgotPassword(false);
      setResetEmail('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send reset link');
    } finally {
      setResetLoading(false);
    }
  };

  // MFA Setup - Intro
  if (mfaStep === 'setup') {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="p-8 bg-white border border-border rounded-xl" data-testid="mfa-setup-card">
            <form onSubmit={(e) => { e.preventDefault(); handleMfaSetupStart(); }}>
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-foreground tracking-tight">Two-Factor Authentication</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                As an administrator, you are required to enable two-factor authentication to protect your account.
              </p>
            </div>
            <div className="space-y-3 mb-8">
              {['Protects against unauthorized access', 'Works with authenticator apps', 'Backup codes for recovery'].map((text) => (
                <div key={text} className="flex items-center gap-3 p-3 bg-muted rounded-lg border border-border">
                  <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
                  <span className="text-foreground text-sm">{text}</span>
                </div>
              ))}
            </div>
            <Button
              data-testid="mfa-setup-start-btn"
              type="submit"
              className="w-full h-12 bg-primary hover:bg-primary text-white rounded-lg font-medium"
              disabled={mfaLoading}
            >
              {mfaLoading ? 'Setting up...' : 'Set Up 2FA'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <button
              type="button"
              data-testid="mfa-skip-btn"
              className="mt-4 w-full text-sm text-muted-foreground hover:text-muted-foreground transition-colors py-3"
              onClick={handleMfaSkip}
            >
              Maybe Later
            </button>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  // MFA Setup - QR Code & Verify
  if (mfaStep === 'setup-verify') {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="p-8 bg-white border border-border rounded-xl" data-testid="mfa-qr-card">
          <form onSubmit={(e) => { e.preventDefault(); handleMfaSetupVerify(); }}>
            <div className="mb-6">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Step 1 of 2</span>
              <h3 className="font-heading text-xl font-bold text-foreground mt-1">Scan QR Code</h3>
              <p className="text-sm text-muted-foreground mt-1">Open your authenticator app and scan this code:</p>
            </div>
            {mfaSetupData?.qr_code && (
              <div className="flex justify-center p-6 bg-white border border-border rounded-xl mb-6">
                <img
                  src={`data:image/png;base64,${mfaSetupData.qr_code}`}
                  alt="MFA QR Code"
                  className="w-48 h-48"
                  data-testid="mfa-qr-code"
                />
              </div>
            )}
            <div className="text-center mb-6">
              <p className="text-xs text-muted-foreground mb-2">Or enter manually:</p>
              <div className="bg-primary p-3 rounded-lg">
                <code className="text-sm text-white font-mono select-all" data-testid="mfa-secret-code">{mfaSetupData?.secret}</code>
              </div>
            </div>
            <div className="mb-6">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Step 2 of 2</span>
              <h3 className="font-heading text-xl font-bold text-foreground mt-1">Verify Code</h3>
              <p className="text-sm text-muted-foreground mt-1">Enter the 6-digit code from your app:</p>
            </div>
            <Input
              data-testid="mfa-setup-code-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="h-14 text-center text-2xl font-mono font-bold tracking-[0.5em] border-border rounded-lg mb-4"
            />
            <Button
              data-testid="mfa-setup-verify-btn"
              type="submit"
              className="w-full h-12 bg-primary hover:bg-primary text-white rounded-lg font-medium"
              disabled={mfaLoading || mfaCode.replace(/\D/g, '').length !== 6}
            >
              {mfaLoading ? 'Verifying...' : 'Verify & Enable'}
            </Button>
          </form>
          </Card>
        </div>
      </div>
    );
  }

  // MFA Setup - Backup Codes
  if (mfaStep === 'setup-backup') {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="p-8 bg-white border border-border rounded-xl" data-testid="mfa-backup-card">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-warning rounded-xl flex items-center justify-center mx-auto mb-4">
                <Key className="w-8 h-8 text-white" />
              </div>
              <h2 className="font-heading text-xl font-bold text-foreground">Save Your Backup Codes</h2>
              <p className="text-sm text-muted-foreground mt-2">Store these codes securely. Each can only be used once.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-6" data-testid="mfa-backup-codes">
              {mfaSetupData?.backup_codes?.map((code, i) => (
                <div key={i} className="bg-primary p-3 rounded-lg text-center">
                  <code className="text-sm font-mono text-white">{code}</code>
                </div>
              ))}
            </div>
            <div className="bg-muted border border-border rounded-lg p-4 mb-6 flex items-start gap-3">
              <Key className="w-5 h-5 text-foreground mt-0.5 flex-shrink-0" />
              <p className="text-sm text-foreground">Save these codes now! You won't be able to see them again.</p>
            </div>
            <Button
              data-testid="mfa-setup-complete-btn"
              className="w-full h-12 bg-primary hover:bg-primary text-white rounded-lg font-medium"
              onClick={handleMfaSetupComplete}
            >
              I've Saved My Codes - Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  // MFA Verify
  if (mfaStep === 'verify') {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="p-8 bg-white border border-border rounded-xl" data-testid="mfa-verify-card">
          <form onSubmit={(e) => { e.preventDefault(); handleMfaVerify(); }}>
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
                {useBackupCode ? <Key className="w-8 h-8 text-white" /> : <Shield className="w-8 h-8 text-white" />}
              </div>
              <h2 className="font-heading text-xl font-bold text-foreground">
                {useBackupCode ? 'Enter Backup Code' : 'Two-Factor Authentication'}
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                {useBackupCode
                  ? 'Enter one of your backup codes to verify your identity.'
                  : 'Enter the 6-digit code from your authenticator app.'}
              </p>
            </div>
            <Input
              data-testid="mfa-verify-code-input"
              type="text"
              inputMode={useBackupCode ? 'text' : 'numeric'}
              autoComplete="one-time-code"
              maxLength={useBackupCode ? 9 : 6}
              placeholder={useBackupCode ? 'XXXX-XXXX' : '000000'}
              value={mfaCode}
              onChange={(e) => setMfaCode(useBackupCode ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="h-14 text-center text-2xl font-mono font-bold tracking-[0.5em] border-border rounded-lg mb-4"
            />
            <Button
              data-testid="mfa-verify-submit-btn"
              type="submit"
              className="w-full h-12 bg-primary hover:bg-primary text-white rounded-lg font-medium mb-4"
              disabled={mfaLoading}
            >
              {mfaLoading ? 'Verifying...' : 'Verify'}
            </Button>
            <div className="text-center space-y-2">
              <button
                type="button"
                data-testid="mfa-toggle-backup-btn"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2 px-4"
                onClick={() => { setUseBackupCode(!useBackupCode); setMfaCode(''); }}
              >
                {useBackupCode ? 'Use authenticator app instead' : 'Use a backup code'}
              </button>
              <br />
              <button
                type="button"
                data-testid="mfa-cancel-login-btn"
                className="text-sm text-muted-foreground hover:text-muted-foreground transition-colors py-2 px-4"
                onClick={resetMfaFlow}
              >
                Cancel login
              </button>
            </div>
          </form>
          </Card>
        </div>
      </div>
    );
  }

  // Main Login/Register Page
  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding/Features */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 noise-texture" />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <TenantLogo size={48} />
            <span className="font-heading text-2xl font-bold text-white tracking-tight">
              {tenantBranding?.app_name || 'Quadley'}
            </span>
          </div>
          
          {/* Main Content */}
          <div className="space-y-8">
            <div>
              <h1 className="font-heading text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight">
                {tenantBranding?.login_welcome_text || (<>Your campus community,<br /><span className="text-white/80">unified.</span></>)}
              </h1>
              <p className="text-white/70 mt-4 text-lg max-w-md">
                {tenantBranding?.tagline || 'The modern platform for residential colleges. Connect, collaborate, and thrive.'}
              </p>
            </div>
            
            {/* Feature Pills */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Users, label: 'Community', desc: 'Floor groups & messaging' },
                { icon: Calendar, label: 'Events', desc: 'College-wide calendar' },
                { icon: Award, label: 'Recognition', desc: 'Peer shoutouts' },
                { icon: Lock, label: 'Secure', desc: 'Enterprise-grade security' },
              ].map((feature) => (
                <div key={feature.label} className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4">
                  <feature.icon className="w-5 h-5 text-white/80 mb-2" strokeWidth={1.5} />
                  <p className="text-white font-medium text-sm">{feature.label}</p>
                  <p className="text-white/60 text-xs mt-0.5">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
          
          {/* Footer */}
          <div className="text-white/50 text-sm">
            {tenantBranding ? `Powered by Quadley` : 'Trusted by leading residential colleges across Australia'}
          </div>
        </div>
      </div>
      
      {/* Right Panel - Auth Forms */}
      <div className="flex-1 flex items-center justify-center p-6 bg-muted">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <TenantLogo size={48} />
              <span className="font-heading text-2xl font-bold text-foreground tracking-tight">
                {tenantBranding?.app_name || 'Quadley'}
              </span>
            </div>
            <p className="text-muted-foreground">
              {tenantBranding?.tagline || 'Your campus community platform'}
            </p>
          </div>

          <Card className="p-8 bg-white border border-border rounded-xl shadow-sm" data-testid="auth-card">
            <h2 className="font-heading text-xl font-bold text-foreground mb-7">Sign In</h2>
            <form onSubmit={handleLogin} className="space-y-5" data-testid="login-form">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-foreground font-medium text-sm">Email</Label>
                    <Input
                      id="login-email"
                      data-testid="login-email"
                      type="email"
                      placeholder="you@college.edu"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      required
                      className="h-12 border-border focus:border-border focus:ring-1 focus:ring-ring rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password" className="text-foreground font-medium text-sm">Password</Label>
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="login-password"
                        data-testid="login-password"
                        type={showLoginPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                        required
                        className="h-12 border-border focus:border-border focus:ring-1 focus:ring-ring rounded-lg pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(p => !p)}
                        onTouchEnd={(e) => { e.preventDefault(); setShowLoginPassword(p => !p); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-2 -mr-2"
                        tabIndex={-1}
                      >
                        {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    data-testid="login-submit-btn"
                    className="w-full h-12 bg-primary hover:bg-primary text-white font-medium rounded-lg transition-all"
                    disabled={loading}
                  >
                    {loading ? 'Signing in...' : 'Sign In'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
            </form>
          </Card>
          
          {/* Use code to Join */}
          <button
            type="button"
            onClick={() => {
              setJoinCode('');
              setJoinStep('code');
              setJoinData(null);
              setJoinPassword('');
              setShowJoinDialog(true);
            }}
            className="mt-4 w-full flex items-center gap-4 bg-white border-2 border-primary rounded-xl px-5 py-4 shadow-sm hover:shadow-md hover:bg-primary/5 transition-all group text-left"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Key className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Use code to Join</p>
              <p className="text-xs text-muted-foreground mt-0.5">Have an invite code? Set up your account</p>
            </div>
            <ArrowRight className="w-4 h-4 text-primary opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
          </button>

          <p className="text-center text-sm text-muted-foreground mt-4">
            <a href="/privacy" className="hover:text-muted-foreground underline underline-offset-2 transition-colors" data-testid="privacy-link">Privacy & Terms</a>
          </p>
        </div>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold text-foreground">Reset Password</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Enter your email address and we'll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email" className="text-foreground font-medium text-sm">Email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="you@college.edu"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                className="h-12 border-border focus:border-border focus:ring-1 focus:ring-ring rounded-lg"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-12 border-border text-foreground hover:bg-muted rounded-lg"
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetEmail('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 h-12 bg-primary hover:bg-primary text-white rounded-lg"
                disabled={resetLoading}
              >
                {resetLoading ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Terms of Service Dialog */}
      <Dialog open={showTermsDialog} onOpenChange={setShowTermsDialog}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col rounded-xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold text-foreground">Terms of Service & Privacy Policy</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs font-mono">Last Updated: February 18, 2026</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 pr-2 space-y-5 mt-4" data-testid="terms-content">
            {termsSections.map((section, i) => (
              <div key={i}>
                <h3 className={`font-heading font-semibold text-foreground ${!section.content ? 'text-lg mt-4 border-b border-border pb-2' : 'text-sm'} mb-1`}>
                  {section.heading}
                </h3>
                {section.content && (
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{section.content}</p>
                )}
              </div>
            ))}
          </div>
          <div className="pt-4 border-t border-border">
            <Button
              className="w-full h-11 bg-primary hover:bg-primary text-white rounded-lg"
              onClick={() => setShowTermsDialog(false)}
              data-testid="close-terms-btn"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Use code to Join Dialog */}
      <Dialog open={showJoinDialog} onOpenChange={(open) => {
        setShowJoinDialog(open);
        if (!open) { setJoinStep('code'); setJoinCode(''); setJoinData(null); setJoinPassword(''); setJoinAgreedToTerms(false); }
      }}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold text-foreground">
              {joinStep === 'code' ? 'Join with Invite Code' : 'Set Your Password'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {joinStep === 'code'
                ? 'Enter the invite code you received from your college administrator.'
                : `You're joining ${joinData?.tenant_name}. Set a password to complete your account.`}
            </DialogDescription>
          </DialogHeader>

          {joinStep === 'code' && (
            <form onSubmit={handleJoinVerify} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="join-code" className="text-foreground font-medium text-sm">Invite Code</Label>
                <Input
                  id="join-code"
                  type="text"
                  placeholder="e.g. ABC-123"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  required
                  autoCapitalize="characters"
                  className="h-12 border-border focus:border-border focus:ring-1 focus:ring-ring rounded-lg tracking-widest font-mono text-center text-lg"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12 border-border text-foreground hover:bg-muted rounded-lg"
                  onClick={() => setShowJoinDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-12 bg-primary hover:bg-primary text-white rounded-lg"
                  disabled={joinLoading || !joinCode.trim()}
                >
                  {joinLoading ? 'Verifying...' : 'Verify Code'}
                </Button>
              </div>
            </form>
          )}

          {joinStep === 'register' && joinData && (
            <form onSubmit={handleJoinRegister} className="space-y-4 mt-4">
              <div className="bg-muted rounded-xl p-4 space-y-1">
                <p className="text-sm font-medium text-foreground">{joinData.full_name || `${joinData.first_name || ''} ${joinData.last_name || ''}`.trim() || joinData.email}</p>
                <p className="text-xs text-muted-foreground">{joinData.email}</p>
                <p className="text-xs text-muted-foreground">{joinData.tenant_name}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="join-password" className="text-foreground font-medium text-sm">Create Password</Label>
                <div className="relative">
                  <Input
                    id="join-password"
                    type={showJoinPassword ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="h-12 border-border focus:border-border focus:ring-1 focus:ring-ring rounded-lg pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowJoinPassword(p => !p)}
                    onTouchEnd={(e) => { e.preventDefault(); setShowJoinPassword(p => !p); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-2 -mr-2"
                    tabIndex={-1}
                  >
                    {showJoinPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              {/* Terms agreement */}
              <div className="flex items-start gap-3 pt-1">
                <input
                  id="join-terms"
                  type="checkbox"
                  checked={joinAgreedToTerms}
                  onChange={(e) => setJoinAgreedToTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-ring cursor-pointer"
                />
                <label htmlFor="join-terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={() => setShowTermsDialog(true)}
                    className="text-primary underline underline-offset-2 hover:opacity-80"
                  >
                    Terms of Service & Privacy Policy
                  </button>
                </label>
              </div>

              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12 border-border text-foreground hover:bg-muted rounded-lg"
                  onClick={() => { setJoinStep('code'); setJoinPassword(''); setJoinAgreedToTerms(false); }}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-12 bg-primary hover:bg-primary text-white rounded-lg"
                  disabled={joinLoading || !joinPassword || !joinAgreedToTerms}
                >
                  {joinLoading ? 'Joining...' : 'Complete Setup'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
