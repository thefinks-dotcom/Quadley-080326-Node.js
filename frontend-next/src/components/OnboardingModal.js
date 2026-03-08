'use client';

import React, { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext, API } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Bell, ChevronRight, ChevronLeft, Check, Sparkles, X
} from 'lucide-react';

const OnboardingModal = ({ onComplete }) => {
  const { user } = useContext(AuthContext);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  
  const [notifications, setNotifications] = useState({
    notif_dining_menu: true,
    notif_messages: true,
    notif_events: true,
    notif_floor_posts: true,
    notif_announcements: true,
    notif_shoutouts: true,
    notif_finance: true,
    notif_memory_lane: true,
    notif_tutoring_reminders: true,
    notif_study_group_reminders: true
  });

  const notificationItems = [
    { key: 'notif_announcements', label: 'Announcements', desc: 'Important college updates', essential: true },
    { key: 'notif_messages', label: 'Messages', desc: 'Direct messages & group chats', essential: true },
    { key: 'notif_events', label: 'Events', desc: 'Upcoming activities', essential: false },
    { key: 'notif_dining_menu', label: 'Dining Menus', desc: 'Daily menu updates', essential: false },
    { key: 'notif_floor_posts', label: 'Floor Posts', desc: 'Your floor activity', essential: false },
    { key: 'notif_shoutouts', label: 'Recognition', desc: 'When you receive shoutouts', essential: false },
    { key: 'notif_finance', label: 'Finance', desc: 'Payment reminders', essential: false },
    { key: 'notif_memory_lane', label: 'Memory Lane', desc: 'Photo albums & memories', essential: false },
    { key: 'notif_tutoring_reminders', label: 'Tutoring', desc: 'Session reminders', essential: false },
    { key: 'notif_study_group_reminders', label: 'Study Groups', desc: 'Meeting reminders', essential: false }
  ];

  const handleToggle = (key) => {
    setNotifications({ ...notifications, [key]: !notifications[key] });
  };

  const enableAll = () => {
    const allEnabled = {};
    notificationItems.forEach(item => { allEnabled[item.key] = true; });
    setNotifications(allEnabled);
  };

  const enableEssentialOnly = () => {
    const essentialOnly = {};
    notificationItems.forEach(item => { essentialOnly[item.key] = item.essential; });
    setNotifications(essentialOnly);
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      await axios.patch(`${API}/auth/me`, {
        ...notifications,
        onboarding_completed: true
      });
      toast.success('Preferences saved!');
      onComplete();
    } catch (error) {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    try {
      await axios.patch(`${API}/auth/me`, { onboarding_completed: true });
      onComplete();
    } catch (error) {
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-secondary text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Welcome to Quadley!</h2>
                <p className="text-white/80 text-sm">Let's personalize your experience</p>
              </div>
            </div>
            <button onClick={handleSkip} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-3 bg-muted border-b flex items-center justify-center gap-2">
          <div className={`w-2 h-2 rounded-full ${step >= 1 ? 'bg-secondary' : 'bg-muted'}`} />
          <div className={`w-8 h-0.5 ${step >= 2 ? 'bg-secondary' : 'bg-muted'}`} />
          <div className={`w-2 h-2 rounded-full ${step >= 2 ? 'bg-secondary' : 'bg-muted'}`} />
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {step === 1 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Bell className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">Notification Preferences</h3>
              </div>
              <p className="text-muted-foreground text-sm mb-4">
                Choose what you'd like to be notified about. You can change these anytime in Settings.
              </p>

              {/* Quick Presets */}
              <div className="flex gap-2 mb-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={enableAll}
                  className="text-xs"
                >
                  Enable All
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={enableEssentialOnly}
                  className="text-xs"
                >
                  Essential Only
                </Button>
              </div>

              {/* Notification Toggles */}
              <div className="space-y-2">
                {notificationItems.map(item => (
                  <div 
                    key={item.key} 
                    className={`flex items-center justify-between py-2 px-3 rounded-lg transition-colors ${
                      notifications[item.key] ? 'bg-muted' : 'bg-muted'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{item.label}</p>
                        {item.essential && (
                          <span className="text-xs bg-muted text-primary px-1.5 py-0.5 rounded">Essential</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <label className="relative inline-block w-10 h-5 shrink-0">
                      <input
                        type="checkbox"
                        checked={notifications[item.key]}
                        onChange={() => handleToggle(item.key)}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-muted rounded-full peer peer-checked:bg-secondary transition-colors cursor-pointer"></div>
                      <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="text-center py-6">
              <div className="inline-flex p-4 bg-success/10 rounded-full mb-4">
                <Check className="h-10 w-10 text-success" />
              </div>
              <h3 className="font-semibold text-xl mb-2">You're All Set!</h3>
              <p className="text-muted-foreground mb-4">
                Welcome, {user?.first_name}! Your preferences have been saved.
              </p>
              <div className="bg-muted rounded-lg p-4 text-left text-sm">
                <p className="font-medium mb-2">Quick Tips:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Explore the sidebar to discover all features</li>
                  <li>• Check out Events for upcoming activities</li>
                  <li>• Send a shoutout to recognize a fellow resident</li>
                  <li>• Update your profile to help others connect with you</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-muted flex items-center justify-between">
          {step === 1 ? (
            <>
              <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground">
                Skip for now
              </Button>
              <Button onClick={() => setStep(2)} className="flex items-center gap-2">
                Continue
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setStep(1)} className="flex items-center gap-2">
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleComplete} disabled={saving} className="flex items-center gap-2">
                {saving ? 'Saving...' : 'Get Started'}
                <Sparkles className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
