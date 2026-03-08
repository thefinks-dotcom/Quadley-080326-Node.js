'use client';

import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { AuthContext, API } from '@/contexts/AuthContext';
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
  User, ChevronDown, AlertTriangle, Cake, X
} from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';

const WellbeingModule = () => {
  const router = useRouter();
  
  const sections = [
    {
      title: 'Pastoral Care',
      description: 'Book one-on-one sessions with pastoral care staff for personal support',
      icon: Heart,
      color: 'from-primary to-secondary',
      path: '/dashboard/wellbeing/pastoral'
    },
    {
      title: 'Wellness Resources',
      description: 'Access mental health resources, self-care guides, and wellness tips',
      icon: Sparkles,
      color: 'from-primary to-destructive',
      path: '/dashboard/wellbeing/resources'
    },
    {
      title: 'Support & Safety',
      description: 'Confidential support for gender-based violence and safety concerns',
      icon: Shield,
      color: 'from-primary to-secondary',
      path: '/dashboard/safe-disclosure'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <ModuleHeader
        title="Wellbeing"
        showBack={true}
        showSearch={false}
      />
      <div className="px-4 pt-4 pb-4 space-y-4">

      <div>
        <h2 className="heading-font text-3xl font-bold">Wellbeing & Support</h2>
        <p className="text-muted-foreground mt-2">Your health and safety are our priority</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {sections.map((section, idx) => {
          const Icon = section.icon;
          return (
            <Card
              key={idx}
              className="p-6 glass cursor-pointer hover:shadow-lg transition-all"
              onClick={() => router.push(section.path)}
            >
              <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${section.color} flex items-center justify-center mb-4`}>
                <Icon className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-bold text-xl mb-2">{section.title}</h3>
              <p className="text-muted-foreground text-sm">{section.description}</p>
              <Button variant="ghost" className="mt-4 p-0 h-auto text-muted-foreground hover:text-foreground">
                Access {section.title} →
              </Button>
            </Card>
          );
        })}
      </div>
      </div>
    </div>
  );
};

// Pastoral Care Detail Module

export default WellbeingModule;
