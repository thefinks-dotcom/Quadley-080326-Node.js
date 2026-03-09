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

const WellnessResourcesModule = () => {
  const [resources, setResources] = useState([]);

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    try {
      const response = await axios.get(`${API}/wellbeing/resources`);
      setResources(response.data);
    } catch (error) {
      console.error('Failed to fetch resources', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ModuleHeader
        title="Wellness Resources"
        showBack={true}
        showSearch={false}
      />
      <div className="px-4 pt-4 pb-4 space-y-4">

      <h2 className="heading-font text-3xl font-bold">Wellness Resources</h2>

      <div className="grid md:grid-cols-2 gap-6">
        {resources.map((resource, idx) => (
          <Card key={idx} data-testid={`resource-${idx}`} className="p-6 glass">
            <h3 className="font-semibold text-lg mb-2">{resource.title}</h3>
            <p className="text-sm text-muted-foreground mb-3">{resource.description}</p>
            <Badge className="bg-secondary text-white">{resource.category}</Badge>
            {resource.link && (
              <a href={resource.link} target="_blank" rel="noopener noreferrer" className="text-sm text-foreground hover:underline block mt-3">
                Learn more →
              </a>
            )}
          </Card>
        ))}
        {resources.length === 0 && (
          <Card className="p-6 glass">
            <p className="text-muted-foreground text-sm">No resources available yet</p>
          </Card>
        )}
      </div>
      </div>
    </div>
  );
};

// Safe Disclosure Module

export default WellnessResourcesModule;
