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

const AcademicsModule = () => {
  const { user } = useContext(AuthContext);
  const [studyGroups, setStudyGroups] = useState([]);
  const [tutoring, setTutoring] = useState([]);
  const [approvedTutors, setApprovedTutors] = useState([]);
  const [myApplication, setMyApplication] = useState(null);
  const [pendingApplications, setPendingApplications] = useState([]);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [showTutoringForm, setShowTutoringForm] = useState(false);
  const [showTutorForm, setShowTutorForm] = useState(false);
  const [showGroupChat, setShowGroupChat] = useState(null);
  const [groupChatMessages, setGroupChatMessages] = useState({});
  const [newChatMessage, setNewChatMessage] = useState({});
  const [newGroup, setNewGroup] = useState({ 
    name: '', 
    subject: '', 
    location: '',
    max_members: 10, 
    meeting_schedule: {
      start_date: '',
      end_date: '',
      frequency: 'weekly',
      day_of_week: 'Monday',
      time: '18:00'
    },
    send_reminders: false,
    reminder_times: []
  });
  const [newTutoring, setNewTutoring] = useState({ subject: '', description: '' });
  const [tutorApplication, setTutorApplication] = useState({
    subjects: [],
    subjectInput: '',
    bio: '',
    available_times: ''
  });

  useEffect(() => {
    fetchStudyGroups();
    fetchTutoring();
    fetchApprovedTutors();
    if (user?.role === 'admin') {
      fetchPendingApplications();
    } else {
      fetchMyApplication();
    }
  }, []);

  const fetchStudyGroups = async () => {
    try {
      const response = await axios.get(`${API}/study-groups`);
      setStudyGroups(response.data);
    } catch (error) {
      console.error('Failed to fetch study groups', error);
    }
  };

  const fetchTutoring = async () => {
    try {
      const response = await axios.get(`${API}/tutoring`);
      setTutoring(response.data);
    } catch (error) {
      console.error('Failed to fetch tutoring', error);
    }
  };

  const fetchApprovedTutors = async () => {
    try {
      const response = await axios.get(`${API}/tutoring/approved`);
      setApprovedTutors(response.data);
    } catch (error) {
      console.error('Failed to fetch tutors', error);
    }
  };

  const fetchMyApplication = async () => {
    try {
      const response = await axios.get(`${API}/tutoring/applications`);
      if (response.data.length > 0) {
        setMyApplication(response.data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch application', error);
    }
  };

  const fetchPendingApplications = async () => {
    try {
      const response = await axios.get(`${API}/tutoring/applications`);
      // Filter for pending applications only
      const pending = response.data.filter(app => app.status === 'pending');
      setPendingApplications(pending);
    } catch (error) {
      console.error('Failed to fetch pending applications', error);
    }
  };

  const reviewApplication = async (applicationId, status) => {
    try {
      await axios.put(`${API}/tutoring/applications/${applicationId}/review?status=${status}`);
      toast.success(`Application ${status}!`);
      fetchPendingApplications();
      fetchApprovedTutors();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to review application');
    }
  };

  const submitTutorApplication = async (e) => {
    e.preventDefault();
    
    // Validation
    if (tutorApplication.subjects.length === 0) {
      toast.error('Please add at least one subject');
      return;
    }
    if (!tutorApplication.available_times.trim()) {
      toast.error('Please enter your available times');
      return;
    }

    try {
      const response = await axios.post(`${API}/tutoring/apply`, {
        subjects: tutorApplication.subjects,
        bio: tutorApplication.bio || '',
        available_times: tutorApplication.available_times
      });
      
      toast.success('Tutor application submitted! Awaiting admin approval.');
      setShowTutorForm(false);
      setTutorApplication({
        subjects: [],
        subjectInput: '',
        bio: '',
        available_times: ''
      });
      fetchMyApplication();
    } catch (error) {
      console.error('Failed to submit application:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to submit application';
      toast.error(errorMessage);
    }
  };

  const addSubject = () => {
    if (tutorApplication.subjectInput.trim() && !tutorApplication.subjects.includes(tutorApplication.subjectInput.trim())) {
      setTutorApplication({
        ...tutorApplication,
        subjects: [...tutorApplication.subjects, tutorApplication.subjectInput.trim()],
        subjectInput: ''
      });
    }
  };

  const removeSubject = (subject) => {
    setTutorApplication({
      ...tutorApplication,
      subjects: tutorApplication.subjects.filter(s => s !== subject)
    });
  };

  const createStudyGroup = async (e) => {
    e.preventDefault();
    try {
      const scheduleText = `${newGroup.meeting_schedule.frequency} on ${newGroup.meeting_schedule.day_of_week}s at ${newGroup.meeting_schedule.time}, from ${new Date(newGroup.meeting_schedule.start_date).toLocaleDateString()} to ${new Date(newGroup.meeting_schedule.end_date).toLocaleDateString()}`;
      
      await axios.post(`${API}/study-groups`, {
        ...newGroup,
        meeting_schedule: scheduleText
      });
      toast.success('Study group created!');
      setShowGroupForm(false);
      setNewGroup({ 
        name: '', 
        subject: '', 
        location: '',
        max_members: 10, 
        meeting_schedule: {
          start_date: '',
          end_date: '',
          frequency: 'weekly',
          day_of_week: 'Monday',
          time: '18:00'
        },
        send_reminders: false,
        reminder_times: []
      });
      fetchStudyGroups();
    } catch (error) {
      toast.error('Failed to create study group');
    }
  };

  const joinGroup = async (groupId) => {
    try {
      await axios.post(`${API}/study-groups/${groupId}/join`);
      toast.success('Joined study group!');
      fetchStudyGroups();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to join group');
    }
  };

  const requestTutoring = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/tutoring`, newTutoring);
      toast.success('Tutoring request submitted!');
      setShowTutoringForm(false);
      setNewTutoring({ subject: '', description: '' });
      fetchTutoring();
    } catch (error) {
      toast.error('Failed to request tutoring');
    }
  };

  const fetchGroupChat = async (messageGroupId, groupId) => {
    if (!messageGroupId) return;
    try {
      const response = await axios.get(`${API}/message-groups/${messageGroupId}/messages`);
      setGroupChatMessages(prev => ({ ...prev, [groupId]: response.data }));
    } catch (error) {
      console.error('Failed to fetch group chat', error);
    }
  };

  const sendGroupChatMessage = async (messageGroupId, groupId) => {
    const message = newChatMessage[groupId]?.trim();
    if (!message) return;

    try {
      await axios.post(`${API}/messages`, {
        group_id: messageGroupId,
        content: message
      });
      setNewChatMessage(prev => ({ ...prev, [groupId]: '' }));
      fetchGroupChat(messageGroupId, groupId);
    } catch (error) {
      toast.error('Failed to send message');
    }
  };

  const toggleGroupChat = (group) => {
    if (showGroupChat === group.id) {
      setShowGroupChat(null);
    } else {
      setShowGroupChat(group.id);
      if (group.message_group_id) {
        fetchGroupChat(group.message_group_id, group.id);
      }
    }
  };

  const startTutorChat = async (tutorId) => {
    try {
      const response = await axios.post(`${API}/tutoring/start-chat/${tutorId}`);
      const messageGroupId = response.data.message_group_id;
      
      // Navigate to messages with this chat open
      toast.success('Opening chat with tutor...');
      // For now, just show success. In a full implementation, you'd navigate to the messages module
      // or open a chat modal
      window.location.href = '#/dashboard?module=messages';
    } catch (error) {
      toast.error('Failed to start chat with tutor');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ModuleHeader
        title="Academics"
        showBack={true}
        showSearch={false}
      />
      <div className="px-4 pt-4 pb-4 space-y-4">

      <h2 className="heading-font text-3xl font-bold">Academics</h2>

      {/* Admin: Pending Tutor Applications */}
      {user?.role === 'admin' && pendingApplications.length > 0 && (
        <Card className="p-6 glass border-2 border-primary/30 bg-muted/50">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            Pending Tutor Applications ({pendingApplications.length})
          </h3>
          <div className="space-y-3">
            {pendingApplications.map((app) => (
              <div key={app.id} className="p-4 bg-white rounded-lg border-2 border-border">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-foreground">{app.student_name}</div>
                    <div className="text-sm text-muted-foreground">{app.student_email}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Applied: {new Date(app.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge className="bg-warning/10 text-warning">Pending</Badge>
                </div>

                <div className="mb-3">
                  <div className="text-sm font-semibold text-foreground mb-1">Subjects:</div>
                  <div className="flex flex-wrap gap-1">
                    {app.subjects.map((subject, idx) => (
                      <Badge key={idx} className="bg-muted text-primary text-xs">
                        {subject}
                      </Badge>
                    ))}
                  </div>
                </div>

                {app.bio && (
                  <div className="mb-3">
                    <div className="text-sm font-semibold text-foreground mb-1">Bio:</div>
                    <p className="text-sm text-muted-foreground">{app.bio}</p>
                  </div>
                )}

                <div className="mb-3">
                  <div className="text-sm font-semibold text-foreground mb-1">Available Times:</div>
                  <p className="text-sm text-muted-foreground">{app.available_times}</p>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => reviewApplication(app.id, 'approved')}
                    className="bg-success hover:bg-success"
                  >
                    ✓ Approve
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => reviewApplication(app.id, 'rejected')}
                    variant="destructive"
                  >
                    ✗ Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Study Groups */}
      <Card className="p-6 glass">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Study Groups</h3>
            <Button size="sm" onClick={() => setShowGroupForm(!showGroupForm)} data-testid="create-study-group-btn">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {showGroupForm && (
            <form onSubmit={createStudyGroup} className="space-y-4 mb-4 p-4 bg-white/50 rounded-xl" data-testid="study-group-form">
              <div>
                <Label>Group Name</Label>
                <Input 
                  placeholder="e.g., Calculus Study Group" 
                  value={newGroup.name} 
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })} 
                  required 
                />
              </div>
              <div>
                <Label>Subject</Label>
                <Input 
                  placeholder="e.g., Math, Physics" 
                  value={newGroup.subject} 
                  onChange={(e) => setNewGroup({ ...newGroup, subject: e.target.value })} 
                  required 
                />
              </div>
              <div>
                <Label>Location</Label>
                <Input 
                  placeholder="e.g., Library Room 203, Student Center" 
                  value={newGroup.location} 
                  onChange={(e) => setNewGroup({ ...newGroup, location: e.target.value })} 
                  required
                  data-testid="group-location-input"
                />
              </div>
              <div>
                <Label>Maximum Members</Label>
                <Input 
                  type="number" 
                  placeholder="Maximum number of students" 
                  value={newGroup.max_members} 
                  onChange={(e) => setNewGroup({ ...newGroup, max_members: parseInt(e.target.value) })}
                  min="2"
                  max="50"
                />
              </div>
              
              <div className="border-t pt-4">
                <Label className="text-base font-semibold mb-3 block">Meeting Schedule</Label>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm">Start Date</Label>
                    <Input 
                      type="date" 
                      value={newGroup.meeting_schedule.start_date}
                      onChange={(e) => setNewGroup({ 
                        ...newGroup, 
                        meeting_schedule: { ...newGroup.meeting_schedule, start_date: e.target.value }
                      })}
                      required
                      data-testid="schedule-start-date"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">End Date</Label>
                    <Input 
                      type="date" 
                      value={newGroup.meeting_schedule.end_date}
                      onChange={(e) => setNewGroup({ 
                        ...newGroup, 
                        meeting_schedule: { ...newGroup.meeting_schedule, end_date: e.target.value }
                      })}
                      required
                      data-testid="schedule-end-date"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <Label className="text-sm">Frequency</Label>
                    <select 
                      className="w-full p-2 rounded border"
                      value={newGroup.meeting_schedule.frequency}
                      onChange={(e) => setNewGroup({ 
                        ...newGroup, 
                        meeting_schedule: { ...newGroup.meeting_schedule, frequency: e.target.value }
                      })}
                      data-testid="schedule-frequency"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Bi-weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-sm">Day of Week</Label>
                    <select 
                      className="w-full p-2 rounded border"
                      value={newGroup.meeting_schedule.day_of_week}
                      onChange={(e) => setNewGroup({ 
                        ...newGroup, 
                        meeting_schedule: { ...newGroup.meeting_schedule, day_of_week: e.target.value }
                      })}
                      data-testid="schedule-day"
                    >
                      <option value="Monday">Monday</option>
                      <option value="Tuesday">Tuesday</option>
                      <option value="Wednesday">Wednesday</option>
                      <option value="Thursday">Thursday</option>
                      <option value="Friday">Friday</option>
                      <option value="Saturday">Saturday</option>
                      <option value="Sunday">Sunday</option>
                    </select>
                  </div>
                </div>

                <div className="mt-3">
                  <Label className="text-sm">Meeting Time</Label>
                  <Input 
                    type="time" 
                    value={newGroup.meeting_schedule.time}
                    onChange={(e) => setNewGroup({ 
                      ...newGroup, 
                      meeting_schedule: { ...newGroup.meeting_schedule, time: e.target.value }
                    })}
                    required
                    data-testid="schedule-time"
                  />
                </div>
              </div>

              {/* Reminder Options */}
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="send-reminders"
                    checked={newGroup.send_reminders}
                    onChange={(e) => setNewGroup({ ...newGroup, send_reminders: e.target.checked })}
                    className="w-4 h-4 rounded"
                    data-testid="send-reminders-checkbox"
                  />
                  <Label htmlFor="send-reminders" className="text-base font-semibold cursor-pointer">
                    Send reminders to participants
                  </Label>
                </div>

                {newGroup.send_reminders && (
                  <div className="ml-6 space-y-2">
                    <p className="text-sm text-muted-foreground mb-2">When to send reminders:</p>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newGroup.reminder_times.includes('1_day_before')}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewGroup({ ...newGroup, reminder_times: [...newGroup.reminder_times, '1_day_before'] });
                            } else {
                              setNewGroup({ ...newGroup, reminder_times: newGroup.reminder_times.filter(t => t !== '1_day_before') });
                            }
                          }}
                          className="w-4 h-4 rounded"
                          data-testid="reminder-1-day"
                        />
                        <span className="text-sm">1 day before</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newGroup.reminder_times.includes('2_hours_before')}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewGroup({ ...newGroup, reminder_times: [...newGroup.reminder_times, '2_hours_before'] });
                            } else {
                              setNewGroup({ ...newGroup, reminder_times: newGroup.reminder_times.filter(t => t !== '2_hours_before') });
                            }
                          }}
                          className="w-4 h-4 rounded"
                          data-testid="reminder-2-hours"
                        />
                        <span className="text-sm">2 hours before</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newGroup.reminder_times.includes('1_hour_before')}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewGroup({ ...newGroup, reminder_times: [...newGroup.reminder_times, '1_hour_before'] });
                            } else {
                              setNewGroup({ ...newGroup, reminder_times: newGroup.reminder_times.filter(t => t !== '1_hour_before') });
                            }
                          }}
                          className="w-4 h-4 rounded"
                          data-testid="reminder-1-hour"
                        />
                        <span className="text-sm">1 hour before</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <Button type="submit" size="sm" className="w-full bg-gradient-to-r from-primary to-secondary">
                Create Group
              </Button>
            </form>
          )}

          <div className="space-y-3">
            {studyGroups.map((group, idx) => {
              const isMember = group.members && group.members.includes(user?.id);
              const isFull = group.members?.length >= group.max_members;
              
              return (
                <div key={idx} data-testid={`study-group-${idx}`} className="p-4 rounded-lg bg-white border border-border">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-semibold text-lg">{group.name}</div>
                      <div className="text-sm text-muted-foreground">{group.subject}</div>
                    </div>
                    {!isMember && !isFull && (
                      <Button 
                        size="sm" 
                        className="bg-gradient-to-r from-primary to-secondary" 
                        onClick={() => joinGroup(group.id)} 
                        data-testid={`join-group-${idx}-btn`}
                      >
                        Join
                      </Button>
                    )}
                    {isMember && (
                      <Badge className="bg-success text-white">Joined</Badge>
                    )}
                    {!isMember && isFull && (
                      <Badge className="bg-destructive/50 text-white">Full</Badge>
                    )}
                  </div>
                  
                  {group.location && (
                    <div className="text-xs text-muted-foreground mt-1">
                      📍 {group.location}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    👥 {group.members?.length || 0} / {group.max_members} members
                  </div>
                  {group.meeting_schedule && (
                    <div className="text-xs text-muted-foreground mt-1">
                      📅 {group.meeting_schedule}
                    </div>
                  )}

                  {/* Group Chat for Members */}
                  {isMember && group.message_group_id && (
                    <div className="mt-3 pt-3 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleGroupChat(group)}
                        className="w-full"
                      >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        {showGroupChat === group.id ? 'Hide Group Chat' : 'Open Group Chat'}
                      </Button>

                      {showGroupChat === group.id && (
                        <div className="mt-3 border rounded-lg p-3 bg-muted">
                          <h4 className="font-semibold mb-2 text-sm">Group Chat</h4>
                          
                          {/* Messages */}
                          <div className="h-48 overflow-y-auto mb-2 space-y-2 bg-white rounded p-2">
                            {groupChatMessages[group.id]?.length > 0 ? (
                              groupChatMessages[group.id].map((msg, msgIdx) => (
                                <div
                                  key={msgIdx}
                                  className={`p-2 rounded-lg text-sm ${
                                    msg.sender_id === user?.id
                                      ? 'bg-muted ml-6'
                                      : msg.sender_id === 'system'
                                      ? 'bg-warning/10 text-center italic'
                                      : 'bg-muted mr-6'
                                  }`}
                                >
                                  {msg.sender_id !== 'system' && (
                                    <div className="text-xs font-semibold text-muted-foreground mb-1">
                                      {msg.sender_name}
                                    </div>
                                  )}
                                  <div className="text-sm">{msg.content}</div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {new Date(msg.timestamp).toLocaleString()}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-center text-muted-foreground text-sm py-6">
                                No messages yet. Start the conversation!
                              </div>
                            )}
                          </div>

                          {/* Message Input */}
                          <div className="flex gap-2">
                            <Input
                              placeholder="Type a message..."
                              value={newChatMessage[group.id] || ''}
                              onChange={(e) =>
                                setNewChatMessage(prev => ({ ...prev, [group.id]: e.target.value }))
                              }
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  sendGroupChatMessage(group.message_group_id, group.id);
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              onClick={() => sendGroupChatMessage(group.message_group_id, group.id)}
                              className="bg-gradient-to-r from-primary to-secondary"
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
      </Card>

      {/* Available Tutors Section */}
      <Card className="p-6 glass">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Available Tutors</h3>
          {!myApplication && (
            <Button 
              size="sm" 
              onClick={() => setShowTutorForm(!showTutorForm)}
              className="bg-gradient-to-r from-primary to-secondary"
            >
              <Plus className="h-4 w-4 mr-2" />
              Offer Tutoring
            </Button>
          )}
          {myApplication && (
            <Badge className={
              myApplication.status === 'pending' ? 'bg-warning/10 text-warning' :
              myApplication.status === 'approved' ? 'bg-success/10 text-success' :
              'bg-destructive/10 text-destructive'
            }>
              Your Application: {myApplication.status}
            </Badge>
          )}
        </div>

        {/* Offer Tutoring Form */}
        {showTutorForm && (
          <div className="mb-4 p-4 bg-muted rounded-lg border-2 border-border">
            <h4 className="font-semibold mb-3">Apply to Become a Tutor</h4>
            <form onSubmit={submitTutorApplication} className="space-y-4">
              <div>
                <Label>Subjects You Can Tutor</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    placeholder="Enter a subject (e.g., Mathematics)"
                    value={tutorApplication.subjectInput}
                    onChange={(e) => setTutorApplication({...tutorApplication, subjectInput: e.target.value})}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSubject();
                      }
                    }}
                  />
                  <Button type="button" onClick={addSubject} size="sm">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tutorApplication.subjects.map((subject, idx) => (
                    <Badge key={idx} className="bg-muted text-primary flex items-center gap-1">
                      {subject}
                      <button
                        type="button"
                        onClick={() => removeSubject(subject)}
                        className="ml-1 hover:text-foreground"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>Bio (Optional)</Label>
                <Textarea
                  placeholder="Tell students about your experience and teaching style..."
                  value={tutorApplication.bio}
                  onChange={(e) => setTutorApplication({...tutorApplication, bio: e.target.value})}
                  rows={3}
                />
              </div>

              <div>
                <Label>Available Times</Label>
                <Input
                  placeholder="e.g., Mon/Wed 3-5pm, Fri 2-4pm"
                  value={tutorApplication.available_times}
                  onChange={(e) => setTutorApplication({...tutorApplication, available_times: e.target.value})}
                  required
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  disabled={tutorApplication.subjects.length === 0 || !tutorApplication.available_times}
                  className="bg-primary hover:bg-primary"
                >
                  Submit Application
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowTutorForm(false);
                    setTutorApplication({
                      subjects: [],
                      subjectInput: '',
                      bio: '',
                      available_times: ''
                    });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Approved Tutors List */}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {approvedTutors.length > 0 ? (
            approvedTutors.map((tutor) => (
              <div key={tutor.id} className="flex-shrink-0 w-80 p-4 rounded-lg bg-white/50 border-2 border-border">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-lg text-foreground">{tutor.student_name}</div>
                    <div className="text-sm text-muted-foreground">{tutor.student_email}</div>
                  </div>
                  <Badge className="bg-muted text-primary">Tutor</Badge>
                </div>
                
                <div className="mt-3">
                  <div className="text-sm font-semibold text-foreground mb-1">Subjects:</div>
                  <div className="flex flex-wrap gap-1">
                    {tutor.subjects.map((subject, idx) => (
                      <Badge key={idx} className="bg-muted text-foreground text-xs">
                        {subject}
                      </Badge>
                    ))}
                  </div>
                </div>

                {tutor.bio && (
                  <div className="mt-3">
                    <div className="text-sm font-semibold text-foreground mb-1">About:</div>
                    <p className="text-sm text-muted-foreground">{tutor.bio}</p>
                  </div>
                )}

                <div className="mt-3">
                  <div className="text-sm font-semibold text-foreground mb-1">⏰ Available:</div>
                  <p className="text-sm text-muted-foreground">{tutor.available_times}</p>
                </div>

                <Button 
                  size="sm" 
                  className="w-full mt-3 bg-gradient-to-r from-primary to-secondary"
                  onClick={() => startTutorChat(tutor.student_id)}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Send Message to Tutor
                </Button>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-center py-8 w-full">
              No tutors available yet. Be the first to offer tutoring services!
            </p>
          )}
        </div>
      </Card>

      {/* Tutoring Requests */}
      <Card className="p-6 glass">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Tutoring Requests</h3>
          <Button size="sm" onClick={() => setShowTutoringForm(!showTutoringForm)} data-testid="request-tutoring-btn">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {showTutoringForm && (
          <form onSubmit={requestTutoring} className="space-y-3 mb-4" data-testid="tutoring-form">
            <Input placeholder="Subject" value={newTutoring.subject} onChange={(e) => setNewTutoring({ ...newTutoring, subject: e.target.value })} required />
            <Textarea placeholder="Describe what you need help with" value={newTutoring.description} onChange={(e) => setNewTutoring({ ...newTutoring, description: e.target.value })} required />
            <Button type="submit" size="sm">Request Tutoring</Button>
          </form>
        )}

        <div className="space-y-3">
          {tutoring.map((req, idx) => (
            <div key={idx} data-testid={`tutoring-${idx}`} className="p-3 rounded-lg bg-white/50">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{req.subject}</div>
                <Badge className={req.status === 'pending' ? 'bg-warning' : 'bg-success'}>{req.status}</Badge>
              </div>
              <div className="text-sm text-muted-foreground mt-1">{req.description}</div>
            </div>
          ))}
        </div>
      </Card>
      </div>
    </div>
  );
};

// Wellbeing Module
// Co-Curricular Parent Module

export default AcademicsModule;
