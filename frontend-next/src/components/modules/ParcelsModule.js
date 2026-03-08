'use client';

import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext, API } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Package, Clock, CheckCircle, Plus, Search, User } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';

const ADMIN_ROLES = ['admin', 'super_admin', 'college_admin', 'ra'];

function ParcelCard({ parcel, isAdmin, onCollect, showCollectedDate }) {
  return (
    <Card className={`p-4 ${parcel.status === 'waiting' ? 'border-warning/40 bg-warning/5' : ''}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${parcel.status === 'waiting' ? 'bg-warning/20' : 'bg-success/10'}`}>
          {parcel.status === 'waiting'
            ? <Package className="h-5 w-5 text-warning" />
            : <CheckCircle className="h-5 w-5 text-success" />
          }
        </div>
        <div className="flex-1 min-w-0">
          {isAdmin && parcel.student_name && (
            <p className="font-bold text-sm mb-0.5">{parcel.student_name}</p>
          )}
          {parcel.sender_name && (
            <p className="text-sm font-semibold">From: {parcel.sender_name}</p>
          )}
          {parcel.tracking_number && (
            <p className="text-xs text-muted-foreground font-mono mt-0.5">Tracking: {parcel.tracking_number}</p>
          )}
          {parcel.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{parcel.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1.5">
            {parcel.status === 'waiting' ? (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> Arrived {new Date(parcel.created_at).toLocaleString()}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-success" />
                Collected {parcel.collected_at ? new Date(parcel.collected_at).toLocaleDateString() : ''}
              </span>
            )}
          </p>
          {isAdmin && parcel.created_by_name && (
            <p className="text-xs text-muted-foreground mt-0.5">Logged by {parcel.created_by_name}</p>
          )}
        </div>
        {parcel.status === 'waiting' && onCollect && (
          <Button size="sm" onClick={onCollect} className="flex-shrink-0 ml-2">
            ✓ Collected
          </Button>
        )}
      </div>
    </Card>
  );
}

const ParcelsModule = () => {
  const { user } = useContext(AuthContext);
  const isAdmin = ADMIN_ROLES.includes(user?.role);

  const [tab, setTab] = useState('pending');
  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [form, setForm] = useState({ student_id: '', sender_name: '', tracking_number: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    fetchParcels();
    if (isAdmin) fetchStudents();
  }, []);

  const fetchParcels = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/parcels`);
      setParcels(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error('Failed to load parcels');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await axios.get(`${API}/users`);
      setStudents((Array.isArray(res.data) ? res.data : []).filter(u => u.role === 'student'));
    } catch {}
  };

  const markCollected = async (parcelId) => {
    try {
      await axios.put(`${API}/parcels/${parcelId}/collect`);
      toast.success('Parcel marked as collected');
      fetchParcels();
    } catch {
      toast.error('Failed to update parcel status');
    }
  };

  const submitParcel = async (e) => {
    e.preventDefault();
    if (!form.student_id) { toast.error('Please select a student'); return; }
    setSubmitting(true);
    try {
      await axios.post(`${API}/parcels`, form);
      toast.success('Parcel logged — student has been notified');
      setForm({ student_id: '', sender_name: '', tracking_number: '', description: '' });
      setStudentSearch('');
      fetchParcels();
      setTab('pending');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to log parcel');
    } finally {
      setSubmitting(false); }
  };

  const pending = parcels.filter(p => p.status === 'waiting');
  const collected = parcels.filter(p => p.status === 'collected');

  const filteredStudents = students.filter(s => {
    if (!studentSearch.trim()) return true;
    const q = studentSearch.toLowerCase();
    return `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
      (s.room || '').toLowerCase().includes(q) ||
      (s.floor || '').toLowerCase().includes(q);
  });

  const adminTabs = [
    { key: 'pending', label: 'Pending', count: pending.length },
    { key: 'log', label: 'Log Parcel', count: null },
    { key: 'history', label: 'History', count: null },
  ];
  const studentTabs = [
    { key: 'pending', label: 'Waiting', count: pending.length },
    { key: 'history', label: 'Collected', count: null },
  ];
  const tabs = isAdmin ? adminTabs : studentTabs;

  return (
    <div className="min-h-screen bg-background">
      <ModuleHeader title="Packages" showBack={true} showSearch={false} />
      <div className="px-4 pt-4 pb-10 space-y-4 max-w-2xl mx-auto">

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-2xl p-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-sm font-medium transition-all ${
                tab === t.key ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
              {t.count !== null && t.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold leading-none ${
                  tab === t.key ? 'bg-primary text-white' : 'bg-muted-foreground/20 text-muted-foreground'
                }`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {loading && (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading parcels...</div>
        )}

        {/* ── PENDING ── */}
        {!loading && tab === 'pending' && (
          pending.length === 0 ? (
            <div className="text-center py-14">
              <Package className="h-14 w-14 text-muted-foreground/20 mx-auto mb-3" />
              <p className="font-medium text-muted-foreground">No parcels waiting</p>
              <p className="text-sm text-muted-foreground mt-1">
                {isAdmin
                  ? 'Use the "Log Parcel" tab to record a new arrival.'
                  : "You'll be notified here when something arrives at reception."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map(p => (
                <ParcelCard
                  key={p.id}
                  parcel={p}
                  isAdmin={isAdmin}
                  onCollect={() => markCollected(p.id)}
                />
              ))}
            </div>
          )
        )}

        {/* ── LOG PARCEL (admin/RA) ── */}
        {!loading && tab === 'log' && isAdmin && (
          <form onSubmit={submitParcel} className="space-y-4">
            <Card className="p-5 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Plus className="h-4 w-4" /> Log a New Parcel Arrival
              </h3>

              {/* Student search */}
              <div>
                <Label className="font-semibold">Student *</Label>
                <div className="relative mt-1">
                  <div className={`flex items-center gap-2 border rounded-lg px-3 py-2 ${form.student_id ? 'border-success bg-success/5' : 'border-border'}`}>
                    <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <input
                      type="text"
                      className="flex-1 bg-transparent outline-none text-sm"
                      placeholder="Search by name, room, or floor..."
                      value={studentSearch}
                      onChange={e => {
                        setStudentSearch(e.target.value);
                        setForm(f => ({ ...f, student_id: '' }));
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                    />
                    {form.student_id && <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />}
                  </div>
                  {showDropdown && studentSearch.trim() !== '' && !form.student_id && (
                    <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-xl shadow-lg max-h-52 overflow-y-auto">
                      {filteredStudents.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-muted-foreground">No students found</div>
                      ) : (
                        filteredStudents.slice(0, 12).map(s => (
                          <button
                            key={s.id}
                            type="button"
                            className="w-full text-left px-4 py-2.5 hover:bg-muted transition-colors text-sm flex items-center gap-3"
                            onMouseDown={() => {
                              setForm(f => ({ ...f, student_id: s.id }));
                              setStudentSearch(`${s.first_name} ${s.last_name}${s.room ? ` — Room ${s.room}` : ''}`);
                              setShowDropdown(false);
                            }}
                          >
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{s.first_name} {s.last_name}</p>
                              {(s.room || s.floor) && (
                                <p className="text-xs text-muted-foreground">
                                  {[s.floor && `Floor ${s.floor}`, s.room && `Room ${s.room}`].filter(Boolean).join(', ')}
                                </p>
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {form.student_id && (
                  <p className="text-xs text-success mt-1 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Student selected — they will receive a push notification automatically
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Sender Name</Label>
                  <Input className="mt-1" placeholder="e.g. Amazon, Royal Mail..."
                    value={form.sender_name}
                    onChange={e => setForm(f => ({ ...f, sender_name: e.target.value }))} />
                </div>
                <div>
                  <Label>Tracking Number</Label>
                  <Input className="mt-1" placeholder="Optional"
                    value={form.tracking_number}
                    onChange={e => setForm(f => ({ ...f, tracking_number: e.target.value }))} />
                </div>
              </div>

              <div>
                <Label>Description</Label>
                <Textarea className="mt-1" rows={2}
                  placeholder="Optional — e.g. large box, envelope, fragile..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </Card>

            <Button type="submit" disabled={submitting || !form.student_id} className="w-full" size="lg">
              <Package className="h-4 w-4 mr-2" />
              {submitting ? 'Logging...' : 'Log Parcel & Notify Student'}
            </Button>
          </form>
        )}

        {/* ── HISTORY ── */}
        {!loading && tab === 'history' && (
          collected.length === 0 ? (
            <div className="text-center py-14">
              <CheckCircle className="h-14 w-14 text-muted-foreground/20 mx-auto mb-3" />
              <p className="font-medium text-muted-foreground">No collected parcels yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {collected.map(p => (
                <ParcelCard key={p.id} parcel={p} isAdmin={isAdmin} showCollectedDate />
              ))}
            </div>
          )
        )}

      </div>
    </div>
  );
};

export default ParcelsModule;
