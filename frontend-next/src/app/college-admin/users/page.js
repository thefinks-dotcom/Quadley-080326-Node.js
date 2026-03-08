'use client';

import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { AuthContext } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  ArrowLeft,
  Users,
  UserPlus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Upload,
  Download,
  Mail
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const API = '';

const CollegeUserManagement = () => {
  const router = useRouter();
  const { user: currentUser } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [newUser, setNewUser] = useState({
    first_name: '',
    last_name: '',
    email: '',
    role: 'student',
    floor: '',
    phone: ''
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    let filtered = [...users];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(u =>
        u.first_name?.toLowerCase().includes(term) ||
        u.last_name?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term)
      );
    }
    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }
    setFilteredUsers(filtered);
  }, [searchTerm, roleFilter, users]);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/users/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
      setFilteredUsers(response.data);
    } catch (error) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/api/auth/register`, {
        ...newUser,
        password: 'TempPassword123!' // Temporary password
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('User created successfully! They will receive a welcome email.');
      setShowAddDialog(false);
      setNewUser({ first_name: '', last_name: '', email: '', role: 'student', floor: '', phone: '' });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (user) => {
    try {
      const token = localStorage.getItem('token');
      const newStatus = user.active === false;
      await axios.patch(`${API}/api/auth/users/${user.id}/status`, 
        { active: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`User ${newStatus ? 'activated' : 'deactivated'}`);
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update user status');
    }
  };

  const getRoleBadge = (role) => {
    const styles = {
      admin: 'bg-muted text-primary',
      ra: 'bg-info/10 text-primary',
      student: 'bg-muted text-foreground'
    };
    return <Badge className={styles[role] || styles.student}>{role?.toUpperCase()}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-muted">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-border"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <Button onClick={() => router.push('/college-admin')} variant="ghost" size="icon" className="hover:bg-muted">
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">User Management</h1>
              <p className="text-muted-foreground text-sm">{filteredUsers.length} users</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setShowAddDialog(true)} className="flex items-center gap-2 h-10 bg-primary hover:bg-primary text-white">
              <UserPlus className="h-4 w-4" /> Add User
            </Button>
            <Button onClick={() => router.push('/college-admin/users/import')} variant="outline" className="flex items-center gap-2 h-10 border-border hover:bg-muted">
              <Upload className="h-4 w-4" /> Import CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6 bg-white border border-border shadow-sm rounded-xl">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 border-border focus:border-border focus:ring-ring"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-4 py-2.5 border border-border rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-border"
              >
                <option value="all">All Roles</option>
                <option value="student">Students</option>
                <option value="ra">RAs</option>
                <option value="admin">Admins</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* User Table */}
        <Card className="bg-white border border-border shadow-sm rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase">User</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase">Role</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase">Floor</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-muted">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-semibold">
                          {user.first_name?.[0]}{user.last_name?.[0]}
                        </div>
                        <div>
                          <p className="font-medium">{user.first_name} {user.last_name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">{getRoleBadge(user.role)}</td>
                    <td className="px-6 py-4 text-muted-foreground">{user.floor || '—'}</td>
                    <td className="px-6 py-4">
                      <Badge className={user.active !== false ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}>
                        {user.active !== false ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleToggleStatus(user)}>
                          {user.active !== false ? <XCircle className="h-4 w-4 text-primary" /> : <CheckCircle className="h-4 w-4 text-success" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setSelectedUser(user); setShowEditDialog(true); }}>
                          <Edit className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Add User Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>Create a new user account. They will receive an email to set their password.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>First Name *</Label>
                  <Input value={newUser.first_name} onChange={(e) => setNewUser({...newUser, first_name: e.target.value})} required />
                </div>
                <div>
                  <Label>Last Name *</Label>
                  <Input value={newUser.last_name} onChange={(e) => setNewUser({...newUser, last_name: e.target.value})} required />
                </div>
              </div>
              <div>
                <Label>Email *</Label>
                <Input type="email" value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Role</Label>
                  <select value={newUser.role} onChange={(e) => setNewUser({...newUser, role: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                    <option value="student">Student</option>
                    <option value="ra">RA</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {newUser.role !== 'admin' && (
                  <div>
                    <Label>Floor</Label>
                    <Input value={newUser.floor} onChange={(e) => setNewUser({...newUser, floor: e.target.value})} />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                <Button type="submit" disabled={actionLoading}>{actionLoading ? 'Creating...' : 'Create User'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default CollegeUserManagement;
