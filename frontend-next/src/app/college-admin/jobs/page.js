'use client';

import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { AuthContext } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { 
  Briefcase, Plus, Search, Filter, Eye, Edit2, Trash2, Users,
  Clock, DollarSign, MapPin, Calendar, ChevronDown, ChevronUp,
  CheckCircle, XCircle, AlertCircle, FileText, Download, X, Building,
  ArrowLeft, Mail, Send
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_BACKEND_URL + '/api';

const CollegeJobsAdmin = () => {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('jobs');
  const [showJobModal, setShowJobModal] = useState(false);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedJob, setExpandedJob] = useState(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const [messageForm, setMessageForm] = useState({
    subject: '',
    message: ''
  });

  // Job form state
  const [jobForm, setJobForm] = useState({
    title: '',
    description: '',
    category: '',
    hours_per_week: '',
    pay_rate: '',
    department: '',
    supervisor: '',
    location: '',
    required_skills: [],
    preferred_qualifications: '',
    responsibilities: '',
    application_deadline: '',
    positions_available: 1,
    status: 'active'
  });
  const [skillInput, setSkillInput] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [jobsRes, statsRes, appsRes] = await Promise.all([
        axios.get(`${API}/jobs`),
        axios.get(`${API}/jobs/admin/stats`),
        axios.get(`${API}/jobs/admin/all-applications`)
      ]);
      setJobs(jobsRes.data);
      setStats(statsRes.data);
      setApplications(appsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load jobs data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateJob = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...jobForm,
        hours_per_week: jobForm.hours_per_week ? parseInt(jobForm.hours_per_week) : null,
        positions_available: parseInt(jobForm.positions_available) || 1
      };
      
      if (selectedJob) {
        await axios.patch(`${API}/jobs/${selectedJob.id}`, payload);
        toast.success('Job updated successfully');
      } else {
        await axios.post(`${API}/jobs`, payload);
        toast.success('Job created successfully');
      }
      
      setShowJobModal(false);
      resetJobForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save job');
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm('Are you sure you want to delete this job and all its applications?')) return;
    
    try {
      await axios.delete(`${API}/jobs/${jobId}`);
      toast.success('Job deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete job');
    }
  };

  const handleUpdateApplicationStatus = async (applicationId, status, notes = '') => {
    try {
      await axios.patch(`${API}/jobs/applications/${applicationId}/status`, {
        status,
        admin_notes: notes
      });
      toast.success(`Application ${status}`);
      fetchData();
      setShowApplicationModal(false);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const openScheduleInterview = () => {
    if (!selectedApplication) return;
    
    const isInterviewStatus = selectedApplication.status === 'interview';
    
    if (isInterviewStatus) {
      // Generic follow-up message for interview status
      setMessageForm({
        subject: `Regarding ${selectedApplication.job_title} Position`,
        message: `Dear ${selectedApplication.applicant_name},\n\n\n\nBest regards`
      });
    } else {
      // Interview invitation for non-interview status
      setMessageForm({
        subject: `Interview Invitation - ${selectedApplication.job_title}`,
        message: `Dear ${selectedApplication.applicant_name},\n\nThank you for applying for the ${selectedApplication.job_title} position. We were impressed by your application and would like to invite you for an interview.\n\nPlease let us know your availability for the following times:\n- \n- \n- \n\nLooking forward to hearing from you.\n\nBest regards`
      });
    }
    setShowMessageModal(true);
  };

  const handleSendMessage = async () => {
    if (!selectedApplication || !messageForm.subject || !messageForm.message) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      // Send the message via the messages API
      await axios.post(`${API}/messages`, {
        receiver_id: selectedApplication.user_id,
        content: `Subject: ${messageForm.subject}\n\n${messageForm.message}`
      });
      
      const isInterviewStatus = selectedApplication.status === 'interview';
      
      // Only update status to interview if not already interview
      if (!isInterviewStatus) {
        await axios.patch(`${API}/jobs/applications/${selectedApplication.id}/status`, {
          status: 'interview',
          admin_notes: `Interview scheduled. Message sent: ${messageForm.subject}`
        });
        // Update selected application status locally
        setSelectedApplication(prev => ({ ...prev, status: 'interview' }));
      }
      
      toast.success('Message sent successfully');
      setShowMessageModal(false);
      setMessageForm({ subject: '', message: '' });
      setMessageSent(true);
      fetchData();
    } catch (error) {
      console.error('Send message error:', error);
      toast.error('Failed to send message. Please try again.');
    }
  };

  const resetJobForm = () => {
    setJobForm({
      title: '',
      description: '',
      category: '',
      hours_per_week: '',
      pay_rate: '',
      department: '',
      supervisor: '',
      location: '',
      required_skills: [],
      preferred_qualifications: '',
      responsibilities: '',
      application_deadline: '',
      positions_available: 1,
      status: 'active'
    });
    setSelectedJob(null);
    setSkillInput('');
  };

  const openEditJob = (job) => {
    setSelectedJob(job);
    setJobForm({
      title: job.title,
      description: job.description,
      category: job.category,
      hours_per_week: job.hours_per_week || '',
      pay_rate: job.pay_rate || '',
      department: job.department || '',
      supervisor: job.supervisor || '',
      location: job.location || '',
      required_skills: job.required_skills || [],
      preferred_qualifications: job.preferred_qualifications || '',
      responsibilities: job.responsibilities || '',
      application_deadline: job.application_deadline?.split('T')[0] || '',
      positions_available: job.positions_available || 1,
      status: job.status
    });
    setShowJobModal(true);
  };

  const addSkill = () => {
    if (skillInput.trim() && !jobForm.required_skills.includes(skillInput.trim())) {
      setJobForm({ ...jobForm, required_skills: [...jobForm.required_skills, skillInput.trim()] });
      setSkillInput('');
    }
  };

  const removeSkill = (skill) => {
    setJobForm({ ...jobForm, required_skills: jobForm.required_skills.filter(s => s !== skill) });
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-success/10 text-success',
      closed: 'bg-muted text-foreground',
      filled: 'bg-muted text-primary',
      draft: 'bg-warning/10 text-warning',
      pending: 'bg-warning/10 text-warning',
      reviewing: 'bg-muted text-primary',
      interview: 'bg-muted text-primary',
      accepted: 'bg-success/10 text-success',
      rejected: 'bg-destructive/10 text-destructive',
      withdrawn: 'bg-muted text-foreground'
    };
    return colors[status] || 'bg-muted text-foreground';
  };

  const handleDownloadResume = async (resumeUrl, applicantName) => {
    try {
      // Construct full URL - resumeUrl already includes /api/uploads/...
      const fullUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}${resumeUrl}`;
      console.log('Downloading from:', fullUrl);
      
      const response = await axios.get(fullUrl, {
        responseType: 'blob',
        withCredentials: true
      });
      
      console.log('Response received, blob size:', response.data.size);
      
      // Check if we got valid data
      if (!response.data || response.data.size === 0) {
        throw new Error('Empty response received');
      }
      
      // Create download link
      const blob = new Blob([response.data], { type: response.data.type || 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.style.display = 'none';
      
      // Extract filename from URL or create one
      const filename = resumeUrl.split('/').pop() || `resume_${applicantName.replace(/\s+/g, '_')}.pdf`;
      link.setAttribute('download', filename);
      
      document.body.appendChild(link);
      
      // Use setTimeout to ensure the link is properly added to DOM before clicking
      setTimeout(() => {
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success('Resume downloaded');
      }, 100);
      
    } catch (error) {
      console.error('Download error:', error);
      console.error('Error details:', error.response?.status, error.response?.data);
      toast.error('Failed to download resume. Please try again.');
    }
  };

  const filteredJobs = jobs.filter(job => {
    const matchesStatus = filterStatus === 'all' || job.status === filterStatus;
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         job.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const filteredApplications = applications.filter(app => {
    const matchesStatus = filterStatus === 'all' || app.status === filterStatus;
    const matchesSearch = app.applicant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         app.job_title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <button
            onClick={() => router.push('/college-admin')}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground mb-2 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="w-7 h-7 text-primary" />
            College Jobs
          </h1>
          <p className="text-muted-foreground mt-1">Manage job postings and applications</p>
        </div>
        <button
          onClick={() => { resetJobForm(); setShowJobModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary transition-colors"
        >
          <Plus className="w-5 h-5" />
          Post New Job
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <button
            onClick={() => { setActiveTab('jobs'); setFilterStatus('active'); }}
            className="bg-white rounded-xl p-4 border border-border hover:border-success hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/10 rounded-lg">
                <Briefcase className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.jobs.active}</p>
                <p className="text-sm text-muted-foreground">Active Jobs</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => { setActiveTab('applications'); setFilterStatus('pending'); }}
            className="bg-white rounded-xl p-4 border border-border hover:border-warning hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <AlertCircle className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.applications.pending}</p>
                <p className="text-sm text-muted-foreground">Pending Apps</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => { setActiveTab('applications'); setFilterStatus('interview'); }}
            className="bg-white rounded-xl p-4 border border-border hover:border-border hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.applications.interview}</p>
                <p className="text-sm text-muted-foreground">Interviews</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => { setActiveTab('jobs'); setFilterStatus('filled'); }}
            className="bg-white rounded-xl p-4 border border-border hover:border-border hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <CheckCircle className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.jobs.filled}</p>
                <p className="text-sm text-muted-foreground">Positions Filled</p>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border mb-6">
        <button
          onClick={() => { setActiveTab('jobs'); setFilterStatus('all'); }}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'jobs' 
              ? 'text-primary border-b-2 border-primary' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Job Postings ({jobs.length})
        </button>
        <button
          onClick={() => { setActiveTab('applications'); setFilterStatus('all'); }}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'applications' 
              ? 'text-primary border-b-2 border-primary' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Applications ({applications.length})
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder={activeTab === 'jobs' ? "Search jobs..." : "Search applications..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Status</option>
          {activeTab === 'jobs' ? (
            <>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
              <option value="filled">Filled</option>
              <option value="draft">Draft</option>
            </>
          ) : (
            <>
              <option value="pending">Pending</option>
              <option value="reviewing">Reviewing</option>
              <option value="interview">Interview</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </>
          )}
        </select>
      </div>

      {/* Jobs List */}
      {activeTab === 'jobs' && (
        <div className="space-y-4">
          {filteredJobs.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-border">
              <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No jobs found</p>
              <button
                onClick={() => { resetJobForm(); setShowJobModal(true); }}
                className="mt-4 text-primary hover:underline"
              >
                Create your first job posting
              </button>
            </div>
          ) : (
            filteredJobs.map(job => (
              <div key={job.id} className="bg-white rounded-xl border border-border overflow-hidden">
                <div 
                  className="p-4 cursor-pointer hover:bg-muted"
                  onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-foreground">{job.title}</h3>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(job.status)}`}>
                          {job.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building className="w-4 h-4" />
                          {job.category}
                        </span>
                        {job.hours_per_week && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {job.hours_per_week} hrs/week
                          </span>
                        )}
                        {job.pay_rate && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            {job.pay_rate}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {job.applications_count} applicants
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditJob(job); }}
                        className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteJob(job.id); }}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                      {expandedJob === job.id ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>
                
                {expandedJob === job.id && (
                  <div className="px-4 pb-4 border-t border-border pt-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium text-foreground mb-2">Description</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{job.description}</p>
                        
                        {job.responsibilities && (
                          <div className="mt-4">
                            <h4 className="font-medium text-foreground mb-2">Responsibilities</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{job.responsibilities}</p>
                          </div>
                        )}
                      </div>
                      <div className="space-y-4">
                        {job.required_skills?.length > 0 && (
                          <div>
                            <h4 className="font-medium text-foreground mb-2">Required Skills</h4>
                            <div className="flex flex-wrap gap-2">
                              {job.required_skills.map((skill, idx) => (
                                <span key={idx} className="px-2 py-1 bg-muted text-primary text-sm rounded-full">
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {job.department && (
                            <div>
                              <span className="text-muted-foreground">Department:</span>
                              <p className="font-medium">{job.department}</p>
                            </div>
                          )}
                          {job.supervisor && (
                            <div>
                              <span className="text-muted-foreground">Supervisor:</span>
                              <p className="font-medium">{job.supervisor}</p>
                            </div>
                          )}
                          {job.location && (
                            <div>
                              <span className="text-muted-foreground">Location:</span>
                              <p className="font-medium">{job.location}</p>
                            </div>
                          )}
                          {job.application_deadline && (
                            <div>
                              <span className="text-muted-foreground">Deadline:</span>
                              <p className="font-medium">{new Date(job.application_deadline).toLocaleDateString()}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Posted by {job.created_by_name} on {new Date(job.created_at).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => { setActiveTab('applications'); setSearchQuery(job.title); }}
                        className="text-primary hover:underline text-sm"
                      >
                        View {job.applications_count} applications →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Applications List */}
      {activeTab === 'applications' && (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          {filteredApplications.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No applications found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Applicant</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Job</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Applied</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredApplications.map(app => (
                    <tr 
                      key={app.id} 
                      className="hover:bg-muted cursor-pointer transition-colors"
                      onClick={() => { setSelectedApplication(app); setMessageSent(false); setShowApplicationModal(true); }}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">{app.applicant_name}</p>
                          <p className="text-sm text-muted-foreground">{app.applicant_email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground">{app.job_title}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(app.status)}`}>
                          {app.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(app.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => { setSelectedApplication(app); setMessageSent(false); setShowApplicationModal(true); }}
                            className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg"
                            title="View Details"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          {app.resume_url && (
                            <button
                              onClick={() => handleDownloadResume(app.resume_url, app.applicant_name)}
                              className="p-2 text-muted-foreground hover:text-success hover:bg-success/10 rounded-lg"
                              title="Download Resume"
                            >
                              <Download className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Job Modal */}
      {showJobModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {selectedJob ? 'Edit Job' : 'Create New Job'}
              </h2>
              <button onClick={() => setShowJobModal(false)} className="p-2 hover:bg-muted rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateJob} className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="font-medium text-foreground border-b pb-2">Basic Information</h3>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Job Title *</label>
                  <input
                    type="text"
                    required
                    value={jobForm.title}
                    onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                    placeholder="e.g., Student Library Assistant"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Category *</label>
                    <input
                      type="text"
                      required
                      value={jobForm.category}
                      onChange={(e) => setJobForm({ ...jobForm, category: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                      placeholder="e.g., Library, Dining, Admin"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                    <select
                      value={jobForm.status}
                      onChange={(e) => setJobForm({ ...jobForm, status: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                    >
                      <option value="active">Active</option>
                      <option value="draft">Draft</option>
                      <option value="closed">Closed</option>
                      <option value="filled">Filled</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Description *</label>
                  <textarea
                    required
                    rows={4}
                    value={jobForm.description}
                    onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                    placeholder="Describe the job role and what the student will be doing..."
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Hours/Week</label>
                    <input
                      type="number"
                      min="1"
                      max="40"
                      value={jobForm.hours_per_week}
                      onChange={(e) => setJobForm({ ...jobForm, hours_per_week: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                      placeholder="10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Pay Rate</label>
                    <input
                      type="text"
                      value={jobForm.pay_rate}
                      onChange={(e) => setJobForm({ ...jobForm, pay_rate: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                      placeholder="$15/hr"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Positions</label>
                    <input
                      type="number"
                      min="1"
                      value={jobForm.positions_available}
                      onChange={(e) => setJobForm({ ...jobForm, positions_available: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Advanced Info */}
              <div className="space-y-4">
                <h3 className="font-medium text-foreground border-b pb-2">Additional Details</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Department</label>
                    <input
                      type="text"
                      value={jobForm.department}
                      onChange={(e) => setJobForm({ ...jobForm, department: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                      placeholder="e.g., Student Services"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Supervisor</label>
                    <input
                      type="text"
                      value={jobForm.supervisor}
                      onChange={(e) => setJobForm({ ...jobForm, supervisor: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                      placeholder="e.g., Jane Smith"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Location</label>
                    <input
                      type="text"
                      value={jobForm.location}
                      onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                      placeholder="e.g., Main Library"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Application Deadline</label>
                    <input
                      type="date"
                      value={jobForm.application_deadline}
                      onChange={(e) => setJobForm({ ...jobForm, application_deadline: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Required Skills</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                      className="flex-1 px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                      placeholder="Type a skill and press Enter"
                    />
                    <button
                      type="button"
                      onClick={addSkill}
                      className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted"
                    >
                      Add
                    </button>
                  </div>
                  {jobForm.required_skills.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {jobForm.required_skills.map((skill, idx) => (
                        <span key={idx} className="px-2 py-1 bg-muted text-primary text-sm rounded-full flex items-center gap-1">
                          {skill}
                          <button type="button" onClick={() => removeSkill(skill)} className="hover:text-foreground">
                            <X className="w-4 h-4" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Responsibilities</label>
                  <textarea
                    rows={3}
                    value={jobForm.responsibilities}
                    onChange={(e) => setJobForm({ ...jobForm, responsibilities: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                    placeholder="List the main responsibilities..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Preferred Qualifications</label>
                  <textarea
                    rows={2}
                    value={jobForm.preferred_qualifications}
                    onChange={(e) => setJobForm({ ...jobForm, preferred_qualifications: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                    placeholder="Any preferred qualifications or nice-to-haves..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowJobModal(false)}
                  className="px-4 py-2 text-foreground hover:bg-muted rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary"
                >
                  {selectedJob ? 'Update Job' : 'Create Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Application Detail Modal */}
      {showApplicationModal && selectedApplication && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">{selectedApplication.applicant_name}</h2>
                <p className="text-sm text-muted-foreground">Applied for: {selectedApplication.job_title}</p>
              </div>
              <button onClick={() => setShowApplicationModal(false)} className="p-2 hover:bg-muted rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(selectedApplication.status)}`}>
                  {selectedApplication.status.toUpperCase()}
                </span>
                <span className="text-sm text-muted-foreground">
                  Applied {new Date(selectedApplication.created_at).toLocaleDateString()}
                </span>
              </div>

              {/* Contact */}
              <div className="bg-muted rounded-lg p-4">
                <h3 className="font-medium mb-2">Contact Information</h3>
                <p className="text-sm text-muted-foreground">{selectedApplication.applicant_email}</p>
              </div>

              {/* Application Details */}
              {selectedApplication.cover_letter && (
                <div>
                  <h3 className="font-medium mb-2">Cover Letter</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted rounded-lg p-4">
                    {selectedApplication.cover_letter}
                  </p>
                </div>
              )}

              {selectedApplication.why_interested && (
                <div>
                  <h3 className="font-medium mb-2">Why Interested</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedApplication.why_interested}</p>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                {selectedApplication.availability && (
                  <div>
                    <h3 className="font-medium mb-1 text-sm text-muted-foreground">Availability</h3>
                    <p className="text-foreground">{selectedApplication.availability}</p>
                  </div>
                )}
                {selectedApplication.start_date && (
                  <div>
                    <h3 className="font-medium mb-1 text-sm text-muted-foreground">Start Date</h3>
                    <p className="text-foreground">{selectedApplication.start_date}</p>
                  </div>
                )}
              </div>

              {selectedApplication.experience && (
                <div>
                  <h3 className="font-medium mb-2">Experience</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedApplication.experience}</p>
                </div>
              )}

              {selectedApplication.relevant_coursework && (
                <div>
                  <h3 className="font-medium mb-2">Relevant Coursework</h3>
                  <p className="text-sm text-muted-foreground">{selectedApplication.relevant_coursework}</p>
                </div>
              )}

              {selectedApplication.references?.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">References</h3>
                  <div className="space-y-2">
                    {selectedApplication.references.map((ref, idx) => (
                      <div key={idx} className="bg-muted rounded-lg p-3 text-sm">
                        <p className="font-medium">{ref.name}</p>
                        <p className="text-muted-foreground">{ref.relationship}</p>
                        <p className="text-muted-foreground">{ref.contact}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedApplication.resume_url && (
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <FileText className="w-8 h-8 text-primary" />
                  <div className="flex-1">
                    <p className="font-medium">Resume Attached</p>
                    <p className="text-sm text-muted-foreground">Click to download</p>
                  </div>
                  <button
                    onClick={() => handleDownloadResume(selectedApplication.resume_url, selectedApplication.applicant_name)}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>
              )}

              {selectedApplication.admin_notes && (
                <div className="bg-warning/10 rounded-lg p-4">
                  <h3 className="font-medium mb-2 text-warning">Admin Notes</h3>
                  <p className="text-sm text-warning">{selectedApplication.admin_notes}</p>
                </div>
              )}

              {/* Schedule Interview / Send Message Button */}
              {(() => {
                const isInterviewStatus = selectedApplication.status === 'interview';
                const showSentState = messageSent;
                const showMessageMode = isInterviewStatus && !showSentState;
                
                return (
                  <div className={`rounded-lg p-4 ${showSentState ? 'bg-success/10' : showMessageMode ? 'bg-muted' : 'bg-muted'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${showSentState ? 'bg-success/10' : showMessageMode ? 'bg-muted' : 'bg-muted'}`}>
                          {showSentState ? (
                            <CheckCircle className="w-5 h-5 text-success" />
                          ) : (
                            <Mail className={`w-5 h-5 ${showMessageMode ? 'text-primary' : 'text-primary'}`} />
                          )}
                        </div>
                        <div>
                          {showSentState ? (
                            <>
                              <p className="font-medium text-success">Message Sent</p>
                              <p className="text-sm text-success">Your message has been sent</p>
                            </>
                          ) : showMessageMode ? (
                            <>
                              <p className="font-medium text-foreground">Send a Message</p>
                              <p className="text-sm text-primary">Follow up with the applicant</p>
                            </>
                          ) : (
                            <>
                              <p className="font-medium text-foreground">Schedule an Interview</p>
                              <p className="text-sm text-primary">Send a message to invite for interview</p>
                            </>
                          )}
                        </div>
                      </div>
                      {showSentState ? (
                        <button
                          onClick={openScheduleInterview}
                          className="px-4 py-2 bg-success/10 text-success rounded-lg hover:bg-success/40 flex items-center gap-2 transition-colors"
                        >
                          <Send className="w-4 h-4" />
                          Send Another
                        </button>
                      ) : showMessageMode ? (
                        <button
                          onClick={openScheduleInterview}
                          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary flex items-center gap-2 transition-colors"
                        >
                          <Send className="w-4 h-4" />
                          Send Message
                        </button>
                      ) : (
                        <button
                          onClick={openScheduleInterview}
                          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary flex items-center gap-2 transition-colors"
                        >
                          <Send className="w-4 h-4" />
                          Send Invite
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">Update Status</h3>
                <div className="flex flex-wrap gap-2">
                  {['pending', 'reviewing', 'interview', 'accepted', 'rejected'].map(status => (
                    <button
                      key={status}
                      onClick={() => handleUpdateApplicationStatus(selectedApplication.id, status)}
                      disabled={selectedApplication.status === status}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        selectedApplication.status === status
                          ? 'bg-muted text-muted-foreground cursor-not-allowed'
                          : 'bg-muted text-foreground hover:bg-muted'
                      }`}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Message Modal for Schedule Interview */}
      {showMessageModal && selectedApplication && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="border-b border-border px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Schedule Interview</h2>
                  <p className="text-sm text-muted-foreground">Send to: {selectedApplication.applicant_email}</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowMessageModal(false); setMessageForm({ subject: '', message: '' }); }} 
                className="p-2 hover:bg-muted rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Subject</label>
                <input
                  type="text"
                  value={messageForm.subject}
                  onChange={(e) => setMessageForm({ ...messageForm, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Interview invitation..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Message</label>
                <textarea
                  rows={8}
                  value={messageForm.message}
                  onChange={(e) => setMessageForm({ ...messageForm, message: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Write your interview invitation message..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => { setShowMessageModal(false); setMessageForm({ subject: '', message: '' }); }}
                  className="px-4 py-2 text-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendMessage}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary flex items-center gap-2 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Send Message
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollegeJobsAdmin;
