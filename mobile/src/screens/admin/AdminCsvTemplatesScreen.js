import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { useTenant } from '../../contexts/TenantContext';
import AdminScreenHeader from '../../components/AdminScreenHeader';

export default function AdminCsvTemplatesScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding, isModuleEnabled } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  // Map each template key to the module it requires.
  // 'users' is always enabled regardless of modules.
  const templateModuleMap = {
    users: null,         // always available
    dining_menu: 'dining',
    events: 'events',
  };

  const isTemplateEnabled = (key) => {
    const requiredModule = templateModuleMap[key];
    if (requiredModule === null) return true;   // users template — always on
    return isModuleEnabled(requiredModule);
  };

  const [downloading, setDownloading] = useState(null);
  const [uploading, setUploading] = useState(null);
  const [uploadResults, setUploadResults] = useState(null);
  const [resultsModalVisible, setResultsModalVisible] = useState(false);
  const [copying, setCopying] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const queryClient = useQueryClient();

  // Static templates — no API call needed, always available
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrowStr = new Date(today.getTime() + 86400000).toISOString().split('T')[0];
  const dayAfterStr = new Date(today.getTime() + 2 * 86400000).toISOString().split('T')[0];

  const templates = {
    users: {
      name: "Bulk User Import",
      description: "Import multiple students and RAs at once. System will send invitation emails to each user.",
      filename: "user_import_template.csv",
      headers: "first_name,last_name,email,role,floor,room",
      example_rows: [
        "John,Doe,john.doe@example.com,student,Level 1 - Wing A,101",
        "Jane,Smith,jane.smith@example.com,ra,Level 2 - Wing B,205",
        "Bob,Johnson,bob.j@example.com,student,Level 1 - Wing A,102"
      ],
      required_fields: ["first_name", "last_name", "email"],
      optional_fields: ["role", "floor", "room"],
      notes: [
        "Email must be unique - duplicates will be skipped",
        "Users will receive an email to set their password",
        "Role: student (default) or ra",
        "Floor and room are optional but recommended"
      ],
    },
    dining_menu: {
      name: "Dining Menu Import",
      description: "Import menu items for the dining hall. Can import multiple days at once.",
      filename: "dining_menu_template.csv",
      headers: "name,description,meal_type,date,dietary_tags,nutrition_info",
      example_rows: [
        `Scrambled Eggs,Fluffy scrambled eggs with herbs,Breakfast,${todayStr},Vegetarian|Gluten-Free,250 cal`,
        `Grilled Chicken Salad,Fresh greens with grilled chicken,Lunch,${todayStr},Gluten-Free,350 cal`,
        `Pasta Primavera,Penne with seasonal vegetables,Dinner,${todayStr},Vegetarian,450 cal`,
        `Fresh Fruit Bowl,Seasonal fresh fruits,Snacks,${tomorrowStr},Vegan|Gluten-Free,120 cal`
      ],
      required_fields: ["name", "meal_type", "date"],
      optional_fields: ["description", "dietary_tags", "nutrition_info"],
      notes: [
        "meal_type must be: Breakfast, Lunch, Dinner, or Snacks",
        `date format: YYYY-MM-DD (e.g., ${todayStr})`,
        "dietary_tags: separate multiple with | (e.g., Vegetarian|Gluten-Free)",
        "Available tags: Vegetarian, Vegan, Gluten-Free, Dairy-Free, Nut-Free, Halal, Kosher",
      ],
    },
    events: {
      name: "Events Import",
      description: "Import multiple events at once.",
      filename: "events_template.csv",
      headers: "title,description,date,time,location,category,max_attendees",
      example_rows: [
        `Movie Night,Join us for a classic film screening,${tomorrowStr},19:00,Common Room,social,50`,
        `Study Group,Midterm preparation session,${dayAfterStr},14:00,Library Room 2,academic,20`,
        `Floor BBQ,Annual floor barbecue event,${dayAfterStr},17:00,Courtyard,floor_event,100`
      ],
      required_fields: ["title", "description", "date", "location", "category"],
      optional_fields: ["time", "max_attendees"],
      notes: [
        "date format: DD/MM/YYYY (e.g., 15/02/2026) or YYYY-MM-DD",
        "time format: HH:MM in 24-hour format (e.g., 18:00 for 6pm)",
        "If time is not provided, defaults to 12:00",
        "category options: social, academic, sports, cultural, floor_event, other"
      ],
    },
  };
  const isLoading = false;

  const getUploadEndpoint = (templateKey) => {
    switch (templateKey) {
      case 'users':
        return '/admin/users/bulk-invite';
      case 'dining_menu':
        return `${ENDPOINTS.DINING}/menu/bulk-upload`;
      case 'events':
        return '/events/bulk-upload';
      default:
        return null;
    }
  };

  const handleUpload = async (templateKey, template) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const file = result.assets[0];
      
      if (!file.name.toLowerCase().endsWith('.csv')) {
        Alert.alert('Error', 'Please select a CSV file');
        return;
      }

      setUploading(templateKey);
      setUploadResults(null);
      setUploadProgress({
        stage: 'preparing',
        message: 'Preparing upload...',
        percent: 0,
        fileName: file.name,
        templateName: template.name,
      });
      setShowProgressModal(true);

      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        type: 'text/csv',
        name: file.name,
      });

      const endpoint = getUploadEndpoint(templateKey);
      if (!endpoint) {
        Alert.alert('Error', 'Upload not supported for this template type');
        setUploading(null);
        setShowProgressModal(false);
        return;
      }

      // Update progress - uploading
      setUploadProgress(prev => ({
        ...prev,
        stage: 'uploading',
        message: 'Uploading file...',
        percent: 20,
      }));

      // Use the progress endpoint for users
      const useProgressEndpoint = templateKey === 'users';
      const finalEndpoint = useProgressEndpoint 
        ? '/admin/users/bulk-invite-with-progress'
        : endpoint;

      // Simulate progress stages
      setUploadProgress(prev => ({
        ...prev,
        stage: 'processing',
        message: 'Processing rows...',
        percent: 40,
      }));

      const response = await api.post(finalEndpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Update progress - completing
      setUploadProgress(prev => ({
        ...prev,
        stage: 'completing',
        message: 'Finalizing...',
        percent: 90,
      }));

      // Small delay to show completion animation
      await new Promise(resolve => setTimeout(resolve, 500));

      setUploadProgress(prev => ({
        ...prev,
        stage: 'complete',
        message: 'Complete!',
        percent: 100,
      }));

      // Close progress modal after brief delay
      await new Promise(resolve => setTimeout(resolve, 700));
      setShowProgressModal(false);

      setUploadResults({
        templateKey,
        templateName: template.name,
        ...response.data,
      });
      setResultsModalVisible(true);

      // Invalidate relevant queries
      if (templateKey === 'users') {
        queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
        queryClient.invalidateQueries({ queryKey: ['setupStats'] });
      } else if (templateKey === 'dining_menu') {
        // Invalidate ALL dining menu queries (with any date key)
        queryClient.invalidateQueries({ queryKey: ['adminDiningMenu'] });
        queryClient.invalidateQueries({ queryKey: ['diningMenu'] });
      } else if (templateKey === 'events') {
        queryClient.invalidateQueries({ queryKey: ['events'] });
        queryClient.invalidateQueries({ queryKey: ['adminEvents'] });
      }

    } catch (error) {
      console.error('Upload error:', error);
      setShowProgressModal(false);
      Alert.alert('Upload Failed', error.response?.data?.detail || 'Failed to upload CSV file');
    } finally {
      setUploading(null);
      setUploadProgress(null);
    }
  };

  const [csvPreviewVisible, setCsvPreviewVisible] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [previewContent, setPreviewContent] = useState('');

  const downloadTemplate = async (templateKey, template) => {
    // Build CSV content
    let csvContent = template.headers + '\n';
    template.example_rows.forEach((row) => {
      csvContent += row + '\n';
    });
    
    setPreviewTemplate({ ...template, filename: template.filename || `${templateKey}_template.csv` });
    setPreviewContent(csvContent);
    setCsvPreviewVisible(true);
  };

  const saveToDevice = async () => {
    if (!previewTemplate || !previewContent) {
      Alert.alert('Error', 'No content to save');
      return;
    }
    
    try {
      setDownloading(previewTemplate.filename);
      
      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Not Available', 'Sharing is not available on this device. Please use "Copy to Clipboard" instead.');
        return;
      }
      
      // Save to file
      const fileUri = FileSystem.cacheDirectory + previewTemplate.filename;
      await FileSystem.writeAsStringAsync(fileUri, previewContent, {
        encoding: 'utf8',
      });

      // Share the file - this opens iOS share sheet
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: `Save ${previewTemplate.name}`,
        UTI: 'public.comma-separated-values-text',
      });

      // Close modal after sharing
      setCsvPreviewVisible(false);
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', `Could not save file: ${error.message || 'Unknown error'}. Try using "Copy to Clipboard" instead.`);
    } finally {
      setDownloading(null);
    }
  };

  const copyTemplateToClipboard = async () => {
    if (!previewContent) {
      Alert.alert('Error', 'No content to copy');
      return;
    }
    
    try {
      // Use the correct method for expo-clipboard
      if (Clipboard.setStringAsync) {
        await Clipboard.setStringAsync(previewContent);
      } else if (Clipboard.setString) {
        Clipboard.setString(previewContent);
      } else {
        throw new Error('Clipboard not available');
      }
      
      setCsvPreviewVisible(false);
      Alert.alert(
        '✅ Copied!', 
        'CSV content copied to clipboard.\n\nNext steps:\n1. Open Notes, Google Sheets, or Excel\n2. Paste the content\n3. Edit with your data\n4. Save/export as .csv file\n5. Come back here to upload'
      );
    } catch (error) {
      console.error('Copy error:', error);
      // Fallback - show the content so user can manually copy
      Alert.alert(
        'Copy Failed', 
        'Could not copy to clipboard automatically. The content is shown in the preview above - you can manually select and copy it.',
        [{ text: 'OK' }]
      );
    }
  };

  const shareViaEmail = async () => {
    if (!previewTemplate || !previewContent) {
      Alert.alert('Error', 'No content to share');
      return;
    }
    
    try {
      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Not Available', 'Sharing is not available on this device.');
        return;
      }
      
      const fileUri = FileSystem.cacheDirectory + previewTemplate.filename;
      await FileSystem.writeAsStringAsync(fileUri, previewContent, {
        encoding: 'utf8',
      });
      
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: `Share ${previewTemplate.name}`,
        UTI: 'public.comma-separated-values-text',
      });
      
      setCsvPreviewVisible(false);
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Error', `Could not share: ${error.message || 'Unknown error'}`);
    }
  };

  const showTemplateContent = (template) => {
    let csvContent = template.headers + '\n';
    template.example_rows.forEach((row) => {
      csvContent += row + '\n';
    });
    
    Alert.alert(
      template.name,
      `Headers:\n${template.headers}\n\nExample rows:\n${template.example_rows.join('\n')}\n\nSave this as a .csv file`,
      [{ text: 'OK' }]
    );
  };

  const copyToClipboard = async (templateKey, template) => {
    try {
      setCopying(templateKey);
      
      // Build CSV content
      let csvContent = template.headers + '\n';
      template.example_rows.forEach((row) => {
        csvContent += row + '\n';
      });
      
      await Clipboard.setStringAsync(csvContent);
      Alert.alert('Copied!', 'CSV template copied to clipboard. Paste it into a text editor and save as .csv file.');
    } catch (error) {
      console.error('Copy error:', error);
      Alert.alert('Error', 'Failed to copy to clipboard');
    } finally {
      setCopying(null);
    }
  };

  const getIconForTemplate = (key) => {
    switch (key) {
      case 'users':
        return 'people';
      case 'dining_menu':
        return 'restaurant';
      case 'events':
        return 'calendar';
      default:
        return 'document';
    }
  };

  const getColorForTemplate = (key) => {
    switch (key) {
      case 'users':
        return primaryColor;
      case 'dining_menu':
        return primaryColor;
      case 'events':
        return primaryColor;
      default:
        return colors.textSecondary;
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={primaryColor} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfaceSecondary }} edges={['bottom']}>
      <AdminScreenHeader
        title="CSV Templates"
        subtitle="Download, fill in, and upload to bulk import data"
        onBack={() => navigation.goBack()}
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>

        {/* Template Cards */}
        {templates && Object.entries(templates).map(([key, template]) => {
          const enabled = isTemplateEnabled(key);
          return (
          <View
            key={key}
            style={{
              backgroundColor: colors.surface,
              borderRadius: borderRadius.lg,
              padding: 20,
              marginBottom: 16,
              shadowColor: colors.textPrimary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: enabled ? 0.1 : 0.04,
              shadowRadius: 4,
              elevation: enabled ? 3 : 1,
              opacity: enabled ? 1 : 0.45,
            }}
          >
            {/* Template Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: borderRadius.md,
                  backgroundColor: `${getColorForTemplate(key)}15`,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons name={getIconForTemplate(key)} size={24} color={getColorForTemplate(key)} />
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>
                  {template.name}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                  {template.filename}
                </Text>
              </View>
              {!enabled && (
                <View style={{ backgroundColor: colors.surfaceSecondary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.sm }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textTertiary }}>Not enabled</Text>
                </View>
              )}
            </View>

            {/* Description */}
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 16, lineHeight: 20 }}>
              {template.description}
            </Text>

            {/* Fields Info */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>
                Required Fields:
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {template.required_fields.map((field) => (
                  <View
                    key={field}
                    style={{
                      backgroundColor: colors.errorLight,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: borderRadius.md,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: colors.error, fontWeight: '500' }}>{field}</Text>
                  </View>
                ))}
              </View>
            </View>

            {template.optional_fields?.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>
                  Optional Fields:
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {template.optional_fields.map((field) => (
                    <View
                      key={field}
                      style={{
                        backgroundColor: primaryColor + '15',
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: borderRadius.md,
                      }}
                    >
                      <Text style={{ fontSize: 12, color: primaryColor, fontWeight: '500' }}>{field}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Notes */}
            {template.notes?.length > 0 && (
              <View
                style={{
                  backgroundColor: colors.background,
                  borderRadius: borderRadius.sm,
                  padding: 12,
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
                  Notes:
                </Text>
                {template.notes.map((note, idx) => (
                  <Text key={idx} style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>
                    • {note}
                  </Text>
                ))}
              </View>
            )}

            {/* Action Buttons - Row 1: Download & Copy */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <TouchableOpacity
                onPress={() => downloadTemplate(key, template)}
                disabled={!enabled || downloading === key}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: getColorForTemplate(key),
                  paddingVertical: 12,
                  borderRadius: borderRadius.sm,
                  opacity: downloading === key ? 0.7 : 1,
                }}
                data-testid={`download-${key}-template`}
              >
                {downloading === key ? (
                  <ActivityIndicator size="small" color={colors.surface} />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={18} color={colors.surface} />
                    <Text style={{ color: colors.textInverse, fontWeight: '600', marginLeft: 6 }}>
                      Download
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => copyToClipboard(key, template)}
                disabled={!enabled || copying === key}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.textSecondary,
                  paddingVertical: 12,
                  borderRadius: borderRadius.sm,
                  opacity: copying === key ? 0.7 : 1,
                }}
                data-testid={`copy-${key}-template`}
              >
                {copying === key ? (
                  <ActivityIndicator size="small" color={colors.surface} />
                ) : (
                  <>
                    <Ionicons name="copy-outline" size={18} color={colors.surface} />
                    <Text style={{ color: colors.textInverse, fontWeight: '600', marginLeft: 6 }}>
                      Copy
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Action Buttons - Row 2: Upload */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => handleUpload(key, template)}
                disabled={!enabled || uploading === key}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: uploading === key ? colors.border : primaryColor,
                  paddingVertical: 12,
                  borderRadius: borderRadius.sm,
                  opacity: uploading === key ? 0.7 : 1,
                }}
                data-testid={`upload-${key}-csv`}
              >
                {uploading === key ? (
                  <ActivityIndicator size="small" color={colors.surface} />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={18} color={colors.surface} />
                    <Text style={{ color: colors.textInverse, fontWeight: '600', marginLeft: 6 }}>
                      Upload
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
          );
        })}

        {/* CSV Format Preview */}
        <View
          style={{
            backgroundColor: colors.primary,
            borderRadius: borderRadius.md,
            padding: spacing.lg,
            marginTop: 8,
            marginBottom: 24,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textInverse, marginBottom: spacing.md }}>
            CSV Format Tips
          </Text>
          <Text style={{ fontSize: 12, color: colors.textTertiary, lineHeight: 18 }}>
            • First row should contain column headers{'\n'}
            • Use commas to separate values{'\n'}
            • Wrap text with commas in double quotes{'\n'}
            • Save file with .csv extension{'\n'}
            • Use UTF-8 encoding for special characters
          </Text>
        </View>
      </ScrollView>

      {/* Upload Progress Modal */}
      <Modal visible={showProgressModal} animationType="fade" transparent>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 20,
              width: '100%',
              maxWidth: 340,
              padding: spacing.xxl,
              alignItems: 'center',
            }}
          >
            {/* Progress Icon */}
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: uploadProgress?.stage === 'complete' ? primaryColor + '15' : primaryColor + '15',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              {uploadProgress?.stage === 'complete' ? (
                <Ionicons name="checkmark-circle" size={40} color={primaryColor} />
              ) : (
                <ActivityIndicator size="large" color={primaryColor} />
              )}
            </View>

            {/* Title */}
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginBottom: 8, textAlign: 'center' }}>
              {uploadProgress?.stage === 'complete' ? 'Upload Complete!' : 'Processing CSV'}
            </Text>

            {/* File Name */}
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16, textAlign: 'center' }}>
              {uploadProgress?.fileName || 'file.csv'}
            </Text>

            {/* Progress Bar */}
            <View style={{ width: '100%', marginBottom: 16 }}>
              <View
                style={{
                  height: 8,
                  backgroundColor: colors.border,
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    height: '100%',
                    width: `${uploadProgress?.percent || 0}%`,
                    backgroundColor: uploadProgress?.stage === 'complete' ? primaryColor : primaryColor,
                    borderRadius: 4,
                  }}
                />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  {uploadProgress?.message || 'Starting...'}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textPrimary }}>
                  {uploadProgress?.percent || 0}%
                </Text>
              </View>
            </View>

            {/* Stage Indicators */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', width: '100%', paddingTop: 8 }}>
              {['preparing', 'uploading', 'processing', 'complete'].map((stage, index) => {
                const isActive = ['preparing', 'uploading', 'processing', 'completing', 'complete'].indexOf(uploadProgress?.stage) >= index;
                const isCurrent = uploadProgress?.stage === stage || (stage === 'processing' && uploadProgress?.stage === 'completing');
                return (
                  <View key={stage} style={{ alignItems: 'center' }}>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: borderRadius.md,
                        backgroundColor: isActive ? (stage === 'complete' ? primaryColor : primaryColor) : colors.border,
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderWidth: isCurrent ? 2 : 0,
                        borderColor: stage === 'complete' ? primaryColor : primaryColor,
                      }}
                    >
                      {isActive && (
                        <Ionicons
                          name={stage === 'complete' ? 'checkmark' : 'ellipse'}
                          size={stage === 'complete' ? 14 : 8}
                          color={colors.surface}
                        />
                      )}
                    </View>
                    <Text style={{ fontSize: 10, color: isActive ? colors.textPrimary : colors.textTertiary, marginTop: 4, textTransform: 'capitalize' }}>
                      {stage === 'preparing' ? 'Prep' : stage === 'uploading' ? 'Upload' : stage === 'processing' ? 'Process' : 'Done'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* CSV Preview & Download Modal */}
      <Modal visible={csvPreviewVisible} animationType="slide" transparent>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: borderRadius.lg,
              width: '100%',
              maxHeight: '85%',
              padding: 20,
            }}
          >
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>
                {previewTemplate?.name || 'CSV Template'}
              </Text>
              <TouchableOpacity 
                onPress={() => setCsvPreviewVisible(false)}
                data-testid="close-csv-preview-modal"
              >
                <Ionicons name="close" size={24} color={colors.secondary} />
              </TouchableOpacity>
            </View>

            {/* Instructions */}
            <View
              style={{
                backgroundColor: primaryColor + '15',
                borderRadius: borderRadius.sm,
                padding: 12,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: primaryColor,
              }}
            >
              <Text style={{ fontSize: 13, color: primaryColor, lineHeight: 18 }}>
                Choose an option below to get this CSV template. You can then edit it with your data and upload it back.
              </Text>
            </View>

            {/* CSV Content Preview */}
            <View
              style={{
                backgroundColor: colors.background,
                borderRadius: borderRadius.sm,
                padding: 12,
                marginBottom: 16,
                maxHeight: 180,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 }}>
                Preview:
              </Text>
              <ScrollView style={{ maxHeight: 140 }}>
                <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
                  {previewContent}
                </Text>
              </ScrollView>
            </View>

            {/* Action Buttons */}
            <View style={{ gap: 10 }}>
              {/* Save/Share to Files */}
              <TouchableOpacity
                onPress={saveToDevice}
                disabled={downloading === previewTemplate?.filename}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: primaryColor,
                  paddingVertical: 14,
                  borderRadius: borderRadius.md,
                  opacity: downloading === previewTemplate?.filename ? 0.7 : 1,
                }}
                data-testid="save-csv-to-device"
              >
                {downloading === previewTemplate?.filename ? (
                  <ActivityIndicator size="small" color={colors.surface} />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={20} color={colors.surface} />
                    <Text style={{ color: colors.textInverse, fontWeight: '600', fontSize: 15, marginLeft: 8 }}>
                      Save to Files / Share
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Copy to Clipboard */}
              <TouchableOpacity
                onPress={copyTemplateToClipboard}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: primaryColor,
                  paddingVertical: 14,
                  borderRadius: borderRadius.md,
                }}
                data-testid="copy-csv-to-clipboard"
              >
                <Ionicons name="copy-outline" size={20} color={colors.surface} />
                <Text style={{ color: colors.textInverse, fontWeight: '600', fontSize: 15, marginLeft: 8 }}>
                  Copy to Clipboard
                </Text>
              </TouchableOpacity>

              {/* Email the template */}
              <TouchableOpacity
                onPress={shareViaEmail}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: primaryColor,
                  paddingVertical: 14,
                  borderRadius: borderRadius.md,
                }}
                data-testid="share-csv-file"
              >
                <Ionicons name="share-social-outline" size={20} color={colors.surface} />
                <Text style={{ color: colors.textInverse, fontWeight: '600', fontSize: 15, marginLeft: 8 }}>
                  Share via Email / AirDrop
                </Text>
              </TouchableOpacity>

              {/* Instructions for manual method */}
              <View
                style={{
                  backgroundColor: primaryColor + '15',
                  borderRadius: borderRadius.sm,
                  padding: 12,
                  marginTop: 8,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: primaryColor, marginBottom: 4 }}>
                  💡 Tip: Copy & Paste Method
                </Text>
                <Text style={{ fontSize: 11, color: primaryColor, lineHeight: 16 }}>
                  1. Tap "Copy to Clipboard" above{'\n'}
                  2. Open Notes app or Google Sheets{'\n'}
                  3. Paste the content{'\n'}
                  4. Edit your data and export as .csv
                </Text>
              </View>
            </View>

            {/* Cancel Button */}
            <TouchableOpacity
              onPress={() => setCsvPreviewVisible(false)}
              style={{
                paddingVertical: 12,
                alignItems: 'center',
                marginTop: 12,
              }}
              data-testid="cancel-csv-preview"
            >
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Upload Results Modal */}
      <Modal visible={resultsModalVisible} animationType="slide" transparent>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: borderRadius.lg,
              width: '100%',
              maxHeight: '80%',
              padding: 20,
            }}
          >
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>
                Upload Results
              </Text>
              <TouchableOpacity onPress={() => setResultsModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.secondary} />
              </TouchableOpacity>
            </View>

            {uploadResults && (
              <ScrollView>
                {/* Template Name */}
                <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 16 }}>
                  {uploadResults.templateName}
                </Text>

                {/* Stats */}
                <View style={{ flexDirection: 'row', gap: 16, marginBottom: 20 }}>
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: primaryColor + '15',
                      borderRadius: borderRadius.md,
                      padding: spacing.lg,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 28, fontWeight: '700', color: primaryColor }}>
                      {uploadResults.success_count || uploadResults.successful || uploadResults.invited || 0}
                    </Text>
                    <Text style={{ fontSize: 12, color: primaryColor }}>Successful</Text>
                  </View>
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: colors.errorLight,
                      borderRadius: borderRadius.md,
                      padding: spacing.lg,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 28, fontWeight: '700', color: colors.error }}>
                      {uploadResults.failed_count || uploadResults.failed || 0}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.error }}>Failed</Text>
                  </View>
                </View>

                {/* Errors */}
                {uploadResults.errors?.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.error, marginBottom: 8 }}>
                      Errors:
                    </Text>
                    <View style={{ backgroundColor: colors.errorLight, borderRadius: borderRadius.sm, padding: 12 }}>
                      {uploadResults.errors.slice(0, 10).map((error, idx) => (
                        <Text key={idx} style={{ fontSize: 12, color: colors.error, marginBottom: 4 }}>
                          • {typeof error === 'string' ? error : error.email || JSON.stringify(error)}
                        </Text>
                      ))}
                      {uploadResults.errors.length > 10 && (
                        <Text style={{ fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', marginTop: 4 }}>
                          ... and {uploadResults.errors.length - 10} more errors
                        </Text>
                      )}
                    </View>
                  </View>
                )}

                {/* Items Created (for dining menu) */}
                {uploadResults.items_created?.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: primaryColor, marginBottom: 8 }}>
                      Menu Items Created:
                    </Text>
                    <View style={{ backgroundColor: primaryColor + '15', borderRadius: borderRadius.sm, padding: 12 }}>
                      {uploadResults.items_created.slice(0, 10).map((item, idx) => (
                        <Text key={idx} style={{ fontSize: 12, color: primaryColor, marginBottom: 4 }}>
                          • {item.name} ({item.meal_type}) - {item.date}
                        </Text>
                      ))}
                      {uploadResults.items_created.length > 10 && (
                        <Text style={{ fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', marginTop: 4 }}>
                          ... and {uploadResults.items_created.length - 10} more items
                        </Text>
                      )}
                    </View>
                    {/* Dining Menu Tips */}
                    <View style={{ backgroundColor: primaryColor + '15', borderRadius: borderRadius.sm, padding: 12, marginTop: 12 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: primaryColor, marginBottom: 4 }}>
                        💡 To see these items:
                      </Text>
                      <Text style={{ fontSize: 11, color: primaryColor }}>
                        • Go to "Manage Dining Menu" and navigate to the date(s) in your CSV{'\n'}
                        • Students will see items in the "Dining" tab on those dates
                      </Text>
                    </View>
                  </View>
                )}

                {/* Users Created (for user imports) */}
                {uploadResults.created_users?.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: primaryColor, marginBottom: 8 }}>
                      Users Created ({uploadResults.created_users.length}):
                    </Text>
                    <View style={{ backgroundColor: primaryColor + '15', borderRadius: borderRadius.sm, padding: 12 }}>
                      {uploadResults.created_users.slice(0, 10).map((user, idx) => (
                        <View key={idx} style={{ marginBottom: 6 }}>
                          <Text style={{ fontSize: 12, color: primaryColor, fontWeight: '500' }}>
                            • {user.name || `${user.first_name} ${user.last_name}`}
                          </Text>
                          <Text style={{ fontSize: 11, color: primaryColor, marginLeft: 12 }}>
                            {user.email}{user.floor ? ` • ${user.floor}` : ''}{user.room ? ` • Room ${user.room}` : ''}
                          </Text>
                        </View>
                      ))}
                      {uploadResults.created_users.length > 10 && (
                        <Text style={{ fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', marginTop: 4 }}>
                          ... and {uploadResults.created_users.length - 10} more users
                        </Text>
                      )}
                    </View>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 8, fontStyle: 'italic' }}>
                      Invitation emails have been sent to all new users.
                    </Text>
                  </View>
                )}

                {/* Events Created */}
                {uploadResults.created_events?.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: primaryColor, marginBottom: 8 }}>
                      Events Created ({uploadResults.created_events.length}):
                    </Text>
                    <View style={{ backgroundColor: primaryColor + '15', borderRadius: borderRadius.sm, padding: 12 }}>
                      {uploadResults.created_events.slice(0, 10).map((event, idx) => (
                        <View key={idx} style={{ marginBottom: 6 }}>
                          <Text style={{ fontSize: 12, color: primaryColor, fontWeight: '500' }}>
                            • {event.title}
                          </Text>
                          <Text style={{ fontSize: 11, color: primaryColor, marginLeft: 12 }}>
                            {event.date} • {event.location} • {event.category}
                          </Text>
                        </View>
                      ))}
                      {uploadResults.created_events.length > 10 && (
                        <Text style={{ fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', marginTop: 4 }}>
                          ... and {uploadResults.created_events.length - 10} more events
                        </Text>
                      )}
                    </View>
                    {/* Events Tips */}
                    <View style={{ backgroundColor: primaryColor + '15', borderRadius: borderRadius.sm, padding: 12, marginTop: 12 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: primaryColor, marginBottom: 4 }}>
                        💡 To see these events:
                      </Text>
                      <Text style={{ fontSize: 11, color: primaryColor }}>
                        • Go to "Events" in Admin to manage them{'\n'}
                        • Students will see events in their Events tab
                      </Text>
                    </View>
                  </View>
                )}

                {/* Close Button */}
                <TouchableOpacity
                  onPress={() => setResultsModalVisible(false)}
                  style={{
                    backgroundColor: primaryColor,
                    paddingVertical: 14,
                    borderRadius: borderRadius.sm,
                    alignItems: 'center',
                    marginTop: 8,
                  }}
                >
                  <Text style={{ color: colors.textInverse, fontSize: 16, fontWeight: '600' }}>Done</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
