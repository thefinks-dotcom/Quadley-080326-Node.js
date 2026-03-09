import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Award,
  Plus,
  Send,
  Clock,
  CheckCircle,
  Calendar,
  Search,
  Eye,
  Megaphone
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const API = process.env.REACT_APP_BACKEND_URL;

const RecognitionAdmin = () => {
  const navigate = useNavigate();
  const [recognitions, setRecognitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('current');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newRecognition, setNewRecognition] = useState({
    to_user_name: '',
    message: '',
    category: 'achievement',
    broadcast: true,
    scheduled_date: ''
  });
  const [tempScheduleDate, setTempScheduleDate] = useState('');
  const [scheduleConfirmed, setScheduleConfirmed] = useState(false);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    fetchRecognitions();
  }, []);

  const fetchRecognitions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/shoutouts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecognitions(response.data);
    } catch (error) {
      console.error('Failed to fetch', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async () => {
    setPosting(true);
    try {
      const token = localStorage.getItem('token');
      
      // If a scheduled date is confirmed, schedule it; otherwise post immediately
      const isScheduled = scheduleConfirmed && !!newRecognition.scheduled_date;
      
      await axios.post(`${API}/api/shoutouts`, {
        to_user_name: newRecognition.to_user_name,
        message: newRecognition.message,
        category: newRecognition.category,
        broadcast: newRecognition.broadcast,
        status: isScheduled ? 'scheduled' : 'published',
        scheduled_date: isScheduled ? newRecognition.scheduled_date : null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (isScheduled) {
        toast.success(`Recognition scheduled for ${new Date(newRecognition.scheduled_date).toLocaleString()}`, { duration: 5000 });
      } else {
        toast.success('Recognition posted!');
      }
      setShowNewDialog(false);
      setNewRecognition({ to_user_name: '', message: '', category: 'achievement', broadcast: true, scheduled_date: '' });
      setTempScheduleDate('');
      setScheduleConfirmed(false);
      fetchRecognitions();
    } catch (error) {
      toast.error('Failed to post recognition');
    } finally {
      setPosting(false);
    }
  };

  const categories = [
    { value: 'achievement', label: 'Achievement' },
    { value: 'helping', label: 'Helping Others' },
    { value: 'leadership', label: 'Leadership' },
    { value: 'community', label: 'Community Spirit' },
    { value: 'academic', label: 'Academic Excellence' }
  ];

  const currentRecognitions = recognitions.filter(r => r.status !== 'scheduled');
  const scheduledRecognitions = recognitions.filter(r => r.status === 'scheduled');
  const historicalRecognitions = recognitions.filter(r => r.status !== 'scheduled'); // Same as current - excludes scheduled

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-border"></div></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button onClick={() => navigate('/college-admin')} variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Recognition Management</h1>
              <p className="text-muted-foreground text-sm">{recognitions.length} total recognitions</p>
            </div>
          </div>
          <Button onClick={() => setShowNewDialog(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> New Recognition
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button variant={tab === 'current' ? 'default' : 'outline'} onClick={() => setTab('current')}>
            <CheckCircle className="h-4 w-4 mr-2" /> Current ({currentRecognitions.length})
          </Button>
          <Button variant={tab === 'scheduled' ? 'default' : 'outline'} onClick={() => setTab('scheduled')}>
            <Clock className="h-4 w-4 mr-2" /> Scheduled ({scheduledRecognitions.length})
          </Button>
          <Button variant={tab === 'history' ? 'default' : 'outline'} onClick={() => setTab('history')}>
            <Calendar className="h-4 w-4 mr-2" /> Historical ({historicalRecognitions.length})
          </Button>
        </div>

        {/* Recognition List */}
        <div className="space-y-4">
          {(tab === 'current' ? currentRecognitions : tab === 'scheduled' ? scheduledRecognitions : historicalRecognitions).map(rec => (
            <Card key={rec.id} className={`hover:shadow-md transition-shadow ${rec.status === 'scheduled' ? 'border-border bg-muted' : ''}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Award className={`h-5 w-5 ${rec.status === 'scheduled' ? 'text-primary' : 'text-primary'}`} />
                      <span className="font-semibold">{rec.to_user_name}</span>
                      {rec.status === 'scheduled' && (
                        <Badge className="bg-muted text-foreground">
                          <Clock className="h-3 w-3 mr-1" /> Scheduled
                        </Badge>
                      )}
                      <Badge>{rec.category}</Badge>
                      {rec.broadcast && <Badge className="bg-muted text-foreground"><Megaphone className="h-3 w-3 mr-1" /> Broadcast</Badge>}
                    </div>
                    <p className="text-muted-foreground mb-2">"{rec.message}"</p>
                    <div className="text-sm text-muted-foreground">
                      <p>From: {rec.from_user_name}</p>
                      {rec.status === 'scheduled' && rec.scheduled_date ? (
                        <p className="text-primary font-medium mt-1">
                          <Clock className="h-4 w-4 inline mr-1" />
                          Scheduled for: {new Date(rec.scheduled_date).toLocaleString()}
                        </p>
                      ) : (
                        <p>Posted: {new Date(rec.created_at).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {((tab === 'current' ? currentRecognitions : tab === 'scheduled' ? scheduledRecognitions : historicalRecognitions).length === 0) && (
            <Card className="p-12 text-center">
              <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No recognitions found</p>
            </Card>
          )}
        </div>

        {/* New Recognition Dialog */}
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Award className="h-5 w-5 text-primary" /> New Recognition</DialogTitle>
              <DialogDescription>Create a recognition to celebrate a resident.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 my-4">
              <div>
                <Label>Recipient Name *</Label>
                <Input value={newRecognition.to_user_name} onChange={(e) => setNewRecognition({...newRecognition, to_user_name: e.target.value})} placeholder="Enter resident name" />
              </div>
              <div>
                <Label>Category</Label>
                <select value={newRecognition.category} onChange={(e) => setNewRecognition({...newRecognition, category: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                  {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <Label>Message *</Label>
                <Textarea value={newRecognition.message} onChange={(e) => setNewRecognition({...newRecognition, message: e.target.value})} placeholder="Write your recognition message..." rows={3} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="broadcast" checked={newRecognition.broadcast} onChange={(e) => setNewRecognition({...newRecognition, broadcast: e.target.checked})} />
                <Label htmlFor="broadcast">Broadcast to all residents</Label>
              </div>
              <div>
                <Label>Schedule for later (optional)</Label>
                {scheduleConfirmed && newRecognition.scheduled_date ? (
                  <div className="flex items-center justify-between p-3 bg-muted border border-border rounded-lg mt-1">
                    <div className="flex items-center gap-2 text-foreground">
                      <Clock className="h-4 w-4" />
                      <span className="font-medium">Scheduled for: {new Date(newRecognition.scheduled_date).toLocaleString()}</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => { setScheduleConfirmed(false); setTempScheduleDate(newRecognition.scheduled_date); }}
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
                          setNewRecognition({...newRecognition, scheduled_date: tempScheduleDate}); 
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
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancel</Button>
              <Button onClick={handlePost} disabled={posting || !newRecognition.to_user_name || !newRecognition.message}>
                {scheduleConfirmed && newRecognition.scheduled_date ? (
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

export default RecognitionAdmin;
