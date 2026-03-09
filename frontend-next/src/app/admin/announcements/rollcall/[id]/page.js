'use client';

import React, { useState, useEffect, useContext } from 'react';
import { useRouter, useParams } from 'next/navigation';
import axios from 'axios';
import { AuthContext, API } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  ArrowLeft, AlertTriangle, CheckCircle, Clock, Users, ShieldCheck,
  Send, X, RefreshCw, XCircle
} from 'lucide-react';
import { BottomSheet } from '@/components/ui/bottom-sheet';

const ADMIN_ROLES = ['admin', 'super_admin', 'college_admin'];

function StatusChip({ status }) {
  if (status === 'evacuated') return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
      <CheckCircle className="h-3 w-3" /> Evacuated
    </span>
  );
  if (status === 'not_at_college') return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
      <ShieldCheck className="h-3 w-3" /> Not at College
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
      <Clock className="h-3 w-3" /> No Response
    </span>
  );
}

export default function RollcallDetailPage() {
  const { user, loading: authLoading } = useContext(AuthContext);
  const router = useRouter();
  const { id } = useParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [reportText, setReportText] = useState('');
  const [sendingReport, setSendingReport] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [expandedFloor, setExpandedFloor] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = user && ADMIN_ROLES.includes(user.role);
  const isRa = user?.role === 'ra';

  useEffect(() => {
    if (!authLoading && user) {
      if (!['admin', 'super_admin', 'college_admin', 'ra'].includes(user.role)) {
        router.replace('/admin');
        return;
      }
      loadSummary();
    }
  }, [user, authLoading, id]);

  const loadSummary = async () => {
    try {
      const res = await axios.get(`${API}/emergency-rollcall/${id}/summary`);
      setData(res.data);
      if (isRa && !reportText && res.data.my_ra_report) {
        setReportText(res.data.my_ra_report.report_text);
      }
      if (isRa && !expandedFloor && user?.floor) {
        setExpandedFloor(user.floor);
      }
    } catch (e) {
      toast.error('Failed to load roll call data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadSummary();
  };

  const handleClose = async () => {
    if (!confirm('Close this roll call? Students will no longer be prompted to respond.')) return;
    setClosing(true);
    try {
      await axios.post(`${API}/emergency-rollcall/${id}/close`);
      toast.success('Roll call closed');
      loadSummary();
    } catch (e) {
      toast.error('Failed to close roll call');
    } finally {
      setClosing(false);
    }
  };

  const handleSendReport = async () => {
    if (!reportText.trim()) { toast.error('Please write a report message'); return; }
    setSendingReport(true);
    try {
      await axios.post(`${API}/emergency-rollcall/${id}/ra-report`, { report_text: reportText });
      toast.success('Clearance report sent to admin');
      setShowReportForm(false);
      loadSummary();
    } catch (e) {
      toast.error('Failed to send report');
    } finally {
      setSendingReport(false);
    }
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  if (!data) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Roll call not found.</div>;
  }

  const { rollcall, floors, ra_reports, my_ra_report } = data;
  const isActive = rollcall.status === 'active';
  const floorNames = Object.keys(floors).sort();

  const defaultReport = isRa && user?.floor
    ? `All residents on ${user.floor} are accounted for. ${data.total_responded} of ${data.total_residents} have responded.`
    : '';

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className={`text-white px-4 pt-10 pb-6 ${isActive ? 'bg-red-600' : 'bg-muted'}`}>
        <div className="max-w-4xl mx-auto">
          <button onClick={() => router.back()} className={`flex items-center gap-1 text-sm mb-4 ${isActive ? 'text-white/80 hover:text-white' : 'text-muted-foreground hover:text-foreground'}`}>
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className={`h-6 w-6 ${isActive ? 'text-white' : 'text-muted-foreground'}`} />
                <h1 className={`text-xl font-bold ${isActive ? 'text-white' : 'text-foreground'}`}>Emergency Roll Call</h1>
                {isActive ? (
                  <span className="text-xs font-bold bg-white/20 text-white px-2 py-0.5 rounded-full animate-pulse">LIVE</span>
                ) : (
                  <span className="text-xs font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Closed</span>
                )}
              </div>
              <p className={`text-sm font-medium ${isActive ? 'text-white/90' : 'text-muted-foreground'}`}>{rollcall.announcement_title}</p>
              <p className={`text-xs mt-1 ${isActive ? 'text-white/70' : 'text-muted-foreground'}`}>
                Started {new Date(rollcall.created_at).toLocaleString()}
                {!isActive && rollcall.closed_at && ` · Closed ${new Date(rollcall.closed_at).toLocaleString()}`}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {isActive && (
                <Button onClick={handleRefresh} disabled={refreshing} size="sm" variant="outline" className={`gap-1 text-xs ${isActive ? 'border-white/30 text-white bg-white/10 hover:bg-white/20' : ''}`}>
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
                </Button>
              )}
              {isAdmin && isActive && (
                <Button onClick={handleClose} disabled={closing} size="sm" variant="outline" className="gap-1 text-xs border-white/30 text-white bg-white/10 hover:bg-white/20">
                  <XCircle className="h-3.5 w-3.5" /> {closing ? 'Closing...' : 'Close Roll Call'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-5 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Residents', value: data.total_residents, color: 'bg-muted' },
            { label: 'Evacuated', value: data.total_evacuated, color: 'bg-green-50 border-green-200 text-green-700' },
            { label: 'Not at College', value: data.total_not_at_college, color: 'bg-blue-50 border-blue-200 text-blue-700' },
            { label: 'No Response', value: data.total_pending, color: data.total_pending > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-muted' },
          ].map(s => (
            <div key={s.label} className={`p-3 rounded-xl border text-center ${s.color}`}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs font-medium mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">Overall Response Rate</p>
            <p className={`text-sm font-bold ${data.response_pct >= 80 ? 'text-green-600' : data.response_pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
              {data.response_pct}%
            </p>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${data.response_pct >= 80 ? 'bg-green-500' : data.response_pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${data.response_pct}%` }}
            />
          </div>
        </div>

        {isRa && (
          <div className={`rounded-xl p-4 border-2 ${my_ra_report ? 'bg-green-50 border-green-300' : 'bg-amber-50 border-amber-300'}`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className={`font-semibold text-sm ${my_ra_report ? 'text-green-700' : 'text-amber-700'}`}>
                  {my_ra_report ? '✓ Clearance report sent' : 'Your floor clearance report'}
                </p>
                {my_ra_report ? (
                  <p className="text-xs text-green-600 mt-0.5">"{my_ra_report.report_text}" · {new Date(my_ra_report.sent_at).toLocaleString()}</p>
                ) : (
                  <p className="text-xs text-amber-600 mt-0.5">Confirm your floor is accounted for and send a report to admin</p>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => { setReportText(my_ra_report?.report_text || defaultReport); setShowReportForm(true); }}
                className={my_ra_report ? 'bg-green-600 hover:bg-green-700 text-white text-xs' : 'bg-amber-500 hover:bg-amber-600 text-white text-xs'}
              >
                <Send className="h-3.5 w-3.5 mr-1" />
                {my_ra_report ? 'Update Report' : 'Send Report'}
              </Button>
            </div>
          </div>
        )}

        {isAdmin && ra_reports.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-600" /> RA Clearance Reports ({ra_reports.length})
            </h3>
            <div className="space-y-2">
              {ra_reports.map((r, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-green-50 border border-green-100 rounded-xl text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-green-800">{r.ra_name} — {r.ra_floor || 'Unassigned floor'}</p>
                    <p className="text-green-700 mt-0.5">"{r.report_text}"</p>
                    <p className="text-xs text-green-500 mt-0.5">{new Date(r.sent_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Users className="h-4 w-4" /> By Floor
          </h3>
          {floorNames.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No floor data available</div>
          ) : floorNames.map(floor => {
            const floorData = floors[floor];
            const total = floorData.evacuated.length + floorData.not_at_college.length + floorData.pending.length;
            const safe = floorData.evacuated.length + floorData.not_at_college.length;
            const pct = total > 0 ? Math.round(safe / total * 100) : 0;
            const isExpanded = expandedFloor === floor;

            return (
              <div key={floor} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedFloor(isExpanded ? null : floor)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} />
                    <span className="font-medium text-sm">{floor}</span>
                    <span className="text-xs text-muted-foreground">{safe}/{total} accounted for</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {floorData.pending.length > 0 && (
                      <span className="text-xs font-medium text-red-600">{floorData.pending.length} pending</span>
                    )}
                    <span className={`text-xs font-bold ${pct === 100 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{pct}%</span>
                    <div className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>›</div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border divide-y divide-border">
                    {[...floorData.evacuated, ...floorData.not_at_college, ...floorData.pending].map((r, i) => (
                      <div key={i} className="px-4 py-3 flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium">{r.user_name}</p>
                          {r.notes && <p className="text-xs text-muted-foreground mt-0.5">{r.notes}</p>}
                          {r.responded_at && (
                            <p className="text-xs text-muted-foreground">{new Date(r.responded_at).toLocaleTimeString()}</p>
                          )}
                        </div>
                        <StatusChip status={r.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {data.pending.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <h3 className="font-semibold text-sm text-red-700 mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> No Response ({data.pending.length})
            </h3>
            <div className="space-y-1">
              {data.pending.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-red-100 last:border-0">
                  <span className="font-medium text-red-800">{p.user_name}</span>
                  <span className="text-xs text-red-500">{p.user_floor || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomSheet
        open={showReportForm}
        onClose={() => setShowReportForm(false)}
        title="Send Clearance Report"
        footer={
          <Button onClick={handleSendReport} disabled={sendingReport || !reportText.trim()} className="w-full gap-2">
            <Send className="h-4 w-4" />
            {sendingReport ? 'Sending...' : 'Send Clearance Report to Admin'}
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This report will be sent to all admins confirming your floor residents are accounted for.
          </p>
          <textarea
            className="w-full text-sm bg-muted border border-border rounded-xl px-3 py-2 min-h-[80px] resize-none"
            placeholder="e.g. All residents on Floor 2 are accounted for..."
            value={reportText}
            onChange={e => setReportText(e.target.value)}
            autoFocus
          />
        </div>
      </BottomSheet>
    </div>
  );
}
