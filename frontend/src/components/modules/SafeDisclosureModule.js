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

const SafeDisclosureModule = () => {
  const { user } = useContext(AuthContext);
  const [showForm, setShowForm] = useState(false);
  const [disclosures, setDisclosures] = useState([]);
  const [formData, setFormData] = useState({
    is_anonymous: false,
    incident_type: '',
    incident_date: '',
    incident_location: '',
    description: '',
    individuals_involved: '',
    witness_present: false,
    witness_details: '',
    immediate_danger: false,
    medical_attention_needed: false,
    police_notified: false,
    support_requested: [],
    preferred_contact: '',
    additional_notes: ''
  });

  useEffect(() => {
    if (user?.role !== 'student') {
      fetchDisclosures();
    }
  }, [user]);

  const fetchDisclosures = async () => {
    try {
      const response = await axios.get(`${API}/safe-disclosures`);
      setDisclosures(response.data);
    } catch (error) {
      console.error('Failed to fetch disclosures', error);
    }
  };

  const handleSupportToggle = (support) => {
    setFormData(prev => ({
      ...prev,
      support_requested: prev.support_requested.includes(support)
        ? prev.support_requested.filter(s => s !== support)
        : [...prev.support_requested, support]
    }));
  };

  const submitDisclosure = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/safe-disclosures`, formData);
      toast.success('Your disclosure has been received. Support services will contact you soon.');
      setShowForm(false);
      setFormData({
        is_anonymous: false,
        incident_type: '',
        incident_date: '',
        incident_location: '',
        description: '',
        individuals_involved: '',
        witness_present: false,
        witness_details: '',
        immediate_danger: false,
        medical_attention_needed: false,
        police_notified: false,
        support_requested: [],
        preferred_contact: '',
        additional_notes: ''
      });
      if (user?.role !== 'student') {
        fetchDisclosures();
      }
    } catch (error) {
      toast.error('Failed to submit disclosure');
    }
  };

  const incidentTypes = [
    'Sexual Assault',
    'Sexual Harassment',
    'Image-based Abuse',
    'Physical Abuse',
    'Emotional/Psychological Abuse',
    'Stalking',
    'Technology-facilitated Abuse',
    'Other'
  ];

  const supportOptions = [
    'Counseling Services',
    'Medical Support',
    'Academic Adjustments',
    'Safety Planning',
    'Legal Information',
    'Accommodation Support',
    'Peer Support'
  ];

  return (
    <div className="min-h-screen bg-background">
      <ModuleHeader
        title="Safe Disclosure"
        showBack={true}
        showSearch={false}
      />
      <div className="px-4 pt-4 pb-4 space-y-4">

      {/* Header with information */}
      <div className="bg-muted border-l-4 border-border p-6 rounded-lg">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="heading-font text-3xl font-bold mb-2">Support & Safety</h2>
            <p className="text-foreground mb-4">
              This is a safe, confidential space to disclose any form of gender-based violence or harassment. 
              Your wellbeing and safety are our priority. You can choose to disclose anonymously or with your identity.
            </p>
            <div className="bg-white p-4 rounded-lg space-y-2 text-sm">
              <p className="font-semibold text-foreground">Important Information:</p>
              <ul className="list-disc list-inside space-y-1 text-foreground">
                <li>All disclosures are handled with strict confidentiality</li>
                <li>You control what happens next - we support your choices</li>
                <li>Support services are available regardless of whether you make a formal report</li>
                <li>You can choose to remain anonymous</li>
                <li>Crisis support is available 24/7 - see emergency contacts below</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Contacts */}
      <Card className="p-6 glass border-l-4 border-destructive/30">
        <h3 className="font-semibold text-lg mb-4 text-destructive">🚨 Immediate Support & Crisis Contacts</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white/70 p-4 rounded-lg">
            <p className="font-semibold">Emergency Services</p>
            <p className="text-2xl font-bold text-destructive">000</p>
            <p className="text-sm text-muted-foreground">Police, Ambulance, Fire</p>
          </div>
          <div className="bg-white/70 p-4 rounded-lg">
            <p className="font-semibold">1800 RESPECT</p>
            <p className="text-2xl font-bold text-foreground">1800 737 732</p>
            <p className="text-sm text-muted-foreground">24/7 Sexual assault, family violence counseling</p>
          </div>
          <div className="bg-white/70 p-4 rounded-lg">
            <p className="font-semibold">Lifeline</p>
            <p className="text-2xl font-bold text-foreground">13 11 14</p>
            <p className="text-sm text-muted-foreground">24/7 Crisis support & suicide prevention</p>
          </div>
          <div className="bg-white/70 p-4 rounded-lg">
            <p className="font-semibold">Campus Security</p>
            <p className="text-2xl font-bold text-foreground">[Contact]</p>
            <p className="text-sm text-muted-foreground">24/7 On-campus emergency</p>
          </div>
        </div>
      </Card>

      {/* Disclosure Form */}
      <Card className="p-6 glass">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-xl">Make a Disclosure</h3>
          {!showForm && (
            <Button 
              onClick={() => setShowForm(true)}
              className="bg-gradient-to-r from-primary to-secondary hover:from-primary hover:to-secondary"
            >
              <Lock className="h-4 w-4 mr-2" />
              Start Confidential Disclosure
            </Button>
          )}
        </div>

        {showForm && (
          <form onSubmit={submitDisclosure} className="space-y-6">
            {/* Anonymous Option */}
            <div className="bg-muted p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="anonymous"
                  checked={formData.is_anonymous}
                  onChange={(e) => setFormData({ ...formData, is_anonymous: e.target.checked })}
                  className="mt-1"
                />
                <div>
                  <Label htmlFor="anonymous" className="font-semibold">Submit Anonymously</Label>
                  <p className="text-sm text-muted-foreground">
                    Your identity will not be recorded. Note: Anonymous submissions may limit our ability to follow up directly with you.
                  </p>
                </div>
              </div>
            </div>

            {/* Incident Type */}
            <div>
              <Label className="text-base font-semibold">Type of Incident *</Label>
              <Select value={formData.incident_type} onValueChange={(value) => setFormData({ ...formData, incident_type: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select incident type..." />
                </SelectTrigger>
                <SelectContent>
                  {incidentTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Incident Details */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>When did this occur?</Label>
                <Input
                  type="datetime-local"
                  value={formData.incident_date}
                  onChange={(e) => setFormData({ ...formData, incident_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Where did this occur?</Label>
                <Input
                  placeholder="e.g., Floor 3, Campus Library, Off-campus..."
                  value={formData.incident_location}
                  onChange={(e) => setFormData({ ...formData, incident_location: e.target.value })}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <Label className="text-base font-semibold">What happened? *</Label>
              <p className="text-sm text-muted-foreground mb-2">Share as much or as little as you're comfortable with. There's no pressure to provide every detail.</p>
              <Textarea
                rows={5}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the incident in your own words..."
                required
              />
            </div>

            {/* Individuals Involved */}
            <div>
              <Label>Individuals Involved (Optional)</Label>
              <p className="text-sm text-muted-foreground mb-2">Names, descriptions, or identifying information of others involved</p>
              <Textarea
                rows={2}
                value={formData.individuals_involved}
                onChange={(e) => setFormData({ ...formData, individuals_involved: e.target.value })}
                placeholder="Optional..."
              />
            </div>

            {/* Witnesses */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="witness"
                  checked={formData.witness_present}
                  onChange={(e) => setFormData({ ...formData, witness_present: e.target.checked })}
                />
                <Label htmlFor="witness">Were there any witnesses?</Label>
              </div>
              {formData.witness_present && (
                <Textarea
                  rows={2}
                  value={formData.witness_details}
                  onChange={(e) => setFormData({ ...formData, witness_details: e.target.value })}
                  placeholder="Witness names or descriptions..."
                />
              )}
            </div>

            {/* Safety Checkboxes */}
            <div className="bg-destructive/5 p-4 rounded-lg space-y-3">
              <p className="font-semibold text-destructive">Safety Assessment</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="immediate_danger"
                    checked={formData.immediate_danger}
                    onChange={(e) => setFormData({ ...formData, immediate_danger: e.target.checked })}
                  />
                  <Label htmlFor="immediate_danger">I am in immediate danger</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="medical"
                    checked={formData.medical_attention_needed}
                    onChange={(e) => setFormData({ ...formData, medical_attention_needed: e.target.checked })}
                  />
                  <Label htmlFor="medical">I need medical attention</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="police"
                    checked={formData.police_notified}
                    onChange={(e) => setFormData({ ...formData, police_notified: e.target.checked })}
                  />
                  <Label htmlFor="police">I have contacted police</Label>
                </div>
              </div>
              {(formData.immediate_danger || formData.medical_attention_needed) && (
                <p className="text-sm text-destructive font-semibold">
                  ⚠️ If you're in immediate danger, please call 000 or campus security immediately.
                </p>
              )}
            </div>

            {/* Support Requested */}
            <div>
              <Label className="text-base font-semibold mb-3 block">What support would be helpful?</Label>
              <p className="text-sm text-muted-foreground mb-3">Select all that apply</p>
              <div className="grid md:grid-cols-2 gap-3">
                {supportOptions.map(option => (
                  <div key={option} className="flex items-center gap-2 bg-white p-3 rounded-lg border">
                    <input
                      type="checkbox"
                      id={option}
                      checked={formData.support_requested.includes(option)}
                      onChange={() => handleSupportToggle(option)}
                    />
                    <Label htmlFor={option} className="cursor-pointer">{option}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact Preference */}
            {!formData.is_anonymous && (
              <div>
                <Label>Preferred Contact Method</Label>
                <Input
                  placeholder="Email, phone, or other preferred method..."
                  value={formData.preferred_contact}
                  onChange={(e) => setFormData({ ...formData, preferred_contact: e.target.value })}
                />
              </div>
            )}

            {/* Additional Notes */}
            <div>
              <Label>Additional Information</Label>
              <Textarea
                rows={3}
                value={formData.additional_notes}
                onChange={(e) => setFormData({ ...formData, additional_notes: e.target.value })}
                placeholder="Anything else you'd like us to know..."
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <Button 
                type="submit"
                className="bg-gradient-to-r from-primary to-secondary hover:from-primary hover:to-secondary"
              >
                <Lock className="h-4 w-4 mr-2" />
                Submit Confidential Disclosure
              </Button>
              <Button 
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setFormData({
                    is_anonymous: false,
                    incident_type: '',
                    incident_date: '',
                    incident_location: '',
                    description: '',
                    individuals_involved: '',
                    witness_present: false,
                    witness_details: '',
                    immediate_danger: false,
                    medical_attention_needed: false,
                    police_notified: false,
                    support_requested: [],
                    preferred_contact: '',
                    additional_notes: ''
                  });
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {!showForm && (
          <p className="text-muted-foreground text-center py-8">
            Click the button above to start a confidential disclosure. All information is treated with the highest level of confidentiality.
          </p>
        )}
      </Card>

      {/* Admin/RA View of Disclosures */}
      {user?.role !== 'student' && (
        <Card className="p-6 glass">
          <h3 className="font-semibold text-xl mb-4">Submitted Disclosures ({disclosures.length})</h3>
          <div className="space-y-4">
            {disclosures.map((disclosure) => (
              <div key={disclosure.id} className="p-4 bg-white rounded-lg border-l-4 border-border">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <Badge className="mb-2 bg-destructive/10 text-destructive">{disclosure.incident_type}</Badge>
                    {disclosure.is_anonymous ? (
                      <p className="text-sm text-muted-foreground">Anonymous Submission</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">From: {disclosure.reporter_name}</p>
                    )}
                  </div>
                  <Badge className={disclosure.status === 'pending' ? 'bg-warning/10 text-warning' : 'bg-muted text-foreground'}>
                    {disclosure.status}
                  </Badge>
                </div>
                <p className="text-sm text-foreground mb-2">{disclosure.description.substring(0, 150)}...</p>
                <div className="flex gap-2 flex-wrap text-xs text-muted-foreground">
                  {disclosure.incident_date && <span>📅 {new Date(disclosure.incident_date).toLocaleDateString()}</span>}
                  {disclosure.incident_location && <span>📍 {disclosure.incident_location}</span>}
                  {disclosure.immediate_danger && <span className="text-destructive font-semibold">⚠️ IMMEDIATE DANGER</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Submitted: {new Date(disclosure.created_at).toLocaleString()}</p>
              </div>
            ))}
            {disclosures.length === 0 && (
              <p className="text-muted-foreground text-center py-8">No disclosures have been submitted yet.</p>
            )}
          </div>
        </Card>
      )}
      </div>
    </div>
  );
};

// Dining Module

export default SafeDisclosureModule;
