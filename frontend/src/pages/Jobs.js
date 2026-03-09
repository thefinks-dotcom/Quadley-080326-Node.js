import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext, API } from '../App';
import toast from 'react-hot-toast';
import { 
  Briefcase, Search, Clock, DollarSign, MapPin, Calendar, 
  Building, ChevronRight, X, Upload, CheckCircle, AlertCircle,
  FileText, Users, Send, ArrowLeft, Home
} from 'lucide-react';

const Jobs = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [myApplications, setMyApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('browse');
  const [selectedJob, setSelectedJob] = useState(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [categories, setCategories] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Application form state
  const [applicationForm, setApplicationForm] = useState({
    cover_letter: '',
    availability: '',
    start_date: '',
    experience: '',
    relevant_coursework: '',
    references: [],
    why_interested: '',
    additional_info: ''
  });
  const [newReference, setNewReference] = useState({ name: '', relationship: '', contact: '' });
  const [resumeFile, setResumeFile] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [jobsRes, appsRes, catsRes] = await Promise.all([
        axios.get(`${API}/jobs`),
        axios.get(`${API}/jobs/my/applications`),
        axios.get(`${API}/jobs/categories`)
      ]);
      setJobs(jobsRes.data);
      setMyApplications(appsRes.data);
      setCategories(catsRes.data);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (e) => {
    e.preventDefault();
    if (!selectedJob) return;

    setSubmitting(true);
    try {
      // Submit application
      const response = await axios.post(`${API}/jobs/${selectedJob.id}/apply`, {
        ...applicationForm,
        job_id: selectedJob.id
      });

      // Upload resume if provided
      if (resumeFile) {
        const formData = new FormData();
        formData.append('file', resumeFile);
        await axios.post(`${API}/jobs/${selectedJob.id}/apply/resume`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      toast.success('Application submitted successfully!');
      setShowApplyModal(false);
      resetApplicationForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  const resetApplicationForm = () => {
    setApplicationForm({
      cover_letter: '',
      availability: '',
      start_date: '',
      experience: '',
      relevant_coursework: '',
      references: [],
      why_interested: '',
      additional_info: ''
    });
    setNewReference({ name: '', relationship: '', contact: '' });
    setResumeFile(null);
    setSelectedJob(null);
  };

  const addReference = () => {
    if (newReference.name && newReference.contact) {
      setApplicationForm({
        ...applicationForm,
        references: [...applicationForm.references, { ...newReference }]
      });
      setNewReference({ name: '', relationship: '', contact: '' });
    }
  };

  const removeReference = (index) => {
    setApplicationForm({
      ...applicationForm,
      references: applicationForm.references.filter((_, i) => i !== index)
    });
  };

  const hasApplied = (jobId) => {
    return myApplications.some(app => app.job_id === jobId);
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-warning/10 text-warning',
      reviewing: 'bg-muted text-primary',
      interview: 'bg-muted text-primary',
      accepted: 'bg-success/10 text-success',
      rejected: 'bg-destructive/10 text-destructive',
      withdrawn: 'bg-muted text-foreground'
    };
    return colors[status] || 'bg-muted text-foreground';
  };

  const filteredJobs = jobs.filter(job => {
    const matchesCategory = categoryFilter === 'all' || job.category === categoryFilter;
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         job.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         job.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground mb-3 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Briefcase className="w-7 h-7 text-primary" />
          College Jobs
        </h1>
        <p className="text-muted-foreground mt-1">Find and apply for on-campus job opportunities</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border mb-6">
        <button
          onClick={() => setActiveTab('browse')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'browse' 
              ? 'text-primary border-b-2 border-primary' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Browse Jobs ({jobs.length})
        </button>
        <button
          onClick={() => setActiveTab('applications')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'applications' 
              ? 'text-primary border-b-2 border-primary' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          My Applications ({myApplications.length})
        </button>
      </div>

      {/* Browse Jobs Tab */}
      {activeTab === 'browse' && (
        <>
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Jobs Grid */}
          {filteredJobs.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-border">
              <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No jobs available at the moment</p>
              <p className="text-sm text-muted-foreground mt-1">Check back later for new opportunities</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {filteredJobs.map(job => {
                const applied = hasApplied(job.id);
                const deadlinePassed = job.application_deadline && 
                  new Date(job.application_deadline) < new Date();
                
                return (
                  <div 
                    key={job.id} 
                    className="bg-white rounded-xl border border-border p-5 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-foreground text-lg">{job.title}</h3>
                        <span className="inline-block px-2 py-0.5 text-xs font-medium bg-muted text-primary rounded-full mt-1">
                          {job.category}
                        </span>
                      </div>
                      {applied && (
                        <span className="px-2 py-1 text-xs font-medium bg-success/10 text-success rounded-full flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Applied
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{job.description}</p>

                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-4">
                      {job.hours_per_week && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {job.hours_per_week} hrs/wk
                        </span>
                      )}
                      {job.pay_rate && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          {job.pay_rate}
                        </span>
                      )}
                      {job.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {job.location}
                        </span>
                      )}
                      {job.positions_available > 1 && (
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {job.positions_available} positions
                        </span>
                      )}
                    </div>

                    {job.application_deadline && (
                      <div className={`text-xs mb-4 flex items-center gap-1 ${deadlinePassed ? 'text-destructive' : 'text-muted-foreground'}`}>
                        <Calendar className="w-4 h-4" />
                        Deadline: {new Date(job.application_deadline).toLocaleDateString()}
                        {deadlinePassed && ' (Passed)'}
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-3 border-t border-border">
                      <button
                        onClick={() => setSelectedJob(job)}
                        className="text-primary hover:underline text-sm flex items-center gap-1"
                      >
                        View Details <ChevronRight className="w-4 h-4" />
                      </button>
                      
                      {!applied && !deadlinePassed ? (
                        <button
                          onClick={() => { setSelectedJob(job); setShowApplyModal(true); }}
                          className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 flex items-center gap-2"
                        >
                          <Send className="w-4 h-4" />
                          Apply Now
                        </button>
                      ) : deadlinePassed ? (
                        <span className="text-sm text-destructive">Applications closed</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* My Applications Tab */}
      {activeTab === 'applications' && (
        <div className="space-y-4">
          {myApplications.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-border">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">You have not applied to any jobs yet</p>
              <button
                onClick={() => setActiveTab('browse')}
                className="mt-4 text-primary hover:underline"
              >
                Browse available jobs
              </button>
            </div>
          ) : (
            myApplications.map(app => (
              <div key={app.id} className="bg-white rounded-xl border border-border p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">{app.job_title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Applied on {new Date(app.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(app.status)}`}>
                    {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                  </span>
                </div>

                {app.status === 'interview' && (
                  <div className="mt-3 p-3 bg-muted rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-primary" />
                    <p className="text-sm text-primary">You have been selected for an interview! Check your email for details.</p>
                  </div>
                )}

                {app.status === 'accepted' && (
                  <div className="mt-3 p-3 bg-success/10 rounded-lg flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-success" />
                    <p className="text-sm text-success">Congratulations! Your application has been accepted.</p>
                  </div>
                )}

                {app.admin_notes && (
                  <div className="mt-3 p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Note from reviewer:</p>
                    <p className="text-sm text-foreground">{app.admin_notes}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Job Detail Modal */}
      {selectedJob && !showApplyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">{selectedJob.title}</h2>
              <button onClick={() => setSelectedJob(null)} className="p-2 hover:bg-muted rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Quick Info */}
              <div className="flex flex-wrap gap-4 pb-4 border-b">
                <span className="px-3 py-1 bg-muted text-primary rounded-full font-medium">
                  {selectedJob.category}
                </span>
                {selectedJob.hours_per_week && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    {selectedJob.hours_per_week} hours/week
                  </span>
                )}
                {selectedJob.pay_rate && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <DollarSign className="w-4 h-4" />
                    {selectedJob.pay_rate}
                  </span>
                )}
              </div>

              {/* Description */}
              <div>
                <h3 className="font-medium text-foreground mb-2">Description</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{selectedJob.description}</p>
              </div>

              {/* Responsibilities */}
              {selectedJob.responsibilities && (
                <div>
                  <h3 className="font-medium text-foreground mb-2">Responsibilities</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{selectedJob.responsibilities}</p>
                </div>
              )}

              {/* Required Skills */}
              {selectedJob.required_skills?.length > 0 && (
                <div>
                  <h3 className="font-medium text-foreground mb-2">Required Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedJob.required_skills.map((skill, idx) => (
                      <span key={idx} className="px-3 py-1 bg-muted text-foreground rounded-full text-sm">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Preferred Qualifications */}
              {selectedJob.preferred_qualifications && (
                <div>
                  <h3 className="font-medium text-foreground mb-2">Preferred Qualifications</h3>
                  <p className="text-muted-foreground">{selectedJob.preferred_qualifications}</p>
                </div>
              )}

              {/* Details Grid */}
              <div className="grid sm:grid-cols-2 gap-4 bg-muted rounded-lg p-4">
                {selectedJob.department && (
                  <div>
                    <span className="text-sm text-muted-foreground">Department</span>
                    <p className="font-medium">{selectedJob.department}</p>
                  </div>
                )}
                {selectedJob.supervisor && (
                  <div>
                    <span className="text-sm text-muted-foreground">Supervisor</span>
                    <p className="font-medium">{selectedJob.supervisor}</p>
                  </div>
                )}
                {selectedJob.location && (
                  <div>
                    <span className="text-sm text-muted-foreground">Location</span>
                    <p className="font-medium">{selectedJob.location}</p>
                  </div>
                )}
                {selectedJob.positions_available && (
                  <div>
                    <span className="text-sm text-muted-foreground">Positions Available</span>
                    <p className="font-medium">{selectedJob.positions_available}</p>
                  </div>
                )}
                {selectedJob.application_deadline && (
                  <div>
                    <span className="text-sm text-muted-foreground">Application Deadline</span>
                    <p className="font-medium">{new Date(selectedJob.application_deadline).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              {/* Apply Button */}
              <div className="pt-4 border-t flex justify-end gap-3">
                <button
                  onClick={() => setSelectedJob(null)}
                  className="px-4 py-2 text-foreground hover:bg-muted rounded-lg"
                >
                  Close
                </button>
                {!hasApplied(selectedJob.id) && (
                  <button
                    onClick={() => setShowApplyModal(true)}
                    className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Apply for this Job
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Apply Modal */}
      {showApplyModal && selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Apply for Position</h2>
                <p className="text-sm text-muted-foreground">{selectedJob.title}</p>
              </div>
              <button onClick={() => { setShowApplyModal(false); resetApplicationForm(); }} className="p-2 hover:bg-muted rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleApply} className="p-6 space-y-6">
              {/* Why Interested */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Why are you interested in this position? *
                </label>
                <textarea
                  required
                  rows={3}
                  value={applicationForm.why_interested}
                  onChange={(e) => setApplicationForm({ ...applicationForm, why_interested: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                  placeholder="Tell us why you'd be a great fit..."
                />
              </div>

              {/* Availability */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Your Availability *</label>
                  <input
                    type="text"
                    required
                    value={applicationForm.availability}
                    onChange={(e) => setApplicationForm({ ...applicationForm, availability: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                    placeholder="e.g., Mon-Fri 2pm-6pm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Earliest Start Date</label>
                  <input
                    type="date"
                    value={applicationForm.start_date}
                    onChange={(e) => setApplicationForm({ ...applicationForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Experience */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Relevant Experience</label>
                <textarea
                  rows={3}
                  value={applicationForm.experience}
                  onChange={(e) => setApplicationForm({ ...applicationForm, experience: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                  placeholder="Describe any relevant work, volunteer, or academic experience..."
                />
              </div>

              {/* Relevant Coursework */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Relevant Coursework</label>
                <input
                  type="text"
                  value={applicationForm.relevant_coursework}
                  onChange={(e) => setApplicationForm({ ...applicationForm, relevant_coursework: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                  placeholder="e.g., Computer Science 101, Business Communications"
                />
              </div>

              {/* Cover Letter */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Cover Letter (Optional)</label>
                <textarea
                  rows={4}
                  value={applicationForm.cover_letter}
                  onChange={(e) => setApplicationForm({ ...applicationForm, cover_letter: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                  placeholder="Add a cover letter if you'd like..."
                />
              </div>

              {/* References */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">References</label>
                {applicationForm.references.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {applicationForm.references.map((ref, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-muted rounded-lg p-3">
                        <div>
                          <p className="font-medium text-sm">{ref.name}</p>
                          <p className="text-xs text-muted-foreground">{ref.relationship} • {ref.contact}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeReference(idx)}
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="p-3 border border-border rounded-lg bg-muted">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Name"
                      value={newReference.name}
                      onChange={(e) => setNewReference({ ...newReference, name: e.target.value })}
                      className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary bg-white"
                    />
                    <input
                      type="text"
                      placeholder="Relationship"
                      value={newReference.relationship}
                      onChange={(e) => setNewReference({ ...newReference, relationship: e.target.value })}
                      className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary bg-white"
                    />
                    <input
                      type="text"
                      placeholder="Email or Phone"
                      value={newReference.contact}
                      onChange={(e) => setNewReference({ ...newReference, contact: e.target.value })}
                      className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addReference}
                    className="w-full px-3 py-2 bg-white border border-border text-foreground rounded-lg hover:bg-muted text-sm font-medium"
                  >
                    + Add Reference
                  </button>
                </div>
              </div>

              {/* Resume Upload */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Resume/CV (Optional)</label>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center relative">
                  {resumeFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="w-8 h-8 text-primary" />
                      <div className="text-left">
                        <p className="font-medium text-foreground">{resumeFile.name}</p>
                        <p className="text-sm text-muted-foreground">{(resumeFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setResumeFile(null)}
                        className="ml-4 text-destructive hover:text-destructive"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block">
                      <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground mb-1">Drop your resume here or click to browse</p>
                      <p className="text-xs text-muted-foreground">PDF, DOC, or DOCX (max 5MB)</p>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => setResumeFile(e.target.files[0])}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Additional Info */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Additional Information</label>
                <textarea
                  rows={2}
                  value={applicationForm.additional_info}
                  onChange={(e) => setApplicationForm({ ...applicationForm, additional_info: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                  placeholder="Anything else you'd like us to know?"
                />
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => { setShowApplyModal(false); resetApplicationForm(); }}
                  className="px-4 py-2 text-foreground hover:bg-muted rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:bg-primary/50 flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Application
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Jobs;
