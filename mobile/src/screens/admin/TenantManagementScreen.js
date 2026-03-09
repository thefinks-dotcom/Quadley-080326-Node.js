import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import api from '../../services/api';
import { useTenant } from '../../contexts/TenantContext';

export default function TenantManagementScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [actionModalType, setActionModalType] = useState(null);
  const [logoImage, setLogoImage] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [newTenant, setNewTenant] = useState({
    name: '',
    contact_person_name: '',
    contact_person_email: '',
    logo_url: '',
  });
  
  const queryClient = useQueryClient();

  // Pick logo image
  const pickLogo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to upload a logo.');
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
        // For now, store the local URI - in production you'd upload to cloud storage
        setNewTenant({ ...newTenant, logo_url: result.assets[0].uri });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  // Upload logo to server (placeholder - would need backend endpoint)
  const uploadLogo = async (imageUri) => {
    // In a real app, you'd upload to S3/CloudStorage and get back a URL
    // For now, we'll just use the local URI or a placeholder
    return imageUri;
  };

  // Fetch tenants
  const { data: tenants, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      const response = await api.get('/tenants');
      return response.data;
    },
  });

  // Create tenant mutation - matches backend TenantCreate schema
  const createTenant = useMutation({
    mutationFn: async (tenantData) => {
      // Backend auto-generates tenant code
      const response = await api.post('/tenants', {
        name: tenantData.name,
        contact_person_name: tenantData.contact_person_name,
        contact_person_email: tenantData.contact_person_email,
        logo_url: tenantData.logo_url || null,
      });
      return response.data;
    },
    onSuccess: (data) => {
      Alert.alert(
        'Tenant Created!', 
        `${data.name} has been created with code: ${data.code}\n\nAn invitation email has been sent to ${data.contact_person_email} to set up their admin account.`,
        [{ text: 'OK' }]
      );
      setAddModalVisible(false);
      resetNewTenant();
      queryClient.invalidateQueries(['tenants']);
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create tenant');
    },
  });

  // Suspend tenant mutation
  const suspendTenant = useMutation({
    mutationFn: async (tenantCode) => {
      const response = await api.post(`/tenants/${tenantCode}/suspend`);
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Tenant suspended');
      setActionModalType(null);
      setSelectedTenant(null);
      queryClient.invalidateQueries(['tenants']);
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to suspend tenant');
    },
  });

  // Reactivate tenant mutation
  const reactivateTenant = useMutation({
    mutationFn: async (tenantCode) => {
      const response = await api.post(`/tenants/${tenantCode}/reactivate`);
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Tenant reactivated');
      setActionModalType(null);
      setSelectedTenant(null);
      queryClient.invalidateQueries(['tenants']);
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to reactivate tenant');
    },
  });

  const resetNewTenant = () => {
    setNewTenant({
      name: '',
      contact_person_name: '',
      contact_person_email: '',
      logo_url: '',
    });
    setLogoImage(null);
  };

  const handleCreateTenant = () => {
    const { name, contact_person_name, contact_person_email } = newTenant;
    
    if (!name || !contact_person_name || !contact_person_email) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contact_person_email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    
    createTenant.mutate(newTenant);
  };

  // Filter tenants
  const filteredTenants = tenants?.filter((tenant) => {
    const matchesSearch =
      tenant.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.contact_person_email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || tenant.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  // Stats
  const pendingCount = tenants?.filter(t => t.status === 'pending').length || 0;
  const activeCount = tenants?.filter(t => t.status === 'active').length || 0;
  const suspendedCount = tenants?.filter(t => t.status === 'suspended').length || 0;

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return primaryColor;
      case 'pending': return primaryColor;
      case 'suspended': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return 'checkmark-circle';
      case 'pending': return 'time';
      case 'suspended': return 'close-circle';
      default: return 'help-circle';
    }
  };

  const getTierColor = (tier) => {
    switch (tier) {
      case 'pro': return primaryColor;
      case 'enterprise': return primaryColor;
      default: return colors.textSecondary;
    }
  };

  const renderTenant = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('TenantDetail', { tenant: item })}
      style={{
        backgroundColor: colors.surface,
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        shadowColor: colors.textPrimary,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {/* Avatar */}
        <View
          style={{
            width: 48,
            height: 48,
            backgroundColor: colors.primary,
            borderRadius: borderRadius.md,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
          }}
        >
          {item.logo_url ? (
            <Ionicons name="image" size={24} color={colors.surface} />
          ) : (
            <Text style={{ color: colors.textInverse, fontSize: 18, fontWeight: 'bold' }}>
              {item.name?.[0]?.toUpperCase()}
            </Text>
          )}
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
              {item.name}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: `${getStatusColor(item.status)}15`,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: borderRadius.md,
              }}
            >
              <Ionicons name={getStatusIcon(item.status)} size={12} color={getStatusColor(item.status)} />
              <Text style={{ color: getStatusColor(item.status), fontSize: 11, fontWeight: '600', marginLeft: 4, textTransform: 'capitalize' }}>
                {item.status}
              </Text>
            </View>
            {item.subscription_tier && item.subscription_tier !== 'basic' && (
              <View
                style={{
                  backgroundColor: `${getTierColor(item.subscription_tier)}15`,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: borderRadius.md,
                }}
              >
                <Text style={{ color: getTierColor(item.subscription_tier), fontSize: 11, fontWeight: '600', textTransform: 'capitalize' }}>
                  {item.subscription_tier}
                </Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            <Ionicons name="person-outline" size={14} color={colors.secondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginLeft: 4 }}>{item.contact_person_name}</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Ionicons name="mail-outline" size={14} color={colors.secondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginLeft: 4 }}>{item.contact_person_email}</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Ionicons name="people-outline" size={14} color={colors.secondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginLeft: 4 }}>{item.user_count || 0} users</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 13, marginLeft: 8 }}>•</Text>
            <Ionicons name="apps-outline" size={14} color={colors.secondary} style={{ marginLeft: 8 }} />
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginLeft: 4 }}>{item.enabled_modules?.length || 0} modules</Text>
          </View>

          <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 6 }}>
            Code: {item.code} • Created: {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.surfaceSecondary, gap: 8 }}>
        {item.status === 'active' && (
          <TouchableOpacity
            onPress={() => {
              setSelectedTenant(item);
              setActionModalType('suspend');
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.errorLight,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: borderRadius.sm,
              borderWidth: 1,
              borderColor: colors.error,
            }}
          >
            <Ionicons name="pause-circle-outline" size={16} color={colors.error} />
            <Text style={{ color: colors.error, fontWeight: '600', fontSize: 13, marginLeft: 4 }}>Suspend</Text>
          </TouchableOpacity>
        )}
        {item.status === 'suspended' && (
          <TouchableOpacity
            onPress={() => {
              setSelectedTenant(item);
              setActionModalType('reactivate');
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: primaryColor,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: borderRadius.sm,
            }}
          >
            <Ionicons name="play-circle-outline" size={16} color={colors.surface} />
            <Text style={{ color: colors.textInverse, fontWeight: '600', fontSize: 13, marginLeft: 4 }}>Reactivate</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }} edges={['top']}>
      {/* Header */}
      <View style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
              <Ionicons name="arrow-back" size={24} color={colors.surface} />
            </TouchableOpacity>
            <View>
              <Text style={{ color: colors.textInverse, fontSize: 20, fontWeight: 'bold' }}>Tenant Management</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                {filteredTenants.length} of {tenants?.length || 0} colleges
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setAddModalVisible(true)}
            style={{
              backgroundColor: primaryColor,
              width: 40,
              height: 40,
              borderRadius: 20,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons name="add" size={24} color={colors.surface} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Cards */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
        {[
          { label: 'Pending', count: pendingCount, color: primaryColor, filter: 'pending' },
          { label: 'Active', count: activeCount, color: primaryColor, filter: 'active' },
          { label: 'Suspended', count: suspendedCount, color: colors.error, filter: 'suspended' },
        ].map((stat) => (
          <TouchableOpacity
            key={stat.filter}
            onPress={() => setStatusFilter(statusFilter === stat.filter ? 'all' : stat.filter)}
            style={{
              flex: 1,
              backgroundColor: statusFilter === stat.filter ? `${stat.color}15` : colors.surface,
              borderRadius: borderRadius.md,
              padding: 12,
              borderWidth: statusFilter === stat.filter ? 2 : 1,
              borderColor: statusFilter === stat.filter ? stat.color : colors.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name={getStatusIcon(stat.filter)} size={14} color={stat.color} />
              <Text style={{ color: colors.textSecondary, fontSize: 11, marginLeft: 4 }}>{stat.label}</Text>
            </View>
            <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: 'bold', marginTop: 4 }}>{stat.count}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            paddingHorizontal: 12,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="search" size={20} color={colors.textTertiary} />
          <TextInput
            style={{
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: 8,
              fontSize: 15,
              color: colors.textPrimary,
            }}
            placeholder="Search by name, code, or email..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tenant List */}
      <FlatList
        data={filteredTenants}
        keyExtractor={(item, index) => item.code || item.id || `tenant-${index}`}
        renderItem={renderTenant}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Ionicons name="business-outline" size={48} color={colors.borderDark} />
            <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 12 }}>No colleges found</Text>
            <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 4 }}>Try adjusting your search or filter</Text>
          </View>
        }
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
      />

      {/* Add Tenant Modal */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setAddModalVisible(false)}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>Add College</Text>
            <TouchableOpacity onPress={handleCreateTenant} disabled={createTenant.isPending}>
              <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>
                {createTenant.isPending ? 'Creating...' : 'Create'}
              </Text>
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView style={{ flex: 1, padding: spacing.lg }} keyboardShouldPersistTaps="handled">
              {/* College Information Section */}
              <View style={{ backgroundColor: colors.background, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <Ionicons name="business" size={20} color={colors.textPrimary} />
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginLeft: 8 }}>College Information</Text>
                </View>

                {/* Logo Upload */}
                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textPrimary, marginBottom: 6 }}>College Logo (1024x1024 recommended)</Text>
                <TouchableOpacity
                  onPress={pickLogo}
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: borderRadius.lg,
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
                    <Image
                      source={{ uri: logoImage.uri }}
                      style={{ width: 120, height: 120 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={{ alignItems: 'center' }}>
                      <Ionicons name="camera" size={32} color={colors.textTertiary} />
                      <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 4 }}>Upload Logo</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {logoImage && (
                  <TouchableOpacity onPress={() => { setLogoImage(null); setNewTenant({ ...newTenant, logo_url: '' }); }}>
                    <Text style={{ color: colors.error, fontSize: 13, marginBottom: spacing.md }}>Remove Logo</Text>
                  </TouchableOpacity>
                )}

                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textPrimary, marginBottom: 6 }}>College Name *</Text>
                <TextInput
                  style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: 12, fontSize: 15, color: colors.textPrimary, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border }}
                  placeholder="e.g., Ormond College"
                  placeholderTextColor={colors.textTertiary}
                  value={newTenant.name}
                  onChangeText={(text) => setNewTenant({ ...newTenant, name: text })}
                />
              </View>

              {/* Contact Person Section */}
              <View style={{ backgroundColor: colors.background, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <Ionicons name="person" size={20} color={colors.textPrimary} />
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginLeft: 8 }}>Contact Person (Admin)</Text>
                </View>

                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textPrimary, marginBottom: 6 }}>Full Name *</Text>
                <TextInput
                  style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: 12, fontSize: 15, color: colors.textPrimary, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border }}
                  placeholder="e.g., John Smith"
                  placeholderTextColor={colors.textTertiary}
                  value={newTenant.contact_person_name}
                  onChangeText={(text) => setNewTenant({ ...newTenant, contact_person_name: text })}
                />

                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textPrimary, marginBottom: 6 }}>Email Address *</Text>
                <TextInput
                  style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: 12, fontSize: 15, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border }}
                  placeholder="admin@college.edu"
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={newTenant.contact_person_email}
                  onChangeText={(text) => setNewTenant({ ...newTenant, contact_person_email: text })}
                />
              </View>

              {/* Info Note */}
              <View style={{ backgroundColor: primaryColor + '15', borderRadius: borderRadius.md, padding: 14, flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 }}>
                <Ionicons name="information-circle" size={20} color={primaryColor} style={{ marginTop: 2 }} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={{ color: primaryColor, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>How it works:</Text>
                  <Text style={{ color: primaryColor, fontSize: 13, lineHeight: 18 }}>
                    1. A unique invite code will be auto-generated{'\n'}
                    2. An invitation email with the code will be sent to the contact person{'\n'}
                    3. They download the app, tap "Join with Invite Code", and set their password
                  </Text>
                </View>
              </View>

              {/* Spacer for keyboard */}
              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Suspend/Reactivate Confirmation Modal */}
      <Modal
        visible={actionModalType !== null}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setActionModalType(null);
          setSelectedTenant(null);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: spacing.xxl, width: '100%', maxWidth: 340 }}>
            {/* Icon */}
            <View style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: actionModalType === 'suspend' ? colors.errorLight : primaryColor + '15',
              justifyContent: 'center',
              alignItems: 'center',
              alignSelf: 'center',
              marginBottom: 16,
            }}>
              <Ionicons
                name={actionModalType === 'suspend' ? 'pause-circle' : 'play-circle'}
                size={32}
                color={actionModalType === 'suspend' ? colors.error : primaryColor}
              />
            </View>

            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary, textAlign: 'center', marginBottom: 8 }}>
              {actionModalType === 'suspend' ? 'Suspend College' : 'Reactivate College'}
            </Text>

            <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 16 }}>
              {actionModalType === 'suspend' 
                ? `Are you sure you want to suspend "${selectedTenant?.name}"? All users will be unable to log in.`
                : `Are you sure you want to reactivate "${selectedTenant?.name}"?`
              }
            </Text>

            {/* Tenant Info */}
            <View style={{ backgroundColor: colors.background, borderRadius: borderRadius.md, padding: 12, marginBottom: 20 }}>
              <Text style={{ fontSize: 13, color: colors.textPrimary }}><Text style={{ fontWeight: '600' }}>Code:</Text> {selectedTenant?.code}</Text>
              <Text style={{ fontSize: 13, color: colors.textPrimary, marginTop: 4 }}><Text style={{ fontWeight: '600' }}>Contact:</Text> {selectedTenant?.contact_person_email}</Text>
              <Text style={{ fontSize: 13, color: colors.textPrimary, marginTop: 4 }}><Text style={{ fontWeight: '600' }}>Users:</Text> {selectedTenant?.user_count || 0}</Text>
            </View>

            {/* Warning for suspend */}
            {actionModalType === 'suspend' && (
              <View style={{ backgroundColor: colors.errorLight, borderRadius: borderRadius.md, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: colors.error }}>
                <Text style={{ fontSize: 12, color: colors.error }}>
                  <Text style={{ fontWeight: '600' }}>Warning:</Text> This action will immediately prevent all users from accessing the platform.
                </Text>
              </View>
            )}

            {/* Buttons */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  setActionModalType(null);
                  setSelectedTenant(null);
                }}
                style={{ flex: 1, paddingVertical: 14, borderRadius: borderRadius.md, backgroundColor: colors.surfaceSecondary }}
              >
                <Text style={{ textAlign: 'center', color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (actionModalType === 'suspend') {
                    suspendTenant.mutate(selectedTenant?.code);
                  } else {
                    reactivateTenant.mutate(selectedTenant?.code);
                  }
                }}
                disabled={suspendTenant.isPending || reactivateTenant.isPending}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: borderRadius.md,
                  backgroundColor: actionModalType === 'suspend' ? colors.error : primaryColor,
                }}
              >
                <Text style={{ textAlign: 'center', color: colors.textInverse, fontWeight: '600' }}>
                  {(suspendTenant.isPending || reactivateTenant.isPending) 
                    ? 'Processing...' 
                    : (actionModalType === 'suspend' ? 'Suspend' : 'Reactivate')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
