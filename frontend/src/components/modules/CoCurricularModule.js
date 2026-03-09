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
  User, ChevronDown, AlertTriangle, Cake, X
} from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';

const CoCurricularModule = () => {
  const navigate = useNavigate();
  
  const sections = [
    {
      title: 'Cultural Activities',
      description: 'Join cultural groups, chess clubs, choral groups, and more',
      icon: Camera,
      color: 'from-primary to-secondary',
      path: '/dashboard/cocurricular/cultural'
    },
    {
      title: 'Sports & Athletics',
      description: 'Participate in sports teams, training sessions, and competitions',
      icon: Trophy,
      color: 'from-primary to-secondary',
      path: '/dashboard/cocurricular/sports'
    },
    {
      title: 'Clubs',
      description: 'Create and join student clubs for shared interests and activities',
      icon: Users,
      color: 'from-primary to-secondary',
      path: '/dashboard/cocurricular/clubs'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <ModuleHeader
        title="Co-Curricular"
        showBack={true}
        showSearch={false}
      />
      <div className="px-4 pt-4 pb-4 space-y-4">

      <div>
        <h2 className="heading-font text-3xl font-bold">Co-Curricular Activities</h2>
        <p className="text-muted-foreground mt-2">Explore cultural, sports, and club opportunities</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {sections.map((section, idx) => {
          const Icon = section.icon;
          return (
            <Card
              key={idx}
              className="p-6 glass cursor-pointer hover:shadow-lg transition-all"
              onClick={() => navigate(section.path)}
            >
              <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${section.color} flex items-center justify-center mb-4`}>
                <Icon className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-bold text-xl mb-2">{section.title}</h3>
              <p className="text-muted-foreground text-sm">{section.description}</p>
              <Button variant="ghost" className="mt-4 p-0 h-auto text-muted-foreground hover:text-foreground">
                View {section.title} →
              </Button>
            </Card>
          );
        })}
      </div>
      </div>
    </div>
  );
};

// Wellbeing Parent Module (Updated with Support & Safety)

export default CoCurricularModule;
