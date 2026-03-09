import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext, API } from '@/App';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Home, MessageSquare, Calendar, Users, Wrench, DollarSign, BookOpen,
  Heart, UtensilsCrossed, Building, Plus, Send, Bell, Sparkles, Award,
  Trophy, Camera, Zap, Shield, Lock, Briefcase, Upload, UserCheck, Settings,
  User, ChevronDown, AlertTriangle, Cake, X
} from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';

const IncidentReportingModule = () => {
  const { user } = useContext(AuthContext);
  const [incidents, setIncidents] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newIncident, setNewIncident] = useState({
    floor: user?.floor || '',
    incident_type: 'noise',
    severity: 'medium',
    description: '',
    location: '',
    involved_students: []
  });

  useEffect(() => {
    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    try {
      const response = await axios.get(`${API}/incidents`);
      setIncidents(response.data);
    } catch (error) {
      console.error('Failed to fetch incidents', error);
    }
  };

  const createIncident = async () => {
    try {
      await axios.post(`${API}/incidents`, newIncident);
      toast.success('Incident report submitted');
      setShowCreateForm(false);
      setNewIncident({
        floor: user?.floor || '',
        incident_type: 'noise',
        severity: 'medium',
        description: '',
        location: '',
        involved_students: []
      });
      fetchIncidents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create incident report');
    }
  };

  const updateIncidentStatus = async (incidentId, status, notes) => {
    try {
      await axios.put(`${API}/incidents/${incidentId}/status?status=${status}&notes=${notes || ''}`);
      toast.success('Incident status updated');
      fetchIncidents();
    } catch (error) {
      toast.error('Failed to update incident status');
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      low: 'bg-muted text-primary',
      medium: 'bg-warning/10 text-warning',
      high: 'bg-muted text-foreground',
      emergency: 'bg-destructive/10 text-destructive'
    };
    return colors[severity] || colors.medium;
  };

  const getStatusColor = (status) => {
    const colors = {
      open: 'bg-destructive/10 text-destructive',
      investigating: 'bg-warning/10 text-warning',
      resolved: 'bg-success/10 text-success'
    };
    return colors[status] || colors.open;
  };

  return (
    <div className="min-h-screen bg-background">
      <ModuleHeader
        title="Safe Disclosure"
        showBack={true}
        showSearch={false}
      />
      <div className="px-4 pt-4 pb-4 space-y-4">

      <div className="flex items-center justify-between">
        <div>
          <h2 className="heading-font text-3xl font-bold">Incident Reporting</h2>
          <p className="text-muted-foreground">Report and track floor incidents</p>
        </div>
        {user?.role === 'ra' && (
          <Button 
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-gradient-to-r from-destructive to-secondary"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Report Incident
          </Button>
        )}
      </div>

      {showCreateForm && user?.role === 'ra' && (
        <Card className="p-6 glass border-2 border-destructive">
          <h3 className="font-semibold mb-4">Create Incident Report</h3>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Incident Type</Label>
                <Select 
                  value={newIncident.incident_type} 
                  onValueChange={(value) => setNewIncident({...newIncident, incident_type: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="noise">Noise Complaint</SelectItem>
                    <SelectItem value="safety">Safety Concern</SelectItem>
                    <SelectItem value="damage">Property Damage</SelectItem>
                    <SelectItem value="health">Health Issue</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Severity Level</Label>
                <Select 
                  value={newIncident.severity} 
                  onValueChange={(value) => setNewIncident({...newIncident, severity: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Location</Label>
              <Input
                value={newIncident.location}
                onChange={(e) => setNewIncident({...newIncident, location: e.target.value})}
                placeholder="e.g., Room 302, Common Room"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={newIncident.description}
                onChange={(e) => setNewIncident({...newIncident, description: e.target.value})}
                placeholder="Describe the incident in detail..."
                rows={4}
              />
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={createIncident}
                disabled={!newIncident.description || !newIncident.location}
                className="bg-destructive/80 hover:bg-destructive/90"
              >
                Submit Report
              </Button>
              <Button 
                onClick={() => setShowCreateForm(false)}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6 glass">
        <h3 className="font-semibold mb-4">Incident Reports</h3>
        <div className="space-y-3">
          {incidents.map((incident) => (
            <div key={incident.id} className="p-4 bg-white/50 rounded-lg border-l-4 border-destructive/30">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={getSeverityColor(incident.severity)}>
                      {incident.severity.toUpperCase()}
                    </Badge>
                    <Badge className={getStatusColor(incident.status)}>
                      {incident.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {incident.incident_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="font-semibold text-foreground">
                    📍 {incident.location} • Floor {incident.floor}
                  </div>
                  <p className="text-sm text-foreground mt-2">{incident.description}</p>
                  <div className="text-xs text-muted-foreground mt-2">
                    Reported by {incident.reporter_name} • {new Date(incident.created_at).toLocaleString()}
                  </div>
                  {incident.notes && (
                    <div className="mt-2 p-2 bg-muted rounded text-sm">
                      <span className="font-semibold">Notes:</span> {incident.notes}
                    </div>
                  )}
                </div>
              </div>
              
              {user?.role === 'ra' && incident.status !== 'resolved' && (
                <div className="mt-3 flex gap-2">
                  {incident.status === 'open' && (
                    <Button 
                      size="sm" 
                      onClick={() => updateIncidentStatus(incident.id, 'investigating', 'Investigation started')}
                      className="bg-warning hover:bg-warning"
                    >
                      Start Investigating
                    </Button>
                  )}
                  <Button 
                    size="sm" 
                    onClick={() => updateIncidentStatus(incident.id, 'resolved', 'Incident resolved')}
                    className="bg-success hover:bg-success"
                  >
                    Mark Resolved
                  </Button>
                </div>
              )}
            </div>
          ))}
          {incidents.length === 0 && (
            <p className="text-muted-foreground text-center py-8">No incidents reported</p>
          )}
        </div>
      </Card>
      </div>
    </div>
  );
};


export default IncidentReportingModule;
