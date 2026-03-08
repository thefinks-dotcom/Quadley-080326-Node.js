'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Calendar,
  Plus,
  Users,
  MapPin,
  Clock,
  DollarSign,
  Eye,
  Edit,
  Trash2,
  CheckCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const API = '';

const EventsAdmin = () => {
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showRsvpDialog, setShowRsvpDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    date: '',
    location: '',
    category: 'social',
    max_attendees: '',
    cost: '',
    rsvp_deadline: ''
  });
  const [tempEventDate, setTempEventDate] = useState('');
  const [dateConfirmed, setDateConfirmed] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/events`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEvents(response.data);
    } catch (error) {
      console.error('Failed to fetch events', error);
      toast.error('Failed to load events. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/api/events`, {
        ...newEvent,
        date: new Date(newEvent.date).toISOString(),
        max_attendees: newEvent.max_attendees ? parseInt(newEvent.max_attendees) : null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Event created!');
      setShowNewDialog(false);
      setNewEvent({ title: '', description: '', date: '', location: '', category: 'social', max_attendees: '', cost: '', rsvp_deadline: '' });
      fetchEvents();
    } catch (error) {
      toast.error('Failed to create event');
    } finally {
      setCreating(false);
    }
  };

  const upcomingEvents = events.filter(e => new Date(e.date) >= new Date());
  const pastEvents = events.filter(e => new Date(e.date) < new Date());

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-muted"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-border"></div></div>;
  }

  return (
    <div className="min-h-screen bg-muted">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button onClick={() => router.push('/college-admin')} variant="ghost" size="icon" className="hover:bg-muted">
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Events & RSVPs</h1>
              <p className="text-muted-foreground text-sm">{upcomingEvents.length} upcoming events</p>
            </div>
          </div>
          <Button onClick={() => setShowNewDialog(true)} className="flex items-center gap-2 h-10 bg-primary hover:bg-primary text-white">
            <Plus className="h-4 w-4" /> Create Event
          </Button>
        </div>

        {/* Upcoming Events */}
        <h2 className="text-lg font-semibold text-foreground mb-4">Upcoming Events</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {upcomingEvents.map(event => (
            <Card key={event.id} className="hover:shadow-md transition-shadow bg-white border border-border rounded-xl">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-lg text-foreground">{event.title}</h3>
                    <Badge className="mt-1 bg-muted text-foreground">{event.category}</Badge>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => { setSelectedEvent(event); setShowRsvpDialog(true); }} className="border-border hover:bg-muted">
                    <Eye className="h-4 w-4 mr-1" /> RSVPs
                  </Button>
                </div>
                <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{event.description}</p>
                <div className="space-y-1.5 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2"><Calendar className="h-4 w-4" /> {new Date(event.date).toLocaleDateString()} at {new Date(event.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                  <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {event.location}</p>
                  <p className="flex items-center gap-2"><Users className="h-4 w-4" /> {event.attendees?.length || 0}{event.max_attendees ? ` / ${event.max_attendees}` : ''} RSVPs</p>
                </div>
              </CardContent>
            </Card>
          ))}
          {upcomingEvents.length === 0 && (
            <Card className="col-span-2 p-12 text-center bg-white border border-border rounded-xl">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No upcoming events</p>
            </Card>
          )}
        </div>

        {/* Past Events */}
        {pastEvents.length > 0 && (
          <>
            <h2 className="text-lg font-semibold text-foreground mb-4">Past Events</h2>
            <div className="space-y-3">
              {pastEvents.slice(0, 5).map(event => (
                <Card key={event.id} className="bg-muted border border-border rounded-xl">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-foreground">{event.title}</h3>
                      <p className="text-sm text-muted-foreground">{new Date(event.date).toLocaleDateString()} • {event.attendees?.length || 0} attended</p>
                    </div>
                    <Badge variant="outline" className="border-border text-muted-foreground">Completed</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Create Event Dialog */}
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-foreground">Create New Event</DialogTitle>
              <DialogDescription className="text-muted-foreground">Fill in the event details below.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <Label>Event Name *</Label>
                <Input value={newEvent.title} onChange={(e) => setNewEvent({...newEvent, title: e.target.value})} required />
              </div>
              <div>
                <Label>Description *</Label>
                <Textarea value={newEvent.description} onChange={(e) => setNewEvent({...newEvent, description: e.target.value})} required rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date & Time *</Label>
                  {dateConfirmed && newEvent.date ? (
                    <div className="flex items-center justify-between p-2 bg-muted border border-border rounded-lg mt-1">
                      <div className="flex items-center gap-2 text-foreground text-sm">
                        <Calendar className="h-4 w-4" />
                        <span className="font-medium">{new Date(newEvent.date).toLocaleString()}</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => { setDateConfirmed(false); setTempEventDate(newEvent.date); }}
                        className="text-primary hover:text-foreground h-6 px-2 text-xs"
                      >
                        Change
                      </Button>
                    </div>
                  ) : (
                    <div className="relative mt-1">
                      <Input 
                        type="datetime-local" 
                        value={tempEventDate} 
                        onChange={(e) => setTempEventDate(e.target.value)}
                        className={tempEventDate ? "pr-20" : ""}
                      />
                      {tempEventDate && (
                        <Button 
                          type="button"
                          size="sm"
                          onClick={() => { 
                            setNewEvent({...newEvent, date: tempEventDate}); 
                            setDateConfirmed(true); 
                          }}
                          className="absolute right-1 top-1/2 -translate-y-1/2 bg-primary hover:bg-primary h-7 px-2 text-xs"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" /> Confirm
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <Label>Location *</Label>
                  <Input value={newEvent.location} onChange={(e) => setNewEvent({...newEvent, location: e.target.value})} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Max Attendees</Label>
                  <Input type="number" value={newEvent.max_attendees} onChange={(e) => setNewEvent({...newEvent, max_attendees: e.target.value})} placeholder="Unlimited" />
                </div>
                <div>
                  <Label>Cost ($)</Label>
                  <Input value={newEvent.cost} onChange={(e) => setNewEvent({...newEvent, cost: e.target.value})} placeholder="Free" />
                </div>
              </div>
              <div>
                <Label>RSVP Deadline</Label>
                <Input type="datetime-local" value={newEvent.rsvp_deadline} onChange={(e) => setNewEvent({...newEvent, rsvp_deadline: e.target.value})} />
              </div>
              <div>
                <Label>Category</Label>
                <select value={newEvent.category} onChange={(e) => setNewEvent({...newEvent, category: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                  <option value="social">Social</option>
                  <option value="academic">Academic</option>
                  <option value="sports">Sports</option>
                  <option value="cultural">Cultural</option>
                  <option value="wellness">Wellness</option>
                </select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowNewDialog(false)}>Cancel</Button>
                <Button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create Event'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* RSVP List Dialog */}
        <Dialog open={showRsvpDialog} onOpenChange={setShowRsvpDialog}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>RSVPs for {selectedEvent?.title}</DialogTitle>
              <DialogDescription>{selectedEvent?.attendees?.length || 0} people have RSVP'd</DialogDescription>
            </DialogHeader>
            <div className="max-h-64 overflow-y-auto space-y-2 my-4">
              {selectedEvent?.attendees?.length > 0 ? (
                selectedEvent.attendees.map((attendee, idx) => (
                  <div key={idx} className="p-3 bg-muted rounded-lg flex items-center gap-3">
                    <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-sm font-medium">
                      {idx + 1}
                    </div>
                    <span>{attendee}</span>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4">No RSVPs yet</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default EventsAdmin;
