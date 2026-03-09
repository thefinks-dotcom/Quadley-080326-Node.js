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

const OWeekModule = () => {
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      const response = await axios.get(`${API}/oweek/activities`);
      setActivities(response.data);
    } catch (error) {
      console.error('Failed to fetch activities', error);
    }
  };

  const completeActivity = async (activityId) => {
    try {
      await axios.post(`${API}/oweek/activities/${activityId}/complete`);
      toast.success('Activity completed! Points awarded to your house!');
      fetchActivities();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete activity');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ModuleHeader
        title="O-Week"
        showBack={true}
        showSearch={false}
      />
      <div className="px-4 pt-4 pb-4 space-y-4">

      <h2 className="heading-font text-3xl font-bold flex items-center gap-3">
        <Trophy className="h-8 w-8 text-primary" />
        O-Week
      </h2>
      <p className="text-muted-foreground">Complete activities and earn points for your house!</p>

      <Card className="p-6 glass">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          O-Week Activities
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          {activities.map((activity, idx) => (
            <div key={idx} data-testid={`oweek-activity-${idx}`} className="p-4 rounded-lg bg-gradient-to-br from-muted to-muted border border-border">
              <div className="font-semibold text-lg">{activity.name}</div>
              <div className="text-sm text-muted-foreground mt-1">{activity.description}</div>
              <div className="flex items-center justify-between mt-3">
                <Badge className="bg-primary text-white">{activity.activity_type}</Badge>
                <Badge className="bg-secondary text-white">{activity.points} points</Badge>
              </div>
              <Button size="sm" className="w-full mt-3 bg-gradient-to-r from-primary to-muted-foreground" onClick={() => completeActivity(activity.id)} data-testid={`complete-activity-${idx}-btn`}>
                Complete Activity
              </Button>
            </div>
          ))}
          {activities.length === 0 && (
            <div className="col-span-2 text-center py-12">
              <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No O-Week activities available yet</p>
              <p className="text-sm text-muted-foreground mt-2">Check back during orientation week!</p>
            </div>
          )}
        </div>
      </Card>
      </div>
    </div>
  );
};

// Memory Lane Module

export default OWeekModule;
