/**
 * Export utilities for generating and sharing report data
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';

/**
 * Convert data to CSV format
 */
export const convertToCSV = (data, headers) => {
  if (!data || data.length === 0) return '';
  
  // If headers not provided, use keys from first object
  const csvHeaders = headers || Object.keys(data[0]);
  
  // Create header row
  let csv = csvHeaders.join(',') + '\n';
  
  // Add data rows
  data.forEach(row => {
    const values = csvHeaders.map(header => {
      let value = row[header];
      
      // Handle null/undefined
      if (value === null || value === undefined) {
        value = '';
      }
      
      // Convert objects/arrays to JSON string
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      
      // Convert to string and escape quotes
      value = String(value).replace(/"/g, '""');
      
      // Wrap in quotes if contains comma, newline, or quote
      if (value.includes(',') || value.includes('\n') || value.includes('"')) {
        value = `"${value}"`;
      }
      
      return value;
    });
    csv += values.join(',') + '\n';
  });
  
  return csv;
};

/**
 * Convert key-value stats object to CSV
 */
export const statsToCSV = (stats, title = 'Report') => {
  let csv = `${title}\n\n`;
  csv += 'Metric,Value\n';
  
  Object.entries(stats).forEach(([key, value]) => {
    const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    csv += `${formattedKey},${value}\n`;
  });
  
  return csv;
};

/**
 * Generate full report CSV with multiple sections
 */
export const generateReportCSV = (sections) => {
  let csv = '';
  
  sections.forEach((section, index) => {
    if (index > 0) csv += '\n\n';
    
    csv += `=== ${section.title} ===\n\n`;
    
    if (section.type === 'stats' && section.data) {
      csv += 'Metric,Value\n';
      Object.entries(section.data).forEach(([key, value]) => {
        const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        csv += `${formattedKey},${value}\n`;
      });
    } else if (section.type === 'table' && section.data) {
      csv += convertToCSV(section.data, section.headers);
    } else if (section.type === 'breakdown' && section.data) {
      csv += 'Category,Count\n';
      Object.entries(section.data).forEach(([key, value]) => {
        const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        csv += `${formattedKey},${value}\n`;
      });
    }
  });
  
  return csv;
};

/**
 * Export data as CSV file and share
 */
export const exportAsCSV = async (csvContent, filename) => {
  try {
    // Check if sharing is available
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert(
        'Export Not Available',
        'Sharing is not available on this device. The report content has been copied.',
        [{ text: 'OK' }]
      );
      return false;
    }
    
    // Create file - use string 'utf8' instead of EncodingType constant
    const fileUri = FileSystem.cacheDirectory + filename;
    await FileSystem.writeAsStringAsync(fileUri, csvContent, {
      encoding: 'utf8',
    });
    
    // Share file
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: `Export ${filename}`,
      UTI: 'public.comma-separated-values-text',
    });
    
    return true;
  } catch (error) {
    console.error('Export error:', error);
    Alert.alert('Export Failed', error.message || 'Failed to export report');
    return false;
  }
};

/**
 * Format date for export filename
 */
export const getExportFilename = (prefix) => {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
  return `${prefix}_${dateStr}.csv`;
};

export default {
  convertToCSV,
  statsToCSV,
  generateReportCSV,
  exportAsCSV,
  getExportFilename,
};
