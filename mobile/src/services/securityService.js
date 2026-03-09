/**
 * Security event reporting service for client-side security monitoring.
 * Reports suspicious activity, auth failures, and integrity violations to the backend.
 * OWASP A09 compliance - Security Logging and Monitoring.
 */
import api from './api';

const SECURITY_EVENTS = {
  AUTH_FAILURE: 'client_auth_failure',
  TOKEN_EXPIRED: 'client_token_expired',
  INVALID_RESPONSE: 'client_invalid_response',
  NETWORK_ERROR: 'client_network_error',
  JAILBREAK_DETECTED: 'client_jailbreak_detected',
  TAMPER_DETECTED: 'client_tamper_detected',
};

let eventQueue = [];
let flushTimer = null;

const queueEvent = (eventType, details = {}) => {
  eventQueue.push({
    event: eventType,
    timestamp: new Date().toISOString(),
    ...details,
  });

  // Flush after 5 events or every 30 seconds
  if (eventQueue.length >= 5) {
    flushEvents();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flushEvents, 30000);
  }
};

const flushEvents = async () => {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (eventQueue.length === 0) return;

  const batch = [...eventQueue];
  eventQueue = [];

  try {
    await api.post('/auth/security-events', { events: batch });
  } catch {
    // Silent fail — don't block user experience for monitoring
  }
};

export const reportAuthFailure = (email, reason) => {
  queueEvent(SECURITY_EVENTS.AUTH_FAILURE, { email, reason });
};

export const reportTokenExpired = () => {
  queueEvent(SECURITY_EVENTS.TOKEN_EXPIRED);
};

export const reportInvalidResponse = (endpoint, statusCode) => {
  queueEvent(SECURITY_EVENTS.INVALID_RESPONSE, { endpoint, statusCode });
};

export const reportTamperDetected = (detail) => {
  queueEvent(SECURITY_EVENTS.TAMPER_DETECTED, { detail });
};

export const reportJailbreakDetected = () => {
  queueEvent(SECURITY_EVENTS.JAILBREAK_DETECTED);
};

export { SECURITY_EVENTS, flushEvents };
