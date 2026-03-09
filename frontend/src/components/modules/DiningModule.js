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

const DiningModule = () => {
  const [menu, setMenu] = useState([]);
  const [lateMealRequests, setLateMealRequests] = useState([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [newRequest, setNewRequest] = useState({ 
    meal_type: 'dinner', 
    date: '', 
    reason: 'Late Class',
    dietary_requirements: ''
  });

  useEffect(() => {
    fetchWeeklyMenu();
    fetchLateMealRequests();
  }, []);

  const fetchWeeklyMenu = async () => {
    try {
      // Get dates for Monday-Friday of current week
      const today = new Date();
      const currentDay = today.getDay();
      const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
      
      const menuData = [];
      for (let i = 0; i < 5; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + mondayOffset + i);
        const dateStr = date.toISOString().split('T')[0];
        
        try {
          const response = await axios.get(`${API}/dining/menu?date=${dateStr}`);
          menuData.push({
            date: dateStr,
            dayName: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][i],
            items: response.data
          });
        } catch (error) {
          menuData.push({
            date: dateStr,
            dayName: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][i],
            items: []
          });
        }
      }
      
      setMenu(menuData);
    } catch (error) {
      console.error('Failed to fetch menu', error);
      toast.error('Failed to load menu. Please refresh the page.');
    }
  };

  const fetchLateMealRequests = async () => {
    try {
      const response = await axios.get(`${API}/dining/late-meals`);
      setLateMealRequests(response.data);
    } catch (error) {
      console.error('Failed to fetch requests', error);
    }
  };

  const requestLateMeal = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/dining/late-meals`, newRequest);
      toast.success('Late meal request submitted!');
      setShowRequestForm(false);
      setNewRequest({ meal_type: 'dinner', date: '', reason: 'Late Class', dietary_requirements: '' });
      fetchLateMealRequests();
    } catch (error) {
      toast.error('Failed to request late meal');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ModuleHeader
        title="Dining"
        showBack={true}
        showSearch={false}
      />
      <div className="px-4 pt-4 pb-4 space-y-4">

      <div className="flex items-center justify-between">
        <h2 className="heading-font text-3xl font-bold">Dining</h2>
        <Button 
          onClick={() => setShowRequestForm(!showRequestForm)}
          data-testid="request-late-meal-btn"
          className="bg-gradient-to-r from-primary to-secondary hover:from-primary hover:to-secondary"
        >
          <UtensilsCrossed className="mr-2 h-4 w-4" />
          Request Late Meal
        </Button>
      </div>

      {/* Late Meal Request Form */}
      {showRequestForm && (
        <Card className="p-6 glass">
          <h3 className="font-semibold mb-4">Request Late Meal</h3>
          <form onSubmit={requestLateMeal} className="space-y-4" data-testid="late-meal-form">
            <div>
              <Label>Meal Type</Label>
              <select 
                className="w-full p-2 rounded border" 
                value={newRequest.meal_type} 
                onChange={(e) => setNewRequest({ ...newRequest, meal_type: e.target.value })}
                data-testid="meal-type-select"
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
              </select>
            </div>
            <div>
              <Label>Date</Label>
              <Input 
                type="date" 
                value={newRequest.date} 
                onChange={(e) => setNewRequest({ ...newRequest, date: e.target.value })} 
                required
                data-testid="meal-date-input"
              />
            </div>
            <div>
              <Label>Reason (Optional)</Label>
              <select 
                className="w-full p-2 rounded border" 
                value={newRequest.reason} 
                onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })}
                data-testid="meal-reason-select"
              >
                <option value="Late Class">Late Class</option>
                <option value="Sporting Commitment">Sporting Commitment</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <Label>Dietary Requirements (Optional)</Label>
              <Textarea 
                placeholder="e.g., Vegetarian, Gluten-free, Allergies, etc."
                value={newRequest.dietary_requirements} 
                onChange={(e) => setNewRequest({ ...newRequest, dietary_requirements: e.target.value })}
                data-testid="meal-dietary-input"
                rows={3}
              />
            </div>
            <Button type="submit" className="bg-gradient-to-r from-primary to-secondary">
              Submit Request
            </Button>
          </form>
        </Card>
      )}

      {/* Late Meal Requests - Pending and History */}
      {lateMealRequests.length > 0 && (
        <Card className="p-6 glass">
          <h3 className="font-semibold text-lg mb-4">Your Late Meal Requests</h3>
          <Tabs defaultValue="pending">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="pending">
                Pending ({lateMealRequests.filter(req => req.status === 'pending').length})
              </TabsTrigger>
              <TabsTrigger value="history">
                History ({lateMealRequests.filter(req => req.status !== 'pending').length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-3">
              {lateMealRequests.filter(req => req.status === 'pending').length > 0 ? (
                lateMealRequests.filter(req => req.status === 'pending').map((req, idx) => (
                  <div key={req.id || idx} className="p-4 rounded-lg bg-muted border-l-4 border-primary">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="font-semibold capitalize text-lg">{req.meal_type}</div>
                          <Badge className="bg-warning">Pending</Badge>
                        </div>
                        <div className="text-sm text-foreground space-y-1">
                          <div><span className="font-medium">Date:</span> {new Date(req.date).toLocaleDateString()}</div>
                          <div><span className="font-medium">Reason:</span> {req.reason}</div>
                          {req.dietary_requirements && (
                            <div><span className="font-medium">Dietary Requirements:</span> {req.dietary_requirements}</div>
                          )}
                          <div className="text-xs text-muted-foreground mt-2">
                            Submitted: {new Date(req.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <UtensilsCrossed className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                  <p>No pending late meal requests</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-3">
              {lateMealRequests.filter(req => req.status !== 'pending').length > 0 ? (
                lateMealRequests.filter(req => req.status !== 'pending').map((req, idx) => (
                  <div key={req.id || idx} className={`p-4 rounded-lg ${
                    req.status === 'approved' ? 'bg-success/10 border-l-4 border-success' :
                    req.status === 'rejected' ? 'bg-destructive/5 border-l-4 border-destructive/30' :
                    'bg-muted border-l-4 border-border'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="font-semibold capitalize text-lg">{req.meal_type}</div>
                          <Badge className={
                            req.status === 'approved' ? 'bg-success' :
                            req.status === 'rejected' ? 'bg-destructive/50' :
                            'bg-secondary'
                          }>
                            {req.status === 'approved' ? '✓ Approved' :
                             req.status === 'rejected' ? '✗ Rejected' :
                             req.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-foreground space-y-1">
                          <div><span className="font-medium">Date:</span> {new Date(req.date).toLocaleDateString()}</div>
                          <div><span className="font-medium">Reason:</span> {req.reason}</div>
                          {req.dietary_requirements && (
                            <div><span className="font-medium">Dietary Requirements:</span> {req.dietary_requirements}</div>
                          )}
                          <div className="text-xs text-muted-foreground mt-2">
                            Submitted: {new Date(req.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <UtensilsCrossed className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                  <p>No request history</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Card>
      )}

      <div className="space-y-6">
        {/* Weekly Menu */}
        <Card className="p-6 glass">
          <h3 className="font-semibold text-lg mb-4">Weekly Menu (Monday - Friday)</h3>
          <div className="space-y-6">
            {menu.map((day, dayIdx) => (
              <div key={dayIdx} className="border-l-4 border-border pl-4">
                <h4 className="font-bold text-lg mb-3">{day.dayName} - {new Date(day.date).toLocaleDateString()}</h4>
                <div className="space-y-3">
                  {['breakfast', 'lunch', 'dinner'].map((mealType) => {
                    const items = day.items.filter(item => item.meal_type === mealType);
                    return (
                      <div key={mealType}>
                        <h5 className="font-semibold capitalize text-foreground mb-2">{mealType}</h5>
                        {items.length > 0 ? (
                          <div className="space-y-2">
                            {items.map((item, idx) => (
                              <div key={idx} data-testid={`menu-item-${dayIdx}-${idx}`} className="p-3 rounded-lg bg-white/50">
                                <div className="font-medium">{item.name}</div>
                                <div className="text-sm text-muted-foreground">{item.description}</div>
                                {item.dietary_tags.length > 0 && (
                                  <div className="flex gap-1 mt-1">
                                    {item.dietary_tags.map((tag, i) => (
                                      <Badge key={i} className="text-xs bg-muted text-foreground">{tag}</Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">No items available</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      </div>
    </div>
  );
};

// Houses Module
// Incident Reporting Module

export default DiningModule;
