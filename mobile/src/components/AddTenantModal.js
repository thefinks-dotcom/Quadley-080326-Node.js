import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { colors, spacing, borderRadius } from '../theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

const ALL_MODULES = [
  { id: 'events', name: 'Events', icon: 'calendar', description: 'Event management' },
  { id: 'announcements', name: 'Announcements', icon: 'megaphone', description: 'Broadcast messages' },
  { id: 'messages', name: 'Messages', icon: 'chatbubbles', description: 'Direct messaging' },
  { id: 'jobs', name: 'Jobs', icon: 'briefcase', description: 'Job board' },
  { id: 'dining', name: 'Dining', icon: 'restaurant', description: 'Menu & late meals' },
  { id: 'maintenance', name: 'Maintenance', icon: 'construct', description: 'Service requests' },
  { id: 'recognition', name: 'Recognition', icon: 'star', description: 'Shoutouts' },
  { id: 'wellbeing', name: 'Wellbeing', icon: 'heart', description: 'Mental health' },
  { id: 'academics', name: 'Academics', icon: 'school', description: 'Study groups' },
  { id: 'cocurricular', name: 'Co-Curricular', icon: 'people', description: 'Clubs & activities' },
  { id: 'floor', name: 'Floor', icon: 'home', description: 'Floor community' },
  { id: 'birthdays', name: 'Birthdays', icon: 'gift', description: 'Birthday calendar' },
  { id: 'finance', name: 'Finance', icon: 'wallet', description: 'Bills & payments' },
  { id: 'safe_disclosure', name: 'Safe Disclosure', icon: 'shield', description: 'Anonymous reports' },
  { id: 'parcels', name: 'Parcels', icon: 'cube', description: 'Package tracking' },
  { id: 'bookings', name: 'Bookings', icon: 'bookmark', description: 'Room bookings' },
];

const DEFAULT_MODULES = ['events', 'announcements', 'messages', 'dining', 'maintenance', 'recognition', 'birthdays', 'parcels', 'cocurricular'];

const ACTIVITY_TYPES = [
  { id: 'sports', name: 'Sports', icon: 'football', color: colors.primary },
  { id: 'clubs', name: 'Clubs', icon: 'people', color: colors.primary },
  { id: 'cultural', name: 'Cultural', icon: 'musical-notes', color: colors.primary },
];

export default function AddTenantModal({ visible, onClose, onSuccess }) {
  const { themeColors: colors } = useAppTheme();
  const [step, setStep] = useState(1); // 1: Basic Info, 2: Modules, 3: Activities, 4: Payment
  const [logoImage, setLogoImage] = useState(null);
  const [enabledModules, setEnabledModules] = useState([...DEFAULT_MODULES]);
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  const [subscriptionTier, setSubscriptionTier] = useState('basic');
  const [activities, setActivities] = useState([]);
  const [newActivity, setNewActivity] = useState({ type: 'clubs', name: '', description: '' });
  const [additionalAdmins, setAdditionalAdmins] = useState([]);
  const [newTenant, setNewTenant] = useState({
    name: '',
    contact_person_name: '',
    contact_person_email: '',
    logo_url: '',
  });

  const queryClient = useQueryClient();

  // Pick logo image
  const pickLogo = () => {
    Alert.alert('Upload Logo', 'Choose a source', [
      { text: 'Photos', onPress: pickFromPhotos },
      { text: 'Files', onPress: pickFromFiles },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickFromPhotos = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant photo library permissions to upload a logo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setLogoImage(result.assets[0]);
        setNewTenant({ ...newTenant, logo_url: result.assets[0].uri });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image from photos');
    }
  };

  const pickFromFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setLogoImage({ uri: asset.uri, width: 1024, height: 1024 });
        setNewTenant({ ...newTenant, logo_url: asset.uri });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image from files');
    }
  };

  // Create tenant mutation
  const createTenant = useMutation({
    mutationFn: async (tenantData) => {
      const response = await api.post('/tenants', {
        name: tenantData.name,
        contact_person_name: tenantData.contact_person_name,
        contact_person_email: tenantData.contact_person_email,
        logo_url: tenantData.logo_url || null,
        enabled_modules: enabledModules,
        subscription_tier: subscriptionTier,
        billing_period: billingPeriod,
        activities: activities,
      });
      return response.data;
    },
    onSuccess: async (data) => {
      // Invite additional admins if any
      for (const admin of additionalAdmins) {
        try {
          await api.post(`/tenants/${data.code}/admins`, {
            name: admin.name,
            email: admin.email,
          });
        } catch (e) {
          console.log(`Failed to invite additional admin ${admin.email}:`, e);
        }
      }
      const adminCount = 1 + additionalAdmins.length;
      Alert.alert(
        'College Created!',
        `${data.name} has been created with code: ${data.code}\n\n${adminCount} admin invitation${adminCount > 1 ? 's' : ''} sent.`,
        [{ text: 'OK', onPress: () => onSuccess?.() }]
      );
      resetForm();
      queryClient.invalidateQueries(['tenants']);
      queryClient.invalidateQueries(['cross-tenant-analytics']);
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create college');
    },
  });

  const resetForm = () => {
    setStep(1);
    setNewTenant({
      name: '',
      contact_person_name: '',
      contact_person_email: '',
      logo_url: '',
    });
    setLogoImage(null);
    setEnabledModules([...DEFAULT_MODULES]);
    setBillingPeriod('monthly');
    setSubscriptionTier('basic');
    setActivities([]);
    setAdditionalAdmins([]);
    setNewActivity({ type: 'clubs', name: '', description: '' });
  };

  const handleNext = () => {
    if (step === 1) {
      const { name, contact_person_name, contact_person_email } = newTenant;
      if (!name || !contact_person_name || !contact_person_email) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contact_person_email)) {
        Alert.alert('Error', 'Please enter a valid email address');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (enabledModules.length === 0) {
        Alert.alert('Error', 'Please select at least one module');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleCreate = () => {
    createTenant.mutate(newTenant);
  };

  const handleClose = () => {
    resetForm();
    onClose?.();
  };

  const toggleModule = (moduleId) => {
    setEnabledModules(prev => {
      if (prev.includes(moduleId)) {
        return prev.filter(m => m !== moduleId);
      } else {
        return [...prev, moduleId];
      }
    });
  };

  const selectAllModules = () => {
    setEnabledModules(ALL_MODULES.map(m => m.id));
  };

  const deselectAllModules = () => {
    setEnabledModules([]);
  };

  const addActivity = () => {
    if (!newActivity.name.trim()) {
      Alert.alert('Error', 'Please enter an activity name');
      return;
    }
    setActivities([...activities, { ...newActivity, id: Date.now().toString() }]);
    setNewActivity({ type: 'clubs', name: '', description: '' });
  };

  const removeActivity = (id) => {
    setActivities(activities.filter(a => a.id !== id));
  };

  const getPrice = () => {
    const prices = {
      basic: { monthly: 99, yearly: 990 },
      pro: { monthly: 299, yearly: 2990 },
      enterprise: { monthly: 0, yearly: 0 },
    };
    return prices[subscriptionTier][billingPeriod];
  };

  const getActivityTypeInfo = (type) => {
    return ACTIVITY_TYPES.find(t => t.id === type) || ACTIVITY_TYPES[1];
  };

  const renderStepIndicator = () => (
    <View style={{ flexDirection: 'row', justifyContent: 'center', paddingVertical: 16, backgroundColor: colors.background }}>
      {[1, 2, 3, 4].map((s) => (
        <View key={s} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: step >= s ? colors.primary : colors.border,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            {step > s ? (
              <Ionicons name="checkmark" size={16} color={colors.surface} />
            ) : (
              <Text style={{ color: step >= s ? colors.surface : colors.secondary, fontWeight: '600', fontSize: 12 }}>{s}</Text>
            )}
          </View>
          {s < 4 && (
            <View style={{ width: 30, height: 2, backgroundColor: step > s ? colors.primary : colors.border }} />
          )}
        </View>
      ))}
    </View>
  );

  const getStepTitle = () => {
    switch (step) {
      case 1: return 'College Info';
      case 2: return 'Select Modules';
      case 3: return 'Activities';
      case 4: return 'Payment Plan';
      default: return '';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <TouchableOpacity onPress={step === 1 ? handleClose : handleBack}>
            <Text style={{ color: colors.secondary, fontSize: 16 }}>{step === 1 ? 'Cancel' : 'Back'}</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>
            {getStepTitle()}
          </Text>
          <TouchableOpacity 
            onPress={step === 4 ? handleCreate : handleNext} 
            disabled={createTenant.isPending}
          >
            {createTenant.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>
                {step === 4 ? 'Create' : 'Next'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Step Indicator */}
        {renderStepIndicator()}

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={{ flex: 1, padding: 16 }} keyboardShouldPersistTaps="handled">
            
            {/* Step 1: Basic Info */}
            {step === 1 && (
              <>
                {/* College Information */}
                <View style={{ backgroundColor: colors.background, borderRadius: 12, padding: 16, marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                    <Ionicons name="business" size={20} color={colors.textPrimary} />
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginLeft: 8 }}>College Information</Text>
                  </View>

                  {/* Logo Upload */}
                  <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textPrimary, marginBottom: 6 }}>College Logo (1024x1024)</Text>
                  <TouchableOpacity
                    onPress={pickLogo}
                    style={{
                      width: 120,
                      height: 120,
                      borderRadius: 16,
                      backgroundColor: colors.surface,
                      borderWidth: 2,
                      borderColor: colors.border,
                      borderStyle: 'dashed',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginBottom: 16,
                      overflow: 'hidden',
                    }}
                  >
                    {logoImage ? (
                      <Image source={{ uri: logoImage.uri }} style={{ width: 120, height: 120 }} resizeMode="cover" />
                    ) : (
                      <View style={{ alignItems: 'center' }}>
                        <Ionicons name="cloud-upload" size={32} color={colors.textTertiary} />
                        <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 4 }}>Upload Logo</Text>
                        <Text style={{ fontSize: 10, color: colors.borderDark, marginTop: 2 }}>Photos or Files</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  {logoImage && (
                    <TouchableOpacity onPress={() => { setLogoImage(null); setNewTenant({ ...newTenant, logo_url: '' }); }}>
                      <Text style={{ color: colors.error, fontSize: 13, marginBottom: 12 }}>Remove Logo</Text>
                    </TouchableOpacity>
                  )}

                  <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textPrimary, marginBottom: 6 }}>College Name *</Text>
                  <TextInput
                    style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 12, fontSize: 15, color: colors.textPrimary, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}
                    placeholder="e.g., Ormond College"
                    placeholderTextColor={colors.textTertiary}
                    value={newTenant.name}
                    onChangeText={(text) => setNewTenant({ ...newTenant, name: text })}
                  />
                </View>

                {/* Contact Person */}
                <View style={{ backgroundColor: colors.background, borderRadius: 12, padding: 16, marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                    <Ionicons name="person" size={20} color={colors.textPrimary} />
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginLeft: 8 }}>Contact Person (Admin)</Text>
                  </View>

                  <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textPrimary, marginBottom: 6 }}>Full Name *</Text>
                  <TextInput
                    style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 12, fontSize: 15, color: colors.textPrimary, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}
                    placeholder="e.g., John Smith"
                    placeholderTextColor={colors.textTertiary}
                    value={newTenant.contact_person_name}
                    onChangeText={(text) => setNewTenant({ ...newTenant, contact_person_name: text })}
                  />

                  <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textPrimary, marginBottom: 6 }}>Email Address *</Text>
                  <TextInput
                    style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 12, fontSize: 15, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border }}
                    placeholder="admin@college.edu"
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={newTenant.contact_person_email}
                    onChangeText={(text) => setNewTenant({ ...newTenant, contact_person_email: text })}
                  />
                </View>

                {/* Additional Admins */}
                <View style={{ backgroundColor: colors.background, borderRadius: 12, padding: 16, marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="people" size={20} color={colors.textPrimary} />
                      <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginLeft: 8 }}>Additional Admins</Text>
                    </View>
                    <Text style={{ fontSize: 12, color: colors.textTertiary }}>Optional</Text>
                  </View>

                  {additionalAdmins.map((admin, index) => (
                    <View key={index} style={{
                      flexDirection: 'row', alignItems: 'center',
                      backgroundColor: colors.surface, borderRadius: 10, padding: 10,
                      marginBottom: 8, borderWidth: 1, borderColor: colors.border,
                    }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary }}>{admin.name}</Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>{admin.email}</Text>
                      </View>
                      <TouchableOpacity onPress={() => setAdditionalAdmins(additionalAdmins.filter((_, i) => i !== index))}>
                        <Ionicons name="close-circle" size={22} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  ))}

                  <View style={{ gap: 8 }}>
                    <TextInput
                      style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 12, fontSize: 15, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border }}
                      placeholder="Admin name"
                      placeholderTextColor={colors.textTertiary}
                      value={newTenant._tempAdminName || ''}
                      onChangeText={(text) => setNewTenant({ ...newTenant, _tempAdminName: text })}
                    />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TextInput
                        style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 10, padding: 12, fontSize: 15, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border }}
                        placeholder="admin@college.edu"
                        placeholderTextColor={colors.textTertiary}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        value={newTenant._tempAdminEmail || ''}
                        onChangeText={(text) => setNewTenant({ ...newTenant, _tempAdminEmail: text })}
                      />
                      <TouchableOpacity
                        onPress={() => {
                          const name = (newTenant._tempAdminName || '').trim();
                          const email = (newTenant._tempAdminEmail || '').trim();
                          if (name && email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                            setAdditionalAdmins([...additionalAdmins, { name, email }]);
                            setNewTenant({ ...newTenant, _tempAdminName: '', _tempAdminEmail: '' });
                          } else {
                            Alert.alert('Error', 'Please enter a valid name and email');
                          }
                        }}
                        style={{
                          backgroundColor: colors.primary, borderRadius: 10,
                          width: 44, justifyContent: 'center', alignItems: 'center',
                        }}
                      >
                        <Ionicons name="add" size={24} color="white" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </>
            )}

            {/* Step 2: Module Selection */}
            {step === 2 && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={{ color: colors.secondary }}>{enabledModules.length} modules selected</Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity onPress={selectAllModules}>
                      <Text style={{ color: colors.primary, fontWeight: '500' }}>Select All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={deselectAllModules}>
                      <Text style={{ color: colors.secondary, fontWeight: '500' }}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {ALL_MODULES.map((module) => {
                  const isEnabled = enabledModules.includes(module.id);
                  return (
                    <TouchableOpacity
                      key={module.id}
                      onPress={() => toggleModule(module.id)}
                      activeOpacity={0.7}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: isEnabled ? colors.primary + '15' : colors.background,
                        padding: 12,
                        borderRadius: 12,
                        marginBottom: 8,
                        borderWidth: 1,
                        borderColor: isEnabled ? colors.primary : colors.border,
                      }}
                    >
                      <View style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        backgroundColor: isEnabled ? colors.primary : colors.border,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}>
                        <Ionicons name={module.icon} size={18} color={isEnabled ? colors.surface : colors.secondary} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary }}>{module.name}</Text>
                        <Text style={{ fontSize: 11, color: colors.secondary }}>{module.description}</Text>
                      </View>
                      <Switch
                        value={isEnabled}
                        onValueChange={() => toggleModule(module.id)}
                        trackColor={{ false: colors.border, true: colors.primary + '15' }}
                        thumbColor={isEnabled ? colors.primary : colors.surfaceSecondary}
                      />
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {/* Step 3: Activities */}
            {step === 3 && (
              <>
                <Text style={{ fontSize: 14, color: colors.secondary, marginBottom: 16 }}>
                  Add sports, clubs, and cultural activities for this college. Admins can modify these later.
                </Text>

                {/* Activity Type Selector */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Activity Type</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {ACTIVITY_TYPES.map((type) => (
                      <TouchableOpacity
                        key={type.id}
                        onPress={() => setNewActivity({ ...newActivity, type: type.id })}
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 10,
                          borderRadius: 10,
                          backgroundColor: newActivity.type === type.id ? `${type.color}15` : colors.background,
                          borderWidth: 2,
                          borderColor: newActivity.type === type.id ? type.color : 'transparent',
                        }}
                      >
                        <Ionicons name={type.icon} size={16} color={newActivity.type === type.id ? type.color : colors.secondary} />
                        <Text style={{ marginLeft: 6, fontSize: 13, fontWeight: '500', color: newActivity.type === type.id ? type.color : colors.secondary }}>
                          {type.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Activity Name & Description */}
                <View style={{ backgroundColor: colors.background, borderRadius: 12, padding: 16, marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textPrimary, marginBottom: 6 }}>Activity Name *</Text>
                  <TextInput
                    style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 12, fontSize: 15, color: colors.textPrimary, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}
                    placeholder="e.g., Basketball Club"
                    placeholderTextColor={colors.textTertiary}
                    value={newActivity.name}
                    onChangeText={(text) => setNewActivity({ ...newActivity, name: text })}
                  />

                  <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textPrimary, marginBottom: 6 }}>Description (optional)</Text>
                  <TextInput
                    style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 12, fontSize: 15, color: colors.textPrimary, marginBottom: 12, borderWidth: 1, borderColor: colors.border, minHeight: 60 }}
                    placeholder="Brief description of the activity..."
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    value={newActivity.description}
                    onChangeText={(text) => setNewActivity({ ...newActivity, description: text })}
                  />

                  <TouchableOpacity
                    onPress={() => {
                      console.log('Add Activity pressed');
                      addActivity();
                    }}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: colors.primary,
                      borderRadius: 10,
                      padding: 14,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="add-circle" size={20} color={colors.surface} />
                    <Text style={{ color: colors.surface, fontWeight: '600', marginLeft: 6 }}>Add Activity</Text>
                  </TouchableOpacity>
                </View>

                {/* Added Activities List */}
                {activities.length > 0 && (
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 12 }}>
                      Added Activities ({activities.length})
                    </Text>
                    {activities.map((activity) => {
                      const typeInfo = getActivityTypeInfo(activity.type);
                      return (
                        <View
                          key={activity.id}
                          style={{
                            backgroundColor: colors.surface,
                            borderRadius: 12,
                            padding: 14,
                            marginBottom: 10,
                            flexDirection: 'row',
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: colors.border,
                          }}
                        >
                          <View style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            backgroundColor: `${typeInfo.color}15`,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}>
                            <Ionicons name={typeInfo.icon} size={20} color={typeInfo.color} />
                          </View>
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={{ fontSize: 15, fontWeight: '500', color: colors.textPrimary }}>{activity.name}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                              <View style={{
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                                borderRadius: 10,
                                backgroundColor: `${typeInfo.color}15`,
                              }}>
                                <Text style={{ fontSize: 11, color: typeInfo.color, fontWeight: '500' }}>{typeInfo.name}</Text>
                              </View>
                              {activity.description ? (
                                <Text style={{ fontSize: 11, color: colors.secondary, marginLeft: 8, flex: 1 }} numberOfLines={1}>
                                  {activity.description}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                          <TouchableOpacity
                            onPress={() => removeActivity(activity.id)}
                            style={{ padding: 8 }}
                          >
                            <Ionicons name="trash-outline" size={20} color={colors.error} />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}

                {activities.length === 0 && (
                  <View style={{ alignItems: 'center', padding: 30 }}>
                    <Ionicons name="list-outline" size={48} color={colors.borderDark} />
                    <Text style={{ color: colors.secondary, marginTop: 12, textAlign: 'center' }}>
                      No activities added yet.{'\n'}Activities are optional and can be added later.
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* Step 4: Payment Plan */}
            {step === 4 && (
              <>
                {/* Billing Period Toggle */}
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 12 }}>Billing Period</Text>
                <View style={{
                  flexDirection: 'row',
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: 12,
                  padding: 4,
                  marginBottom: 24,
                }}>
                  <TouchableOpacity
                    onPress={() => setBillingPeriod('monthly')}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 10,
                      backgroundColor: billingPeriod === 'monthly' ? colors.surface : 'transparent',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontWeight: '600', color: billingPeriod === 'monthly' ? colors.textPrimary : colors.secondary }}>Monthly</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setBillingPeriod('yearly')}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 10,
                      backgroundColor: billingPeriod === 'yearly' ? colors.surface : 'transparent',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontWeight: '600', color: billingPeriod === 'yearly' ? colors.textPrimary : colors.secondary }}>Yearly</Text>
                    <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '600' }}>Save 17%</Text>
                  </TouchableOpacity>
                </View>

                {/* Subscription Tiers */}
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 12 }}>Select Plan</Text>
                
                {[
                  { id: 'basic', name: 'Basic', monthlyPrice: 99, yearlyPrice: 990, maxUsers: 100, modules: 8, color: colors.secondary, icon: 'cube' },
                  { id: 'pro', name: 'Pro', monthlyPrice: 299, yearlyPrice: 2990, maxUsers: 500, modules: 16, color: colors.primary, icon: 'flash' },
                  { id: 'enterprise', name: 'Enterprise', monthlyPrice: 0, yearlyPrice: 0, maxUsers: -1, modules: 16, color: colors.primary, icon: 'diamond' },
                ].map((tier) => {
                  const isSelected = subscriptionTier === tier.id;
                  const price = billingPeriod === 'yearly' ? tier.yearlyPrice : tier.monthlyPrice;
                  
                  return (
                    <TouchableOpacity
                      key={tier.id}
                      onPress={() => setSubscriptionTier(tier.id)}
                      style={{
                        backgroundColor: isSelected ? colors.primary + '15' : colors.background,
                        borderRadius: 16,
                        padding: 16,
                        marginBottom: 12,
                        borderWidth: 2,
                        borderColor: isSelected ? colors.primary : 'transparent',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          backgroundColor: `${tier.color}15`,
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}>
                          <Ionicons name={tier.icon} size={24} color={tier.color} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.textPrimary }}>{tier.name}</Text>
                          <Text style={{ fontSize: 14, color: colors.secondary }}>
                            {price > 0 ? `$${price}/${billingPeriod === 'yearly' ? 'year' : 'month'}` : 'Custom pricing'}
                          </Text>
                        </View>
                        {isSelected && (
                          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="checkmark" size={16} color={colors.surface} />
                          </View>
                        )}
                      </View>
                      <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                        <Text style={{ fontSize: 13, color: colors.secondary }}>
                          • Up to {tier.maxUsers > 0 ? tier.maxUsers : 'Unlimited'} users
                        </Text>
                        <Text style={{ fontSize: 13, color: colors.secondary }}>
                          • {tier.modules === 8 ? '8 core' : 'All 16'} modules
                        </Text>
                        <Text style={{ fontSize: 13, color: colors.secondary }}>
                          • {tier.id === 'enterprise' ? 'Dedicated' : tier.id === 'pro' ? 'Priority' : 'Email'} support
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {/* Summary */}
                <View style={{ backgroundColor: colors.primary + '15', borderRadius: 12, padding: 16, marginTop: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary, marginBottom: 8 }}>Summary</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: colors.textPrimary }}>College:</Text>
                    <Text style={{ fontWeight: '500', color: colors.textPrimary }}>{newTenant.name || '-'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: colors.textPrimary }}>Modules:</Text>
                    <Text style={{ fontWeight: '500', color: colors.textPrimary }}>{enabledModules.length} selected</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: colors.textPrimary }}>Activities:</Text>
                    <Text style={{ fontWeight: '500', color: colors.textPrimary }}>{activities.length} added</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: colors.textPrimary }}>Plan:</Text>
                    <Text style={{ fontWeight: '500', color: colors.textPrimary }}>
                      {subscriptionTier.charAt(0).toUpperCase() + subscriptionTier.slice(1)} ({billingPeriod})
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.primary + '15', paddingTop: 8, marginTop: 8 }}>
                    <Text style={{ fontWeight: '600', color: colors.primary }}>Total:</Text>
                    <Text style={{ fontWeight: 'bold', fontSize: 18, color: colors.primary }}>
                      {getPrice() > 0 ? `$${getPrice()}/${billingPeriod === 'yearly' ? 'yr' : 'mo'}` : 'Contact Sales'}
                    </Text>
                  </View>
                </View>
              </>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
