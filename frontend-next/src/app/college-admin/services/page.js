'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  Search,
  Wrench,
  Clock,
  CheckCircle,
  AlertTriangle,
  User,
  MapPin,
  Send,
  Mail,
  UserCheck,
  Plus,
  RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const API = '';

const ServiceRequests = () => {
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showAddFacilitatorDialog, setShowAddFacilitatorDialog] = useState(false);
  const [facilitators, setFacilitators] = useState([]);
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [newFacilitator, setNewFacilitator] = useState({ name: '', email: '', category: 'General' });
  const [assigning, setAssigning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    fetchRequests();
    fetchFacilitators();
  }, []);

  useEffect(() => {
    let filtered = [...requests];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.student_name?.toLowerCase().includes(term) ||
        r.description?.toLowerCase().includes(term) ||
        r.room_number?.toLowerCase().includes(term) ||
        r.assigned_facilitator_name?.toLowerCase().includes(term)
      );
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }
    setFilteredRequests(filtered);
  }, [searchTerm, statusFilter, requests]);

  const fetchRequests = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const response = await axios.get(`${API}/api/maintenance`, {
      });
      setRequests(response.data);
      setFilteredRequests(response.data);
      setLastUpdated(new Date());
      if (isRefresh) toast.success('Data refreshed');
    } catch (error) {
      console.error('Failed to fetch requests', error);
      toast.error('Failed to load service requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchFacilitators = async () => {
    try {
      const response = await axios.get(`${API}/api/maintenance/facilitators/list`, {
      });
      setFacilitators(response.data);
    } catch (error) {
      // Use defaults if API fails
      setFacilitators([
        { id: '1', name: 'Maintenance Team', email: 'maintenance@college.edu', category: 'General' },
        { id: '2', name: 'IT Support', email: 'it@college.edu', category: 'Electrical' },
        { id: '3', name: 'Housekeeping', email: 'housekeeping@college.edu', category: 'Cleaning' },
        { id: '4', name: 'Facilities Manager', email: 'facilities@college.edu', category: 'HVAC' },
        { id: '5', name: 'Plumbing Services', email: 'plumbing@college.edu', category: 'Plumbing' }
      ]);
    }
  };

  const handleAssign = async (facilitator) => {
    if (!selectedRequest) return;
    setAssigning(true);
    
    try {
      await axios.post(
        `${API}/api/maintenance/${selectedRequest.id}/assign`,
        {
          facilitator_name: facilitator.name,
          facilitator_email: facilitator.email,
          notes: assignmentNotes
        }
      );
      
      toast.success(`Request assigned to ${facilitator.name}`);
      setShowAssignDialog(false);
      setSelectedRequest(null);
      setAssignmentNotes('');
      fetchRequests();
    } catch (error) {
      toast.error('Failed to assign request');
    } finally {
      setAssigning(false);
    }
  };

  const handleAddFacilitator = async () => {
    if (!newFacilitator.name || !newFacilitator.email) {
      toast.error('Name and email are required');
      return;
    }

    try {
      await axios.post(
        `${API}/api/maintenance/facilitators`,
        newFacilitator
      );
      
      toast.success('Facilitator added');
      setShowAddFacilitatorDialog(false);
      setNewFacilitator({ name: '', email: '', category: 'General' });
      fetchFacilitators();
    } catch (error) {
      toast.error('Failed to add facilitator');
    }
  };

  const handleStatusChange = async (requestId, newStatus) => {
    try {
      await axios.patch(`${API}/api/maintenance/${requestId}`, 
        { status: newStatus }
      );
      toast.success('Status updated');
      fetchRequests();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-muted text-foreground',
      in_progress: 'bg-muted text-foreground',
      resolved: 'bg-success/10 text-success'
    };
    return <Badge className={styles[status] || styles.pending}>{status?.replace('_', ' ')}</Badge>;
  };

  const getPriorityBadge = (priority) => {
    const styles = {
      normal: 'bg-muted text-muted-foreground',
      high: 'bg-muted text-foreground',
      urgent: 'bg-destructive/10 text-destructive'
    };
    return <Badge className={styles[priority] || styles.normal}>{priority}</Badge>;
  };

  // Get suggested facilitator based on issue type
  const getSuggestedFacilitator = (issueType) => {
    const mapping = {
      'Plumbing': 'Plumbing',
      'Electrical': 'Electrical',
      'HVAC': 'HVAC',
      'Cleaning': 'Cleaning'
    };
    const category = mapping[issueType] || 'General';
    return facilitators.find(f => f.category === category) || facilitators[0];
  };

  const stats = {
    pending: requests.filter(r => r.status === 'pending').length,
    inProgress: requests.filter(r => r.status === 'in_progress').length,
    resolved: requests.filter(r => r.status === 'resolved').length
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-border"></div></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button onClick={() => router.push('/college-admin')} variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Service Requests</h1>
              <p className="text-muted-foreground text-sm">{filteredRequests.length} requests</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdated && (
              <span className="text-sm text-muted-foreground">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => fetchRequests(true)} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
              <Button variant="outline" onClick={() => setShowAddFacilitatorDialog(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add Facilitator
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className={`cursor-pointer ${statusFilter === 'pending' ? 'ring-2 ring-primary' : ''}`} onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}>
            <CardContent className="p-4 text-center">
              <Clock className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer ${statusFilter === 'in_progress' ? 'ring-2 ring-primary' : ''}`} onClick={() => setStatusFilter(statusFilter === 'in_progress' ? 'all' : 'in_progress')}>
            <CardContent className="p-4 text-center">
              <Wrench className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.inProgress}</p>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer ${statusFilter === 'resolved' ? 'ring-2 ring-success' : ''}`} onClick={() => setStatusFilter(statusFilter === 'resolved' ? 'all' : 'resolved')}>
            <CardContent className="p-4 text-center">
              <CheckCircle className="h-6 w-6 text-success mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.resolved}</p>
              <p className="text-sm text-muted-foreground">Resolved</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name, room, description, or assignee..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
          </CardContent>
        </Card>

        {/* Requests List */}
        <div className="space-y-4">
          {filteredRequests.length === 0 ? (
            <Card className="p-12 text-center">
              <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No service requests found</p>
            </Card>
          ) : (
            filteredRequests.map(request => (
              <Card key={request.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="font-semibold text-lg">{request.issue_type}</h3>
                        {getStatusBadge(request.status)}
                        {getPriorityBadge(request.priority)}
                      </div>
                      <p className="text-muted-foreground mb-2">{request.description}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><User className="h-4 w-4" /> {request.student_name}</span>
                        <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> Room {request.room_number}</span>
                        <span>{new Date(request.created_at).toLocaleDateString()}</span>
                      </div>
                      
                      {/* Assignment Info */}
                      {request.assigned_facilitator_name && (
                        <div className="mt-3 p-3 bg-muted rounded-lg border border-border">
                          <div className="flex items-center gap-2 text-foreground">
                            <UserCheck className="h-4 w-4" />
                            <span className="font-medium">Assigned to: {request.assigned_facilitator_name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-primary text-sm mt-1">
                            <Mail className="h-3 w-3" />
                            <a href={`mailto:${request.assigned_facilitator_email}`} className="hover:underline">
                              {request.assigned_facilitator_email}
                            </a>
                          </div>
                          {request.assignment_notes && (
                            <p className="text-sm text-primary mt-2">Notes: {request.assignment_notes}</p>
                          )}
                          <p className="text-xs text-primary mt-1">
                            Assigned by {request.assigned_by_name} on {new Date(request.assigned_at).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2 flex-wrap">
                      {request.status !== 'resolved' && (
                        <Button variant="outline" size="sm" onClick={() => { setSelectedRequest(request); setShowAssignDialog(true); }}>
                          <Send className="h-4 w-4 mr-1" /> {request.assigned_facilitator_name ? 'Reassign' : 'Assign'}
                        </Button>
                      )}
                      {request.status === 'pending' && (
                        <Button size="sm" onClick={() => handleStatusChange(request.id, 'in_progress')}>Start</Button>
                      )}
                      {request.status === 'in_progress' && (
                        <Button size="sm" className="bg-success hover:bg-success" onClick={() => handleStatusChange(request.id, 'resolved')}>Resolve</Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Assign Dialog */}
        <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Assign to Facilitator</DialogTitle>
              <DialogDescription>
                {selectedRequest && (
                  <span>Assign "{selectedRequest.issue_type}" request to a team or person.</span>
                )}
              </DialogDescription>
            </DialogHeader>
            
            {selectedRequest && (
              <div className="p-3 bg-muted rounded-lg border border-border mb-4">
                <p className="text-sm text-foreground">
                  <strong>Suggested:</strong> {getSuggestedFacilitator(selectedRequest.issue_type)?.name} 
                  (based on issue type: {selectedRequest.issue_type})
                </p>
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {facilitators.map(f => (
                <button
                  key={f.id}
                  onClick={() => handleAssign(f)}
                  disabled={assigning}
                  className="w-full p-4 text-left border rounded-lg hover:bg-muted transition-colors disabled:opacity-50 flex items-start justify-between"
                >
                  <div>
                    <p className="font-medium">{f.name}</p>
                    <p className="text-sm text-muted-foreground">{f.email}</p>
                    <Badge variant="outline" className="mt-1 text-xs">{f.category}</Badge>
                  </div>
                  {selectedRequest?.issue_type && getSuggestedFacilitator(selectedRequest.issue_type)?.id === f.id && (
                    <Badge className="bg-success/10 text-success">Recommended</Badge>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <Label>Assignment Notes (optional)</Label>
              <Textarea 
                placeholder="Add any notes for the facilitator..."
                value={assignmentNotes}
                onChange={(e) => setAssignmentNotes(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAssignDialog(false)}>Cancel</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Facilitator Dialog */}
        <Dialog open={showAddFacilitatorDialog} onOpenChange={setShowAddFacilitatorDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Facilitator/Team</DialogTitle>
              <DialogDescription>Add a new team or person who can receive service requests.</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 my-4">
              <div>
                <Label>Name *</Label>
                <Input 
                  placeholder="e.g., Plumbing Services"
                  value={newFacilitator.name}
                  onChange={(e) => setNewFacilitator({...newFacilitator, name: e.target.value})}
                />
              </div>
              <div>
                <Label>Email *</Label>
                <Input 
                  type="email"
                  placeholder="e.g., plumbing@college.edu"
                  value={newFacilitator.email}
                  onChange={(e) => setNewFacilitator({...newFacilitator, email: e.target.value})}
                />
              </div>
              <div>
                <Label>Category</Label>
                <select 
                  value={newFacilitator.category}
                  onChange={(e) => setNewFacilitator({...newFacilitator, category: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg mt-1"
                >
                  <option value="General">General</option>
                  <option value="Plumbing">Plumbing</option>
                  <option value="Electrical">Electrical</option>
                  <option value="HVAC">HVAC</option>
                  <option value="Cleaning">Cleaning</option>
                  <option value="IT">IT</option>
                  <option value="Security">Security</option>
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddFacilitatorDialog(false)}>Cancel</Button>
              <Button onClick={handleAddFacilitator}>Add Facilitator</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ServiceRequests;
