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
  Shield,
  AlertTriangle,
  Clock,
  CheckCircle,
  User,
  FileText,
  Calendar,
  Phone,
  ExternalLink,
  Eye,
  MessageSquare,
  UserCheck,
  ClipboardList,
  AlertCircle,
  Scale,
  Heart,
  Info,
  RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const API = process.env.REACT_APP_BACKEND_URL;

const SafetySupportAdmin = () => {
  const navigate = useNavigate();
  const [disclosures, setDisclosures] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending_risk_assessment: 0,
    risk_assessment_complete: 0,
    support_plan_active: 0,
    investigation: 0,
    resolved: 0,
    urgent_count: 0,
    immediate_danger: 0
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedDisclosure, setSelectedDisclosure] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Risk Assessment Form
  const [riskForm, setRiskForm] = useState({
    risk_level: 'low',
    safety_measures: [],
    assessment_notes: ''
  });
  
  // Support Plan Form
  const [supportForm, setSupportForm] = useState({
    support_services: [],
    plan_notes: '',
    follow_up_date: ''
  });

  useEffect(() => {
    fetchDisclosures();
    fetchStats();
  }, []);

  const fetchDisclosures = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/safe-disclosures`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDisclosures(response.data);
      setLastUpdated(new Date());
      if (isRefresh) toast.success('Data refreshed');
    } catch (error) {
      console.error('Failed to fetch disclosures', error);
      toast.error('Failed to load disclosures');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/safe-disclosures/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats', error);
    }
  };

  const handleCompleteRiskAssessment = async () => {
    if (!selectedDisclosure) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/api/safe-disclosures/${selectedDisclosure.id}/risk-assessment`,
        riskForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Risk assessment completed');
      setShowActionDialog(false);
      setRiskForm({ risk_level: 'low', safety_measures: [], assessment_notes: '' });
      fetchDisclosures();
      fetchStats();
    } catch (error) {
      toast.error('Failed to complete risk assessment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateSupportPlan = async () => {
    if (!selectedDisclosure) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/api/safe-disclosures/${selectedDisclosure.id}/support-plan`,
        supportForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Support plan created');
      setShowActionDialog(false);
      setSupportForm({ support_services: [], plan_notes: '', follow_up_date: '' });
      fetchDisclosures();
      fetchStats();
    } catch (error) {
      toast.error('Failed to create support plan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEscalateToFormalReport = async (disclosureId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/api/safe-disclosures/${disclosureId}/formal-report`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Escalated to formal investigation');
      fetchDisclosures();
      fetchStats();
    } catch (error) {
      toast.error('Failed to escalate');
    }
  };

  const handleResolve = async (disclosureId) => {
    const notes = prompt('Enter resolution notes:');
    if (!notes) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/api/safe-disclosures/${disclosureId}/resolve`,
        { resolution_notes: notes },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Case resolved');
      setShowDetailDialog(false);
      fetchDisclosures();
      fetchStats();
    } catch (error) {
      toast.error('Failed to resolve');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      'pending_risk_assessment': { bg: 'bg-destructive/10 text-destructive', label: 'Risk Assessment Required', icon: AlertTriangle },
      'risk_assessment_complete': { bg: 'bg-muted text-foreground', label: 'Support Plan Needed', icon: ClipboardList },
      'support_plan_active': { bg: 'bg-muted text-foreground', label: 'Support Active', icon: Heart },
      'investigation': { bg: 'bg-muted text-foreground', label: 'Under Investigation', icon: Scale },
      'resolved': { bg: 'bg-success/10 text-success', label: 'Resolved', icon: CheckCircle }
    };
    const style = styles[status] || styles['pending_risk_assessment'];
    const Icon = style.icon;
    return <Badge className={`${style.bg} gap-1`}><Icon className="h-3 w-3" /> {style.label}</Badge>;
  };

  const getUrgencyBadge = (urgency, immediateDanger) => {
    if (immediateDanger) {
      return <Badge className="bg-destructive/80 text-white animate-pulse gap-1"><AlertCircle className="h-3 w-3" /> IMMEDIATE DANGER</Badge>;
    }
    const styles = {
      urgent: 'bg-destructive/10 text-destructive',
      high: 'bg-muted text-foreground',
      normal: 'bg-muted text-muted-foreground'
    };
    return <Badge className={styles[urgency] || styles.normal}>{urgency}</Badge>;
  };

  const getTimeRemaining = (deadline) => {
    if (!deadline) return null;
    const now = new Date();
    const due = new Date(deadline);
    const hoursRemaining = Math.round((due - now) / (1000 * 60 * 60));
    if (hoursRemaining < 0) return <span className="text-destructive font-semibold">OVERDUE</span>;
    if (hoursRemaining <= 12) return <span className="text-destructive font-semibold">{hoursRemaining}h remaining</span>;
    if (hoursRemaining <= 24) return <span className="text-primary">{hoursRemaining}h remaining</span>;
    return <span className="text-muted-foreground">{Math.round(hoursRemaining / 24)}d remaining</span>;
  };

  const toggleSafetyMeasure = (measure) => {
    setRiskForm(prev => ({
      ...prev,
      safety_measures: prev.safety_measures.includes(measure)
        ? prev.safety_measures.filter(m => m !== measure)
        : [...prev.safety_measures, measure]
    }));
  };

  const toggleSupportService = (service) => {
    setSupportForm(prev => ({
      ...prev,
      support_services: prev.support_services.includes(service)
        ? prev.support_services.filter(s => s !== service)
        : [...prev.support_services, service]
    }));
  };

  const filteredDisclosures = filter === 'all' ? disclosures :
    filter === 'urgent' ? disclosures.filter(d => d.urgency === 'urgent' || d.urgency === 'high') :
    disclosures.filter(d => d.status === filter);

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-border"></div></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button onClick={() => navigate('/college-admin')} variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Support & Safety Disclosures</h1>
              <p className="text-muted-foreground text-sm">Gender-based Violence Code Compliance (F2025L01251)</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdated && (
              <span className="text-sm text-muted-foreground">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { fetchDisclosures(true); fetchStats(); }} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
              <Button variant="outline" onClick={() => window.open('https://www.legislation.gov.au/F2025L01251/asmade/text', '_blank')}>
                <ExternalLink className="h-4 w-4 mr-2" /> View Legislation
              </Button>
            </div>
          </div>
        </div>

        {/* Compliance Info */}
        <Card className="mb-6 bg-muted border-border">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-primary mt-0.5" />
              <div className="text-sm text-foreground">
                <p className="font-semibold">Key Timeframes (Standard 4 & 5):</p>
                <ul className="mt-1 space-y-1">
                  <li>• <strong>Risk Assessment:</strong> Within 48 hours of disclosure</li>
                  <li>• <strong>Support Plan:</strong> Develop collaboratively within 48 hours</li>
                  <li>• <strong>Formal Reports:</strong> Finalize within 45 business days</li>
                  <li>• <strong>Appeals:</strong> Finalize within 20 business days</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Urgent Alert */}
        {(stats.urgent_count > 0 || stats.pending_risk_assessment > 0) && (
          <Card className="mb-6 border-destructive bg-destructive/5">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-6 w-6 text-destructive animate-pulse" />
                  <div>
                    <p className="font-semibold text-destructive">Action Required</p>
                    <p className="text-sm text-destructive">
                      {stats.pending_risk_assessment > 0 && `${stats.pending_risk_assessment} disclosure(s) require risk assessment within 48 hours. `}
                      {stats.urgent_count > 0 && `${stats.urgent_count} case(s) marked as urgent.`}
                    </p>
                  </div>
                </div>
                <Button className="bg-destructive/80 hover:bg-destructive/90" onClick={() => setFilter('pending_risk_assessment')}>
                  Review Now
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className={`cursor-pointer ${filter === 'all' ? 'ring-2 ring-border' : ''}`} onClick={() => setFilter('all')}>
            <CardContent className="p-4 text-center">
              <Shield className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer border-destructive/20 ${filter === 'pending_risk_assessment' ? 'ring-2 ring-destructive' : ''}`} onClick={() => setFilter('pending_risk_assessment')}>
            <CardContent className="p-4 text-center">
              <AlertTriangle className="h-6 w-6 text-destructive mx-auto mb-2" />
              <p className="text-2xl font-bold text-destructive">{stats.pending_risk_assessment}</p>
              <p className="text-xs text-muted-foreground">Need Risk Assessment</p>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer ${filter === 'risk_assessment_complete' ? 'ring-2 ring-primary' : ''}`} onClick={() => setFilter('risk_assessment_complete')}>
            <CardContent className="p-4 text-center">
              <ClipboardList className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.risk_assessment_complete}</p>
              <p className="text-xs text-muted-foreground">Support Plan Needed</p>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer ${filter === 'investigation' ? 'ring-2 ring-primary' : ''}`} onClick={() => setFilter('investigation')}>
            <CardContent className="p-4 text-center">
              <Scale className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.investigation}</p>
              <p className="text-xs text-muted-foreground">Under Investigation</p>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer ${filter === 'resolved' ? 'ring-2 ring-success' : ''}`} onClick={() => setFilter('resolved')}>
            <CardContent className="p-4 text-center">
              <CheckCircle className="h-6 w-6 text-success mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.resolved}</p>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </CardContent>
          </Card>
        </div>

        {/* Disclosures List */}
        <div className="space-y-4">
          {filteredDisclosures.length === 0 ? (
            <Card className="p-12 text-center">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No disclosures in this category</p>
            </Card>
          ) : (
            filteredDisclosures.map(disclosure => (
              <Card key={disclosure.id} className={`hover:shadow-md transition-shadow ${disclosure.urgency === 'urgent' || disclosure.immediate_danger ? 'border-destructive bg-destructive/5/50' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="flex-1">
                      {/* Header */}
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        {disclosure.is_anonymous ? (
                          <span className="font-semibold flex items-center gap-1"><User className="h-4 w-4" /> Anonymous Disclosure</span>
                        ) : (
                          <span className="font-semibold flex items-center gap-1"><User className="h-4 w-4" /> {disclosure.reporter_name}</span>
                        )}
                        {getStatusBadge(disclosure.status)}
                        {getUrgencyBadge(disclosure.urgency, disclosure.immediate_danger)}
                        {disclosure.formal_report && <Badge className="bg-muted text-foreground">Formal Report</Badge>}
                      </div>

                      {/* Incident Details */}
                      <div className="bg-muted rounded-lg p-3 mb-3">
                        <p className="text-sm"><strong>Type:</strong> {disclosure.incident_type}</p>
                        <p className="text-sm"><strong>Location:</strong> {disclosure.incident_location || 'Not specified'}</p>
                        <p className="text-sm"><strong>Date:</strong> {disclosure.incident_date ? new Date(disclosure.incident_date).toLocaleDateString() : 'Not specified'}</p>
                        <p className="text-sm mt-2 text-muted-foreground">{disclosure.description}</p>
                      </div>

                      {/* Timeline Requirements */}
                      {disclosure.status === 'pending_risk_assessment' && disclosure.risk_assessment_due && (
                        <div className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-destructive" />
                            <strong>Risk Assessment Due:</strong> {getTimeRemaining(disclosure.risk_assessment_due)}
                          </span>
                        </div>
                      )}

                      {disclosure.status === 'investigation' && disclosure.investigation_deadline && (
                        <div className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-primary" />
                            <strong>Investigation Deadline (45 days):</strong> {new Date(disclosure.investigation_deadline).toLocaleDateString()}
                          </span>
                        </div>
                      )}

                      {/* Support Requested */}
                      {disclosure.support_requested?.length > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          <Heart className="h-4 w-4 text-primary" />
                          <span className="text-sm">Support requested: {disclosure.support_requested.join(', ')}</span>
                        </div>
                      )}

                      {/* Safety Measures */}
                      {disclosure.safety_measures?.length > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          <Shield className="h-4 w-4 text-success" />
                          <span className="text-sm">Safety measures: {disclosure.safety_measures.join(', ')}</span>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground mt-3">
                        Received: {new Date(disclosure.created_at).toLocaleString()}
                        {disclosure.assigned_to_name && ` • Assigned to: ${disclosure.assigned_to_name}`}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 min-w-[200px]">
                      <Button variant="outline" size="sm" onClick={() => { setSelectedDisclosure(disclosure); setShowDetailDialog(true); }}>
                        <Eye className="h-4 w-4 mr-1" /> View Details
                      </Button>
                      
                      {disclosure.status === 'pending_risk_assessment' && (
                        <Button size="sm" className="bg-destructive/80 hover:bg-destructive/90" onClick={() => { setSelectedDisclosure(disclosure); setShowActionDialog(true); }}>
                          <ClipboardList className="h-4 w-4 mr-1" /> Complete Risk Assessment
                        </Button>
                      )}

                      {disclosure.status === 'risk_assessment_complete' && (
                        <Button size="sm" onClick={() => { setSelectedDisclosure(disclosure); setShowActionDialog(true); }}>
                          <Heart className="h-4 w-4 mr-1" /> Create Support Plan
                        </Button>
                      )}

                      {!disclosure.is_anonymous && disclosure.reporter_email && (
                        <Button variant="outline" size="sm" onClick={() => window.location.href = `mailto:${disclosure.reporter_email}`}>
                          <Phone className="h-4 w-4 mr-1" /> Contact Discloser
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-destructive" />
                Disclosure Details
              </DialogTitle>
            </DialogHeader>
            {selectedDisclosure && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Discloser</p>
                    <p className="font-medium">{selectedDisclosure.is_anonymous ? 'Anonymous' : selectedDisclosure.reporter_name}</p>
                    {!selectedDisclosure.is_anonymous && selectedDisclosure.reporter_email && (
                      <p className="text-sm text-muted-foreground">{selectedDisclosure.reporter_email}</p>
                    )}
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Incident Type</p>
                    <p className="font-medium">{selectedDisclosure.incident_type}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="font-medium">{selectedDisclosure.incident_location || 'Not specified'}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Incident Date</p>
                    <p className="font-medium">{selectedDisclosure.incident_date ? new Date(selectedDisclosure.incident_date).toLocaleDateString() : 'Not specified'}</p>
                  </div>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Description</p>
                  <p>{selectedDisclosure.description}</p>
                </div>

                {selectedDisclosure.individuals_involved && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Individuals Involved</p>
                    <p>{selectedDisclosure.individuals_involved}</p>
                  </div>
                )}

                {/* Flags */}
                <div className="flex flex-wrap gap-2">
                  {selectedDisclosure.immediate_danger && <Badge className="bg-destructive/80 text-white">Immediate Danger</Badge>}
                  {selectedDisclosure.medical_attention_needed && <Badge className="bg-primary text-white">Medical Attention Needed</Badge>}
                  {selectedDisclosure.police_notified && <Badge className="bg-primary text-white">Police Notified</Badge>}
                  {selectedDisclosure.witness_present && <Badge className="bg-primary text-white">Witnesses Present</Badge>}
                </div>

                {/* Risk Assessment Info */}
                {selectedDisclosure.risk_assessment && (
                  <div className="p-3 bg-success/10 rounded-lg border border-success">
                    <p className="font-semibold text-success mb-2">Risk Assessment Complete</p>
                    <p className="text-sm"><strong>Risk Level:</strong> {selectedDisclosure.risk_assessment.risk_level}</p>
                    {selectedDisclosure.risk_assessment.assessment_notes && (
                      <p className="text-sm mt-1"><strong>Notes:</strong> {selectedDisclosure.risk_assessment.assessment_notes}</p>
                    )}
                    <p className="text-xs text-success mt-2">
                      Completed by {selectedDisclosure.risk_assessment.completed_by_name} on {new Date(selectedDisclosure.risk_assessment.completed_at).toLocaleDateString()}
                    </p>
                  </div>
                )}

                {/* Support Plan Info */}
                {selectedDisclosure.support_plan && (
                  <div className="p-3 bg-muted rounded-lg border border-border">
                    <p className="font-semibold text-foreground mb-2">Support Plan Active</p>
                    {selectedDisclosure.support_plan.support_services?.length > 0 && (
                      <p className="text-sm"><strong>Services:</strong> {selectedDisclosure.support_plan.support_services.join(', ')}</p>
                    )}
                    {selectedDisclosure.support_plan.plan_notes && (
                      <p className="text-sm mt-1"><strong>Notes:</strong> {selectedDisclosure.support_plan.plan_notes}</p>
                    )}
                    <p className="text-xs text-primary mt-2">
                      Created by {selectedDisclosure.support_plan.created_by_name} on {new Date(selectedDisclosure.support_plan.created_at).toLocaleDateString()}
                    </p>
                  </div>
                )}

                <div className="p-3 bg-muted rounded-lg border border-border">
                  <p className="font-semibold text-foreground mb-2">Legislative Requirements (F2025L01251)</p>
                  <ul className="text-sm text-foreground space-y-1">
                    <li>✓ Risk assessment required within 48 hours (Standard 4.4, 7.1)</li>
                    <li>✓ Support plan developed collaboratively with discloser (Standard 4.6)</li>
                    <li>✓ Person-centred and trauma-informed approach required (Standard 4.1)</li>
                    <li>✓ Discloser's views must be seriously considered (Standard 4.5)</li>
                    <li>✓ Multiple pathways available for resolution (Standard 5.5)</li>
                  </ul>
                </div>
              </div>
            )}
            <DialogFooter className="flex gap-2">
              {selectedDisclosure && !selectedDisclosure.formal_report && selectedDisclosure.status !== 'resolved' && (
                <Button variant="outline" onClick={() => handleEscalateToFormalReport(selectedDisclosure.id)}>
                  <Scale className="h-4 w-4 mr-1" /> Escalate to Formal Report
                </Button>
              )}
              {selectedDisclosure && selectedDisclosure.status !== 'resolved' && (
                <Button variant="outline" className="text-success" onClick={() => handleResolve(selectedDisclosure.id)}>
                  <CheckCircle className="h-4 w-4 mr-1" /> Mark Resolved
                </Button>
              )}
              <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Action Dialog */}
        <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {selectedDisclosure?.status === 'pending_risk_assessment' ? 'Complete Risk Assessment' : 'Create Support Plan'}
              </DialogTitle>
              <DialogDescription>
                Per Standard 4 & 7 of the Code, this must be completed within 48 hours of disclosure.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 my-4">
              {selectedDisclosure?.status === 'pending_risk_assessment' && (
                <>
                  <div>
                    <Label>Immediate Safety Concerns</Label>
                    <select 
                      className="w-full px-3 py-2 border rounded-lg mt-1"
                      value={riskForm.risk_level}
                      onChange={(e) => setRiskForm({...riskForm, risk_level: e.target.value})}
                    >
                      <option value="none">No immediate danger identified</option>
                      <option value="low">Low risk - monitoring required</option>
                      <option value="medium">Medium risk - intervention needed</option>
                      <option value="high">High risk - immediate action required</option>
                    </select>
                  </div>
                  <div>
                    <Label>Safety Measures Required</Label>
                    <div className="space-y-2 mt-2">
                      {['Alternative living arrangements', 'No-contact directive', 'Academic adjustments', 'Respondent relocation', 'Security escort', 'Counseling referral'].map(measure => (
                        <label key={measure} className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            className="rounded"
                            checked={riskForm.safety_measures.includes(measure)}
                            onChange={() => toggleSafetyMeasure(measure)}
                          /> 
                          {measure}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Assessment Notes</Label>
                    <Textarea 
                      placeholder="Document your risk assessment findings..." 
                      rows={3}
                      value={riskForm.assessment_notes}
                      onChange={(e) => setRiskForm({...riskForm, assessment_notes: e.target.value})}
                    />
                  </div>
                </>
              )}

              {selectedDisclosure?.status === 'risk_assessment_complete' && (
                <>
                  <div>
                    <Label>Support Services</Label>
                    <div className="space-y-2 mt-2">
                      {['Counseling', 'Academic support', 'Housing assistance', 'Financial aid', 'Legal referral', 'Medical referral', 'External crisis service'].map(service => (
                        <label key={service} className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            className="rounded"
                            checked={supportForm.support_services.includes(service)}
                            onChange={() => toggleSupportService(service)}
                          /> 
                          {service}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Plan Notes</Label>
                    <Textarea 
                      placeholder="Document the support plan details..." 
                      rows={3}
                      value={supportForm.plan_notes}
                      onChange={(e) => setSupportForm({...supportForm, plan_notes: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Follow-up Date</Label>
                    <Input 
                      type="date"
                      value={supportForm.follow_up_date}
                      onChange={(e) => setSupportForm({...supportForm, follow_up_date: e.target.value})}
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowActionDialog(false)}>Cancel</Button>
              <Button 
                onClick={selectedDisclosure?.status === 'pending_risk_assessment' ? handleCompleteRiskAssessment : handleCreateSupportPlan}
                disabled={actionLoading}
              >
                {actionLoading ? 'Saving...' : selectedDisclosure?.status === 'pending_risk_assessment' ? 'Complete Risk Assessment' : 'Create Support Plan'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default SafetySupportAdmin;
