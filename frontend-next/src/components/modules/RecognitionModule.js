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

const RecognitionModule = () => {
  const { user } = useContext(AuthContext);
  const [shoutouts, setShoutouts] = useState([]);
  const [showShoutoutForm, setShowShoutoutForm] = useState(false);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customName, setCustomName] = useState('');
  const [newShoutout, setNewShoutout] = useState({ 
    to_user_id: '', 
    to_user_name: '', 
    message: '', 
    category: 'kindness',
    is_general: false,
    broadcast_to_all: false
  });

  useEffect(() => {
    fetchShoutouts();
    fetchUsers();
  }, []);

  const fetchShoutouts = async () => {
    try {
      // Fetch all shoutouts to show community recognitions
      const response = await axios.get(`${API}/shoutouts`);
      setShoutouts(response.data);
    } catch (error) {
      console.error('Failed to fetch shoutouts', error);
    }
  };

  const fetchUsers = async () => {
    try {
      // Fetch all users for selection
      const response = await axios.get(`${API}/users/list`);
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users', error);
      // Set empty array if endpoint doesn't exist yet
      setUsers([]);
    }
  };

  const createShoutout = async (e) => {
    e.preventDefault();
    try {
      const shoutoutData = {
        message: newShoutout.message,
        category: newShoutout.category,
        broadcast: newShoutout.broadcast_to_all  // Add broadcast flag
      };

      // Only add recipient if not general
      if (!newShoutout.is_general && newShoutout.to_user_id) {
        shoutoutData.to_user_id = newShoutout.to_user_id;
        shoutoutData.to_user_name = newShoutout.to_user_name;
      }

      await axios.post(`${API}/shoutouts`, shoutoutData);
      
      // If broadcast to all is enabled, also create an announcement
      if (newShoutout.broadcast_to_all) {
        try {
          const announcementTitle = newShoutout.to_user_name 
            ? `Recognition: ${newShoutout.to_user_name}` 
            : 'Community Recognition';
          
          await axios.post(`${API}/announcements`, {
            title: announcementTitle,
            content: `${newShoutout.message}\n\n— ${user.first_name} ${user.last_name}`,
            target_audience: 'all',
            priority: 'normal',
            is_emergency: false
          });
          toast.success('Shoutout sent and broadcast to everyone!');
        } catch (err) {
          console.error('Failed to broadcast announcement', err);
          toast.success('Shoutout sent and broadcast to everyone! (Announcement optional)');
        }
      } else {
        toast.success('Shoutout sent!');
      }
      
      setShowShoutoutForm(false);
      setNewShoutout({ to_user_id: '', to_user_name: '', message: '', category: 'kindness', is_general: false, broadcast_to_all: false });
      setSearchTerm('');
      fetchShoutouts();
    } catch (error) {
      toast.error('Failed to send shoutout');
    }
  };

  const selectUser = (selectedUser) => {
    setNewShoutout({
      ...newShoutout,
      to_user_id: selectedUser.id,
      to_user_name: selectedUser.name,
      is_general: false
    });
    setSearchTerm('');
    setShowDropdown(false);
    setShowCustomInput(false);
  };

  const selectCustomPerson = () => {
    if (customName.trim()) {
      setNewShoutout({
        ...newShoutout,
        to_user_id: '', // No user ID for custom person
        to_user_name: customName.trim(),
        is_general: false
      });
      setCustomName('');
      setShowCustomInput(false);
      setShowDropdown(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.id !== user.id && 
    (u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     u.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-background">
      <ModuleHeader
        title="Recognition"
        showBack={true}
        showSearch={false}
      />
      <div className="px-4 pt-4 pb-4 space-y-4">

      <h2 className="heading-font text-3xl font-bold flex items-center gap-3">
        <Award className="h-8 w-8 text-muted-foreground" />
        Instant Recognition
      </h2>
      <p className="text-muted-foreground">Celebrate your peers with shoutouts for kindness, achievements, and help!</p>

      <Card className="p-6 glass">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Send a Shoutout</h3>
          <Button onClick={() => setShowShoutoutForm(!showShoutoutForm)} data-testid="create-shoutout-btn">
            <Plus className="mr-2 h-4 w-4" />
            New Shoutout
          </Button>
        </div>

        {showShoutoutForm && (
          <form onSubmit={createShoutout} className="space-y-4 mb-6 p-4 bg-white/50 rounded-xl" data-testid="shoutout-form">
            <div>
              <Label>Shoutout Type</Label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!newShoutout.is_general}
                    onChange={() => setNewShoutout({ ...newShoutout, is_general: false })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">To a specific person</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={newShoutout.is_general}
                    onChange={() => setNewShoutout({ ...newShoutout, is_general: true, to_user_id: '', to_user_name: '' })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">General shoutout</span>
                </label>
              </div>
            </div>

            {!newShoutout.is_general && (
              <div>
                <Label>Select Person</Label>
                {newShoutout.to_user_name ? (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border">
                    <span className="font-medium text-foreground">{newShoutout.to_user_name}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setNewShoutout({ ...newShoutout, to_user_id: '', to_user_name: '' });
                        setShowCustomInput(false);
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Button
                      type="button"
                      onClick={() => setShowDropdown(!showDropdown)}
                      className="w-full justify-between bg-white text-foreground border border-border hover:bg-muted"
                      data-testid="select-person-btn"
                    >
                      <span>Select a person...</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    
                    {showDropdown && (
                      <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-96 overflow-hidden flex flex-col">
                        {/* Custom Person Option at Top */}
                        <div className="border-b-2 border-border bg-muted">
                          {!showCustomInput ? (
                            <button
                              type="button"
                              onClick={() => setShowCustomInput(true)}
                              className="w-full text-left p-3 hover:bg-muted transition-colors font-medium text-primary"
                              data-testid="add-custom-person-btn"
                            >
                              <Plus className="inline h-4 w-4 mr-2" />
                              Add someone outside user list
                            </button>
                          ) : (
                            <div className="p-3 space-y-2">
                              <Input
                                placeholder="Enter person's name..."
                                value={customName}
                                onChange={(e) => setCustomName(e.target.value)}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    selectCustomPerson();
                                  }
                                }}
                                autoFocus
                                data-testid="custom-name-input"
                              />
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={selectCustomPerson}
                                  disabled={!customName.trim()}
                                  className="bg-primary hover:bg-primary"
                                >
                                  Add
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setShowCustomInput(false);
                                    setCustomName('');
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Search Box */}
                        <div className="p-2 border-b bg-muted">
                          <Input
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            data-testid="user-search-input"
                          />
                        </div>

                        {/* User List */}
                        <div className="overflow-y-auto max-h-64">
                          {(searchTerm ? filteredUsers : users.filter(u => u.id !== user.id)).length > 0 ? (
                            (searchTerm ? filteredUsers : users.filter(u => u.id !== user.id)).map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => selectUser(u)}
                                className="w-full text-left p-3 hover:bg-muted transition-colors border-b last:border-b-0"
                                data-testid={`user-option-${u.id}`}
                              >
                                <div className="font-medium">{u.name}</div>
                                <div className="text-sm text-muted-foreground">{u.email}</div>
                              </button>
                            ))
                          ) : (
                            <div className="p-4 text-center text-muted-foreground">
                              {searchTerm ? 'No users found' : 'Loading users...'}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <Label>Your Message</Label>
              <Textarea 
                placeholder={newShoutout.is_general ? "Share your appreciation with the community..." : "Your message of recognition"} 
                value={newShoutout.message} 
                onChange={(e) => setNewShoutout({ ...newShoutout, message: e.target.value })} 
                required 
                rows={3}
                data-testid="shoutout-message-input"
              />
            </div>

            <div>
              <Label>Category</Label>
              <select 
                className="w-full p-2 rounded border" 
                value={newShoutout.category} 
                onChange={(e) => setNewShoutout({ ...newShoutout, category: e.target.value })}
                data-testid="shoutout-category-select"
              >
                <option value="kindness">Kindness</option>
                <option value="achievement">Achievement</option>
                <option value="help">Help</option>
              </select>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg border-2 border-border">
              <input
                type="checkbox"
                id="broadcast-to-all"
                checked={newShoutout.broadcast_to_all}
                onChange={(e) => setNewShoutout({ ...newShoutout, broadcast_to_all: e.target.checked })}
                className="w-5 h-5 rounded mt-0.5"
                data-testid="broadcast-checkbox"
              />
              <div className="flex-1">
                <Label htmlFor="broadcast-to-all" className="cursor-pointer font-semibold text-foreground">
                  📢 Broadcast to All Users
                </Label>
                <p className="text-xs text-primary mt-1">
                  Send this recognition as an announcement so everyone can see it
                </p>
              </div>
            </div>

            <Button type="submit" className="bg-gradient-to-r from-primary to-secondary">
              Send Shoutout
            </Button>
          </form>
        )}

        <div className="space-y-3">
          <h3 className="font-semibold">Recent Shoutouts</h3>
          {shoutouts.map((shoutout, idx) => (
            <div key={idx} data-testid={`shoutout-${idx}`} className="p-4 rounded-xl bg-gradient-to-br from-muted to-muted border-2 border-border">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
                  <Award className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-lg">
                    {shoutout.from_user_name}
                    {shoutout.to_user_name ? (
                      <span> → {shoutout.to_user_name === `${user.first_name} ${user.last_name}` ? 'You' : shoutout.to_user_name}</span>
                    ) : (
                      <span className="text-primary"> → Community</span>
                    )}
                  </div>
                  <div className="text-foreground mt-1">{shoutout.message}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-primary text-white">{shoutout.category}</Badge>
                    <div className="text-xs text-muted-foreground">{new Date(shoutout.created_at).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {shoutouts.length === 0 && <p className="text-muted-foreground text-center py-8">No shoutouts yet. Be the first to send one!</p>}
        </div>
      </Card>
      </div>
    </div>
  );
};

// Move-In Magic Banner Component
const MoveInMagicBanner = () => {
  const { user } = useContext(AuthContext);
  const [data, setData] = useState(null);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [requestType, setRequestType] = useState('move_in_help');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchMoveInData();
  }, []);

  const fetchMoveInData = async () => {
    try {
      const response = await axios.get(`${API}/move-in-magic/data`);
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch move-in data', error);
    }
  };

  const submitStaffRequest = async () => {
    try {
      await axios.post(`${API}/move-in-magic/staff-request`, {
        request_type: requestType,
        message: message
      });
      toast.success('Your help request has been submitted! Staff will respond shortly.');
      setShowStaffForm(false);
      setMessage('');
      setRequestType('move_in_help');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit request');
    }
  };

  // Only show Move-In Magic for students, not RAs or admins
  if (!data || user?.role === 'ra' || user?.role === 'admin') return null;

  return (
    <Card className="p-6 glass border-4 border-border bg-gradient-to-r from-muted to-background" data-testid="move-in-banner">
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-2xl flex-shrink-0">
          🏠
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-2xl mb-2 gradient-text">Move-In Magic ✨</h3>
          <p className="text-foreground whitespace-pre-line mb-4">{data.welcome_message}</p>

          {/* Pre-Arrival Modules */}
          <div className="bg-white/70 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-lg mb-3">📚 Complete Before Move-In:</h4>
            <p className="text-sm text-muted-foreground mb-3">Please complete these required modules before your arrival</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href="#module1"
                className="flex items-center gap-3 p-3 bg-white rounded-lg border-2 border-border hover:border-border hover:shadow-md transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold flex-shrink-0">
                  1
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm text-foreground">Safety & Security</div>
                  <div className="text-xs text-muted-foreground">15 min</div>
                </div>
              </a>
              
              <a
                href="#module2"
                className="flex items-center gap-3 p-3 bg-white rounded-lg border-2 border-border hover:border-border hover:shadow-md transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold flex-shrink-0">
                  2
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm text-foreground">Community Guidelines</div>
                  <div className="text-xs text-muted-foreground">10 min</div>
                </div>
              </a>
              
              <a
                href="#module3"
                className="flex items-center gap-3 p-3 bg-white rounded-lg border-2 border-border hover:border-border hover:shadow-md transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-destructive flex items-center justify-center text-white font-bold flex-shrink-0">
                  3
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm text-foreground">Wellbeing Resources</div>
                  <div className="text-xs text-muted-foreground">12 min</div>
                </div>
              </a>
              
              <a
                href="#module4"
                className="flex items-center gap-3 p-3 bg-white rounded-lg border-2 border-border hover:border-border hover:shadow-md transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-success to-secondary flex items-center justify-center text-white font-bold flex-shrink-0">
                  4
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm text-foreground">Campus Orientation</div>
                  <div className="text-xs text-muted-foreground">20 min</div>
                </div>
              </a>
            </div>
          </div>

          {/* Things to Bring */}
          <div className="bg-white/70 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-lg mb-3">📦 Things to Bring:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.things_to_bring.map((item, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="text-muted-foreground font-bold">✓</span>
                  <span className="text-sm text-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Floor Map */}
          <div className="bg-white/70 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-lg mb-3">🗺️ Your Floor Map</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Floor: <span className="font-semibold">{data.user_floor || 'Not assigned'}</span> | 
              Room: <span className="font-semibold">{data.user_room || 'Not assigned'}</span>
            </p>
            <img 
              src={data.floor_map_url} 
              alt="Floor Map" 
              className="w-full h-64 object-cover rounded-lg border-2 border-border"
            />
          </div>

          {/* Transport Options */}
          <div className="bg-white/70 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-lg mb-3">🚌 Transport Options:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.transport_options?.map((transport, index) => (
                <div key={index} className="p-3 bg-white rounded-lg border border-border">
                  <div className="font-semibold text-foreground">{transport.name}</div>
                  <div className="text-sm text-muted-foreground mt-1">{transport.description}</div>
                  <div className="text-xs text-muted-foreground mt-2">
                    <div>⏰ {transport.schedule}</div>
                    <div>📞 {transport.contact}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Grocery Stores */}
          <div className="bg-white/70 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-lg mb-3">🛒 Nearby Groceries:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.grocery_stores?.map((store, index) => (
                <div key={index} className="p-3 bg-white rounded-lg border border-border">
                  <div className="font-semibold text-foreground">{store.name}</div>
                  <div className="text-sm text-muted-foreground mt-1">📍 {store.distance}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    <div>🕐 {store.hours}</div>
                    <div className="mt-1 text-foreground">{store.notes}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Popular Venues */}
          <div className="bg-white/70 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-lg mb-3">⭐ Popular Venues:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.popular_venues?.map((venue, index) => (
                <div key={index} className="p-3 bg-white rounded-lg border border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-muted text-foreground text-xs">
                      {venue.category}
                    </Badge>
                  </div>
                  <div className="font-semibold text-foreground">{venue.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">{venue.description}</div>
                  <div className="text-xs text-muted-foreground mt-1">📍 {venue.location}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Contact Staff Button */}
          <div className="flex gap-3">
            <Button 
              onClick={() => setShowStaffForm(!showStaffForm)}
              className="bg-gradient-to-r from-primary to-secondary hover:from-primary hover:to-secondary"
            >
              {showStaffForm ? 'Hide Form' : '🆘 Need Help? Contact Staff'}
            </Button>
          </div>

          {/* Staff Contact Form */}
          {showStaffForm && (
            <div className="mt-4 bg-white/90 rounded-lg p-4 border-2 border-border">
              <h5 className="font-semibold mb-3">Contact Staff for Help</h5>
              <div className="space-y-3">
                <div>
                  <Label>Request Type</Label>
                  <Select value={requestType} onValueChange={setRequestType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="move_in_help">Move-In Help</SelectItem>
                      <SelectItem value="general_inquiry">General Inquiry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Your Message</Label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe how we can help you..."
                    rows={3}
                  />
                </div>
                <Button 
                  onClick={submitStaffRequest}
                  disabled={!message.trim()}
                  className="w-full bg-secondary hover:bg-primary"
                >
                  Submit Request
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

// O-Week Banner Component
const OWeekBanner = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchOWeekData();
  }, []);

  const fetchOWeekData = async () => {
    try {
      const response = await axios.get(`${API}/o-week/data`);
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch o-week data', error);
    }
  };

  if (!data) return null;

  return (
    <Card className="p-6 glass border-4 border-primary/30 bg-gradient-to-r from-muted to-muted" data-testid="o-week-banner">
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-2xl flex-shrink-0">
          🎊
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-2xl mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            O-Week Activities
          </h3>
          <p className="text-foreground whitespace-pre-line mb-4">{data.welcome_message}</p>

          {/* Activities Schedule */}
          <div className="bg-white/70 rounded-lg p-4">
            <h4 className="font-semibold text-lg mb-3">📅 Schedule:</h4>
            <div className="space-y-3">
              {data.activities.map((activity) => (
                <div 
                  key={activity.id} 
                  className="border-l-4 border-primary/30 pl-4 py-2 bg-white/50 rounded-r-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-foreground">{activity.name}</div>
                      <div className="text-sm text-muted-foreground mt-1">{activity.description}</div>
                      <div className="flex items-center gap-3 mt-2">
                        <Badge className="bg-muted text-primary">
                          {activity.date || activity.activity_type}
                        </Badge>
                        {activity.points > 0 && (
                          <span className="text-xs text-muted-foreground">+{activity.points} points</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

// O-Week Module

export default RecognitionModule;
