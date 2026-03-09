import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext, API } from '@/App';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Briefcase, X } from 'lucide-react';

      </div>
    </div>
  );
};

// Admin Module
const AdminModule = () => {
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('jobs');
  
  // Jobs state
  const [jobs, setJobs] = useState([]);
  const [showJobForm, setShowJobForm] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [myApplications, setMyApplications] = useState([]);
  const [newJob, setNewJob] = useState({
    title: '',
    job_type: 'internal',
    description: '',
    department: '',
    location: '',
    hours_per_week: '',
    pay_rate: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    application_deadline: '',
    requires_resume: false
  });
  const [jobApplication, setJobApplication] = useState({
    cover_letter: '',
    resume_url: ''
  });

  // RA Applications state
  const [raApplications, setRaApplications] = useState([]);
  const [showRaAppForm, setShowRaAppForm] = useState(false);
  const [selectedRaApp, setSelectedRaApp] = useState(null);
  const [newRaApp, setNewRaApp] = useState({
    title: '',
    description: '',
    requirements: '',
    due_date: ''
  });
  const [raAppSubmission, setRaAppSubmission] = useState({
    responses: '',
    resume_url: ''
  });

  useEffect(() => {
    fetchJobs();
    fetchRaApplications();
    if (user?.role === 'student') {
      fetchMyApplications();
    }
  }, [user]);

  // Jobs functions
  const fetchJobs = async () => {
    try {
      const response = await axios.get(`${API}/jobs`);
      setJobs(response.data);
    } catch (error) {
      console.error('Failed to fetch jobs', error);
    }
  };

  const createJob = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/jobs`, newJob);
      toast.success('Job posted successfully!');
      setShowJobForm(false);
      setNewJob({
        title: '',
        job_type: 'internal',
        description: '',
        department: '',
        location: '',
        hours_per_week: '',
        pay_rate: '',
        contact_name: '',
        contact_email: '',
        contact_phone: '',
        application_deadline: '',
        requires_resume: false
      });
      fetchJobs();
    } catch (error) {
      toast.error('Failed to create job');
    }
  };

  const applyForJob = async (jobId) => {
    try {
      await axios.post(`${API}/jobs/${jobId}/apply`, {
        job_id: jobId,
        cover_letter: jobApplication.cover_letter,
        resume_url: jobApplication.resume_url
      });
      toast.success('Application submitted!');
      setSelectedJob(null);
      setJobApplication({ cover_letter: '', resume_url: '' });
      fetchMyApplications();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit application');
    }
  };

  const fetchMyApplications = async () => {
    try {
      const response = await axios.get(`${API}/my-job-applications`);
      setMyApplications(response.data);
    } catch (error) {
      console.error('Failed to fetch applications', error);
    }
  };

  // RA Applications functions
  const fetchRaApplications = async () => {
    try {
      const response = await axios.get(`${API}/ra-applications`);
      setRaApplications(response.data);
    } catch (error) {
      console.error('Failed to fetch RA applications', error);
    }
  };

  const createRaApplication = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/ra-applications`, newRaApp);
      toast.success('RA Application posted!');
      setShowRaAppForm(false);
      setNewRaApp({
        title: '',
        description: '',
        requirements: '',
        due_date: ''
      });
      fetchRaApplications();
    } catch (error) {
      toast.error('Failed to create RA application');
    }
  };

  const submitRaApplication = async (raAppId) => {
    try {
      await axios.post(`${API}/ra-applications/${raAppId}/submit`, {
        ra_application_id: raAppId,
        responses: raAppSubmission.responses,
        resume_url: raAppSubmission.resume_url
      });
      toast.success('RA Application submitted!');
      setSelectedRaApp(null);
      setRaAppSubmission({ responses: '', resume_url: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit application');
    }
  };

  if (user?.role !== 'admin' && user?.role !== 'student' && user?.role !== 'ra') {
    return (
      <div className="text-center py-12">
        <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Access required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-module">
      <h2 className="heading-font text-3xl font-bold">Admin Panel</h2>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="ra-applications">RA Applications</TabsTrigger>
        </TabsList>

        {/* JOBS TAB */}
        <TabsContent value="jobs" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold">Job Opportunities</h3>
            {user?.role === 'admin' && (
              <Button
                onClick={() => setShowJobForm(!showJobForm)}
                className="bg-gradient-to-r from-primary to-secondary"
              >
                <Plus className="mr-2 h-4 w-4" />
                Post Job
              </Button>
            )}
          </div>

          {showJobForm && user?.role === 'admin' && (
            <Card className="p-6 glass">
              <h4 className="font-semibold mb-4">Post New Job</h4>
              <form onSubmit={createJob} className="space-y-4">
                <div>
                  <Label>Job Type</Label>
                  <Select value={newJob.job_type} onValueChange={(value) => setNewJob({ ...newJob, job_type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Internal Job</SelectItem>
                      <SelectItem value="external">External Job</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  placeholder="Job Title"
                  value={newJob.title}
                  onChange={(e) => setNewJob({ ...newJob, title: e.target.value })}
                  required
                />
                <Textarea
                  placeholder="Job Description"
                  value={newJob.description}
                  onChange={(e) => setNewJob({ ...newJob, description: e.target.value })}
                  required
                  rows={4}
                />
                <div className="grid md:grid-cols-2 gap-4">
                  <Input
                    placeholder="Department"
                    value={newJob.department}
                    onChange={(e) => setNewJob({ ...newJob, department: e.target.value })}
                  />
                  <Input
                    placeholder="Location"
                    value={newJob.location}
                    onChange={(e) => setNewJob({ ...newJob, location: e.target.value })}
                  />
                  <Input
                    placeholder="Hours per week"
                    value={newJob.hours_per_week}
                    onChange={(e) => setNewJob({ ...newJob, hours_per_week: e.target.value })}
                  />
                  <Input
                    placeholder="Pay Rate"
                    value={newJob.pay_rate}
                    onChange={(e) => setNewJob({ ...newJob, pay_rate: e.target.value })}
                  />
                </div>

                {newJob.job_type === 'external' && (
                  <div className="space-y-4 p-4 bg-muted rounded-lg">
                    <h5 className="font-semibold text-sm">Contact Information</h5>
                    <Input
                      placeholder="Contact Name"
                      value={newJob.contact_name}
                      onChange={(e) => setNewJob({ ...newJob, contact_name: e.target.value })}
                    />
                    <Input
                      placeholder="Contact Email"
                      type="email"
                      value={newJob.contact_email}
                      onChange={(e) => setNewJob({ ...newJob, contact_email: e.target.value })}
                    />
                    <Input
                      placeholder="Contact Phone"
                      value={newJob.contact_phone}
                      onChange={(e) => setNewJob({ ...newJob, contact_phone: e.target.value })}
                    />
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Application Deadline</Label>
                    <Input
                      type="date"
                      value={newJob.application_deadline}
                      onChange={(e) => setNewJob({ ...newJob, application_deadline: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="requires_resume"
                      checked={newJob.requires_resume}
                      onChange={(e) => setNewJob({ ...newJob, requires_resume: e.target.checked })}
                    />
                    <Label htmlFor="requires_resume">Requires Resume</Label>
                  </div>
                </div>

                <Button type="submit" className="bg-gradient-to-r from-primary to-secondary">
                  Post Job
                </Button>
              </form>
            </Card>
          )}

          {/* My Applications (Students) */}
          {user?.role === 'student' && myApplications.length > 0 && (
            <Card className="p-6 glass">
              <h4 className="font-semibold mb-4">My Applications</h4>
              <div className="space-y-3">
                {myApplications.map((app) => (
                  <div key={app.id} className="p-4 bg-white/50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <h5 className="font-semibold">{app.job_title}</h5>
                        <p className="text-sm text-muted-foreground">Applied: {new Date(app.applied_at).toLocaleDateString()}</p>
                      </div>
                      <Badge className={app.status === 'pending' ? 'bg-warning' : 'bg-success'}>
                        {app.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Job Listings */}
          <div className="grid md:grid-cols-2 gap-6">
            {jobs.map((job) => (
              <Card key={job.id} className="p-6 glass">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge className={job.job_type === 'internal' ? 'bg-success' : 'bg-primary'}>
                        {job.job_type === 'internal' ? 'Internal' : 'External'}
                      </Badge>
                      <h4 className="font-bold text-lg mt-2">{job.title}</h4>
                    </div>
                  </div>
                  
                  <p className="text-foreground text-sm">{job.description}</p>

                  {job.department && (
                    <p className="text-sm"><strong>Department:</strong> {job.department}</p>
                  )}
                  {job.location && (
                    <p className="text-sm"><strong>Location:</strong> {job.location}</p>
                  )}
                  {job.hours_per_week && (
                    <p className="text-sm"><strong>Hours:</strong> {job.hours_per_week}</p>
                  )}
                  {job.pay_rate && (
                    <p className="text-sm"><strong>Pay:</strong> {job.pay_rate}</p>
                  )}
                  {job.application_deadline && (
                    <p className="text-sm"><strong>Deadline:</strong> {new Date(job.application_deadline).toLocaleDateString()}</p>
                  )}

                  {job.job_type === 'external' && (
                    <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                      <p><strong>Contact:</strong> {job.contact_name}</p>
                      <p><strong>Email:</strong> {job.contact_email}</p>
                      {job.contact_phone && <p><strong>Phone:</strong> {job.contact_phone}</p>}
                    </div>
                  )}

                  {job.job_type === 'internal' && user?.role === 'student' && selectedJob === job.id && (
                    <div className="space-y-3 pt-3 border-t">
                      <Textarea
                        placeholder="Cover Letter (Optional)"
                        value={jobApplication.cover_letter}
                        onChange={(e) => setJobApplication({ ...jobApplication, cover_letter: e.target.value })}
                        rows={4}
                      />
                      {job.requires_resume && (
                        <Input
                          placeholder="Resume URL"
                          value={jobApplication.resume_url}
                          onChange={(e) => setJobApplication({ ...jobApplication, resume_url: e.target.value })}
                        />
                      )}
                      <div className="flex gap-2">
                        <Button
                          onClick={() => applyForJob(job.id)}
                          className="bg-gradient-to-r from-success to-success"
                        >
                          Submit Application
                        </Button>
                        <Button variant="outline" onClick={() => setSelectedJob(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {job.job_type === 'internal' && user?.role === 'student' && selectedJob !== job.id && (
                    <Button
                      onClick={() => setSelectedJob(job.id)}
                      className="w-full bg-gradient-to-r from-primary to-secondary"
                    >
                      Apply Now
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* RA APPLICATIONS TAB */}
        <TabsContent value="ra-applications" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold">RA Applications</h3>
            {user?.role === 'admin' && (
              <Button
                onClick={() => setShowRaAppForm(!showRaAppForm)}
                className="bg-gradient-to-r from-primary to-secondary"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create RA Application
              </Button>
            )}
          </div>

          {showRaAppForm && user?.role === 'admin' && (
            <Card className="p-6 glass">
              <h4 className="font-semibold mb-4">Create RA Application</h4>
              <form onSubmit={createRaApplication} className="space-y-4">
                <Input
                  placeholder="Title (e.g., RA Application 2025)"
                  value={newRaApp.title}
                  onChange={(e) => setNewRaApp({ ...newRaApp, title: e.target.value })}
                  required
                />
                <Textarea
                  placeholder="Description and Instructions"
                  value={newRaApp.description}
                  onChange={(e) => setNewRaApp({ ...newRaApp, description: e.target.value })}
                  required
                  rows={4}
                />
                <Textarea
                  placeholder="Requirements"
                  value={newRaApp.requirements}
                  onChange={(e) => setNewRaApp({ ...newRaApp, requirements: e.target.value })}
                  rows={3}
                />
                <div>
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={newRaApp.due_date}
                    onChange={(e) => setNewRaApp({ ...newRaApp, due_date: e.target.value })}
                  />
                </div>
                <Button type="submit" className="bg-gradient-to-r from-primary to-secondary">
                  Create Application
                </Button>
              </form>
            </Card>
          )}

          {/* RA Application Listings */}
          <div className="space-y-4">
            {raApplications.map((raApp) => (
              <Card key={raApp.id} className="p-6 glass">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-xl">{raApp.title}</h4>
                    <p className="text-foreground mt-2">{raApp.description}</p>
                  </div>

                  {raApp.requirements && (
                    <div>
                      <h5 className="font-semibold text-sm mb-1">Requirements:</h5>
                      <p className="text-sm text-muted-foreground">{raApp.requirements}</p>
                    </div>
                  )}

                  {raApp.due_date && (
                    <p className="text-sm">
                      <strong>Due Date:</strong> {new Date(raApp.due_date).toLocaleDateString()}
                    </p>
                  )}

                  {user?.role === 'student' && selectedRaApp === raApp.id && (
                    <div className="space-y-3 pt-3 border-t">
                      <Textarea
                        placeholder="Your application responses..."
                        value={raAppSubmission.responses}
                        onChange={(e) => setRaAppSubmission({ ...raAppSubmission, responses: e.target.value })}
                        rows={6}
                        required
                      />
                      <Input
                        placeholder="Resume URL (Optional)"
                        value={raAppSubmission.resume_url}
                        onChange={(e) => setRaAppSubmission({ ...raAppSubmission, resume_url: e.target.value })}
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => submitRaApplication(raApp.id)}
                          className="bg-gradient-to-r from-success to-success"
                        >
                          Submit Application
                        </Button>
                        <Button variant="outline" onClick={() => setSelectedRaApp(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {user?.role === 'student' && selectedRaApp !== raApp.id && (
                    <Button
                      onClick={() => setSelectedRaApp(raApp.id)}
                      className="w-full bg-gradient-to-r from-primary to-secondary"
                    >
                      <UserCheck className="mr-2 h-4 w-4" />
                      Apply for RA Position
                    </Button>
                  )}
                </div>
              </Card>
            ))}

export default AdminModule;
