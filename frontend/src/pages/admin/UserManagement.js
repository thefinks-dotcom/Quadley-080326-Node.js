import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Search,
  Download,
  Upload,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Users,
  Filter,
  MoreHorizontal,
  UserPlus,
  Mail
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const API = process.env.REACT_APP_BACKEND_URL;

const UserManagement = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [floorFilter, setFloorFilter] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [userToToggle, setUserToToggle] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter users whenever search/filter changes
  useEffect(() => {
    let filtered = [...users];

    if (searchTerm) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(user => {
        const firstName = (user.first_name || '').toLowerCase();
        const lastName = (user.last_name || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        const fullName = `${firstName} ${lastName}`;
        
        return firstName.includes(term) ||
               lastName.includes(term) ||
               email.includes(term) ||
               fullName.includes(term);
      });
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    if (floorFilter !== 'all') {
      filtered = filtered.filter(user => user.floor === floorFilter);
    }

    setFilteredUsers(filtered);
  }, [searchTerm, roleFilter, floorFilter, users]);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/users/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
      setFilteredUsers(response.data); // Initialize filtered users
    } catch (error) {
      toast.error('Failed to fetch users');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = (userId) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id));
    }
  };

  const handleToggleStatus = async () => {
    if (!userToToggle) return;
    setStatusLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const newStatus = userToToggle.active === false;
      
      await axios.patch(
        `${API}/api/auth/users/${userToToggle.id}/status`,
        { active: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`User ${newStatus ? 'activated' : 'deactivated'} successfully`);
      setShowStatusDialog(false);
      setUserToToggle(null);
      fetchUsers();
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Failed to update user status');
    } finally {
      setStatusLoading(false);
    }
  };

  const exportUsers = () => {
    const csv = [
      ['First Name', 'Last Name', 'Email', 'Role', 'Floor', 'Status'].join(','),
      ...filteredUsers.map(user => [
        user.first_name || '',
        user.last_name || '',
        user.email,
        user.role || 'student',
        user.floor || '',
        user.active !== false ? 'Active' : 'Inactive'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success('Users exported successfully');
  };

  const getRoleBadge = (role) => {
    const styles = {
      admin: 'bg-muted text-foreground',
      super_admin: 'bg-muted text-foreground',
      ra: 'bg-muted text-foreground',
      student: 'bg-muted text-foreground'
    };
    return (
      <Badge className={`${styles[role] || styles.student} hover:${styles[role] || styles.student}`}>
        {role === 'super_admin' ? 'Super Admin' : role?.toUpperCase() || 'STUDENT'}
      </Badge>
    );
  };

  const uniqueFloors = [...new Set(users.map(u => u.floor).filter(Boolean))];
  const uniqueRoles = [...new Set(users.map(u => u.role).filter(Boolean))];

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
            <Button
              onClick={() => navigate('/admin')}
              variant="ghost"
              size="icon"
              className="shrink-0 hover:bg-muted"
            >
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">User Management</h1>
              <p className="text-muted-foreground text-sm mt-1">
                {filteredUsers.length} of {users.length} users
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => navigate('/admin/users/csv-upload')}
              variant="outline"
              className="flex items-center gap-2 h-10 border-border text-foreground hover:bg-muted"
            >
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
            <Button
              onClick={exportUsers}
              variant="outline"
              className="flex items-center gap-2 h-10 border-border text-foreground hover:bg-muted"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6 bg-white border border-border shadow-sm rounded-xl">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-11 border-border focus:border-border focus:ring-ring"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-4 py-2.5 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring focus:border-border"
                >
                  <option value="all">All Roles</option>
                  {uniqueRoles.map(role => (
                    <option key={role} value={role}>
                      {role === 'super_admin' ? 'Super Admin' : role?.charAt(0).toUpperCase() + role?.slice(1)}
                    </option>
                  ))}
                </select>
                <select
                  value={floorFilter}
                  onChange={(e) => setFloorFilter(e.target.value)}
                  className="px-4 py-2.5 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring focus:border-border"
                >
                  <option value="all">All Floors</option>
                  {uniqueFloors.map(floor => (
                    <option key={floor} value={floor}>{floor}</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedUsers.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {selectedUsers.length} user(s) selected
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedUsers([])}
                    className="h-7 px-2 text-muted-foreground hover:text-foreground"
                    title="Clear selection"
                  >
                    <XCircle className="h-4 w-4" />
                    <span className="ml-1 text-xs">Clear</span>
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex items-center gap-2 bg-success hover:bg-success h-9">
                    <CheckCircle className="h-4 w-4" />
                    Activate
                  </Button>
                  <Button size="sm" variant="outline" className="flex items-center gap-2 h-9 border-border">
                    <XCircle className="h-4 w-4" />
                    Deactivate
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Table */}
        <Card className="bg-white border border-border shadow-sm rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-4 sm:px-6 py-4 text-left">
                    <Checkbox
                      checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                    Role
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                    Floor
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-border">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No users found</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 sm:px-6 py-4">
                        <Checkbox
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={() => handleSelectUser(user.id)}
                        />
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-medium shrink-0">
                            {user.first_name?.[0]?.toUpperCase()}{user.last_name?.[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-foreground truncate">
                              {user.first_name} {user.last_name}
                            </div>
                            <div className="text-sm text-muted-foreground truncate flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 hidden md:table-cell">
                        {getRoleBadge(user.role)}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-foreground hidden lg:table-cell">
                        {user.floor || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <Badge className={`${
                          user.active !== false
                            ? 'bg-success/10 text-success hover:bg-success/10'
                            : 'bg-destructive/10 text-destructive hover:bg-destructive/10'
                        }`}>
                          {user.active !== false ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setUserToToggle(user);
                              setShowStatusDialog(true);
                            }}
                            title={user.active !== false ? 'Deactivate user' : 'Activate user'}
                          >
                            {user.active !== false ? (
                              <XCircle className="h-4 w-4 text-primary" />
                            ) : (
                              <CheckCircle className="h-4 w-4 text-success" />
                            )}
                          </Button>
                          <Button size="sm" variant="ghost">
                            <Edit className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setUserToDelete(user);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete User</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete <strong>{userToDelete?.first_name} {userToDelete?.last_name}</strong>?
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                Cancel
              </Button>
              <Button variant="destructive">
                Delete User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Activate/Deactivate Confirmation Dialog */}
        <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {userToToggle?.active !== false ? (
                  <><XCircle className="h-5 w-5 text-primary" /> Deactivate User</>
                ) : (
                  <><CheckCircle className="h-5 w-5 text-success" /> Activate User</>
                )}
              </DialogTitle>
              <DialogDescription>
                {userToToggle?.active !== false ? (
                  <>Are you sure you want to deactivate <strong>{userToToggle?.first_name} {userToToggle?.last_name}</strong>? They will no longer be able to log in.</>
                ) : (
                  <>Are you sure you want to activate <strong>{userToToggle?.first_name} {userToToggle?.last_name}</strong>? They will be able to log in again.</>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="p-4 bg-muted rounded-lg my-2">
              <p className="text-sm"><strong>Email:</strong> {userToToggle?.email}</p>
              <p className="text-sm"><strong>Role:</strong> {userToToggle?.role}</p>
              <p className="text-sm"><strong>Current Status:</strong> {userToToggle?.active !== false ? 'Active' : 'Inactive'}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowStatusDialog(false)} disabled={statusLoading}>
                Cancel
              </Button>
              <Button 
                onClick={handleToggleStatus} 
                disabled={statusLoading}
                className={userToToggle?.active !== false ? 'bg-warning hover:bg-warning' : 'bg-success hover:bg-success'}
              >
                {statusLoading ? 'Processing...' : (userToToggle?.active !== false ? 'Deactivate' : 'Activate')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default UserManagement;
