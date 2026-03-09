/**
 * Date formatting utilities for consistent date display across the app
 * Uses dd-MM-yyyy format as requested
 */
import { format as dateFnsFormat } from 'date-fns';

// Standard date formats used throughout the app
export const DATE_FORMATS = {
  // Display formats (for UI)
  DATE_DISPLAY: 'dd-MM-yyyy',           // 22-01-2026
  DATE_TIME_DISPLAY: 'dd-MM-yyyy h:mm a', // 22-01-2026 3:30 PM
  DATE_LONG: 'EEEE, dd MMMM yyyy',       // Wednesday, 22 January 2026
  DATE_MEDIUM: 'dd MMM yyyy',            // 22 Jan 2026
  DATE_SHORT: 'dd/MM',                   // 22/01
  TIME_ONLY: 'h:mm a',                   // 3:30 PM
  MONTH_YEAR: 'MMMM yyyy',               // January 2026
  
  // API formats (for backend communication - keep as yyyy-MM-dd for backend)
  API_DATE: 'yyyy-MM-dd',                // 2026-01-22
  API_DATETIME: "yyyy-MM-dd'T'HH:mm:ss", // 2026-01-22T15:30:00
};

/**
 * Format a date for display (dd-MM-yyyy)
 */
export const formatDate = (date, formatStr = DATE_FORMATS.DATE_DISPLAY) => {
  if (!date) return '';
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateFnsFormat(dateObj, formatStr);
  } catch (error) {
    console.error('Date formatting error:', error);
    return '';
  }
};

/**
 * Format a date with time for display (dd-MM-yyyy h:mm a)
 */
export const formatDateTime = (date) => {
  return formatDate(date, DATE_FORMATS.DATE_TIME_DISPLAY);
};

/**
 * Format a date in long format (Wednesday, 22 January 2026)
 */
export const formatDateLong = (date) => {
  return formatDate(date, DATE_FORMATS.DATE_LONG);
};

/**
 * Format a date in medium format (22 Jan 2026)
 */
export const formatDateMedium = (date) => {
  return formatDate(date, DATE_FORMATS.DATE_MEDIUM);
};

/**
 * Format for API calls (yyyy-MM-dd) - keep this format for backend
 */
export const formatForApi = (date) => {
  return formatDate(date, DATE_FORMATS.API_DATE);
};

/**
 * Format month and year (January 2026)
 */
export const formatMonthYear = (date) => {
  return formatDate(date, DATE_FORMATS.MONTH_YEAR);
};

/**
 * Check if two dates are the same day
 */
export const isSameDay = (date1, date2) => {
  if (!date1 || !date2) return false;
  return formatForApi(date1) === formatForApi(date2);
};

export default {
  formatDate,
  formatDateTime,
  formatDateLong,
  formatDateMedium,
  formatForApi,
  formatMonthYear,
  isSameDay,
  DATE_FORMATS,
};
