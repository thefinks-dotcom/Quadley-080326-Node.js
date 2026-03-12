'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  Users,
  Search,
  Trophy,
  Palette,
  Users2,
  RefreshCw,
  Calendar,
  Crown,
  Mail,
  UserCog,
  X,
  Check
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const API = '';

const CoCurricularAdmin = () => {
  const router = useRouter();
  const [groups, setGroups] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Modal states
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showChangeAdminModal, setShowChangeAdminModal] = useState(false);
  const [newAdminId, setNewAdminId] = useState('');
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchGroups();
    fetchUsers();
  }, []);

  const fetchGroups = async () => {
    setRefreshing(true);
    try {
      const response = await axios.get(`${API}/api/cocurricular/groups/all`, {
      });
      setGroups(response.data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch groups', error);
      toast.error('Failed to load co-curricular groups');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/api/users/list`, {
      });
      setAllUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users', error);
    }
  };

  const handleChangeAdmin = async () => {
    if (!newAdminId || !selectedGroup) {
      toast.error('Please select a new admin');
      return;
    }

    setSaving(true);
    try {
      const newAdmin = allUsers.find(u => u.id === newAdminId);
      
      await axios.patch(`${API}/api/cocurricular/groups/${selectedGroup.id}/admin`, {
        new_owner_id: newAdminId,
        new_owner_name: `${newAdmin.first_name} ${newAdmin.last_name}`
      }, {
      });
      
      toast.success('Admin changed successfully');
      setShowChangeAdminModal(false);
      setShowDetailModal(false);
      setNewAdminId('');
      setAdminSearchTerm('');
      fetchGroups();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change admin');
    } finally {
      setSaving(false);
    }
  };

  const openGroupDetail = (group) => {
    setSelectedGroup(group);
    setShowDetailModal(true);
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'sports': return <Trophy className="h-5 w-5 text-primary" />;
      case 'clubs': return <Users2 className="h-5 w-5 text-primary" />;
      case 'cultural': return <Palette className="h-5 w-5 text-primary" />;
      default: return <Users className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getTypeBadgeColor = (type) => {
    switch (type) {
      case 'sports': return 'bg-muted text-foreground';
      case 'clubs': return 'bg-muted text-foreground';
      case 'cultural': return 'bg-muted text-foreground';
      default: return 'bg-muted text-foreground';
    }
  };

  const filteredGroups = groups.filter(group => {
    const matchesSearch = group.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         group.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || group.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const groupsByType = {
    sports: groups.filter(g => g.type === 'sports'),
    clubs: groups.filter(g => g.type === 'clubs'),
    cultural: groups.filter(g => g.type === 'cultural')
  };

  // Filter users for admin selection (exclude current admin)
  const filteredUsersForAdmin = allUsers.filter(u => {
    if (selectedGroup && u.id === selectedGroup.owner_id) return false;
    const fullName = `${u.first_name} ${u.last_name}`.toLowerCase();
    return fullName.includes(adminSearchTerm.toLowerCase()) || 
           u.email?.toLowerCase().includes(adminSearchTerm.toLowerCase());
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-muted">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-border"></div>
      </div>
    );
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
              <h1 className="text-2xl font-bold text-foreground">Co-curricular Groups</h1>
              <p className="text-muted-foreground text-sm">{groups.length} total groups</p>
            </div>
          </div>
          <Button
            onClick={fetchGroups}
            variant="outline"
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        {lastUpdated && (
          <p className="text-xs text-muted-foreground mb-4">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        )}

        {/* Stats - Clickable Filters */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card 
            className={`bg-muted border-border cursor-pointer transition-all hover:shadow-md ${typeFilter === 'sports' ? 'ring-2 ring-warning' : ''}`}
            onClick={() => setTypeFilter(typeFilter === 'sports' ? 'all' : 'sports')}
          >
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Trophy className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold text-foreground">{groupsByType.sports.length}</p>
                  <p className="text-sm text-primary">Sports Teams</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card 
            className={`bg-muted border-border cursor-pointer transition-all hover:shadow-md ${typeFilter === 'clubs' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setTypeFilter(typeFilter === 'clubs' ? 'all' : 'clubs')}
          >
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Users2 className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold text-primary">{groupsByType.clubs.length}</p>
                  <p className="text-sm text-primary">Clubs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card 
            className={`bg-muted border-border cursor-pointer transition-all hover:shadow-md ${typeFilter === 'cultural' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setTypeFilter(typeFilter === 'cultural' ? 'all' : 'cultural')}
          >
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Palette className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold text-primary">{groupsByType.cultural.length}</p>
                  <p className="text-sm text-primary">Cultural Groups</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search groups..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg bg-white"
              >
                <option value="all">All Types</option>
                <option value="sports">Sports</option>
                <option value="clubs">Clubs</option>
                <option value="cultural">Cultural</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Groups List */}
        {filteredGroups.length === 0 ? (
          <Card className="p-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-lg">No co-curricular groups found</p>
            <p className="text-muted-foreground text-sm mt-2">
              {groups.length === 0 
                ? 'Groups can be created by students in the main app' 
                : 'Try adjusting your search or filter'}
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredGroups.map(group => (
              <Card 
                key={group.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => openGroupDetail(group)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-muted rounded-lg">
                        {getTypeIcon(group.type)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg">{group.name}</h3>
                          <Badge className={getTypeBadgeColor(group.type)}>
                            {group.type}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-sm mb-3">{group.description}</p>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {group.members?.length || 0} members
                          </span>
                          {group.meeting_times && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {group.meeting_times}
                            </span>
                          )}
                          {group.owner_name && (
                            <span className="flex items-center gap-1">
                              <Crown className="h-4 w-4 text-primary" />
                              {group.owner_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        Created {new Date(group.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-primary mt-1">Click to view details →</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Group Detail Modal */}
        <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                {selectedGroup && getTypeIcon(selectedGroup.type)}
                {selectedGroup?.name}
              </DialogTitle>
              <DialogDescription>{selectedGroup?.description}</DialogDescription>
            </DialogHeader>

            {selectedGroup && (
              <div className="space-y-6">
                {/* Group Info */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">Type</p>
                    <Badge className={getTypeBadgeColor(selectedGroup.type)}>{selectedGroup.type}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="text-sm font-medium">{new Date(selectedGroup.created_at).toLocaleDateString()}</p>
                  </div>
                  {selectedGroup.meeting_times && (
                    <div>
                      <p className="text-xs text-muted-foreground">Meeting Times</p>
                      <p className="text-sm font-medium">{selectedGroup.meeting_times}</p>
                    </div>
                  )}
                  {selectedGroup.competition_times && (
                    <div>
                      <p className="text-xs text-muted-foreground">Competition Times</p>
                      <p className="text-sm font-medium">{selectedGroup.competition_times}</p>
                    </div>
                  )}
                </div>

                {/* Current Admin */}
                <div className="p-4 bg-muted border border-border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Crown className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-xs text-primary">Current Admin</p>
                        <p className="font-semibold text-foreground">{selectedGroup.owner_name || 'Not assigned'}</p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowChangeAdminModal(true)}
                      className="flex items-center gap-2"
                    >
                      <UserCog className="h-4 w-4" />
                      Change Admin
                    </Button>
                  </div>
                </div>

                {/* Members List */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Members ({selectedGroup.members?.length || 0})
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedGroup.member_names && selectedGroup.member_names.length > 0 ? (
                      selectedGroup.member_names.map((name, idx) => {
                        const isOwner = selectedGroup.members?.[idx] === selectedGroup.owner_id;
                        return (
                          <div 
                            key={idx} 
                            className={`flex items-center justify-between p-3 rounded-lg ${isOwner ? 'bg-muted border border-border' : 'bg-muted'}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                                {name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <span className="font-medium">{name}</span>
                            </div>
                            {isOwner && (
                              <Badge className="bg-muted text-foreground">
                                <Crown className="h-3 w-3 mr-1" /> Admin
                              </Badge>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-muted-foreground text-center py-4">No members yet</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetailModal(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Change Admin Modal */}
        <Dialog open={showChangeAdminModal} onOpenChange={setShowChangeAdminModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5" />
                Change Group Admin
              </DialogTitle>
              <DialogDescription>
                Select a new admin for {selectedGroup?.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Search Users</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={adminSearchTerm}
                    onChange={(e) => setAdminSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-2">
                {filteredUsersForAdmin.slice(0, 20).map(user => (
                  <div
                    key={user.id}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                      newAdminId === user.id ? 'bg-muted border border-border' : 'bg-muted hover:bg-muted'
                    }`}
                    onClick={() => setNewAdminId(user.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                        {user.first_name?.[0]}{user.last_name?.[0]}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{user.first_name} {user.last_name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    {newAdminId === user.id && (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                  </div>
                ))}
                {filteredUsersForAdmin.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">No users found</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowChangeAdminModal(false); setNewAdminId(''); setAdminSearchTerm(''); }}>
                Cancel
              </Button>
              <Button onClick={handleChangeAdmin} disabled={!newAdminId || saving}>
                {saving ? 'Saving...' : 'Confirm Change'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default CoCurricularAdmin;
