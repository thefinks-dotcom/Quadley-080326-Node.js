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

const MemoryLaneModule = () => {
  const { user } = useContext(AuthContext);
  const [memories, setMemories] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);

  useEffect(() => {
    setSelectedYear(new Date().getFullYear());
  }, []);

  useEffect(() => {
    fetchMemories();
  }, [selectedYear]);

  const fetchMemories = async () => {
    try {
      const response = await axios.get(`${API}/memory-lane?year=${selectedYear}`);
      setMemories(response.data);
    } catch (error) {
      console.error('Failed to fetch memories', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ModuleHeader
        title="Memory Lane"
        showBack={true}
        showSearch={false}
      />
      <div className="px-4 pt-4 pb-4 space-y-4">

      <h2 className="heading-font text-3xl font-bold flex items-center gap-3">
        <Camera className="h-8 w-8 text-muted-foreground" />
        Memory Lane
      </h2>
      <p className="text-muted-foreground">Relive the highlights of your college year!</p>

      <Card className="p-6 glass">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-lg">Year in Review</h3>
          <select 
            className="p-2 rounded border" 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            data-testid="year-selector"
          >
            {[2025, 2024, 2023, 2022].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {memories.map((memory, idx) => (
            <div key={idx} data-testid={`memory-${idx}`} className="rounded-xl overflow-hidden bg-white shadow-md card-hover">
              {memory.photo_url && (
                <img src={memory.photo_url} alt={memory.title} className="w-full h-48 object-cover" />
              )}
              <div className="p-4">
                <div className="font-semibold text-lg mb-2">{memory.title}</div>
                <div className="text-sm text-muted-foreground mb-2">{memory.description}</div>
                <div className="flex flex-wrap gap-1">
                  {memory.tags.map((tag, i) => (
                    <Badge key={i} className="text-xs bg-muted text-foreground">{tag}</Badge>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {memories.length === 0 && (
          <div className="text-center py-12">
            <Camera className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No memories for {selectedYear} yet</p>
            <p className="text-sm text-muted-foreground mt-2">Check back later as RAs add highlights throughout the year!</p>
          </div>
        )}
      </Card>
      </div>
    </div>
  );
};

// Profile Module

export default MemoryLaneModule;
