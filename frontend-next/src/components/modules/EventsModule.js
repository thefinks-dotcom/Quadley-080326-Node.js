'use client';

import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext, API } from '@/contexts/AuthContext';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { Calendar, MapPin, Users, Plus, CheckCircle, XCircle, Clock } from 'lucide-react';
import ModuleHeader from '../ModuleHeader';

const EventsModule = () => {
  const { user } = useContext(AuthContext);
  const [events, setEvents] = useState([]);
  const [eventRsvps, setEventRsvps] = useState({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    date: '',
    location: '',
    max_attendees: '',
    category: 'social'
  });
  const [tempEventDate, setTempEventDate] = useState('');
  const [dateConfirmed, setDateConfirmed] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await axios.get(`${API}/events`, { params: { include_past: true, limit: 100 } });
      setEvents(res.data);
      
      // Fetch RSVP status for each event
      const rsvpPromises = res.data.map(event => 
        axios.get(`${API}/events/${event.id}/my-rsvp`)
          .then(rsvpRes => ({ eventId: event.id, rsvp: rsvpRes.data.response }))
          .catch(() => ({ eventId: event.id, rsvp: null }))
      );
      
      const rsvpResults = await Promise.all(rsvpPromises);
      const rsvpMap = {};
      rsvpResults.forEach(({ eventId, rsvp }) => {
        rsvpMap[eventId] = rsvp;
      });
      setEventRsvps(rsvpMap);
    } catch (error) {
      console.error('Failed to fetch events', error);
      toast.error('Failed to load events. Please refresh the page.');
    }
  };

  const createEvent = async (e) => {
    e.preventDefault();
    if (!dateConfirmed || !newEvent.date) {
      toast.error('Please confirm the date and time');
      return;
    }
    try {
      await axios.post(`${API}/events`, newEvent);
      toast.success('Event created!');
      setShowCreateForm(false);
      setNewEvent({
        title: '',
        description: '',
        date: '',
        location: '',
        max_attendees: '',
        category: 'social'
      });
      setTempEventDate('');
      setDateConfirmed(false);
      fetchEvents();
    } catch (error) {
      toast.error('Failed to create event');
    }
  };

  const rsvpToEvent = async (eventId, response) => {
    try {
      await axios.post(`${API}/events/${eventId}/rsvp`, { response });
      toast.success(`RSVP updated to: ${response}`);
      
      // Update local state immediately for better UX
      setEventRsvps(prev => ({ ...prev, [eventId]: response }));
      
      // If attending, scroll to top
      if (response === 'attending') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      
      fetchEvents();
    } catch (error) {
      toast.error('Failed to RSVP');
    }
  };

  const now = new Date();
  const upcomingEvents = events.filter(e => new Date(e.date) >= now);
  const pastEvents = events.filter(e => new Date(e.date) < now);
  const visibleEvents = showPast ? events : upcomingEvents;

  return (
    <div className="min-h-screen bg-background">
      <ModuleHeader
        title="Events"
        subtitle={`${upcomingEvents.length} upcoming event${upcomingEvents.length !== 1 ? 's' : ''}`}
        showBack
        showSearch={false}
        rightContent={
          (user.role === 'ra' || user.role === 'admin' || user.role === 'super_admin' || user.role === 'college_admin') ? (
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <Plus className="h-5 w-5 text-white" />
            </button>
          ) : null
        }
      />
      <div className="px-4 pt-4 pb-4 space-y-4">

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: '✨ All' },
          { key: 'social', label: '🎉 Social' },
          { key: 'academic', label: '📚 Academic' },
          { key: 'wellness', label: '💚 Wellness' },
          { key: 'cultural', label: '🌏 Cultural' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSelectedCategory(key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
              selectedCategory === key
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-white text-muted-foreground border-border hover:border-primary hover:text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Past events toggle */}
      {pastEvents.length > 0 && (
        <button
          onClick={() => setShowPast(prev => !prev)}
          className="text-sm text-muted-foreground hover:text-primary underline-offset-2 hover:underline transition-colors"
        >
          {showPast ? 'Hide past events' : `Show ${pastEvents.length} past event${pastEvents.length !== 1 ? 's' : ''}`}
        </button>
      )}

      {/* Create Event Form */}
      {showCreateForm && (
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">Create New Event</h2>
          <form onSubmit={createEvent} className="space-y-4">
            <input
              type="text"
              placeholder="Event Title"
              value={newEvent.title}
              onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
              required
              className="w-full p-3 border rounded-lg"
            />
            <textarea
              placeholder="Description"
              value={newEvent.description}
              onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
              required
              className="w-full p-3 border rounded-lg min-h-[100px]"
            />
            {dateConfirmed && newEvent.date ? (
              <div className="flex items-center justify-between p-3 bg-muted border border-border rounded-lg">
                <div className="flex items-center gap-2 text-foreground">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">Date: {new Date(newEvent.date).toLocaleString()}</span>
                </div>
                <button 
                  type="button"
                  onClick={() => { setDateConfirmed(false); setTempEventDate(newEvent.date); }}
                  className="text-primary hover:text-foreground text-sm font-medium"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="datetime-local"
                  value={tempEventDate}
                  onChange={(e) => setTempEventDate(e.target.value)}
                  className={`w-full p-3 border rounded-lg ${tempEventDate ? 'pr-24' : ''}`}
                />
                {tempEventDate && (
                  <button 
                    type="button"
                    onClick={() => { 
                      setNewEvent({ ...newEvent, date: tempEventDate }); 
                      setDateConfirmed(true); 
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary hover:bg-primary text-white px-3 py-1 rounded text-sm font-medium flex items-center gap-1"
                  >
                    ✓ Confirm
                  </button>
                )}
              </div>
            )}
            <input
              type="text"
              placeholder="Location"
              value={newEvent.location}
              onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
              required
              className="w-full p-3 border rounded-lg"
            />
            <input
              type="number"
              placeholder="Max Attendees (optional)"
              value={newEvent.max_attendees}
              onChange={(e) => setNewEvent({ ...newEvent, max_attendees: e.target.value })}
              className="w-full p-3 border rounded-lg"
            />
            <select
              value={newEvent.category}
              onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value })}
              className="w-full p-3 border rounded-lg"
            >
              <option value="social">Social</option>
              <option value="academic">Academic</option>
              <option value="wellness">Wellness</option>
              <option value="cultural">Cultural</option>
            </select>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">Create Event</Button>
              <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Events List - Attending events shown first */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...visibleEvents]
          .filter(event => selectedCategory === 'all' || event.category === selectedCategory)
          .sort((a, b) => {
            // Sort attending events to the top
            const aAttending = eventRsvps[a.id] === 'attending' ? 1 : 0;
            const bAttending = eventRsvps[b.id] === 'attending' ? 1 : 0;
            if (bAttending !== aAttending) return bAttending - aAttending;
            // Then sort by date
            return new Date(a.date) - new Date(b.date);
          })
          .map((event) => (
          <Card key={event.id} className={`p-6 hover:shadow-xl transition-shadow ${eventRsvps[event.id] === 'attending' ? 'ring-2 ring-success bg-success/10/50' : ''}`}>
            <div className="mb-4">
              <Badge className="mb-2">{event.category}</Badge>
              <h3 className="text-xl font-bold mb-2">{event.title}</h3>
              <p className="text-muted-foreground text-sm mb-4">{event.description}</p>
            </div>

            <div className="space-y-2 mb-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {new Date(event.date).toLocaleString()}
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {event.location}
              </div>
              {event.max_attendees && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {event.attendees?.length || 0} / {event.max_attendees} attendees
                </div>
              )}
            </div>

            <div className="space-y-2">
              {eventRsvps[event.id] && (
                <div className="text-sm font-medium text-center p-2 rounded-lg bg-muted text-primary">
                  Your RSVP: {eventRsvps[event.id] === 'attending' ? '✓ Attending' : 
                              eventRsvps[event.id] === 'maybe' ? '? Maybe' : 
                              eventRsvps[event.id] === 'unable' ? '✗ Can\'t Go' : 'None'}
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => rsvpToEvent(event.id, 'attending')}
                  className={`w-full ${eventRsvps[event.id] === 'attending' ? 'bg-success' : 'bg-success'} hover:bg-success text-sm`}
                  variant={eventRsvps[event.id] === 'attending' ? 'default' : 'outline'}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Attending
                </Button>
                <div className="flex gap-2">
                  <Button
                    onClick={() => rsvpToEvent(event.id, 'unable')}
                    variant="outline"
                    className={`flex-1 text-sm ${eventRsvps[event.id] === 'unable' ? 'border-destructive/30 text-destructive' : ''}`}
                  >
                    <XCircle className="mr-1 h-4 w-4" />
                    Can't Go
                  </Button>
                  <Button
                    onClick={() => rsvpToEvent(event.id, 'maybe')}
                    variant="outline"
                    className={`flex-1 text-sm ${eventRsvps[event.id] === 'maybe' ? 'border-warning text-warning' : ''}`}
                  >
                    <Clock className="mr-1 h-4 w-4" />
                    Maybe
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {visibleEvents.filter(e => selectedCategory === 'all' || e.category === selectedCategory).length === 0 && (
        <Card className="p-12 text-center">
          <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <p className="text-xl text-muted-foreground">
            {selectedCategory === 'all'
              ? (showPast ? 'No events found' : 'No upcoming events')
              : `No ${selectedCategory} events`}
          </p>
        </Card>
      )}

      </div>
    </div>
  );
};

export default EventsModule;
