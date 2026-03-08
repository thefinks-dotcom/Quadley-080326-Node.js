'use client';

import React, { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext, API } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Bell, Lock, ChevronDown, ChevronRight, User, Shield
} from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';

const SettingsModule = () => {
  const { user } = useContext(AuthContext);
  const [expandedSection, setExpandedSection] = useState(null);
  
  const [notifications, setNotifications] = useState({
    notif_dining_menu: user?.notif_dining_menu ?? true,
    notif_messages: user?.notif_messages ?? true,
    notif_events: user?.notif_events ?? true,
    notif_floor_posts: user?.notif_floor_posts ?? true,
    notif_announcements: user?.notif_announcements ?? true,
    notif_shoutouts: user?.notif_shoutouts ?? true,
    notif_finance: user?.notif_finance ?? true,
    notif_memory_lane: user?.notif_memory_lane ?? true,
    notif_tutoring_reminders: user?.notif_tutoring_reminders ?? true,
    notif_study_group_reminders: user?.notif_study_group_reminders ?? true
  });

  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handleToggle = async (key) => {
    const newValue = !notifications[key];
    setNotifications({ ...notifications, [key]: newValue });
    
    try {
      await axios.patch(`${API}/auth/me`, { [key]: newValue });
      toast.success('Settings updated');
    } catch (error) {
      toast.error('Failed to update settings');
      setNotifications({ ...notifications, [key]: !newValue });
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.new_password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setPasswordLoading(true);
    try {
      await axios.post(`${API}/auth/change-password`, {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      });
      toast.success('Password changed successfully!');
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
      setExpandedSection(null);
    } catch (error) {
      const detail = error.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : 'Failed to change password';
      toast.error(message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const notificationItems = [
    { key: 'notif_dining_menu', label: 'Dining Menu Release', desc: 'Get notified when new menus are posted' },
    { key: 'notif_messages', label: 'Messages', desc: 'New direct messages and group chats' },
    { key: 'notif_events', label: 'New Events', desc: 'Upcoming college events and activities' },
    { key: 'notif_floor_posts', label: 'Floor Posts', desc: 'Activity posted in your floor' },
    { key: 'notif_announcements', label: 'Announcements', desc: 'Important college announcements' },
    { key: 'notif_shoutouts', label: 'Shoutouts', desc: 'When someone mentions you in recognition' },
    { key: 'notif_finance', label: 'Finance', desc: 'Payment reminders and financial updates' },
    { key: 'notif_memory_lane', label: 'Memory Lane', desc: 'New memories and photo albums posted' },
    { key: 'notif_tutoring_reminders', label: 'Tutoring Reminders', desc: 'Upcoming tutoring sessions and requests' },
    { key: 'notif_study_group_reminders', label: 'Study Group Reminders', desc: 'Upcoming study group meetings' }
  ];

  return (
    <div className="min-h-screen bg-background">
      <ModuleHeader
        title="Settings"
        showBack={true}
        showSearch={false}
      />
      <div className="px-4 pt-4 pb-4 space-y-4">

      <h2 className="heading-font text-3xl font-bold mb-6">Settings</h2>

      {/* Change Password Section */}
      <Card className="overflow-hidden">
        <button
          onClick={() => toggleSection('password')}
          className="w-full p-4 flex items-center justify-between hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted rounded-lg">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold">Change Password</h3>
              <p className="text-sm text-muted-foreground">Update your account password</p>
            </div>
          </div>
          {expandedSection === 'password' ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
        
        {expandedSection === 'password' && (
          <div className="px-4 pb-4 border-t bg-muted/50">
            <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md pt-4">
              <div>
                <Label htmlFor="current_password">Current Password</Label>
                <Input
                  id="current_password"
                  type={showPasswords ? 'text' : 'password'}
                  value={passwordData.current_password}
                  onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                  placeholder="Enter your current password"
                  required
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="new_password">New Password</Label>
                <Input
                  id="new_password"
                  type={showPasswords ? 'text' : 'password'}
                  value={passwordData.new_password}
                  onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                  placeholder="Enter new password (min 8 characters)"
                  required
                  minLength={8}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="confirm_password">Confirm New Password</Label>
                <Input
                  id="confirm_password"
                  type={showPasswords ? 'text' : 'password'}
                  value={passwordData.confirm_password}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                  placeholder="Confirm new password"
                  required
                  className="mt-1"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="show_passwords"
                  checked={showPasswords}
                  onChange={(e) => setShowPasswords(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="show_passwords" className="text-sm cursor-pointer">Show passwords</Label>
              </div>
              
              <Button type="submit" disabled={passwordLoading}>
                {passwordLoading ? 'Changing...' : 'Change Password'}
              </Button>
            </form>
          </div>
        )}
      </Card>

      {/* Smart Notifications Section */}
      <Card className="overflow-hidden">
        <button
          onClick={() => toggleSection('notifications')}
          className="w-full p-4 flex items-center justify-between hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted rounded-lg">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold">Smart Notifications</h3>
              <p className="text-sm text-muted-foreground">Choose which notifications you'd like to receive</p>
            </div>
          </div>
          {expandedSection === 'notifications' ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
        
        {expandedSection === 'notifications' && (
          <div className="border-t bg-muted/50">
            <div className="p-4 space-y-1">
              {notificationItems.map(item => (
                <div key={item.key} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/50 hover:bg-white transition-colors">
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                  <label className="relative inline-block w-12 h-6">
                    <input
                      type="checkbox"
                      checked={notifications[item.key]}
                      onChange={() => handleToggle(item.key)}
                      className="sr-only peer"
                    />
                    <div className="w-12 h-6 bg-muted rounded-full peer peer-checked:bg-secondary transition-colors cursor-pointer"></div>
                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-6"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Account Info Section */}
      <Card className="overflow-hidden">
        <button
          onClick={() => toggleSection('account')}
          className="w-full p-4 flex items-center justify-between hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success/10 rounded-lg">
              <User className="h-5 w-5 text-success" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold">Account Information</h3>
              <p className="text-sm text-muted-foreground">View your account details</p>
            </div>
          </div>
          {expandedSection === 'account' ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
        
        {expandedSection === 'account' && (
          <div className="px-4 pb-4 border-t bg-muted/50">
            <div className="pt-4 space-y-3">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{user?.first_name} {user?.last_name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{user?.email}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Role</span>
                <span className="font-medium capitalize">{user?.role?.replace('_', ' ')}</span>
              </div>
              {user?.floor && (
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Floor</span>
                  <span className="font-medium">{user?.floor}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
      </div>
    </div>
  );
};

export default SettingsModule;
