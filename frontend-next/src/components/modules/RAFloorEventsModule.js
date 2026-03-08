'use client';

import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext, API } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Calendar, Plus, Edit2, Trash2, X, AlertCircle, RefreshCw, Clock, MapPin } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';

const RAFloorEventsModule = () => {
  const { user } = useContext(AuthContext);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
  });

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/floor-events`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEvents(res.data || []);
    } catch (error) {
      toast.error('Could not load floor events');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ title: '', description: '', date: '', time: '', location: '' });
    setEditingEvent(null);
    setShowForm(false);
  };

  const openEdit = (event) => {
    const dt = event.date ? new Date(event.date) : null;
    setForm({
      title: event.title || '',
      description: event.description || '',
      date: dt ? dt.toISOString().slice(0, 10) : '',
      time: dt ? dt.toISOString().slice(11, 16) : '',
      location: event.location || '',
    });
    setEditingEvent(event);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.date) {
      toast.error('Title and date are required');
      return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        title: form.title,
        description: form.description,
        date: form.date + (form.time ? `T${form.time}:00` : 'T00:00:00'),
        location: form.location,
      };
      if (editingEvent) {
        await axios.put(`${API}/floor-events/${editingEvent.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Event updated');
      } else {
        await axios.post(`${API}/floor-events`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Floor event created');
      }
      resetForm();
      fetchEvents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save event');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (eventId) => {
    if (!window.confirm('Delete this floor event?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/floor-events/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Event deleted');
      fetchEvents();
    } catch (error) {
      toast.error('Failed to delete event');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-AU', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ModuleHeader
        title="Floor Events"
        showBack={true}
        showSearch={false}
      />
      <div className="px-4 pt-4 pb-4 space-y-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-7 h-7 text-primary" />
            Floor Events
          </h1>
          <p className="text-muted-foreground mt-1">Create and manage events for your floor</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Event
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6 border-primary/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">{editingEvent ? 'Edit Event' : 'Create Floor Event'}</h2>
              <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">Title *</label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Event title"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">Description</label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe the event..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1">Date *</label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1">Time</label>
                  <Input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">Location</label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. Common Room, Floor 3"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : editingEvent ? 'Update Event' : 'Create Event'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {events.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">No floor events yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first floor event using the button above</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <Card key={event.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground">{event.title}</h3>
                    {event.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-2">
                      {event.date && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatDate(event.date)} {formatTime(event.date)}
                        </span>
                      )}
                      {event.location && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          {event.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => openEdit(event)}
                      className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(event.id)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </div>
    </div>
  );
};

export default RAFloorEventsModule;
