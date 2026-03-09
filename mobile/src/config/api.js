// API Configuration - reads from build-time config, falls back to production URL
import Constants from 'expo-constants';

const configApiUrl = Constants.expoConfig?.extra?.apiUrl;
export const API_BASE_URL = configApiUrl || process.env.EXPO_PUBLIC_API_URL || 'https://quadley-280126-production.up.railway.app/api';

export const ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  LOGIN_MFA: '/auth/login/mfa',
  REGISTER: '/auth/register',
  LOGOUT: '/auth/logout',
  ME: '/auth/me',
  CHANGE_PASSWORD: '/auth/change-password',
  REQUEST_EMAIL_CHANGE: '/auth/request-email-change',
  VERIFY_EMAIL_CHANGE: '/auth/verify-email-change',
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD: '/auth/reset-password',
  INVITE_CODE_VERIFY: '/auth/invite-code/verify',
  INVITE_CODE_REGISTER: '/auth/invite-code/register',
  
  // MFA
  MFA_STATUS: '/mfa/status',
  MFA_SETUP: '/mfa/setup',
  MFA_VERIFY: '/mfa/verify',
  MFA_DISABLE: '/mfa/disable',
  MFA_VERIFY_CODE: '/mfa/verify-code',
  MFA_BACKUP_CODES: '/mfa/regenerate-backup-codes',
  
  // CAPTCHA
  CAPTCHA: '/captcha',
  CAPTCHA_CONFIG: '/captcha/config',
  CAPTCHA_CHALLENGE: '/captcha/challenge',
  CAPTCHA_VERIFY: '/captcha/verify',
  
  // Events
  EVENTS: '/events',
  
  // Announcements
  ANNOUNCEMENTS: '/announcements',
  EMERGENCY_ROLLCALL: '/emergency-rollcall',
  
  // Messages
  MESSAGES: '/messages',
  MESSAGE_GROUPS: '/message-groups',
  CONVERSATIONS: '/conversations',
  
  // Jobs
  JOBS: '/jobs',
  JOB_APPLICATIONS: '/jobs/applications',
  
  // Dining
  DINING: '/dining',
  LATE_MEALS: '/dining/late-meals',
  
  // Maintenance
  MAINTENANCE: '/maintenance',
  
  // Shoutouts/Recognition
  SHOUTOUTS: '/shoutouts',
  RECOGNITION_PARTICIPANTS: '/recognition/participants',
  
  // Co-Curricular
  COCURRICULAR: '/cocurricular',
  
  // Wellbeing
  WELLBEING: '/wellbeing',
  
  // Floor
  FLOOR: '/floor',
  
  // Birthdays
  BIRTHDAYS: '/birthdays/upcoming',
  
  // Finance (Bills)
  FINANCE: '/bills',
  
  // Academics
  ACADEMICS: '/academics',
  STUDY_GROUPS: '/study-groups',
  TUTORING: '/tutoring',
  TUTORING_APPROVED: '/tutoring/approved',
  
  // Admin
  ADMIN_USERS: '/admin/users',
  ADMIN_STATS: '/admin/stats',
  
  // Notifications
  NOTIFICATIONS: '/notifications',
  NOTIFICATIONS_UNREAD: '/notifications/unread-count',
  NOTIFICATIONS_READ_ALL: '/notifications/read-all',
  NOTIFICATION_REGISTER: '/notifications/register-device',
  NOTIFICATION_PREFERENCES: '/notifications/preferences',
  
  // Dashboard
  DASHBOARD: '/dashboard',
  
  // Bookings
  BOOKINGS: '/bookings',
  BOOKINGS_FACILITIES: '/bookings/facilities',
  BOOKINGS_MY: '/bookings/my',
  
  // Parcels
  PARCELS: '/parcels',
  
  // Safe Disclosure
  SAFE_DISCLOSURE: '/safe-disclosures',
  
  // Student Reports
  STUDENT_REPORTS: '/student-reports',
  
  // Tenants
  TENANTS: '/tenants',

  // User List (Admin)
  USERS_LIST: '/admin/users',
  USER_SEARCH: '/admin/users/search',
};
