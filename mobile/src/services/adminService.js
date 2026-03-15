import api from './api';
import { ENDPOINTS } from '../config/api';

// ====== USERS ======

export const getUsers = () =>
  api.get(ENDPOINTS.USERS_LIST).then(r => r.data);

export const updateUserRole = (userId, role) =>
  api.patch(`${ENDPOINTS.ADMIN_USERS}/${userId}`, { role }).then(r => r.data);

export const updateUserStatus = (userId, active) =>
  api.patch(`/auth/users/${userId}/status`, { active }).then(r => r.data);

export const inviteUser = (studentData) =>
  api.post('/admin/users/invite', studentData).then(r => r.data);

export const bulkInviteUsers = (formData) =>
  api.post('/admin/users/bulk-invite', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);

export const resendInvite = (userId) =>
  api.post(`/admin/users/resend-invite/${userId}`).then(r => r.data);

export const updateUserDetails = (userId, { first_name, last_name, email }) =>
  api.patch(`/admin/users/${userId}/details`, { first_name, last_name, email }).then(r => r.data);

export const deleteUser = (userId) =>
  api.delete(`/admin/users/${userId}`).then(r => r.data);

export const bulkDeleteUsers = (userIds) =>
  api.post('/admin/users/bulk-delete', { user_ids: userIds }).then(r => r.data);

// ====== ANNOUNCEMENTS ======

export const getAnnouncements = () =>
  api.get(ENDPOINTS.ANNOUNCEMENTS).then(r => r.data);

export const getAnnouncementReadStats = () =>
  api.get(`${ENDPOINTS.ANNOUNCEMENTS}/read-stats/summary`).then(r => r.data);

export const getAnnouncementItemStats = (id) =>
  api.get(`${ENDPOINTS.ANNOUNCEMENTS}/${id}/read-stats`).then(r => r.data);

export const createAnnouncement = (payload) =>
  api.post(ENDPOINTS.ANNOUNCEMENTS, payload).then(r => r.data);

export const updateAnnouncement = (id, payload) =>
  api.put(`${ENDPOINTS.ANNOUNCEMENTS}/${id}`, payload).then(r => r.data);

export const deleteAnnouncement = (id) =>
  api.delete(`${ENDPOINTS.ANNOUNCEMENTS}/${id}`).then(r => r.data);

// ====== EVENTS ======

export const getEvents = () =>
  api.get(ENDPOINTS.EVENTS).then(r => r.data);

export const createEvent = (payload) =>
  api.post(ENDPOINTS.EVENTS, payload).then(r => r.data);

export const updateEvent = (eventId, payload) =>
  api.put(`${ENDPOINTS.EVENTS}/${eventId}`, payload).then(r => r.data);

export const deleteEvent = (eventId) =>
  api.delete(`${ENDPOINTS.EVENTS}/${eventId}`).then(r => r.data);

// ====== JOBS ======

export const getJobs = () =>
  api.get(ENDPOINTS.JOBS).then(r => r.data);

export const getAllJobApplications = () =>
  api.get(`${ENDPOINTS.JOBS}/admin/all-applications`).then(r => r.data);

export const createJob = (payload) =>
  api.post(ENDPOINTS.JOBS, payload).then(r => r.data);

export const updateJob = (jobId, data) =>
  api.patch(`${ENDPOINTS.JOBS}/${jobId}`, data).then(r => r.data);

export const deleteJob = (jobId) =>
  api.delete(`${ENDPOINTS.JOBS}/${jobId}`).then(r => r.data);

export const updateJobApplicationStatus = (applicationId, status) =>
  api.patch(`${ENDPOINTS.JOBS}/applications/${applicationId}/status`, { status }).then(r => r.data);

// ====== DINING ======

export const getDiningMenu = (dateStr) =>
  api.get(`${ENDPOINTS.DINING}/menu?date=${dateStr}`).then(r => r.data);

export const createMenuItem = (data) =>
  api.post(`${ENDPOINTS.DINING}/menu`, data).then(r => r.data);

export const updateMenuItem = (id, data) =>
  api.put(`${ENDPOINTS.DINING}/menu/${id}`, data).then(r => r.data);

export const deleteMenuItem = (id) =>
  api.delete(`${ENDPOINTS.DINING}/menu/${id}`).then(r => r.data);

export const clearDiningDate = (date) =>
  api.delete(`${ENDPOINTS.DINING}/menu/clear-date/${date}`).then(r => r.data);

export const bulkUploadMenu = (formData) =>
  api.post(`${ENDPOINTS.DINING}/menu/bulk-upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);

// ====== MESSAGES / CONVERSATIONS ======

export const getConversations = () =>
  api.get(ENDPOINTS.CONVERSATIONS).then(r => r.data);

export const searchUsers = () =>
  api.get(ENDPOINTS.USER_SEARCH).then(r => r.data);

export const createMessageGroup = (name, memberIds) =>
  api.post('/message-groups', { name: name.trim(), member_ids: memberIds }).then(r => r.data);

// ====== RECOGNITION / SHOUTOUTS ======

export const getShoutouts = () =>
  api.get(ENDPOINTS.SHOUTOUTS).then(r => r.data);

export const createShoutout = (data) =>
  api.post(ENDPOINTS.SHOUTOUTS, data).then(r => r.data);

// ====== SAFE DISCLOSURES ======

export const getSafeDisclosures = () =>
  api.get(ENDPOINTS.SAFE_DISCLOSURE).then(r => r.data);

export const getSafeDisclosureStats = () =>
  api.get(`${ENDPOINTS.SAFE_DISCLOSURE}/stats`).then(r => r.data);

export const forwardSafeDisclosure = (id, data) =>
  api.post(`${ENDPOINTS.SAFE_DISCLOSURE}/${id}/forward`, data).then(r => r.data);

export const updateSafeDisclosureStatus = (id, status, notes) =>
  api.put(`${ENDPOINTS.SAFE_DISCLOSURE}/${id}/status`, { status, notes }).then(r => r.data);

export const updateSafeDisclosureRiskAssessment = (id, data) =>
  api.put(`${ENDPOINTS.SAFE_DISCLOSURE}/${id}/risk-assessment`, data).then(r => r.data);

export const resolveSafeDisclosure = (id, resolutionNotes) =>
  api.put(`${ENDPOINTS.SAFE_DISCLOSURE}/${id}/resolve`, { resolution_notes: resolutionNotes }).then(r => r.data);

export const updateSafeDisclosureRespondent = (id, data) =>
  api.put(`${ENDPOINTS.SAFE_DISCLOSURE}/${id}/respondent`, data).then(r => r.data);

export const addSafeDisclosureInterimMeasures = (id, data) =>
  api.post(`${ENDPOINTS.SAFE_DISCLOSURE}/${id}/interim-measures`, data).then(r => r.data);

// ====== MAINTENANCE / SERVICE REQUESTS ======

export const getMaintenanceRequests = () =>
  api.get(ENDPOINTS.MAINTENANCE).then(r => r.data);

export const updateMaintenanceStatus = (requestId, status) =>
  api.patch(`${ENDPOINTS.MAINTENANCE}/${requestId}`, { status }).then(r => r.data);

// ====== TENANT SETTINGS ======

export const getTenantSettings = () =>
  api.get('/tenants').then(r => r.data);

export const updateContactPerson = (tenantCode, data) =>
  api.put(`/tenants/${tenantCode}/contact-person`, data).then(r => r.data);

// ====== REPORTS & ANALYTICS ======

export const getAdminStats = () =>
  api.get(ENDPOINTS.ADMIN_STATS).then(r => r.data);

export const getStudentUsageAnalytics = (period) =>
  api.get(`/analytics/student-usage?period=${period}`).then(r => r.data);

export const getGenderViolenceReport = () =>
  api.get('/analytics/gender-violence-report').then(r => r.data);

export const getStudentReportYears = () =>
  api.get(`${ENDPOINTS.STUDENT_REPORTS}/years`).then(r => r.data);

export const getStudentReportFloors = () =>
  api.get(`${ENDPOINTS.STUDENT_REPORTS}/floors`).then(r => r.data);

export const getStudentReportActivityTypes = () =>
  api.get(`${ENDPOINTS.STUDENT_REPORTS}/activity-types`).then(r => r.data);

export const searchStudentReports = (params) =>
  api.get(`${ENDPOINTS.STUDENT_REPORTS}/search?${params.toString()}`).then(r => r.data);

export const getStudentReport = (studentId) =>
  api.get(`${ENDPOINTS.STUDENT_REPORTS}/student/${studentId}`).then(r => r.data);

// ====== CO-CURRICULAR ACTIVITIES ======

export const getCocurricularGroups = () =>
  api.get('/cocurricular/groups/all').then(r => r.data);

export const createCocurricularGroup = (data) =>
  api.post('/cocurricular/groups', data).then(r => r.data);

export const updateCocurricularGroup = (activityId, data) =>
  api.put(`/cocurricular/groups/${activityId}`, data).then(r => r.data);

export const deleteCocurricularGroup = (activityId) =>
  api.delete(`/cocurricular/groups/${activityId}`).then(r => r.data);
