'use client';

import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { AuthContext } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  ArrowLeft, Package, Plus, CheckCircle, Clock, Search,
  User, X, RefreshCw, Inbox
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

const API = '/api';

const ParcelsAdmin = () => {
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const [parcels, setParcels] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('waiting');
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newParcel, setNewParcel] = useState({
    student_id: '',
    tracking_number: '',
    sender_name: '',
    description: ''
  });

  useEffect(() => {
    fetchParcels();
    fetchUsers();
  }, []);

  const fetchParcels = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await axios.get(`${API}/parcels`);
      setParcels(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error('Failed to load parcels');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API}/users/list`);
      setUsers(Array.isArray(res.data) ? res.data.filter(u => u.role === 'student' || u.role === 'ra') : []);
    } catch {
      // non-critical
    }
  };

  const handleAddParcel = async (e) => {
    e.preventDefault();
    if (!newParcel.student_id) { toast.error('Please select a resident'); return; }
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/parcels`, newParcel);
      setParcels(prev => [res.data, ...prev]);
      toast.success('Parcel logged and resident notified');
      setShowAddModal(false);
      setNewParcel({ student_id: '', tracking_number: '', sender_name: '', description: '' });
    } catch {
      toast.error('Failed to log parcel');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkCollected = async (parcelId) => {
    try {
      await axios.put(`${API}/parcels/${parcelId}/collect`, {});
      setParcels(prev => prev.map(p =>
        p.id === parcelId ? { ...p, status: 'collected', collected_at: new Date().toISOString() } : p
      ));
      toast.success('Parcel marked as collected');
    } catch {
      toast.error('Failed to update parcel');
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = Math.floor((now - d) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return d.toLocaleDateString();
  };

  const pending = parcels.filter(p => p.status === 'waiting');
  const today = new Date().toDateString();
  const collectedToday = parcels.filter(p => p.status === 'collected' && p.collected_at && new Date(p.collected_at).toDateString() === today);

  const filtered = parcels.filter(p => {
    const matchesFilter = filter === 'all' || p.status === filter;
    const matchesSearch = !search ||
      p.student_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.student_email?.toLowerCase().includes(search.toLowerCase()) ||
      p.tracking_number?.toLowerCase().includes(search.toLowerCase()) ||
      p.sender_name?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-muted">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Banner */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => router.push('/college-admin')}
            className="flex items-center gap-1 text-white/70 hover:text-white mb-3 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-white" />
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Parcels</h1>
                <p className="text-white/80 text-sm mt-0.5">
                  {pending.length} parcel{pending.length !== 1 ? 's' : ''} awaiting collection
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchParcels(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white text-amber-600 rounded-lg hover:bg-white/90 transition-colors font-medium text-sm"
              >
                <Plus className="w-4 h-4" />
                Log Parcel
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card className="bg-white border border-border">
            <CardContent className="p-5 text-center">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-2">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <p className="text-3xl font-bold text-amber-600">{pending.length}</p>
              <p className="text-sm text-muted-foreground mt-1">Awaiting Collection</p>
            </CardContent>
          </Card>
          <Card className="bg-white border border-border">
            <CardContent className="p-5 text-center">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-green-600">{collectedToday.length}</p>
              <p className="text-sm text-muted-foreground mt-1">Collected Today</p>
            </CardContent>
          </Card>
          <Card className="bg-white border border-border">
            <CardContent className="p-5 text-center">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                <Package className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-3xl font-bold text-foreground">{parcels.length}</p>
              <p className="text-sm text-muted-foreground mt-1">Total Logged</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters + Search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex rounded-lg border border-border overflow-hidden bg-white">
            {[
              { key: 'waiting', label: 'Pending' },
              { key: 'collected', label: 'Collected' },
              { key: 'all', label: 'All' }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${filter === key ? 'bg-amber-500 text-white' : 'text-muted-foreground hover:bg-muted'}`}
              >
                {label}
                {key === 'waiting' && pending.length > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-bold ${filter === 'waiting' ? 'bg-white/30 text-white' : 'bg-amber-100 text-amber-700'}`}>
                    {pending.length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, tracking number..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
        </div>

        {/* Parcel List */}
        {filtered.length === 0 ? (
          <Card className="bg-white border border-border">
            <CardContent className="p-16 text-center">
              <Inbox className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="font-medium text-foreground">
                {filter === 'waiting' ? 'No parcels awaiting collection' :
                 filter === 'collected' ? 'No collected parcels' :
                 search ? 'No parcels match your search' : 'No parcels logged yet'}
              </p>
              {filter === 'waiting' && !search && (
                <p className="text-sm text-muted-foreground mt-1">Log a parcel to notify a resident</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(parcel => (
              <Card
                key={parcel.id}
                className={`bg-white border transition-all ${parcel.status === 'waiting' ? 'border-amber-200 shadow-sm' : 'border-border opacity-75'}`}
              >
                <CardContent className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-lg ${parcel.status === 'collected' ? 'bg-green-50' : 'bg-amber-50'}`}>
                        <Package className={`w-5 h-5 ${parcel.status === 'collected' ? 'text-green-600' : 'text-amber-600'}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{parcel.student_name}</p>
                        <p className="text-xs text-muted-foreground">{parcel.student_email}</p>
                      </div>
                    </div>
                    <Badge className={`text-xs shrink-0 ${parcel.status === 'collected' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                      {parcel.status === 'collected' ? 'Collected' : 'Pending'}
                    </Badge>
                  </div>

                  {/* Details */}
                  {(parcel.sender_name || parcel.tracking_number || parcel.description) && (
                    <div className="bg-muted rounded-lg p-3 mb-3 space-y-1 text-xs">
                      {parcel.sender_name && (
                        <p className="text-muted-foreground">From: <span className="text-foreground font-medium">{parcel.sender_name}</span></p>
                      )}
                      {parcel.tracking_number && (
                        <p className="text-muted-foreground">Tracking: <span className="text-foreground font-mono">{parcel.tracking_number}</span></p>
                      )}
                      {parcel.description && (
                        <p className="text-muted-foreground">{parcel.description}</p>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {parcel.status === 'collected' && parcel.collected_at
                        ? `Collected ${formatTime(parcel.collected_at)}`
                        : `Logged ${formatTime(parcel.created_at)}`}
                    </p>
                    {parcel.status === 'waiting' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 border-green-300 text-green-700 hover:bg-green-50"
                        onClick={() => handleMarkCollected(parcel.id)}
                      >
                        <CheckCircle className="w-3 h-3" />
                        Mark Collected
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Parcel Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-600" />
                <h2 className="font-semibold text-foreground">Log New Parcel</h2>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-muted rounded">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <form onSubmit={handleAddParcel} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Resident <span className="text-destructive">*</span></label>
                <select
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={newParcel.student_id}
                  onChange={e => setNewParcel(p => ({ ...p, student_id: e.target.value }))}
                  required
                >
                  <option value="">Select a resident...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name} — {u.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Sender Name</label>
                <Input
                  placeholder="e.g. Amazon, Mum & Dad..."
                  value={newParcel.sender_name}
                  onChange={e => setNewParcel(p => ({ ...p, sender_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Tracking Number</label>
                <Input
                  placeholder="Optional"
                  value={newParcel.tracking_number}
                  onChange={e => setNewParcel(p => ({ ...p, tracking_number: e.target.value }))}
                  className="font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                <Input
                  placeholder="e.g. Small box, envelope..."
                  value={newParcel.description}
                  onChange={e => setNewParcel(p => ({ ...p, description: e.target.value }))}
                />
              </div>
              <p className="text-xs text-muted-foreground">The resident will receive a push notification when their parcel is logged.</p>
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white">
                  {submitting ? 'Logging...' : 'Log Parcel'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParcelsAdmin;
