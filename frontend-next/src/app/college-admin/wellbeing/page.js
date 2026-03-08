'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  Heart,
  AlertTriangle,
  Clock,
  CheckCircle,
  User,
  Calendar,
  Phone,
  FileText,
  ExternalLink,
  RefreshCw,
  Plus
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const API = process.env.NEXT_PUBLIC_BACKEND_URL;

const WellbeingAdmin = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    scheduled: 0,
    in_progress: 0,
    resolved: 0,
    urgent_count: 0
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(searchParams.get('filter') || 'all');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    fetchRequests();
    fetchStats();
  }, []);

  const fetchRequests = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/wellbeing-admin/requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(response.data);
      setLastUpdated(new Date());
      if (isRefresh) toast.success('Data refreshed');
    } catch (error) {
      console.error('Failed to fetch requests', error);
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/wellbeing-admin/requests/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats', error);
    }
  };

  const handleSchedule = async () => {
    if (!selectedRequest || !scheduledTime) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/api/wellbeing-admin/requests/${selectedRequest.id}/schedule`,
        { scheduled_time: scheduledTime },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Appointment scheduled');
      setShowScheduleDialog(false);
      setScheduledTime('');
      fetchRequests();
      fetchStats();
    } catch (error) {
      toast.error('Failed to schedule appointment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async (requestId) => {
    const notes = prompt('Enter resolution notes:');
    if (!notes) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/api/wellbeing-admin/requests/${requestId}/resolve`,
        { resolution_notes: notes },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Request resolved');
      setShowDetailDialog(false);
      fetchRequests();
      fetchStats();
    } catch (error) {
      toast.error('Failed to resolve request');
    }
  };

  const handleStatusChange = async (requestId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/api/wellbeing-admin/requests/${requestId}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Status updated');
      fetchRequests();
      fetchStats();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const getUrgencyBadge = (urgency) => {
    const styles = {
      urgent: 'bg-destructive/10 text-destructive animate-pulse',
      high: 'bg-muted text-foreground',
      normal: 'bg-muted text-foreground'
    };
    return <Badge className={styles[urgency] || styles.normal}>{urgency === 'urgent' && <AlertTriangle className="h-3 w-3 mr-1" />}{urgency}</Badge>;
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: { bg: 'bg-muted text-foreground', label: 'Pending' },
      scheduled: { bg: 'bg-muted text-foreground', label: 'Scheduled' },
      in_progress: { bg: 'bg-muted text-foreground', label: 'In Progress' },
      resolved: { bg: 'bg-success/10 text-success', label: 'Resolved' }
    };
    const style = styles[status] || styles.pending;
    return <Badge className={style.bg}>{style.label}</Badge>;
  };

  const filteredRequests = filter === 'all' ? requests : 
    filter === 'urgent' ? requests.filter(r => r.urgency === 'urgent' || r.urgency === 'high') :
    requests.filter(r => r.status === filter);

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-border"></div></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button onClick={() => router.push('/college-admin')} variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Wellbeing Requests</h1>
              <p className="text-muted-foreground text-sm">{stats.total} total requests</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdated && (
              <span className="text-sm text-muted-foreground">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { fetchRequests(true); fetchStats(); }} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
              <Button variant="outline" className="flex items-center gap-2" onClick={() => window.open('https://calendar.google.com', '_blank')}>
                <Calendar className="h-4 w-4" /> Open Calendar
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className={`cursor-pointer ${filter === 'all' ? 'ring-2 ring-border' : ''}`} onClick={() => setFilter('all')}>
            <CardContent className="p-4 text-center">
              <Heart className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer ${filter === 'pending' ? 'ring-2 ring-primary' : ''}`} onClick={() => setFilter('pending')}>
            <CardContent className="p-4 text-center">
              <Clock className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-primary">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer ${filter === 'scheduled' ? 'ring-2 ring-primary' : ''}`} onClick={() => setFilter('scheduled')}>
            <CardContent className="p-4 text-center">
              <Calendar className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-primary">{stats.scheduled}</p>
              <p className="text-xs text-muted-foreground">Scheduled</p>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer ${filter === 'urgent' ? 'ring-2 ring-destructive' : ''}`} onClick={() => setFilter('urgent')}>
            <CardContent className="p-4 text-center">
              <AlertTriangle className="h-6 w-6 text-destructive mx-auto mb-2" />
              <p className="text-2xl font-bold text-destructive">{stats.urgent_count}</p>
              <p className="text-xs text-muted-foreground">Urgent</p>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer ${filter === 'resolved' ? 'ring-2 ring-success' : ''}`} onClick={() => setFilter('resolved')}>
            <CardContent className="p-4 text-center">
              <CheckCircle className="h-6 w-6 text-success mx-auto mb-2" />
              <p className="text-2xl font-bold text-success">{stats.resolved}</p>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </CardContent>
          </Card>
        </div>

        {/* Urgent Alert */}
        {stats.urgent_count > 0 && (
          <Card className="mb-6 border-destructive bg-destructive/5">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-destructive animate-pulse" />
                <div>
                  <p className="font-semibold text-destructive">Urgent Attention Required</p>
                  <p className="text-sm text-destructive">{stats.urgent_count} request(s) marked as urgent need immediate follow-up</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Requests List */}
        <div className="space-y-4">
          {filteredRequests.length === 0 ? (
            <Card className="p-12 text-center">
              <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No wellbeing requests in this category</p>
            </Card>
          ) : (
            filteredRequests.map(request => (
              <Card key={request.id} className={`hover:shadow-md transition-shadow ${request.urgency === 'urgent' ? 'border-destructive bg-destructive/5/50' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-5 w-5 text-muted-foreground" />
                        <span className="font-semibold">{request.student_name}</span>
                        {getUrgencyBadge(request.urgency)}
                        {getStatusBadge(request.status)}
                        <Badge variant="outline">{request.type}</Badge>
                      </div>
                      <p className="text-muted-foreground mb-2">{request.description}</p>
                      <p className="text-sm text-muted-foreground">
                        Submitted: {new Date(request.created_at).toLocaleDateString()}
                        {request.scheduled_time && ` • Scheduled: ${new Date(request.scheduled_time).toLocaleString()}`}
                        {request.assigned_to_name && ` • Assigned to: ${request.assigned_to_name}`}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => { setSelectedRequest(request); setShowDetailDialog(true); }}>
                        <FileText className="h-4 w-4 mr-1" /> Details
                      </Button>
                      {request.status === 'pending' && (
                        <Button size="sm" onClick={() => { setSelectedRequest(request); setShowScheduleDialog(true); }}>
                          <Calendar className="h-4 w-4 mr-1" /> Schedule
                        </Button>
                      )}
                      {request.urgency === 'urgent' && request.status === 'pending' && request.student_email && (
                        <Button size="sm" className="bg-destructive/80 hover:bg-destructive/90" onClick={() => window.location.href = `mailto:${request.student_email}`}>
                          <Phone className="h-4 w-4 mr-1" /> Contact Now
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Detail Dialog */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Details</DialogTitle>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Student</p>
                    <p className="font-medium">{selectedRequest.student_name}</p>
                    {selectedRequest.student_email && (
                      <p className="text-sm text-muted-foreground">{selectedRequest.student_email}</p>
                    )}
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Type</p>
                    <p className="font-medium">{selectedRequest.type}</p>
                  </div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Urgency</p>
                  <p className="font-medium">{selectedRequest.urgency}</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusBadge(selectedRequest.status)}
                    {selectedRequest.scheduled_time && (
                      <span className="text-sm text-muted-foreground">
                        Scheduled for: {new Date(selectedRequest.scheduled_time).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-medium mb-2">Description:</p>
                  <p className="text-muted-foreground">{selectedRequest.description}</p>
                </div>
                {selectedRequest.notes && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="font-medium mb-2">Staff Notes:</p>
                    <p className="text-muted-foreground">{selectedRequest.notes}</p>
                  </div>
                )}
                {selectedRequest.resolution_notes && (
                  <div className="p-4 bg-success/10 rounded-lg border border-success">
                    <p className="font-medium mb-2 text-success">Resolution Notes:</p>
                    <p className="text-success">{selectedRequest.resolution_notes}</p>
                  </div>
                )}
                <div className="p-3 bg-muted rounded-lg text-sm text-foreground">
                  <strong>Note:</strong> Per Australian legislation, maintain appropriate records and follow up within required timeframes.
                </div>
              </div>
            )}
            <DialogFooter className="flex gap-2">
              {selectedRequest && selectedRequest.status !== 'resolved' && (
                <>
                  {selectedRequest.status === 'pending' && (
                    <Button variant="outline" onClick={() => handleStatusChange(selectedRequest.id, 'in_progress')}>
                      Start Working
                    </Button>
                  )}
                  <Button variant="outline" className="text-success" onClick={() => handleResolve(selectedRequest.id)}>
                    <CheckCircle className="h-4 w-4 mr-1" /> Mark Resolved
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Schedule Dialog */}
        <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule Appointment</DialogTitle>
              <DialogDescription>
                Schedule a meeting with {selectedRequest?.student_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 my-4">
              <div>
                <Label>Date & Time</Label>
                <Input 
                  type="datetime-local" 
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>Cancel</Button>
              <Button onClick={handleSchedule} disabled={!scheduledTime || actionLoading}>
                {actionLoading ? 'Scheduling...' : 'Schedule Appointment'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default WellbeingAdmin;
