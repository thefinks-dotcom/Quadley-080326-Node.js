import React, { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { AuthContext, API } from '../../App';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { toast } from 'sonner';
import { Megaphone, AlertCircle, CheckCircle2, Search, Archive, Plus, X } from 'lucide-react';
import ModuleHeader from '../ModuleHeader';

const AnnouncementsModule = () => {
  const { user } = useContext(AuthContext);
  const [announcements, setAnnouncements] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('unread');
  const [showForm, setShowForm] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    priority: 'normal',
    target_audience: 'all',
    is_emergency: false
  });

  const isStaff = user?.role && ['ra', 'admin', 'college_admin'].includes(user.role);
  const formRef = useRef(null);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  useEffect(() => {
    if (showForm && formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showForm]);

  const fetchAnnouncements = async () => {
    console.log('fetchAnnouncements called');
    try {
      const res = await axios.get(`${API}/announcements`);
      console.log('Fetched announcements:', res.data.length, 'announcements');
      setAnnouncements(res.data);
    } catch (error) {
      console.error('Failed to fetch announcements', error);
    }
  };

  const markAsRead = async (announcementId) => {
    console.log('markAsRead called with ID:', announcementId);
    try {
      const response = await axios.post(`${API}/announcements/${announcementId}/mark-read`);
      console.log('Mark read response:', response);
      toast.success('Announcement marked as read');
      await fetchAnnouncements();
      console.log('Announcements refetched');
    } catch (error) {
      console.error('Failed to mark as read', error);
      toast.error('Failed to mark announcement as read');
    }
  };

  const submitAnnouncement = async () => {
    if (!newAnnouncement.title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    if (!newAnnouncement.content.trim()) {
      toast.error('Please enter content');
      return;
    }
    try {
      await axios.post(`${API}/announcements`, newAnnouncement);
      toast.success('Announcement posted successfully!');
      setShowForm(false);
      setNewAnnouncement({ title: '', content: '', priority: 'normal', target_audience: 'all', is_emergency: false });
      fetchAnnouncements();
    } catch (error) {
      console.error('Failed to post announcement', error);
      toast.error(error.response?.data?.detail || 'Failed to post announcement');
    }
  };

  // Filter announcements based on read status and search query
  const unreadAnnouncements = announcements.filter(ann => 
    !ann.is_read && 
    (ann.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
     ann.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const readAnnouncements = announcements.filter(ann => 
    ann.is_read && 
    (ann.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
     ann.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderAnnouncement = (announcement, showMarkRead = true) => (
    <Card
      key={announcement.id}
      className={`p-4 ${announcement.is_emergency ? 'border-2 border-destructive/30 bg-destructive/5' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            {announcement.is_emergency && (
              <Badge className="bg-destructive/50">
                <AlertCircle className="h-3 w-3 mr-1" />
                Emergency
              </Badge>
            )}
            {announcement.priority === 'high' && !announcement.is_emergency && (
              <Badge className="bg-muted0">High Priority</Badge>
            )}
            <Badge variant="outline">{announcement.target_audience}</Badge>
          </div>
          <h3 className="text-base font-semibold mb-1 leading-snug">{announcement.title}</h3>
          <p className="text-sm text-foreground whitespace-pre-wrap">{announcement.content}</p>
          <p className="text-xs text-muted-foreground mt-1.5">
            {new Date(announcement.created_at).toLocaleString()}
            {announcement.created_by_name && ` • Posted by ${announcement.created_by_name}`}
          </p>
        </div>
        {showMarkRead && !announcement.is_read && (
          <Button
            onClick={() => markAsRead(announcement.id)}
            variant="outline"
            size="sm"
            className="shrink-0"
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Mark Read
          </Button>
        )}
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <ModuleHeader
        title="Announcements"
        subtitle={`${unreadAnnouncements.length} unread`}
        showBack
        showSearch={false}
        rightContent={
          isStaff ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <Plus className="h-5 w-5 text-white" />
            </button>
          ) : null
        }
      />
      <div className="px-4 pt-4 pb-4 space-y-4">

      {/* New Announcement Form */}
      {showForm && (
        <Card ref={formRef} className="p-4 border-2 border-primary bg-muted">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base font-bold">Create New Announcement</h2>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Title *</label>
              <Input
                placeholder="Announcement title..."
                value={newAnnouncement.title}
                onChange={(e) => setNewAnnouncement(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Content *</label>
              <textarea
                className="w-full min-h-[80px] p-2 border rounded-md text-sm"
                placeholder="Write your announcement..."
                value={newAnnouncement.content}
                onChange={(e) => setNewAnnouncement(prev => ({ ...prev, content: e.target.value }))}
              />
            </div>
            
            <div className="flex flex-wrap gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Priority</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={newAnnouncement.priority === 'normal' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setNewAnnouncement(prev => ({ ...prev, priority: 'normal' }))}
                  >
                    🔵 Normal
                  </Button>
                  <Button
                    type="button"
                    variant={newAnnouncement.priority === 'high' ? 'destructive' : 'outline'}
                    size="sm"
                    onClick={() => setNewAnnouncement(prev => ({ ...prev, priority: 'high' }))}
                  >
                    🔴 High
                  </Button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Audience</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={newAnnouncement.target_audience === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setNewAnnouncement(prev => ({ ...prev, target_audience: 'all' }))}
                  >
                    Everyone
                  </Button>
                  <Button
                    type="button"
                    variant={newAnnouncement.target_audience === 'students' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setNewAnnouncement(prev => ({ ...prev, target_audience: 'students' }))}
                  >
                    Students
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_emergency"
                checked={newAnnouncement.is_emergency}
                onChange={(e) => setNewAnnouncement(prev => ({ ...prev, is_emergency: e.target.checked }))}
                className="h-4 w-4"
              />
              <label htmlFor="is_emergency" className="text-sm font-medium text-destructive">
                ⚠️ Mark as Emergency
              </label>
            </div>
            
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button onClick={submitAnnouncement} className="bg-primary hover:bg-primary">
                <Megaphone className="h-4 w-4 mr-1" />
                Post Announcement
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search announcements..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs for Unread and Archive */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="unread">
            <Megaphone className="h-4 w-4 mr-2" />
            Unread ({unreadAnnouncements.length})
          </TabsTrigger>
          <TabsTrigger value="archive">
            <Archive className="h-4 w-4 mr-2" />
            Archive ({readAnnouncements.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unread" className="space-y-4 mt-6">
          {unreadAnnouncements.length > 0 ? (
            unreadAnnouncements.map((announcement) => renderAnnouncement(announcement, true))
          ) : (
            <Card className="p-8 text-center">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-success" />
              <p className="text-base text-muted-foreground">
                {searchQuery ? 'No unread announcements match your search' : 'All caught up! No unread announcements'}
              </p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="archive" className="space-y-4 mt-6">
          {readAnnouncements.length > 0 ? (
            readAnnouncements.map((announcement) => renderAnnouncement(announcement, false))
          ) : (
            <Card className="p-8 text-center">
              <Archive className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-base text-muted-foreground">
                {searchQuery ? 'No archived announcements match your search' : 'No archived announcements'}
              </p>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      </div>
    </div>
  );
};

export default AnnouncementsModule;
