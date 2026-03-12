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
  Megaphone,
  Plus,
  Send,
  Clock,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Users,
  Edit,
  Trash2
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const API = '';

const AnnouncementsAdmin = () => {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('current');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [posting, setPosting] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    target_audience: 'all',
    priority: 'normal',
    is_emergency: false,
    scheduled_date: ''
  });
  const [tempScheduleDate, setTempScheduleDate] = useState('');
  const [scheduleConfirmed, setScheduleConfirmed] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const response = await axios.get(`${API}/api/announcements?include_scheduled=true`, {
      });
      setAnnouncements(response.data);
    } catch (error) {
      console.error('Failed to fetch', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async () => {
    setPosting(true);
    try {
      
      // If a scheduled date is confirmed, schedule it; otherwise post immediately
      const isScheduled = scheduleConfirmed && !!newAnnouncement.scheduled_date;
      
      const payload = {
        title: newAnnouncement.title,
        content: newAnnouncement.content,
        target_audience: newAnnouncement.target_audience,
        priority: newAnnouncement.priority,
        is_emergency: newAnnouncement.is_emergency,
        status: isScheduled ? 'scheduled' : 'published',
        scheduled_date: isScheduled ? newAnnouncement.scheduled_date : null
      };
      
      await axios.post(`${API}/api/announcements`, payload, {
      });
      
      if (isScheduled) {
        toast.success(`Announcement scheduled for ${new Date(newAnnouncement.scheduled_date).toLocaleString()}`, { duration: 5000 });
      } else {
        toast.success('Announcement posted!');
      }
      setShowNewDialog(false);
      setNewAnnouncement({ title: '', content: '', target_audience: 'all', priority: 'normal', is_emergency: false, scheduled_date: '' });
      setTempScheduleDate('');
      setScheduleConfirmed(false);
      fetchAnnouncements();
    } catch (error) {
      console.error('Failed to post:', error);
      toast.error('Failed to post announcement');
    } finally {
      setPosting(false);
    }
  };

  const getPriorityBadge = (priority, isEmergency) => {
    if (isEmergency) return <Badge className="bg-destructive/10 text-destructive"><AlertTriangle className="h-3 w-3 mr-1" /> Emergency</Badge>;
    const styles = { high: 'bg-muted text-foreground', normal: 'bg-muted text-foreground', low: 'bg-muted text-muted-foreground' };
    return <Badge className={styles[priority]}>{priority}</Badge>;
  };

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
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Announcements</h1>
              <p className="text-muted-foreground text-sm">{announcements.length} total announcements</p>
            </div>
          </div>
          <Button onClick={() => setShowNewDialog(true)} className="flex items-center gap-2 h-10 bg-primary hover:bg-primary text-white">
            <Plus className="h-4 w-4" /> New Announcement
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button variant={tab === 'current' ? 'default' : 'outline'} onClick={() => setTab('current')}>
            <CheckCircle className="h-4 w-4 mr-2" /> Current
          </Button>
          <Button variant={tab === 'scheduled' ? 'default' : 'outline'} onClick={() => setTab('scheduled')}>
            <Clock className="h-4 w-4 mr-2" /> Scheduled
          </Button>
          <Button variant={tab === 'history' ? 'default' : 'outline'} onClick={() => setTab('history')}>
            <Calendar className="h-4 w-4 mr-2" /> Historical
          </Button>
        </div>

        {/* Announcements List */}
        <div className="space-y-4">
          {announcements
            .filter(ann => {
              if (tab === 'scheduled') return ann.status === 'scheduled';
              if (tab === 'history') return ann.status === 'published' || !ann.status;
              return true; // 'active' shows all
            })
            .map(ann => (
            <Card key={ann.id} className={`hover:shadow-md transition-shadow ${ann.is_emergency ? 'border-destructive bg-destructive/5' : ''} ${ann.status === 'scheduled' ? 'border-border bg-muted' : ''}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Megaphone className={`h-5 w-5 ${ann.is_emergency ? 'text-destructive' : ann.status === 'scheduled' ? 'text-primary' : 'text-primary'}`} />
                      <h3 className="font-semibold text-lg">{ann.title}</h3>
                      {ann.status === 'scheduled' && (
                        <Badge className="bg-muted text-foreground">
                          <Clock className="h-3 w-3 mr-1" /> Scheduled
                        </Badge>
                      )}
                      {getPriorityBadge(ann.priority, ann.is_emergency)}
                      <Badge variant="outline"><Users className="h-3 w-3 mr-1" /> {ann.target_audience}</Badge>
                    </div>
                    <p className="text-muted-foreground mb-2">{ann.content}</p>
                    <div className="text-sm text-muted-foreground">
                      {ann.status === 'scheduled' && ann.scheduled_date ? (
                        <p className="text-primary font-medium">
                          <Clock className="h-4 w-4 inline mr-1" />
                          Scheduled for: {new Date(ann.scheduled_date).toLocaleString()}
                        </p>
                      ) : (
                        <p>Posted: {new Date(ann.created_at).toLocaleDateString()}</p>
                      )}
                      {ann.created_by_name && <p>By: {ann.created_by_name}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm"><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {announcements.length === 0 && (
            <Card className="p-12 text-center">
              <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No announcements yet</p>
            </Card>
          )}
        </div>

        {/* New Announcement Dialog */}
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /> New Announcement</DialogTitle>
              <DialogDescription>Create an announcement for residents.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 my-4">
              <div>
                <Label>Title *</Label>
                <Input value={newAnnouncement.title} onChange={(e) => setNewAnnouncement({...newAnnouncement, title: e.target.value})} placeholder="Announcement title" />
              </div>
              <div>
                <Label>Content *</Label>
                <Textarea value={newAnnouncement.content} onChange={(e) => setNewAnnouncement({...newAnnouncement, content: e.target.value})} placeholder="Write your announcement..." rows={4} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Target Audience</Label>
                  <select value={newAnnouncement.target_audience} onChange={(e) => setNewAnnouncement({...newAnnouncement, target_audience: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                    <option value="all">All Residents</option>
                    <option value="students">Students Only</option>
                    <option value="staff">Staff Only</option>
                  </select>
                </div>
                <div>
                  <Label>Priority</Label>
                  <select value={newAnnouncement.priority} onChange={(e) => setNewAnnouncement({...newAnnouncement, priority: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="emergency" checked={newAnnouncement.is_emergency} onChange={(e) => setNewAnnouncement({...newAnnouncement, is_emergency: e.target.checked})} />
                <Label htmlFor="emergency" className="text-destructive">Mark as Emergency</Label>
              </div>
              <div>
                <Label>Schedule for later (optional)</Label>
                {scheduleConfirmed && newAnnouncement.scheduled_date ? (
                  <div className="flex items-center justify-between p-3 bg-muted border border-border rounded-lg mt-1">
                    <div className="flex items-center gap-2 text-foreground">
                      <Clock className="h-4 w-4" />
                      <span className="font-medium">Scheduled for: {new Date(newAnnouncement.scheduled_date).toLocaleString()}</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => { setScheduleConfirmed(false); setTempScheduleDate(newAnnouncement.scheduled_date); }}
                      className="text-primary hover:text-foreground"
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="relative mt-1">
                    <Input 
                      type="datetime-local" 
                      value={tempScheduleDate} 
                      onChange={(e) => setTempScheduleDate(e.target.value)}
                      className={tempScheduleDate ? "pr-24" : ""}
                    />
                    {tempScheduleDate && (
                      <Button 
                        type="button"
                        size="sm"
                        onClick={() => { 
                          setNewAnnouncement({...newAnnouncement, scheduled_date: tempScheduleDate}); 
                          setScheduleConfirmed(true); 
                        }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 bg-primary hover:bg-primary h-7 px-2"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" /> Confirm
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancel</Button>
              <Button onClick={handlePost} disabled={posting || !newAnnouncement.title || !newAnnouncement.content}>
                {scheduleConfirmed && newAnnouncement.scheduled_date ? (
                  <><Clock className="h-4 w-4 mr-2" /> {posting ? 'Scheduling...' : 'Schedule'}</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" /> {posting ? 'Posting...' : 'Post'}</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AnnouncementsAdmin;
