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

const HousesModule = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [floorEvents, setFloorEvents] = useState([]);
  const [floorGroups, setFloorGroups] = useState([]);
  const [floorUsers, setFloorUsers] = useState([]);
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const [floorSurveys, setFloorSurveys] = useState([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showCreateSurvey, setShowCreateSurvey] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [surveyResponses, setSurveyResponses] = useState({});
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [isFloorWide, setIsFloorWide] = useState(true);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [newContact, setNewContact] = useState({
    name: '',
    role: 'ra',
    phone: '',
    email: '',
    available_hours: ''
  });
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    date: '',
    location: '',
    max_attendees: ''
  });
  const [newSurvey, setNewSurvey] = useState({
    title: '',
    description: '',
    questions: [''],
    question_type: 'free_form', // 'free_form' or 'poll'
    poll_options: [''],
    closes_at: ''
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [surveyAnswers, setSurveyAnswers] = useState({});

  useEffect(() => {
    fetchFloorEvents();
    fetchFloorGroups();
    fetchFloorUsers();
    fetchEmergencyContacts();
    fetchFloorSurveys();
  }, []);

  const fetchFloorEvents = async () => {
    try {
      const response = await axios.get(`${API}/floor-events`);
      setFloorEvents(response.data);
    } catch (error) {
      console.error('Failed to fetch floor events', error);
    }
  };

  const fetchFloorGroups = async () => {
    try {
      const response = await axios.get(`${API}/floor-message-groups`);
      setFloorGroups(response.data);
    } catch (error) {
      console.error('Failed to fetch floor groups', error);
    }
  };

  const fetchFloorUsers = async () => {
    try {
      const response = await axios.get(`${API}/floor/users`);
      setFloorUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch floor users', error);
    }
  };

  const fetchEmergencyContacts = async () => {
    try {
      const response = await axios.get(`${API}/emergency-contacts`);
      setEmergencyContacts(response.data);
    } catch (error) {
      console.error('Failed to fetch emergency contacts', error);
    }
  };

  const createFloorGroup = async () => {
    try {
      await axios.post(`${API}/floor-message-groups`, {
        name: groupName,
        floor: user.floor,
        description: groupDescription,
        member_ids: isFloorWide ? [] : selectedMembers,
        is_floor_wide: isFloorWide
      });
      toast.success('Floor group created!');
      setShowCreateGroup(false);
      setGroupName('');
      setGroupDescription('');
      setIsFloorWide(true);
      setSelectedMembers([]);
      fetchFloorGroups();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create group');
    }
  };

  const createFloorEvent = async () => {
    if (!newEvent.title || !newEvent.date || !newEvent.location) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await axios.post(`${API}/floor-events`, {
        title: newEvent.title,
        description: newEvent.description,
        date: new Date(newEvent.date).toISOString(),
        location: newEvent.location,
        max_attendees: newEvent.max_attendees ? parseInt(newEvent.max_attendees) : null
      });
      toast.success('Floor event created!');
      setShowCreateEvent(false);
      setNewEvent({ title: '', description: '', date: '', location: '', max_attendees: '' });
      fetchFloorEvents();
    } catch (error) {
      console.error('Floor event creation error:', error);
      toast.error(error.response?.data?.detail || 'Failed to create event');
    }
  };

  const rsvpToEvent = async (eventId) => {
    try {
      await axios.post(`${API}/floor-events/${eventId}/rsvp`);
      toast.success('RSVP confirmed!');
      fetchFloorEvents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to RSVP');
    }
  };

  const fetchFloorSurveys = async () => {
    try {
      const response = await axios.get(`${API}/floor-surveys`);
      setFloorSurveys(response.data);
    } catch (error) {
      console.error('Failed to fetch floor surveys', error);
    }
  };

  const createFloorSurvey = async () => {
    if (!newSurvey.title || newSurvey.questions.filter(q => q.trim()).length === 0) {
      toast.error('Please provide a title and at least one question');
      return;
    }

    if (newSurvey.question_type === 'poll' && newSurvey.poll_options.filter(o => o.trim()).length < 2) {
      toast.error('Please provide at least 2 poll options');
      return;
    }
    
    try {
      await axios.post(`${API}/floor-surveys`, {
        target_floor: user.floor,
        title: newSurvey.title,
        description: newSurvey.description,
        questions: newSurvey.questions.filter(q => q.trim()),
        question_type: newSurvey.question_type,
        poll_options: newSurvey.question_type === 'poll' ? newSurvey.poll_options.filter(o => o.trim()) : null,
        closes_at: newSurvey.closes_at || null
      });
      toast.success('Survey created!');
      setShowCreateSurvey(false);
      setNewSurvey({ title: '', description: '', questions: [''], question_type: 'free_form', poll_options: [''], closes_at: '' });
      fetchFloorSurveys();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create survey');
    }
  };

  const submitSurveyResponse = async (surveyId) => {
    const answers = surveyAnswers[surveyId];
    if (!answers || Object.keys(answers).length === 0) {
      toast.error('Please answer all questions');
      return;
    }

    try {
      await axios.post(`${API}/floor-surveys/${surveyId}/respond`, {
        survey_id: surveyId,
        answers: Object.values(answers)
      });
      toast.success('Response submitted!');
      setSelectedSurvey(null);
      setSurveyAnswers({ ...surveyAnswers, [surveyId]: {} });
      fetchFloorSurveys();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit response');
    }
  };

  const viewSurveyResponses = async (surveyId) => {
    try {
      const response = await axios.get(`${API}/floor-surveys/${surveyId}/responses`);
      setSurveyResponses({ ...surveyResponses, [surveyId]: response.data });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to fetch responses');
    }
  };

  const toggleMemberSelection = (userId) => {
    setSelectedMembers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const addEmergencyContact = async () => {
    try {
      await axios.post(`${API}/emergency-contacts`, newContact);
      toast.success('Emergency contact added!');
      setShowAddContact(false);
      setNewContact({ name: '', role: 'ra', phone: '', email: '', available_hours: '' });
      fetchEmergencyContacts();
    } catch (error) {
      toast.error('Failed to add emergency contact');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ModuleHeader
        title="Floor"
        showBack={true}
        showSearch={false}
      />
      <div className="px-4 pt-4 pb-4 space-y-4">

      <div className="flex items-center justify-between">
        <div>
          <h2 className="heading-font text-3xl font-bold">Floor - {user?.floor || 'Not Assigned'}</h2>
          <p className="text-muted-foreground">Manage your floor community</p>
        </div>
      </div>

      {/* Floor Message Groups */}
      <Card className="p-6 glass">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Floor Message Groups</h3>
          <Button 
            onClick={() => setShowCreateGroup(!showCreateGroup)}
            className="bg-gradient-to-r from-primary to-secondary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Group
          </Button>
        </div>

        {showCreateGroup && (
          <div className="mb-4 p-4 bg-white/70 rounded-lg border-2 border-border">
            <h4 className="font-semibold mb-3">Create Floor Message Group</h4>
            <div className="space-y-3">
              <div>
                <Label>Group Name</Label>
                <Input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g., Level 3 All Residents"
                />
              </div>
              <div>
                <Label>Description (Optional)</Label>
                <Textarea
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="What is this group for?"
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="floor-wide"
                  checked={isFloorWide}
                  onChange={(e) => {
                    setIsFloorWide(e.target.checked);
                    if (e.target.checked) setSelectedMembers([]);
                  }}
                  className="rounded"
                />
                <Label htmlFor="floor-wide">Include all floor members (auto-populate)</Label>
              </div>

              {!isFloorWide && (
                <div>
                  <Label>Select Members</Label>
                  <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                    {floorUsers.map((floorUser) => (
                      <div key={floorUser.id} className="flex items-center gap-2 p-2 hover:bg-muted rounded">
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(floorUser.id)}
                          onChange={() => toggleMemberSelection(floorUser.id)}
                          className="rounded"
                        />
                        <span className="text-sm">
                          {floorUser.first_name} {floorUser.last_name} ({floorUser.role})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button 
                  onClick={createFloorGroup}
                  disabled={!groupName.trim()}
                  className="bg-secondary hover:bg-primary"
                >
                  Create Group
                </Button>
                <Button 
                  onClick={() => {
                    setShowCreateGroup(false);
                    setGroupName('');
                    setGroupDescription('');
                    setIsFloorWide(true);
                    setSelectedMembers([]);
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {floorGroups.map((group) => (
            <div 
              key={group.id} 
              className="p-4 bg-white/50 rounded-lg hover:bg-white/70 transition-colors cursor-pointer"
              onClick={() => navigate(`/dashboard/messages?group=${group.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-semibold">{group.name}</div>
                  {group.description && (
                    <div className="text-sm text-muted-foreground mt-1">{group.description}</div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-muted text-foreground">
                      {group.is_floor_wide ? 'All Floor' : `${group.members.length} members`}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      by {group.created_by_name}
                    </span>
                  </div>
                </div>
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          ))}
          {floorGroups.length === 0 && (
            <p className="text-muted-foreground text-center py-4">No floor message groups yet. Create one to get started!</p>
          )}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Floor Events */}
        <Card className="p-6 glass">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Floor Events</h3>
            {user?.role === 'ra' && (
              <Button 
                onClick={() => setShowCreateEvent(!showCreateEvent)}
                size="sm"
                className="bg-primary hover:bg-primary"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Event
              </Button>
            )}
          </div>

          {showCreateEvent && user?.role === 'ra' && (
            <div className="mb-4 p-3 bg-white/70 rounded-lg border-2 border-border">
              <h4 className="font-semibold mb-2 text-sm">Create Floor Event</h4>
              <div className="space-y-2">
                <Input
                  placeholder="Event Title"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                />
                <Textarea
                  placeholder="Description"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                  rows={2}
                />
                <Input
                  type="datetime-local"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                />
                <Input
                  placeholder="Location"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({...newEvent, location: e.target.value})}
                />
                <Input
                  type="number"
                  placeholder="Max Attendees (optional)"
                  value={newEvent.max_attendees}
                  onChange={(e) => setNewEvent({...newEvent, max_attendees: e.target.value})}
                />
                <div className="flex gap-2">
                  <Button 
                    onClick={createFloorEvent}
                    size="sm"
                    disabled={!newEvent.title || !newEvent.date || !newEvent.location}
                  >
                    Create
                  </Button>
                  <Button 
                    onClick={() => {
                      setShowCreateEvent(false);
                      setNewEvent({ title: '', description: '', date: '', location: '', max_attendees: '' });
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {floorEvents.map((event) => (
              <div key={event.id} className="p-3 rounded-lg bg-white/50">
                <div className="font-semibold">{event.title}</div>
                <div className="text-sm text-muted-foreground">{event.description}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  📍 {event.location} • {new Date(event.date).toLocaleString()}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className="bg-muted text-primary">
                    {event.attendees?.length || 0} attending
                  </Badge>
                  {!event.attendees?.includes(user?.id) && (
                    <Button 
                      size="sm" 
                      onClick={() => rsvpToEvent(event.id)}
                      className="h-6 text-xs"
                    >
                      RSVP
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {floorEvents.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-4">No floor events scheduled</p>
            )}
          </div>
        </Card>

        {/* Floor Surveys */}
        <Card className="p-6 glass">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Floor Surveys</h3>
            {user?.role === 'ra' && (
              <Button 
                onClick={() => setShowCreateSurvey(!showCreateSurvey)}
                className="bg-gradient-to-r from-primary to-secondary"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Survey
              </Button>
            )}
          </div>

          {/* Create Survey Form (RA Only) */}
          {showCreateSurvey && user?.role === 'ra' && (
            <div className="mb-4 p-4 bg-white/70 rounded-lg border-2 border-border">
              <h4 className="font-semibold mb-3">Create Floor Survey</h4>
              <div className="space-y-3">
                <div>
                  <Label>Survey Title</Label>
                  <Input
                    value={newSurvey.title}
                    onChange={(e) => setNewSurvey({ ...newSurvey, title: e.target.value })}
                    placeholder="e.g., Floor Event Preferences"
                  />
                </div>
                <div>
                  <Label>Description (Optional)</Label>
                  <Textarea
                    value={newSurvey.description}
                    onChange={(e) => setNewSurvey({ ...newSurvey, description: e.target.value })}
                    placeholder="What is this survey about?"
                    rows={2}
                  />
                </div>
                {/* Survey Type Selection */}
                <div>
                  <Label>Survey Type</Label>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="question_type"
                        checked={newSurvey.question_type === 'free_form'}
                        onChange={() => setNewSurvey({ ...newSurvey, question_type: 'free_form' })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Free Form Answers</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="question_type"
                        checked={newSurvey.question_type === 'poll'}
                        onChange={() => setNewSurvey({ ...newSurvey, question_type: 'poll' })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Poll (Multiple Choice)</span>
                    </label>
                  </div>
                </div>

                <div>
                  <Label>Questions</Label>
                  {newSurvey.questions.map((question, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <Input
                        value={question}
                        onChange={(e) => {
                          const updatedQuestions = [...newSurvey.questions];
                          updatedQuestions[index] = e.target.value;
                          setNewSurvey({ ...newSurvey, questions: updatedQuestions });
                        }}
                        placeholder={`Question ${index + 1}`}
                      />
                      {index > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const updatedQuestions = newSurvey.questions.filter((_, i) => i !== index);
                            setNewSurvey({ ...newSurvey, questions: updatedQuestions });
                          }}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewSurvey({ ...newSurvey, questions: [...newSurvey.questions, ''] })}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Question
                  </Button>
                </div>

                {/* Poll Options (only if poll type selected) */}
                {newSurvey.question_type === 'poll' && (
                  <div>
                    <Label>Poll Options</Label>
                    {newSurvey.poll_options.map((option, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <Input
                          value={option}
                          onChange={(e) => {
                            const updatedOptions = [...newSurvey.poll_options];
                            updatedOptions[index] = e.target.value;
                            setNewSurvey({ ...newSurvey, poll_options: updatedOptions });
                          }}
                          placeholder={`Option ${index + 1}`}
                        />
                        {index > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const updatedOptions = newSurvey.poll_options.filter((_, i) => i !== index);
                              setNewSurvey({ ...newSurvey, poll_options: updatedOptions });
                            }}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setNewSurvey({ ...newSurvey, poll_options: [...newSurvey.poll_options, ''] })}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Option
                    </Button>
                  </div>
                )}

                <div>
                  <Label>Closes At (Optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="datetime-local"
                      value={newSurvey.closes_at}
                      onChange={(e) => setNewSurvey({ ...newSurvey, closes_at: e.target.value })}
                      onFocus={() => setShowDatePicker(true)}
                      className="flex-1"
                    />
                    {showDatePicker && newSurvey.closes_at && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setShowDatePicker(false);
                          toast.success('Date and time set!');
                        }}
                        className="bg-success hover:bg-success"
                      >
                        ✓
                      </Button>
                    )}
                  </div>
                  {newSurvey.closes_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Closes: {new Date(newSurvey.closes_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button onClick={createFloorSurvey} className="bg-gradient-to-r from-primary to-secondary">
                    Create Survey
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setShowCreateSurvey(false);
                    setShowDatePicker(false);
                    setNewSurvey({ title: '', description: '', questions: [''], question_type: 'free_form', poll_options: [''], closes_at: '' });
                  }}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Survey List */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {floorSurveys.map((survey) => (
              <div key={survey.id} className="p-4 rounded-lg bg-white/50 border-l-4 border-primary">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground">{survey.title}</h4>
                    {survey.description && (
                      <p className="text-sm text-muted-foreground mt-1">{survey.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Created by {survey.created_by_name} • {new Date(survey.created_at).toLocaleDateString()}
                    </p>
                    {survey.closes_at && (
                      <p className="text-xs text-muted-foreground">
                        Closes: {new Date(survey.closes_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  {user?.role === 'student' && (
                    <Button
                      size="sm"
                      onClick={() => setSelectedSurvey(survey.id === selectedSurvey ? null : survey.id)}
                      className="bg-gradient-to-r from-primary to-secondary"
                    >
                      {selectedSurvey === survey.id ? 'Cancel' : 'Respond'}
                    </Button>
                  )}
                  {user?.role === 'ra' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        viewSurveyResponses(survey.id);
                        setSelectedSurvey(survey.id === selectedSurvey ? null : survey.id);
                      }}
                    >
                      {selectedSurvey === survey.id ? 'Hide' : 'View Responses'}
                    </Button>
                  )}
                </div>

                {/* Response Form (Students) */}
                {selectedSurvey === survey.id && user?.role === 'student' && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <h5 className="font-semibold mb-3 text-sm">Your Responses:</h5>
                    <div className="space-y-3">
                      {survey.questions.map((question, index) => (
                        <div key={index}>
                          <Label className="text-sm font-semibold">{index + 1}. {question}</Label>
                          
                          {/* Poll Type - Clickable Options */}
                          {survey.question_type === 'poll' && survey.poll_options && (
                            <div className="mt-2 space-y-2">
                              {survey.poll_options.map((option, optIndex) => (
                                <button
                                  key={optIndex}
                                  onClick={() => {
                                    setSurveyAnswers({
                                      ...surveyAnswers,
                                      [survey.id]: {
                                        ...surveyAnswers[survey.id],
                                        [index]: option
                                      }
                                    });
                                  }}
                                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                                    surveyAnswers[survey.id]?.[index] === option
                                      ? 'border-primary bg-muted font-semibold'
                                      : 'border-border bg-white hover:border-border hover:bg-muted'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                      surveyAnswers[survey.id]?.[index] === option
                                        ? 'border-primary bg-primary'
                                        : 'border-border'
                                    }`}>
                                      {surveyAnswers[survey.id]?.[index] === option && (
                                        <div className="w-2 h-2 bg-white rounded-full"></div>
                                      )}
                                    </div>
                                    <span>{option}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Free Form Type - Text Input */}
                          {survey.question_type !== 'poll' && (
                            <Textarea
                              placeholder="Your answer..."
                              rows={2}
                              className="mt-2"
                              value={surveyAnswers[survey.id]?.[index] || ''}
                              onChange={(e) => {
                                setSurveyAnswers({
                                  ...surveyAnswers,
                                  [survey.id]: {
                                    ...surveyAnswers[survey.id],
                                    [index]: e.target.value
                                  }
                                });
                              }}
                            />
                          )}
                        </div>
                      ))}
                      <Button
                        size="sm"
                        onClick={() => submitSurveyResponse(survey.id)}
                        className="bg-gradient-to-r from-primary to-secondary"
                        disabled={!surveyAnswers[survey.id] || Object.keys(surveyAnswers[survey.id]).length === 0}
                      >
                        Submit Response
                      </Button>
                    </div>
                  </div>
                )}

                {/* View Responses (RAs) */}
                {selectedSurvey === survey.id && user?.role === 'ra' && surveyResponses[survey.id] && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <h5 className="font-semibold mb-3 text-sm">Responses ({surveyResponses[survey.id].length}):</h5>
                    {surveyResponses[survey.id].length === 0 ? (
                      <p className="text-sm text-muted-foreground">No responses yet</p>
                    ) : (
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {surveyResponses[survey.id].map((response) => (
                          <div key={response.id} className="p-3 bg-white rounded-lg border">
                            <p className="font-semibold text-sm text-foreground">{response.student_name}</p>
                            <p className="text-xs text-muted-foreground mb-2">{new Date(response.created_at).toLocaleString()}</p>
                            {response.answers.map((answer, idx) => (
                              <div key={idx} className="mb-2">
                                <p className="text-xs font-semibold text-muted-foreground">{survey.questions[idx]}</p>
                                <p className="text-sm text-foreground">{answer}</p>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {floorSurveys.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-4">No floor surveys available</p>
            )}
          </div>
        </Card>

        {/* Emergency Contacts */}
        <Card className="p-6 glass">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Emergency Contacts</h3>
            {user?.role === 'ra' && (
              <Button 
                onClick={() => setShowAddContact(!showAddContact)}
                size="sm"
                className="bg-destructive/50 hover:bg-destructive/80"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Contact
              </Button>
            )}
          </div>

          {showAddContact && user?.role === 'ra' && (
            <div className="mb-4 p-3 bg-white/70 rounded-lg border-2 border-destructive/20">
              <h4 className="font-semibold mb-2 text-sm">Add Emergency Contact</h4>
              <div className="space-y-2">
                <Input
                  placeholder="Contact Name"
                  value={newContact.name}
                  onChange={(e) => setNewContact({...newContact, name: e.target.value})}
                />
                <select
                  className="w-full p-2 border rounded-lg text-sm"
                  value={newContact.role}
                  onChange={(e) => setNewContact({...newContact, role: e.target.value})}
                >
                  <option value="ra">RA</option>
                  <option value="senior_ra">Senior RA</option>
                  <option value="head_of_house">Head of House</option>
                  <option value="security">Security</option>
                  <option value="medical">Medical</option>
                  <option value="mental_health">Mental Health</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="other">Other</option>
                </select>
                <Input
                  placeholder="Phone Number"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({...newContact, phone: e.target.value})}
                />
                <Input
                  placeholder="Email (optional)"
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({...newContact, email: e.target.value})}
                />
                <Input
                  placeholder="Available Hours (optional)"
                  value={newContact.available_hours}
                  onChange={(e) => setNewContact({...newContact, available_hours: e.target.value})}
                />
                <div className="flex gap-2">
                  <Button 
                    onClick={addEmergencyContact}
                    size="sm"
                    disabled={!newContact.name || !newContact.phone}
                  >
                    Add
                  </Button>
                  <Button 
                    onClick={() => {
                      setShowAddContact(false);
                      setNewContact({ name: '', role: 'ra', phone: '', email: '', available_hours: '' });
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {emergencyContacts.map((contact) => (
              <div key={contact.id} className="p-3 rounded-lg bg-white/50 border-l-4 border-destructive/30">
                <div className="font-semibold text-foreground">{contact.name}</div>
                <div className="text-sm text-muted-foreground capitalize">{contact.role.replace(/_/g, ' ')}</div>
                <div className="text-sm font-semibold text-foreground mt-1">📞 {contact.phone}</div>
                {contact.email && (
                  <div className="text-xs text-muted-foreground">✉️ {contact.email}</div>
                )}
                {contact.available_hours && (
                  <div className="text-xs text-muted-foreground mt-1">🕒 {contact.available_hours}</div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
      </div>
    </div>
  );
};

// Recognition Module (Instant Recognition/Shoutouts)

export default HousesModule;
