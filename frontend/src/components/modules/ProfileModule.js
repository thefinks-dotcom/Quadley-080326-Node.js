import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext, API } from '@/App';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Home, MessageSquare, Calendar, Users, Wrench, DollarSign, BookOpen,
  Heart, UtensilsCrossed, Building, Plus, Send, Bell, Sparkles, Award,
  Trophy, Camera, Zap, Shield, Lock, Briefcase, Upload, UserCheck, Settings,
  User, ChevronDown, AlertTriangle, Cake, X, LogOut
} from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';

const ProfileModule = () => {
  const { user, setUser, logout } = useContext(AuthContext);
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [emailVerificationStep, setEmailVerificationStep] = useState(1); // 1 = enter email+pw, 2 = enter code
  const [profileData, setProfileData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    role: user?.role || '',
    floor: user?.floor || '',
    student_id: user?.student_id || '',
    photo_url: user?.photo_url || ''
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [emailData, setEmailData] = useState({
    newEmail: '',
    currentPassword: '',
    verificationCode: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [emailError, setEmailError] = useState('');

  // Password validation
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

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await axios.patch(`${API}/auth/me`, profileData);
      toast.success('Profile updated successfully!');
      setEditing(false);
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError('');

    // Validate new password
    const validation = validatePassword(passwordData.newPassword);
    if (!validation.isValid) {
      setPasswordError('New password does not meet requirements');
      return;
    }

    // Check passwords match
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    try {
      await axios.post(`${API}/auth/change-password`, {
        current_password: passwordData.currentPassword,
        new_password: passwordData.newPassword
      });
      toast.success('Password changed successfully!');
      setChangingPassword(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      setPasswordError(error.response?.data?.detail || 'Failed to change password');
    }
  };

  const handleEmailChange = async (e) => {
    e.preventDefault();
    setEmailError('');

    if (emailVerificationStep === 1) {
      // Step 1: Request email change — send verification code
      const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailPattern.test(emailData.newEmail)) {
        setEmailError('Please enter a valid email address');
        return;
      }
      if (!emailData.currentPassword) {
        setEmailError('Please enter your current password');
        return;
      }
      try {
        await axios.post(`${API}/auth/request-email-change`, {
          new_email: emailData.newEmail,
          current_password: emailData.currentPassword
        });
        toast.success('Verification code sent to your new email!');
        setEmailVerificationStep(2);
      } catch (error) {
        setEmailError(error.response?.data?.detail || 'Failed to request email change');
      }
    } else {
      // Step 2: Verify code and complete email change
      if (!emailData.verificationCode || emailData.verificationCode.length !== 6) {
        setEmailError('Please enter the 6-digit verification code');
        return;
      }
      try {
        const response = await axios.post(`${API}/auth/verify-email-change`, {
          code: emailData.verificationCode
        });
        toast.success('Email changed successfully!');
        if (setUser && response.data.new_email) {
          setUser(prev => ({ ...prev, email: response.data.new_email }));
        }
        setChangingEmail(false);
        setEmailVerificationStep(1);
        setEmailData({ newEmail: '', currentPassword: '', verificationCode: '' });
      } catch (error) {
        setEmailError(error.response?.data?.detail || 'Failed to verify email change');
      }
    }
  };

  return (
    <div className="min-h-screen bg-background" data-testid="profile-module">
      <ModuleHeader
        title="Profile"
        subtitle={`${user?.first_name || ''} ${user?.last_name || ''}`}
        showSearch={false}
        rightContent={
          <button
            onClick={() => logout && logout()}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.2)' }}
            aria-label="Log out"
          >
            <LogOut className="h-5 w-5 text-white" />
          </button>
        }
      />
      <div className="px-4 pt-4 pb-4 space-y-4">
      
      <Card className="p-6 glass">
        <div className="flex items-center gap-6 mb-6">
          {user?.photo_url ? (
            <img src={user.photo_url} alt="Profile" className="w-24 h-24 rounded-full object-cover" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-3xl font-semibold">
              {user?.first_name?.[0]?.toUpperCase()}{user?.last_name?.[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <h3 className="text-2xl font-bold">{user?.first_name} {user?.last_name}</h3>
            <p className="text-muted-foreground capitalize">{user?.role}</p>
          </div>
        </div>

        {editing ? (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>First Name</Label>
                <Input
                  value={profileData.first_name}
                  onChange={(e) => setProfileData({ ...profileData, first_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input
                  value={profileData.last_name}
                  onChange={(e) => setProfileData({ ...profileData, last_name: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Role</Label>
              <Input
                value={profileData.role}
                onChange={(e) => setProfileData({ ...profileData, role: e.target.value })}
              />
            </div>
            {!['admin', 'super_admin'].includes(user?.role) && (
              <div>
                <Label>Floor</Label>
                <Input
                  value={profileData.floor}
                  onChange={(e) => setProfileData({ ...profileData, floor: e.target.value })}
                />
              </div>
            )}
            <div>
              <Label>Student ID</Label>
              <Input
                value={profileData.student_id}
                onChange={(e) => setProfileData({ ...profileData, student_id: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="bg-gradient-to-r from-primary to-secondary">
                Save Changes
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{user?.email}</p>
              </div>
              {!['admin', 'super_admin'].includes(user?.role) && (
                <div>
                  <p className="text-sm text-muted-foreground">Floor</p>
                  <p className="font-medium">{user?.floor || 'Not set'}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Student ID</p>
                <p className="font-medium">{user?.student_id || 'Not set'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Year</p>
                <p className="font-medium">{user?.year || 'Not set'}</p>
              </div>
            </div>
            <Button onClick={() => setEditing(true)} className="bg-gradient-to-r from-primary to-secondary">
              Edit Profile
            </Button>
          </div>
        )}
      </Card>

      {/* Change Password Section */}
      <Card className="p-6 glass">
        <h3 className="text-xl font-semibold mb-4">Change Password</h3>
        
        {changingPassword ? (
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <Label>Current Password</Label>
              <Input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>New Password</Label>
              <Input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                required
              />
              {/* Password Requirements */}
              <div className="text-xs space-y-1 mt-2">
                <p className="font-medium text-foreground">Password must contain:</p>
                <div className="space-y-0.5">
                  <p className={passwordData.newPassword.length >= 8 ? "text-success" : "text-muted-foreground"}>
                    {passwordData.newPassword.length >= 8 ? "✓" : "○"} At least 8 characters
                  </p>
                  <p className={/[A-Z]/.test(passwordData.newPassword) ? "text-success" : "text-muted-foreground"}>
                    {/[A-Z]/.test(passwordData.newPassword) ? "✓" : "○"} One uppercase letter
                  </p>
                  <p className={/[a-z]/.test(passwordData.newPassword) ? "text-success" : "text-muted-foreground"}>
                    {/[a-z]/.test(passwordData.newPassword) ? "✓" : "○"} One lowercase letter
                  </p>
                  <p className={/[!@#$%^&*(),.?":{}|<>]/.test(passwordData.newPassword) ? "text-success" : "text-muted-foreground"}>
                    {/[!@#$%^&*(),.?":{}|<>]/.test(passwordData.newPassword) ? "✓" : "○"} One special character
                  </p>
                </div>
              </div>
            </div>
            <div>
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                required
              />
              {passwordData.confirmPassword && (
                <p className={`text-xs mt-1 ${passwordData.newPassword === passwordData.confirmPassword ? "text-success" : "text-destructive"}`}>
                  {passwordData.newPassword === passwordData.confirmPassword ? "✓ Passwords match" : "✗ Passwords do not match"}
                </p>
              )}
            </div>
            {passwordError && (
              <div className="text-sm text-destructive bg-destructive/5 p-3 rounded-lg">
                {passwordError}
              </div>
            )}
            <div className="flex gap-2">
              <Button type="submit" className="bg-gradient-to-r from-primary to-secondary">
                Change Password
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setChangingPassword(false);
                  setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  setPasswordError('');
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button onClick={() => setChangingPassword(true)} variant="outline" data-testid="change-password-btn">
            Change Password
          </Button>
        )}
      </Card>

      {/* Change Email Section */}
      <Card className="p-6 glass" data-testid="change-email-card">
        <h3 className="text-xl font-semibold mb-4">Change Email Address</h3>
        <p className="text-sm text-muted-foreground mb-4">Current email: <strong>{user?.email}</strong></p>
        
        {changingEmail ? (
          <form onSubmit={handleEmailChange} className="space-y-4" data-testid="change-email-form">
            {emailVerificationStep === 1 ? (
              <>
                <div>
                  <Label>New Email Address</Label>
                  <Input
                    type="email"
                    value={emailData.newEmail}
                    onChange={(e) => setEmailData({ ...emailData, newEmail: e.target.value })}
                    placeholder="Enter new email address"
                    required
                    data-testid="new-email-input"
                  />
                </div>
                <div>
                  <Label>Current Password</Label>
                  <Input
                    type="password"
                    value={emailData.currentPassword}
                    onChange={(e) => setEmailData({ ...emailData, currentPassword: e.target.value })}
                    placeholder="Enter your current password to confirm"
                    required
                    data-testid="email-change-password-input"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Password required to verify your identity</p>
                </div>
              </>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  A 6-digit verification code has been sent to <strong>{emailData.newEmail}</strong>. Enter it below to complete the change.
                </p>
                <Label>Verification Code</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={emailData.verificationCode}
                  onChange={(e) => setEmailData({ ...emailData, verificationCode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  placeholder="Enter 6-digit code"
                  required
                  className="text-center tracking-widest text-lg font-mono"
                  data-testid="email-verification-code-input"
                />
                <p className="text-xs text-muted-foreground mt-1">Code expires in 15 minutes</p>
              </div>
            )}
            {emailError && (
              <div className="text-sm text-destructive bg-destructive/5 p-3 rounded-lg" data-testid="email-error">
                {emailError}
              </div>
            )}
            <div className="flex gap-2">
              <Button type="submit" className="bg-gradient-to-r from-primary to-secondary" data-testid="submit-email-change-btn">
                {emailVerificationStep === 1 ? 'Send Verification Code' : 'Verify & Change Email'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setChangingEmail(false);
                  setEmailVerificationStep(1);
                  setEmailData({ newEmail: '', currentPassword: '', verificationCode: '' });
                  setEmailError('');
                }}
                data-testid="cancel-email-change-btn"
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button onClick={() => setChangingEmail(true)} variant="outline" data-testid="change-email-btn">
            Change Email
          </Button>
        )}
      </Card>

      </div>
    </div>
  );
};

// Settings Module

export default ProfileModule;
