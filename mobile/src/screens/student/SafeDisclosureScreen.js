import React, { useState, useCallback } from 'react';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import api from '../../services/api';
import { useTenant } from '../../contexts/TenantContext';

// Move TextInputField outside the component to prevent re-creation on each render
const TextInputField = ({ label, placeholder, value, onChangeText, multiline, height }) => (
  <View style={{ marginBottom: 16 }}>
    <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>{label}</Text>
    <TextInput
      style={{
        backgroundColor: colors.surfaceSecondary,
        borderRadius: borderRadius.md,
        padding: 12,
        fontSize: 14,
        color: colors.textPrimary,
        height: height || (multiline ? 80 : 48),
        textAlignVertical: multiline ? 'top' : 'center',
      }}
      multiline={multiline}
      placeholder={placeholder}
      placeholderTextColor={colors.textTertiary}
      value={value}
      onChangeText={onChangeText}
      blurOnSubmit={false}
      returnKeyType="next"
      autoCorrect={false}
    />
  </View>
);

export default function SafeDisclosureScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const [showForm, setShowForm] = useState(false);
  const [showDemographics, setShowDemographics] = useState(false);
  const [formData, setFormData] = useState({
    is_anonymous: false,
    incident_type: '',
    incident_date: '',
    incident_location: '',
    description: '',
    happened_to: '',
    individuals_involved: '',
    witness_details: '',
    reported_elsewhere: '',
    immediate_danger: false,
    medical_attention_needed: false,
    police_notified: false,
    support_requested: [],
    preferred_contact: '',
    additional_notes: '',
    // Demographics
    help_with_data: null,
    respondent_type: '',
    sex: '',
    gender_identity: '',
    aboriginal_torres_strait: '',
    sexual_orientation: '',
    year_of_birth: '',
    cald: '',
    country_of_birth: '',
    languages_at_home: '',
    living_with_disability: '',
    neurodiverse: '',
  });

  const incidentTypes = [
    'A General Complaint',
    'Sexual Assault',
    'Sexual Harassment',
    'Image-based Abuse',
    'Physical Abuse',
    'Emotional/Psychological Abuse',
    'Stalking',
    'Technology-facilitated Abuse',
    'Other',
  ];

  const happenedToOptions = [
    'It happened to me',
    'It happened to someone else',
    "I'm not sure/I prefer not to say",
  ];

  const reportedElsewhereOptions = [
    'Yes, to another college',
    'Yes, to the University',
    'Yes, to the Police',
    'No',
    'Prefer not to say',
  ];

  const supportOptions = [
    'Counseling Services',
    'Medical Support',
    'Academic Adjustments',
    'Safety Planning',
    'Legal Information',
    'Accommodation Support',
    'Peer Support',
  ];

  const respondentTypes = ['Current Resident', 'Current Affiliate', 'Staff Member'];
  const sexOptions = ['Female', 'Male', 'Intersex', 'Prefer not to say'];
  const genderOptions = ['Woman', 'Man', 'Non-binary', 'Prefer not to say'];
  const yesNoOptions = ['Yes', 'No', 'Prefer not to say'];

  const submitDisclosure = useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/safe-disclosures', data);
      return response.data;
    },
    onSuccess: () => {
      Alert.alert(
        'Disclosure Received',
        'Your disclosure has been received. Support services will contact you soon.',
        [{ text: 'OK', onPress: () => { setShowForm(false); resetForm(); } }]
      );
    },
    onError: (error) => {
      if (error.response?.status === 401) {
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please log in again and resubmit the form. Your form data has been preserved.',
          [{ text: 'OK' }]
        );
        return;
      }
      const detail = error.response?.data?.detail;
      let errorMsg;
      if (Array.isArray(detail)) {
        errorMsg = detail.map(e => e.msg || JSON.stringify(e)).join('; ');
      } else if (typeof detail === 'string') {
        errorMsg = detail;
      } else {
        errorMsg = error.message || 'Failed to submit disclosure';
      }
      Alert.alert('Error', errorMsg);
    },
  });

  const resetForm = () => {
    setFormData({
      is_anonymous: false,
      incident_type: '',
      incident_date: '',
      incident_location: '',
      description: '',
      happened_to: '',
      individuals_involved: '',
      witness_details: '',
      reported_elsewhere: '',
      immediate_danger: false,
      medical_attention_needed: false,
      police_notified: false,
      support_requested: [],
      preferred_contact: '',
      additional_notes: '',
      help_with_data: null,
      respondent_type: '',
      sex: '',
      gender_identity: '',
      aboriginal_torres_strait: '',
      sexual_orientation: '',
      year_of_birth: '',
      cald: '',
      country_of_birth: '',
      languages_at_home: '',
      living_with_disability: '',
      neurodiverse: '',
    });
    setShowDemographics(false);
  };

  const toggleSupport = (option) => {
    setFormData(prev => ({
      ...prev,
      support_requested: prev.support_requested.includes(option)
        ? prev.support_requested.filter(s => s !== option)
        : [...prev.support_requested, option],
    }));
  };

  const mapHappenedTo = (value) => {
    if (value === 'It happened to me') return 'self';
    if (value === 'It happened to someone else') return 'third_party';
    return 'unsure';
  };

  const handleSubmit = () => {
    if (!formData.incident_type || !formData.description.trim() || !formData.happened_to) {
      Alert.alert('Error', 'Please complete all required fields (incident type, who it happened to, and description)');
      return;
    }

    const demographics = {
      respondent_type: formData.respondent_type,
      sex: formData.sex,
      gender_identity: formData.gender_identity,
      aboriginal_torres_strait: formData.aboriginal_torres_strait,
      sexual_orientation: formData.sexual_orientation,
      year_of_birth: formData.year_of_birth,
      cald: formData.cald,
      country_of_birth: formData.country_of_birth,
      languages_at_home: formData.languages_at_home,
      living_with_disability: formData.living_with_disability,
      neurodiverse: formData.neurodiverse,
    };

    const payload = {
      is_anonymous: formData.is_anonymous,
      incident_type: formData.incident_type,
      incident_date: formData.incident_date || undefined,
      incident_location: formData.incident_location || undefined,
      description: formData.description,
      reporter_relationship: mapHappenedTo(formData.happened_to),
      individuals_involved: formData.individuals_involved || undefined,
      witness_details: formData.witness_details || undefined,
      reported_elsewhere: formData.reported_elsewhere ? [formData.reported_elsewhere] : [],
      immediate_danger: formData.immediate_danger,
      medical_attention_needed: formData.medical_attention_needed,
      police_notified: formData.police_notified,
      support_requested: formData.support_requested,
      preferred_contact: formData.preferred_contact || undefined,
      additional_notes: formData.additional_notes || undefined,
      demographics: formData.help_with_data === true ? demographics : {},
    };

    submitDisclosure.mutate(payload);
  };

  const handleCall = (phone) => {
    Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
  };

  const emergencyContacts = [
    { title: 'Emergency Services', number: '000', description: 'Police, Ambulance, Fire' },
    { title: '1800 RESPECT', number: '1800 737 732', description: '24/7 Sexual assault, family violence' },
    { title: 'Lifeline', number: '13 11 14', description: '24/7 Crisis support' },
    { title: 'Campus Security', number: 'Contact', description: '24/7 On-campus' },
  ];

  // Reusable selector component
  const OptionSelector = ({ label, required, options, value, onSelect, columns = 1 }) => (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>
        {label} {required && '*'}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((option) => (
          <TouchableOpacity
            key={option}
            onPress={() => onSelect(option)}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 16,
              backgroundColor: value === option ? colors.primary : colors.surfaceSecondary,
              borderRadius: borderRadius.md,
              minWidth: columns === 1 ? '100%' : '48%',
              flexGrow: columns === 1 ? 1 : 0,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                color: value === option ? colors.textInverse : colors.textPrimary,
                fontWeight: value === option ? '600' : '400',
                textAlign: 'center',
              }}
            >
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 60 }}
        >
          {/* Header Info Box */}
          <View
            style={{
              backgroundColor: colors.background,
              borderLeftWidth: 4,
              borderLeftColor: colors.primary,
              padding: 20,
              margin: 16,
              borderRadius: borderRadius.md,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: colors.textSecondary,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 16,
                }}
              >
                <Ionicons name="shield-checkmark" size={24} color={colors.textInverse} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 8 }}>
                  Support & Safety
                </Text>
                <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 16 }}>
                  This is a safe, confidential space to disclose any form of gender-based violence or harassment. 
                  Your wellbeing and safety are our priority.
                </Text>
                <View style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.md }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 }}>
                    Important Information:
                  </Text>
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>• All disclosures are handled with strict confidentiality</Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>• You control what happens next - we support your choices</Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>• Support services are available regardless of formal report</Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>• You can choose to remain anonymous</Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>• Crisis support is available 24/7</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Emergency Contacts */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderLeftWidth: 4,
              borderLeftColor: colors.error,
              padding: spacing.lg,
              marginHorizontal: spacing.lg,
              marginBottom: 16,
              borderRadius: borderRadius.md,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.error, marginBottom: spacing.md }}>
              🚨 Immediate Support & Crisis Contacts
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {emergencyContacts.map((contact, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => contact.number !== 'Contact' && handleCall(contact.number)}
                  style={{
                    backgroundColor: colors.background,
                    padding: 12,
                    borderRadius: borderRadius.md,
                    width: '48%',
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textPrimary }}>{contact.title}</Text>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: contact.number === '000' ? colors.error : colors.primary }}>
                    {contact.number}
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.textSecondary }}>{contact.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Disclosure Section */}
          <View
            style={{
              backgroundColor: colors.surface,
              margin: 16,
              marginTop: 0,
              borderRadius: borderRadius.lg,
              padding: 20,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>Make a Disclosure</Text>
              {!showForm && (
                <TouchableOpacity
                  onPress={() => setShowForm(true)}
                  style={{
                    backgroundColor: colors.textSecondary,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderRadius: borderRadius.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    flexShrink: 1,
                  }}
                >
                  <Ionicons name="lock-closed" size={16} color={colors.textInverse} />
                  <Text style={{ color: colors.textInverse, fontWeight: '600', marginLeft: 6, fontSize: 12 }} numberOfLines={1}>
                    Start Disclosure
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {!showForm ? (
              <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingVertical: 24 }}>
                Click the button above to start a confidential disclosure. All information is treated with the highest level of confidentiality.
              </Text>
            ) : (
              <View style={{ gap: 4 }}>
                {/* SAFETY ASSESSMENT - AT THE TOP */}
                <View style={{ backgroundColor: colors.errorLight, padding: spacing.lg, borderRadius: borderRadius.md, marginBottom: 16 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.error, marginBottom: spacing.md }}>
                    Safety Assessment
                  </Text>
                  <View style={{ gap: 12 }}>
                    {[
                      { key: 'immediate_danger', label: 'I am in immediate danger' },
                      { key: 'medical_attention_needed', label: 'I need medical attention' },
                      { key: 'police_notified', label: 'I have contacted police' },
                    ].map((item) => (
                      <TouchableOpacity
                        key={item.key}
                        onPress={() => setFormData({ ...formData, [item.key]: !formData[item.key] })}
                        style={{ flexDirection: 'row', alignItems: 'center' }}
                      >
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 4,
                            borderWidth: 2,
                            borderColor: colors.error,
                            backgroundColor: formData[item.key] ? colors.error : 'transparent',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginRight: 10,
                          }}
                        >
                          {formData[item.key] && <Ionicons name="checkmark" size={14} color={colors.textInverse} />}
                        </View>
                        <Text style={{ fontSize: 14, color: colors.error }}>{item.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Show Emergency Contacts when Immediate Danger is selected */}
                  {formData.immediate_danger && (
                    <View style={{ marginTop: 16, backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg, borderWidth: 2, borderColor: colors.error }}>
                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.error, marginBottom: spacing.md }}>
                        ⚠️ Call for help now:
                      </Text>
                      <View style={{ gap: 10 }}>
                        <TouchableOpacity
                          onPress={() => handleCall('000')}
                          style={{
                            backgroundColor: colors.error,
                            padding: spacing.lg,
                            borderRadius: borderRadius.md,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="call" size={22} color={colors.textInverse} />
                          <View style={{ marginLeft: 12 }}>
                            <Text style={{ color: colors.textInverse, fontWeight: 'bold', fontSize: 20 }}>000</Text>
                            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12 }}>Emergency Services</Text>
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleCall('1800737732')}
                          style={{
                            backgroundColor: colors.textSecondary,
                            padding: 14,
                            borderRadius: borderRadius.md,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="call" size={20} color={colors.textInverse} />
                          <View style={{ marginLeft: 12 }}>
                            <Text style={{ color: colors.textInverse, fontWeight: 'bold', fontSize: 18 }}>1800 RESPECT</Text>
                            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>1800 737 732 - 24/7 Support</Text>
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleCall('131114')}
                          style={{
                            backgroundColor: colors.textSecondary,
                            padding: 14,
                            borderRadius: borderRadius.md,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="call" size={20} color={colors.textInverse} />
                          <View style={{ marginLeft: 12 }}>
                            <Text style={{ color: colors.textInverse, fontWeight: 'bold', fontSize: 18 }}>Lifeline</Text>
                            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>13 11 14 - Crisis Support</Text>
                          </View>
                        </TouchableOpacity>
                        <View
                          style={{
                            backgroundColor: colors.background,
                            padding: 14,
                            borderRadius: borderRadius.md,
                            flexDirection: 'row',
                            alignItems: 'center',
                          }}
                        >
                          <Ionicons name="shield" size={20} color={colors.textSecondary} />
                          <View style={{ marginLeft: 12 }}>
                            <Text style={{ color: colors.textPrimary, fontWeight: 'bold', fontSize: 16 }}>Campus Security</Text>
                            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>24/7 On-campus Emergency</Text>
                          </View>
                        </View>
                      </View>
                      <Text style={{ fontSize: 12, color: colors.error, marginTop: 12, textAlign: 'center' }}>
                        You can still complete this form after seeking immediate help
                      </Text>
                    </View>
                  )}

                  {formData.medical_attention_needed && !formData.immediate_danger && (
                    <Text style={{ fontSize: 13, color: colors.error, fontWeight: '600', marginTop: 12 }}>
                      ⚠️ If you need urgent medical attention, please call 000 or visit your nearest emergency department.
                    </Text>
                  )}
                </View>

                {/* Anonymous Option */}
                <View style={{ backgroundColor: colors.background, padding: spacing.lg, borderRadius: borderRadius.md, marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>Submit Anonymously</Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                        Your identity will not be recorded. Note: This may limit follow-up.
                      </Text>
                    </View>
                    <Switch
                      value={formData.is_anonymous}
                      onValueChange={(value) => setFormData({ ...formData, is_anonymous: value })}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor={colors.textInverse}
                    />
                  </View>
                </View>

                {/* Incident Type */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>
                    Type of Incident *
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {incidentTypes.map((type) => (
                      <TouchableOpacity
                        key={type}
                        onPress={() => setFormData({ ...formData, incident_type: type })}
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          backgroundColor: formData.incident_type === type ? colors.primary : colors.surfaceSecondary,
                          borderRadius: 20,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            color: formData.incident_type === type ? colors.textInverse : colors.textPrimary,
                            fontWeight: formData.incident_type === type ? '600' : '400',
                          }}
                        >
                          {type}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Did this happen to you or someone else? */}
                <OptionSelector
                  label="Did this incident happen to you or someone else?"
                  required
                  options={happenedToOptions}
                  value={formData.happened_to}
                  onSelect={(value) => setFormData({ ...formData, happened_to: value })}
                />

                {/* When/Where */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 4 }}>When did this occur?</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>Approximate dates if unsure</Text>
                  <TextInput
                    style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 14, color: colors.textPrimary }}
                    placeholder="Date/Time"
                    placeholderTextColor={colors.textTertiary}
                    value={formData.incident_date}
                    onChangeText={(text) => setFormData({ ...formData, incident_date: text })}
                  />
                </View>

                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 4 }}>Where did this occur?</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>Describe as best you can</Text>
                  <TextInput
                    style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 14, color: colors.textPrimary }}
                    placeholder="Location"
                    placeholderTextColor={colors.textTertiary}
                    value={formData.incident_location}
                    onChangeText={(text) => setFormData({ ...formData, incident_location: text })}
                  />
                </View>

                {/* Description */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 }}>What happened? *</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>
                    Share as much or as little as you're comfortable with.
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: colors.surfaceSecondary,
                      borderRadius: borderRadius.md,
                      padding: 12,
                      fontSize: 14,
                      color: colors.textPrimary,
                      height: 120,
                      textAlignVertical: 'top',
                    }}
                    multiline
                    placeholder="Describe the incident in your own words..."
                    placeholderTextColor={colors.textTertiary}
                    value={formData.description}
                    onChangeText={(text) => setFormData({ ...formData, description: text })}
                  />
                </View>

                {/* Individuals Involved */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 4 }}>Individuals Involved (Optional)</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>
                    Names, descriptions, or identifying information
                  </Text>
                  <TextInput
                    style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 14, color: colors.textPrimary, height: 60, textAlignVertical: 'top' }}
                    multiline
                    placeholder="Optional..."
                    placeholderTextColor={colors.textTertiary}
                    value={formData.individuals_involved}
                    onChangeText={(text) => setFormData({ ...formData, individuals_involved: text })}
                  />
                </View>

                {/* Witnesses */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 4 }}>
                    Were there any witnesses? (Optional)
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>
                    If you wish to share, e.g. staff, other students
                  </Text>
                  <TextInput
                    style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 14, color: colors.textPrimary, height: 60, textAlignVertical: 'top' }}
                    multiline
                    placeholder="Witness names or descriptions..."
                    placeholderTextColor={colors.textTertiary}
                    value={formData.witness_details}
                    onChangeText={(text) => setFormData({ ...formData, witness_details: text })}
                  />
                </View>

                {/* Reported Elsewhere */}
                <OptionSelector
                  label="Have you reported this elsewhere?"
                  options={reportedElsewhereOptions}
                  value={formData.reported_elsewhere}
                  onSelect={(value) => setFormData({ ...formData, reported_elsewhere: value })}
                />

                {/* Support Requested */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 }}>
                    What support would be helpful?
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: spacing.md }}>Select all that apply</Text>
                  <View style={{ gap: 8 }}>
                    {supportOptions.map((option) => (
                      <TouchableOpacity
                        key={option}
                        onPress={() => toggleSupport(option)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: colors.surface,
                          padding: 14,
                          borderRadius: borderRadius.md,
                          borderWidth: 1,
                          borderColor: formData.support_requested.includes(option) ? colors.primary : colors.border,
                        }}
                      >
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 4,
                            borderWidth: 2,
                            borderColor: colors.primary,
                            backgroundColor: formData.support_requested.includes(option) ? colors.primary : 'transparent',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginRight: 12,
                          }}
                        >
                          {formData.support_requested.includes(option) && <Ionicons name="checkmark" size={14} color={colors.textInverse} />}
                        </View>
                        <Text style={{ fontSize: 14, color: colors.textPrimary }}>{option}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Contact Preference */}
                {!formData.is_anonymous && (
                  <TextInputField
                    label="Preferred Contact Method"
                    placeholder="Email, phone, or other..."
                    value={formData.preferred_contact}
                    onChangeText={(text) => setFormData({ ...formData, preferred_contact: text })}
                  />
                )}

                {/* Additional Notes */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Additional Information</Text>
                  <TextInput
                    style={{
                      backgroundColor: colors.surfaceSecondary,
                      borderRadius: borderRadius.md,
                      padding: 12,
                      fontSize: 14,
                      color: colors.textPrimary,
                      height: 80,
                      textAlignVertical: 'top',
                    }}
                    multiline
                    placeholder="Anything else you'd like us to know..."
                    placeholderTextColor={colors.textTertiary}
                    value={formData.additional_notes}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, additional_notes: text }))}
                    blurOnSubmit={false}
                  />
                </View>

                {/* Anonymous Data Section */}
                <View style={{ backgroundColor: primaryColor + '15', padding: spacing.lg, borderRadius: borderRadius.md, marginBottom: 16, borderWidth: 1, borderColor: primaryColor }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: primaryColor, marginBottom: 8 }}>
                    Help Improve Community Safety
                  </Text>
                  <Text style={{ fontSize: 13, color: primaryColor, marginBottom: 16, lineHeight: 20 }}>
                    We use anonymous data to help improve safety for our whole community. If you would like to help us with this, could you provide the following details? Please feel free to skip any questions for any reason.
                  </Text>
                  
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity
                      onPress={() => { setFormData({ ...formData, help_with_data: true }); setShowDemographics(true); }}
                      style={{
                        flex: 1,
                        backgroundColor: formData.help_with_data === true ? primaryColor : colors.surface,
                        paddingVertical: 14,
                        borderRadius: borderRadius.md,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: primaryColor,
                      }}
                    >
                      <Text style={{ fontWeight: '600', color: formData.help_with_data === true ? colors.textInverse : primaryColor }}>Yes, I'd like to help</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { setFormData({ ...formData, help_with_data: false }); setShowDemographics(false); }}
                      style={{
                        flex: 1,
                        backgroundColor: formData.help_with_data === false ? colors.primary : colors.surface,
                        paddingVertical: 14,
                        borderRadius: borderRadius.md,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: colors.primary,
                      }}
                    >
                      <Text style={{ fontWeight: '600', color: formData.help_with_data === false ? colors.textInverse : colors.primary }}>No, skip this</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Demographics Section - Only shown if user opts in */}
                {showDemographics && formData.help_with_data === true && (
                  <View style={{ backgroundColor: colors.background, padding: spacing.lg, borderRadius: borderRadius.md, marginBottom: 16 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 16 }}>
                      Demographic Information (All Optional)
                    </Text>

                    <OptionSelector
                      label="Are you"
                      options={respondentTypes}
                      value={formData.respondent_type}
                      onSelect={(value) => setFormData({ ...formData, respondent_type: value })}
                    />

                    <OptionSelector
                      label="Sex"
                      options={sexOptions}
                      value={formData.sex}
                      onSelect={(value) => setFormData({ ...formData, sex: value })}
                      columns={2}
                    />

                    <OptionSelector
                      label="Gender Identity"
                      options={genderOptions}
                      value={formData.gender_identity}
                      onSelect={(value) => setFormData({ ...formData, gender_identity: value })}
                      columns={2}
                    />

                    <OptionSelector
                      label="Do you identify as Aboriginal and/or Torres Strait Islander?"
                      options={yesNoOptions}
                      value={formData.aboriginal_torres_strait}
                      onSelect={(value) => setFormData({ ...formData, aboriginal_torres_strait: value })}
                    />

                    <View style={{ marginBottom: 16 }}>
                      <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Sexual Orientation</Text>
                      <TextInput
                        style={{
                          backgroundColor: colors.surfaceSecondary,
                          borderRadius: borderRadius.md,
                          padding: 12,
                          fontSize: 14,
                          color: colors.textPrimary,
                          height: 48,
                        }}
                        placeholder="Enter if you wish..."
                        placeholderTextColor={colors.textTertiary}
                        value={formData.sexual_orientation}
                        onChangeText={(text) => setFormData(prev => ({ ...prev, sexual_orientation: text }))}
                        blurOnSubmit={false}
                        returnKeyType="next"
                      />
                    </View>

                    <View style={{ marginBottom: 16 }}>
                      <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Year of Birth</Text>
                      <TextInput
                        style={{
                          backgroundColor: colors.surfaceSecondary,
                          borderRadius: borderRadius.md,
                          padding: 12,
                          fontSize: 14,
                          color: colors.textPrimary,
                          height: 48,
                        }}
                        placeholder="e.g., 1998"
                        placeholderTextColor={colors.textTertiary}
                        value={formData.year_of_birth}
                        onChangeText={(text) => {
                          // Only allow numeric input, max 4 characters
                          const numericText = text.replace(/[^0-9]/g, '').slice(0, 4);
                          setFormData(prev => ({ ...prev, year_of_birth: numericText }));
                        }}
                        keyboardType="number-pad"
                        maxLength={4}
                      />
                    </View>

                    <View style={{ marginBottom: 16 }}>
                      <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Cultural & Linguistic Diversity (CALD)</Text>
                      <TextInput
                        style={{
                          backgroundColor: colors.surfaceSecondary,
                          borderRadius: borderRadius.md,
                          padding: 12,
                          fontSize: 14,
                          color: colors.textPrimary,
                          height: 80,
                          textAlignVertical: 'top',
                        }}
                        multiline
                        placeholder="Describe in your own words..."
                        placeholderTextColor={colors.textTertiary}
                        value={formData.cald}
                        onChangeText={(text) => setFormData(prev => ({ ...prev, cald: text }))}
                      />
                    </View>

                    <View style={{ marginBottom: 16 }}>
                      <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Country of Birth</Text>
                      <TextInput
                        style={{
                          backgroundColor: colors.surfaceSecondary,
                          borderRadius: borderRadius.md,
                          padding: 12,
                          fontSize: 14,
                          color: colors.textPrimary,
                          height: 48,
                        }}
                        placeholder="Enter country..."
                        placeholderTextColor={colors.textTertiary}
                        value={formData.country_of_birth}
                        onChangeText={(text) => setFormData(prev => ({ ...prev, country_of_birth: text }))}
                      />
                    </View>

                    <View style={{ marginBottom: 16 }}>
                      <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Language/s used at home</Text>
                      <TextInput
                        style={{
                          backgroundColor: colors.surfaceSecondary,
                          borderRadius: borderRadius.md,
                          padding: 12,
                          fontSize: 14,
                          color: colors.textPrimary,
                          height: 48,
                        }}
                        placeholder="e.g., English, Mandarin..."
                        placeholderTextColor={colors.textTertiary}
                        value={formData.languages_at_home}
                        onChangeText={(text) => setFormData(prev => ({ ...prev, languages_at_home: text }))}
                      />
                    </View>

                    <OptionSelector
                      label="Living with a Disability"
                      options={['Yes', 'No', 'Prefer not to say']}
                      value={formData.living_with_disability}
                      onSelect={(value) => setFormData({ ...formData, living_with_disability: value })}
                    />

                    <OptionSelector
                      label="Do you identify as Neurodiverse?"
                      options={['Yes', 'No', 'Prefer not to say']}
                      value={formData.neurodiverse}
                      onSelect={(value) => setFormData({ ...formData, neurodiverse: value })}
                    />
                  </View>
                )}

                {/* Submit Buttons */}
                <View style={{ flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 20 }}>
                  <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={submitDisclosure.isPending}
                    style={{
                      flex: 2,
                      backgroundColor: colors.textSecondary,
                      paddingVertical: 16,
                      borderRadius: borderRadius.md,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="lock-closed" size={18} color={colors.textInverse} />
                    <Text style={{ color: colors.textInverse, fontWeight: '600', fontSize: 15, marginLeft: 8 }}>
                      {submitDisclosure.isPending ? 'Submitting...' : 'Submit Disclosure'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setShowForm(false); resetForm(); }}
                    style={{
                      flex: 1,
                      backgroundColor: colors.surfaceSecondary,
                      paddingVertical: 16,
                      borderRadius: borderRadius.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 15 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
