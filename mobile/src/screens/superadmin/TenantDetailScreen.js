import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  Switch,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../services/api';

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
  { id: 'safe_disclosure', name: 'Safe Disclosure', icon: 'shield', description: 'Anonymous reports' },
  { id: 'parcels', name: 'Parcels', icon: 'cube', description: 'Package tracking' },
  { id: 'bookings', name: 'Bookings', icon: 'bookmark', description: 'Room bookings' },
  { id: 'relationship_disclosures', name: 'Relationship Disclosures', icon: 'heart', description: 'RA governance tracking' },
  { id: 'gbv_training', name: 'GBV Training', icon: 'shield-checkmark', description: 'Staff training compliance' },
];

const SUBSCRIPTION_TIERS = [
  { id: 'basic', name: 'Basic', monthlyPrice: 99, yearlyPrice: 990, maxUsers: 100, color: colors.textSecondary },
  { id: 'pro', name: 'Pro', monthlyPrice: 299, yearlyPrice: 2990, maxUsers: 500, color: null },
  { id: 'enterprise', name: 'Enterprise', monthlyPrice: 0, yearlyPrice: 0, maxUsers: -1, color: null },
];

const ACTIVITY_TYPES = [
  { id: 'sports', name: 'Sports', icon: 'football', color: null },
  { id: 'clubs', name: 'Clubs', icon: 'people', color: null },
  { id: 'cultural', name: 'Cultural', icon: 'musical-notes', color: null },
];

import { colors, borderRadius, spacing, shadows } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useTenant } from '../../contexts/TenantContext';

// Move SectionCard outside of main component
const SectionCard = ({ title, icon, children, action }) => (
  <View style={{
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.border,
  }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name={icon} size={18} color={colors.textSecondary} />
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginLeft: 8 }}>{title}</Text>
      </View>
      {action}
    </View>
    {children}
  </View>
);

export default function TenantDetailScreen({ route, navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const { tenant: initialTenant } = route.params;
  const [modulesModalVisible, setModulesModalVisible] = useState(false);
  const [billingModalVisible, setBillingModalVisible] = useState(false);
  const [usersModalVisible, setUsersModalVisible] = useState(false);
  const [activityModalVisible, setActivityModalVisible] = useState(false);
  const [addActivityModalVisible, setAddActivityModalVisible] = useState(false);
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [addAdminModalVisible, setAddAdminModalVisible] = useState(false);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactSaving, setContactSaving] = useState(false);
  const [enabledModules, setEnabledModules] = useState([]);
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  const [newActivity, setNewActivity] = useState({ type: 'clubs', name: '', description: '' });
  
  const queryClient = useQueryClient();

  // Fetch tenant details
  const { data: tenant, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['tenant', initialTenant.code],
    queryFn: async () => {
      const response = await api.get(`/tenants/${initialTenant.code}`);
      return response.data;
    },
    initialData: initialTenant,
  });

  // Refetch when screen comes back into focus (e.g. after branding changes)
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  // Update enabledModules when tenant data changes
  useEffect(() => {
    if (tenant?.enabled_modules) {
      setEnabledModules([...tenant.enabled_modules]);
    }
  }, [tenant?.enabled_modules]);

  // Fetch tenant users
  const { data: usersData } = useQuery({
    queryKey: ['tenant-users', initialTenant.code],
    queryFn: async () => {
      // Fetch both users list and stats for complete data
      const [usersResponse, statsResponse] = await Promise.all([
        api.get(`/tenants/${initialTenant.code}/users`),
        api.get(`/tenants/${initialTenant.code}/stats`)
      ]);
      
      // Combine the data into expected format
      return {
        users: usersResponse.data || [],
        total_users: statsResponse.data?.total_users || usersResponse.data?.length || 0,
        users_by_role: statsResponse.data?.users_by_role || {
          admin: 0,
          ra: 0,
          student: 0
        }
      };
    },
  });

  // Fetch tenant admins
  const { data: adminsData, refetch: refetchAdmins } = useQuery({
    queryKey: ['tenant-admins', initialTenant.code],
    queryFn: async () => {
      const response = await api.get(`/tenants/${initialTenant.code}/admins`);
      return response.data;
    },
  });

  const handleAddAdmin = async () => {
    if (!newAdminName.trim() || !newAdminEmail.trim()) {
      Alert.alert('Error', 'Please enter both name and email');
      return;
    }
    setAddingAdmin(true);
    try {
      await api.post(`/tenants/${initialTenant.code}/admins`, {
        name: newAdminName.trim(),
        email: newAdminEmail.trim(),
      });
      Alert.alert('Success', `Admin invitation sent to ${newAdminEmail.trim()}`);
      setNewAdminName('');
      setNewAdminEmail('');
      setAddAdminModalVisible(false);
      refetchAdmins();
      queryClient.invalidateQueries(['tenant-users', initialTenant.code]);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to add admin');
    } finally {
      setAddingAdmin(false);
    }
  };

  // Fetch tenant activity
  const { data: activityData, isLoading: activityLoading, refetch: refetchActivity } = useQuery({
    queryKey: ['tenant-activity', initialTenant.code],
    queryFn: async () => {
      try {
        const response = await api.get(`/analytics/cross-tenant/activity?days=30`);
        // Find this tenant's activity
        const tenantActivity = response.data.by_tenant?.find(
          t => t.tenant_code === initialTenant.code
        );
        return tenantActivity || null;
      } catch (error) {
        console.log('Activity fetch error:', error);
        return null;
      }
    },
    enabled: activityModalVisible,
  });

  // Fetch pending invitations for this tenant
  const { data: invitationsData, refetch: refetchInvitations } = useQuery({
    queryKey: ['tenant-invitations', initialTenant.code],
    queryFn: async () => {
      try {
        const response = await api.get(`/tenants/${initialTenant.code}/invitations`);
        return response.data;
      } catch (error) {
        return { invitations: [] };
      }
    },
  });

  // Fetch activities for this tenant
  const { data: activitiesData, refetch: refetchActivities } = useQuery({
    queryKey: ['tenant-activities', initialTenant.code],
    queryFn: async () => {
      try {
        const response = await api.get(`/tenants/${initialTenant.code}/activities`);
        return response.data;
      } catch (error) {
        return { activities: [] };
      }
    },
  });

  // Update modules mutation
  const updateModules = useMutation({
    mutationFn: async (modules) => {
      const response = await api.put(`/tenants/${tenant.code}/modules`, {
        enabled_modules: modules,
      });
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Modules updated successfully');
      setModulesModalVisible(false);
      queryClient.invalidateQueries(['tenant', tenant.code]);
      queryClient.invalidateQueries(['tenants']);
    },
    onError: (error) => {
      console.log('Update modules error:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update modules');
    },
  });

  // Resend invitation mutation
  const resendInvitation = useMutation({
    mutationFn: async (invitationId) => {
      const response = await api.post(`/tenants/${tenant.code}/invitations/${invitationId}/resend`);
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Invitation resent successfully');
      refetchInvitations();
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to resend invitation');
    },
  });

  // Add activity mutation
  const addActivity = useMutation({
    mutationFn: async (activity) => {
      const currentActivities = activitiesData?.activities || [];
      const updatedActivities = [...currentActivities, activity];
      const response = await api.put(`/tenants/${tenant.code}/activities`, {
        activities: updatedActivities,
      });
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Activity added successfully');
      setAddActivityModalVisible(false);
      setNewActivity({ type: 'clubs', name: '', description: '' });
      refetchActivities();
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to add activity');
    },
  });

  // Delete activity mutation
  const deleteActivity = useMutation({
    mutationFn: async (activityId) => {
      const currentActivities = activitiesData?.activities || [];
      const updatedActivities = currentActivities.filter(a => a.id !== activityId);
      const response = await api.put(`/tenants/${tenant.code}/activities`, {
        activities: updatedActivities,
      });
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Activity removed');
      refetchActivities();
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to remove activity');
    },
  });

  // Suspend tenant mutation
  const suspendTenant = useMutation({
    mutationFn: async () => {
      const response = await api.delete(`/tenants/${tenant.code}`);
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'College suspended');
      queryClient.invalidateQueries(['tenants']);
      navigation.goBack();
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to suspend college');
    },
  });

  // Reactivate tenant mutation
  const reactivateTenant = useMutation({
    mutationFn: async () => {
      const response = await api.put(`/tenants/${tenant.code}/reactivate`);
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'College reactivated');
      queryClient.invalidateQueries(['tenant', tenant.code]);
      queryClient.invalidateQueries(['tenants']);
      refetch();
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to reactivate college');
    },
  });

  // Delete tenant permanently mutation
  const deleteTenantPermanently = useMutation({
    mutationFn: async () => {
      const response = await api.delete(`/tenants/${tenant.code}/permanent`);
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Deleted', 'College has been permanently deleted');
      queryClient.invalidateQueries(['tenants']);
      queryClient.invalidateQueries(['cross-tenant-analytics']);
      navigation.goBack();
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to delete college');
    },
  });

  // Create checkout session for billing
  const createCheckout = useMutation({
    mutationFn: async ({ tier, period }) => {
      const response = await api.post('/billing/checkout', {
        tenant_code: tenant.code,
        tier: tier,
        billing_period: period,
        origin_url: 'quadley://billing-callback',
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.url) {
        Alert.alert(
          'Redirect to Payment',
          'You will be redirected to complete payment. Continue?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Continue', 
              onPress: () => {
                import('react-native').then(({ Linking }) => {
                  Linking.openURL(data.url);
                });
                setBillingModalVisible(false);
              }
            },
          ]
        );
      }
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create checkout');
    },
  });

  // Direct subscription update (Super Admin only - bypasses payment)
  const updateSubscription = useMutation({
    mutationFn: async ({ tier }) => {
      const response = await api.put(`/tenants/${tenant.code}/subscription`, {
        subscription_tier: tier,
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['tenant', tenant.code]);
      queryClient.invalidateQueries(['tenants']);
      Alert.alert('Success', `Subscription updated to ${data.subscription_tier}`);
      setBillingModalVisible(false);
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update subscription');
    },
  });

  // Update contact person mutation
  const handleSaveContact = async () => {
    if (!contactName.trim() || !contactEmail.trim()) {
      Alert.alert('Error', 'Name and email are required');
      return;
    }
    setContactSaving(true);
    try {
      await api.put(`/tenants/${tenant.code}/contact-person`, {
        contact_person_name: contactName.trim(),
        contact_person_email: contactEmail.trim(),
      });
      Alert.alert('Success', 'Contact person updated');
      setContactModalVisible(false);
      queryClient.invalidateQueries(['tenant', tenant.code]);
      queryClient.invalidateQueries(['tenants']);
      refetch();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update contact person');
    } finally {
      setContactSaving(false);
    }
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

  const handleSaveModules = () => {
    if (enabledModules.length === 0) {
      Alert.alert('Warning', 'Please enable at least one module');
      return;
    }
    updateModules.mutate(enabledModules);
  };

  const handleAddActivity = () => {
    if (!newActivity.name.trim()) {
      Alert.alert('Error', 'Please enter an activity name');
      return;
    }
    addActivity.mutate({
      type: newActivity.type,
      name: newActivity.name.trim(),
      description: newActivity.description.trim(),
    });
  };

  const handleDeleteActivity = (activity) => {
    Alert.alert(
      'Remove Activity',
      `Remove "${activity.name}" from this college?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => deleteActivity.mutate(activity.id) },
      ]
    );
  };

  const handleSuspendTenant = () => {
    Alert.alert(
      'Suspend College',
      `Are you sure you want to suspend ${tenant?.name}? Users will not be able to log in.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Suspend', style: 'destructive', onPress: () => suspendTenant.mutate() },
      ]
    );
  };

  const handleReactivateTenant = () => {
    Alert.alert(
      'Reactivate College',
      `Reactivate ${tenant?.name}? Users will be able to log in again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reactivate', onPress: () => reactivateTenant.mutate() },
      ]
    );
  };

  const handleDeleteTenantPermanently = () => {
    Alert.alert(
      'Delete College Permanently',
      `⚠️ WARNING: This will permanently delete ${tenant?.name} and ALL its data including users, events, messages, etc.\n\nThis action CANNOT be undone!`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete Forever', 
          style: 'destructive', 
          onPress: () => {
            // Double confirmation
            Alert.alert(
              'Final Confirmation',
              `Type the college name "${tenant?.name}" to confirm deletion.\n\nAre you absolutely sure?`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Yes, Delete', style: 'destructive', onPress: () => deleteTenantPermanently.mutate() },
              ]
            );
          }
        },
      ]
    );
  };

  const handleUpgrade = (tier) => {
    if (tier === 'enterprise') {
      Alert.alert('Enterprise Plan', 'Please contact sales@quadley.com for custom pricing.');
      return;
    }
    
    // Super admin can set tier directly without payment
    Alert.alert(
      'Update Subscription',
      `Set subscription to ${tier.charAt(0).toUpperCase() + tier.slice(1)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set Directly (Admin)',
          onPress: () => updateSubscription.mutate({ tier }),
        },
        {
          text: 'Checkout (Payment)',
          onPress: () => createCheckout.mutate({ tier, period: billingPeriod }),
        },
      ]
    );
  };

  const handleResendInvitation = (invitation) => {
    Alert.alert(
      'Resend Invitation',
      `Resend invitation to ${invitation.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Resend', onPress: () => resendInvitation.mutate(invitation.id) },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  const currentTier = SUBSCRIPTION_TIERS.find(t => t.id === (tenant?.subscription_tier || 'basic'));
  const pendingInvitations = invitationsData?.invitations?.filter(i => i.status === 'pending') || [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }} edges={['top']}>
      {/* Header */}
      <View style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color={colors.surface} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textInverse, fontSize: 20, fontWeight: 'bold' }}>{tenant?.name}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Code: {tenant?.code}</Text>
          </View>
          <View style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
            backgroundColor: tenant?.status === 'active' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
          }}>
            <Text style={{
              color: tenant?.status === 'active' ? primaryColor + '15' : colors.errorLight,
              fontSize: 13,
              fontWeight: '600',
              textTransform: 'capitalize',
            }}>
              {tenant?.status}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {/* Quick Stats */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: 14 }}>
            <Ionicons name="people" size={20} color={primaryColor} />
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.textPrimary, marginTop: 4 }}>
              {tenant?.user_count || 0}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>Users</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: 14 }}>
            <Ionicons name="apps" size={20} color={primaryColor} />
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.textPrimary, marginTop: 4 }}>
              {tenant?.enabled_modules?.length || 0}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>Modules</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: 14 }}>
            <Ionicons name="card" size={20} color={colors.warning} />
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.textPrimary, marginTop: 4 }}>
              {currentTier?.name}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>Plan</Text>
          </View>
        </View>

        {/* Contact Information */}
        <SectionCard 
          title="Contact Person" 
          icon="person"
          action={
            <TouchableOpacity onPress={() => {
              setContactName(tenant?.contact_person_name || '');
              setContactEmail(tenant?.contact_person_email || '');
              setContactModalVisible(true);
            }}>
              <Text style={{ color: colors.primary, fontWeight: '500' }}>Edit</Text>
            </TouchableOpacity>
          }
        >
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="person-outline" size={16} color={colors.secondary} />
              <Text style={{ color: colors.textPrimary, marginLeft: 8 }}>{tenant?.contact_person_name}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="mail-outline" size={16} color={colors.secondary} />
              <Text style={{ color: colors.textPrimary, marginLeft: 8 }}>{tenant?.contact_person_email}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="calendar-outline" size={16} color={colors.secondary} />
              <Text style={{ color: colors.textPrimary, marginLeft: 8 }}>
                Created: {new Date(tenant?.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </SectionCard>

        {/* Admins */}
        <SectionCard
          title="Administrators"
          icon="shield-checkmark"
          action={
            <TouchableOpacity onPress={() => setAddAdminModalVisible(true)}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="add-circle" size={18} color={colors.primary} />
                <Text style={{ color: colors.primary, fontWeight: '500', marginLeft: 4 }}>Add</Text>
              </View>
            </TouchableOpacity>
          }
        >
          {adminsData && adminsData.length > 0 ? (
            <View style={{ gap: 10 }}>
              {adminsData.map((admin) => (
                <View key={admin.id || admin.email} style={{
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12,
                }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: primaryColor + '20', justifyContent: 'center', alignItems: 'center', marginRight: 12,
                  }}>
                    <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 14 }}>
                      {(admin.first_name?.[0] || '').toUpperCase()}{(admin.last_name?.[0] || '').toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                      {admin.first_name} {admin.last_name}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>{admin.email}</Text>
                  </View>
                  <View style={{
                    paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.full,
                    backgroundColor: admin.active ? colors.primary + '15' : colors.errorLight,
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: admin.active ? colors.primary : colors.error }}>
                      {admin.pending_setup ? 'Pending' : admin.active ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ color: colors.textTertiary, fontSize: 14 }}>No admins found</Text>
          )}
        </SectionCard>

        {/* Subscription & Billing */}
        <SectionCard 
          title="Subscription" 
          icon="card"
          action={
            <TouchableOpacity onPress={() => setBillingModalVisible(true)}>
              <Text style={{ color: primaryColor, fontWeight: '500' }}>Upgrade</Text>
            </TouchableOpacity>
          }
        >
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: `${currentTier?.color}15`,
            padding: 12,
            borderRadius: borderRadius.md,
          }}>
            <Ionicons 
              name={currentTier?.id === 'enterprise' ? 'diamond' : currentTier?.id === 'pro' ? 'flash' : 'cube'} 
              size={24} 
              color={currentTier?.color} 
            />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>{currentTier?.name} Plan</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                {currentTier?.monthlyPrice > 0 ? `$${currentTier?.monthlyPrice}/month` : 'Custom pricing'}
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              Max {currentTier?.maxUsers > 0 ? currentTier?.maxUsers : '∞'} users
            </Text>
          </View>
        </SectionCard>

        {/* Branding */}
        <SectionCard 
          title="Branding" 
          icon="color-palette"
          action={
            <TouchableOpacity onPress={() => navigation.navigate('TenantBranding', { tenant })}>
              <Text style={{ color: primaryColor, fontWeight: '500' }}>Customise</Text>
            </TouchableOpacity>
          }
        >
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surfaceSecondary,
            padding: 12,
            borderRadius: borderRadius.md,
          }}>
            <View style={{ flexDirection: 'row', marginRight: 12 }}>
              <View style={{
                width: 40,
                height: 40,
                borderRadius: borderRadius.sm,
                backgroundColor: tenant?.branding?.primary_color || tenant?.primary_color || primaryColor,
              }} />
              <View style={{
                width: 40,
                height: 40,
                borderRadius: borderRadius.sm,
                backgroundColor: tenant?.branding?.secondary_color || tenant?.secondary_color || colors.textPrimary,
                marginLeft: -8,
                borderWidth: 2,
                borderColor: colors.surfaceSecondary,
              }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary }}>
                {tenant?.branding?.app_name || tenant?.name || 'Default'}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                Primary: {tenant?.branding?.primary_color || tenant?.primary_color || primaryColor}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                Secondary: {tenant?.branding?.secondary_color || tenant?.secondary_color || colors.textPrimary}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </View>
        </SectionCard>

        {/* Modules */}
        <SectionCard 
          title="Modules" 
          icon="apps"
          action={
            <TouchableOpacity onPress={() => setModulesModalVisible(true)}>
              <Text style={{ color: primaryColor, fontWeight: '500' }}>Edit</Text>
            </TouchableOpacity>
          }
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(tenant?.enabled_modules || []).map((moduleId) => {
              const module = ALL_MODULES.find(m => m.id === moduleId);
              return (
                <View key={moduleId} style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.surfaceSecondary,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: borderRadius.lg,
                }}>
                  <Ionicons name={module?.icon || 'cube'} size={14} color={colors.textPrimary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 13, marginLeft: 4 }}>
                    {module?.name || moduleId}
                  </Text>
                </View>
              );
            })}
          </View>
          {(tenant?.enabled_modules || []).length === 0 && (
            <Text style={{ color: colors.textTertiary, fontStyle: 'italic' }}>No modules enabled</Text>
          )}
        </SectionCard>

        {/* Activities */}
        <SectionCard 
          title="Activities" 
          icon="fitness"
          action={
            <TouchableOpacity onPress={() => setAddActivityModalVisible(true)}>
              <Text style={{ color: primaryColor, fontWeight: '500' }}>Add</Text>
            </TouchableOpacity>
          }
        >
          {(activitiesData?.activities || []).length > 0 ? (
            <View style={{ gap: 10 }}>
              {/* Group activities by type */}
              {ACTIVITY_TYPES.map((type) => {
                const typeActivities = (activitiesData?.activities || []).filter(a => a.type === type.id);
                if (typeActivities.length === 0) return null;
                
                return (
                  <View key={type.id}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <View style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        backgroundColor: `${type.color}15`,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 8,
                      }}>
                        <Ionicons name={type.icon} size={14} color={type.color || primaryColor} />
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: type.color || primaryColor }}>
                        {type.name} ({typeActivities.length})
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginLeft: 32 }}>
                      {typeActivities.map((activity) => (
                        <TouchableOpacity 
                          key={activity.id}
                          onLongPress={() => handleDeleteActivity(activity)}
                          activeOpacity={0.7}
                          style={{
                            backgroundColor: `${type.color}10`,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: borderRadius.md,
                            borderWidth: 1,
                            borderColor: `${type.color}30`,
                            flexDirection: 'row',
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{ fontSize: 13, color: colors.textPrimary }}>{activity.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Ionicons name="fitness-outline" size={32} color={colors.borderDark} />
              <Text style={{ color: colors.textTertiary, marginTop: 8, fontStyle: 'italic' }}>
                No activities set up yet
              </Text>
            </View>
          )}
        </SectionCard>

        {/* Users */}
        <SectionCard 
          title="Users" 
          icon="people"
          action={
            <TouchableOpacity onPress={() => setUsersModalVisible(true)}>
              <Text style={{ color: primaryColor, fontWeight: '500' }}>View All</Text>
            </TouchableOpacity>
          }
        >
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.textSecondary }}>Admins</Text>
              <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{usersData?.users_by_role?.admin || 0}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.textSecondary }}>RAs</Text>
              <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{usersData?.users_by_role?.ra || 0}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.textSecondary }}>Students</Text>
              <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{usersData?.users_by_role?.student || 0}</Text>
            </View>
          </View>
        </SectionCard>

        {/* Actions */}
        <SectionCard title="Actions" icon="flash">
          <View style={{ gap: 10 }}>
            {/* Resend Invitations */}
            <TouchableOpacity
              onPress={() => {
                if (pendingInvitations.length === 0) {
                  Alert.alert('No Pending Invitations', 'There are no pending invitations to resend.');
                } else {
                  Alert.alert(
                    'Resend Invitations',
                    `There are ${pendingInvitations.length} pending invitation(s). Resend all?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: 'Resend All', 
                        onPress: () => {
                          pendingInvitations.forEach(inv => resendInvitation.mutate(inv.id));
                        }
                      },
                    ]
                  );
                }
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: primaryColor + '15',
                padding: 14,
                borderRadius: borderRadius.md,
              }}
            >
              <Ionicons name="mail" size={20} color={primaryColor} />
              <Text style={{ color: primaryColor, fontWeight: '500', marginLeft: 10, flex: 1 }}>
                Resend Invitations ({pendingInvitations.length})
              </Text>
              <Ionicons name="chevron-forward" size={20} color={primaryColor} />
            </TouchableOpacity>

            {/* View Activity Reports */}
            <TouchableOpacity
              onPress={() => {
                setActivityModalVisible(true);
                refetchActivity();
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.warningLight,
                padding: 14,
                borderRadius: borderRadius.md,
              }}
            >
              <Ionicons name="bar-chart" size={20} color={colors.warning} />
              <Text style={{ color: colors.warning, fontWeight: '500', marginLeft: 10, flex: 1 }}>View Activity Reports</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.warning} />
            </TouchableOpacity>

            {/* Suspend / Reactivate */}
            {tenant?.status === 'active' ? (
              <TouchableOpacity
                onPress={handleSuspendTenant}
                disabled={suspendTenant.isPending}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: primaryColor + '15',
                  padding: 14,
                  borderRadius: borderRadius.md,
                }}
              >
                <Ionicons name="pause-circle" size={20} color={colors.warning} />
                <Text style={{ color: primaryColor, fontWeight: '500', marginLeft: 10, flex: 1 }}>
                  {suspendTenant.isPending ? 'Suspending...' : 'Suspend College'}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={colors.warning} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleReactivateTenant}
                disabled={reactivateTenant.isPending}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: primaryColor + '15',
                  padding: 14,
                  borderRadius: borderRadius.md,
                }}
              >
                <Ionicons name="play-circle" size={20} color={primaryColor} />
                <Text style={{ color: primaryColor, fontWeight: '500', marginLeft: 10, flex: 1 }}>
                  {reactivateTenant.isPending ? 'Reactivating...' : 'Reactivate College'}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={primaryColor} />
              </TouchableOpacity>
            )}

            {/* Delete Permanently */}
            <TouchableOpacity
              onPress={handleDeleteTenantPermanently}
              disabled={deleteTenantPermanently.isPending}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.errorLight,
                padding: 14,
                borderRadius: borderRadius.md,
              }}
            >
              <Ionicons name="trash" size={20} color={colors.error} />
              <Text style={{ color: colors.error, fontWeight: '500', marginLeft: 10, flex: 1 }}>
                {deleteTenantPermanently.isPending ? 'Deleting...' : 'Delete Permanently'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        </SectionCard>

        {/* Bottom spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modules Modal */}
      <Modal
        visible={modulesModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModulesModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setModulesModalVisible(false)}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>Edit Modules</Text>
            <TouchableOpacity onPress={handleSaveModules} disabled={updateModules.isPending}>
              <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>
                {updateModules.isPending ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1, padding: spacing.lg }}>
            <Text style={{ color: colors.textSecondary, marginBottom: 16 }}>
              Enable or disable modules for {tenant?.name}. {enabledModules.length} selected.
            </Text>
            
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
                    backgroundColor: isEnabled ? primaryColor + '15' : colors.background,
                    padding: 14,
                    borderRadius: borderRadius.md,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: isEnabled ? primaryColor : colors.border,
                  }}
                >
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: borderRadius.md,
                    backgroundColor: isEnabled ? primaryColor : colors.border,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <Ionicons 
                      name={module.icon} 
                      size={20} 
                      color={isEnabled ? colors.surface : colors.textSecondary} 
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontSize: 15, fontWeight: '500', color: colors.textPrimary }}>{module.name}</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>{module.description}</Text>
                  </View>
                  <Switch
                    value={isEnabled}
                    onValueChange={() => toggleModule(module.id)}
                    trackColor={{ false: colors.border, true: primaryColor + '15' }}
                    thumbColor={isEnabled ? primaryColor : colors.surfaceSecondary}
                  />
                </TouchableOpacity>
              );
            })}
            
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Billing Modal with Annual/Monthly toggle */}
      <Modal
        visible={billingModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setBillingModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setBillingModalVisible(false)}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Close</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>Subscription Plans</Text>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView style={{ flex: 1, padding: spacing.lg }}>
            <Text style={{ color: colors.textSecondary, marginBottom: spacing.md }}>
              Current plan: <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{currentTier?.name}</Text>
            </Text>

            {/* Billing Period Toggle */}
            <View style={{
              flexDirection: 'row',
              backgroundColor: colors.surfaceSecondary,
              borderRadius: borderRadius.md,
              padding: 4,
              marginBottom: 20,
            }}>
              <TouchableOpacity
                onPress={() => setBillingPeriod('monthly')}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: borderRadius.md,
                  backgroundColor: billingPeriod === 'monthly' ? colors.surface : 'transparent',
                  alignItems: 'center',
                }}
              >
                <Text style={{ 
                  fontWeight: '600', 
                  color: billingPeriod === 'monthly' ? colors.textPrimary : colors.textSecondary 
                }}>
                  Monthly
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setBillingPeriod('yearly')}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: borderRadius.md,
                  backgroundColor: billingPeriod === 'yearly' ? colors.surface : 'transparent',
                  alignItems: 'center',
                }}
              >
                <Text style={{ 
                  fontWeight: '600', 
                  color: billingPeriod === 'yearly' ? colors.textPrimary : colors.textSecondary 
                }}>
                  Yearly
                </Text>
                <Text style={{ fontSize: 10, color: primaryColor }}>Save 17%</Text>
              </TouchableOpacity>
            </View>
            
            {SUBSCRIPTION_TIERS.map((tier) => {
              const price = billingPeriod === 'yearly' ? tier.yearlyPrice : tier.monthlyPrice;
              const isCurrentTier = tier.id === tenant?.subscription_tier;
              
              return (
                <View
                  key={tier.id}
                  style={{
                    backgroundColor: isCurrentTier ? primaryColor + '15' : colors.background,
                    borderRadius: borderRadius.lg,
                    padding: 20,
                    marginBottom: spacing.md,
                    borderWidth: 2,
                    borderColor: isCurrentTier ? primaryColor : 'transparent',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                    <Ionicons 
                      name={tier.id === 'enterprise' ? 'diamond' : tier.id === 'pro' ? 'flash' : 'cube'} 
                      size={28} 
                      color={tier.color || primaryColor} 
                    />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.textPrimary }}>{tier.name}</Text>
                      <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                        {price > 0 
                          ? `$${price}/${billingPeriod === 'yearly' ? 'year' : 'month'}` 
                          : 'Custom pricing'
                        }
                      </Text>
                    </View>
                    {isCurrentTier && (
                      <View style={{ backgroundColor: primaryColor, paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.md }}>
                        <Text style={{ color: colors.textInverse, fontSize: 12, fontWeight: '600' }}>Current</Text>
                      </View>
                    )}
                  </View>

                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ color: colors.textPrimary, marginBottom: 4 }}>
                      • Up to {tier.maxUsers > 0 ? tier.maxUsers : 'Unlimited'} users
                    </Text>
                    <Text style={{ color: colors.textPrimary, marginBottom: 4 }}>
                      • {tier.id === 'basic' ? '8 core' : 'All 16'} modules
                    </Text>
                    <Text style={{ color: colors.textPrimary }}>
                      • {tier.id === 'enterprise' ? 'Dedicated' : tier.id === 'pro' ? 'Priority' : 'Email'} support
                    </Text>
                  </View>

                  {!isCurrentTier && (
                    <TouchableOpacity
                      onPress={() => handleUpgrade(tier.id)}
                      disabled={createCheckout.isPending}
                      style={{
                        backgroundColor: tier.color || primaryColor,
                        padding: 14,
                        borderRadius: borderRadius.md,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: colors.textInverse, fontWeight: '600', fontSize: 15 }}>
                        {createCheckout.isPending ? 'Processing...' : (tier.id === 'enterprise' ? 'Contact Sales' : `Upgrade to ${tier.name}`)}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
            
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Users Modal */}
      <Modal
        visible={usersModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setUsersModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setUsersModalVisible(false)}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Close</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>Users</Text>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView style={{ flex: 1, padding: spacing.lg }}>
            <View style={{ backgroundColor: colors.background, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: 20 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>User Breakdown</Text>
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.textSecondary }}>Total Users</Text>
                  <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{usersData?.total_users || 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.textSecondary }}>Admins</Text>
                  <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{usersData?.users_by_role?.admin || 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.textSecondary }}>RAs</Text>
                  <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{usersData?.users_by_role?.ra || 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.textSecondary }}>Students</Text>
                  <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{usersData?.users_by_role?.student || 0}</Text>
                </View>
              </View>
            </View>

            {usersData?.users?.map((user) => (
              <View
                key={user.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.background,
                  padding: 12,
                  borderRadius: borderRadius.md,
                  marginBottom: 8,
                }}
              >
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: primaryColor,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <Text style={{ color: colors.textInverse, fontWeight: 'bold' }}>
                    {user.first_name?.[0]}{user.last_name?.[0]}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary }}>
                    {user.first_name} {user.last_name}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>{user.email}</Text>
                </View>
                <View style={{
                  backgroundColor: user.role === 'admin' ? primaryColor + '15' : user.role === 'ra' ? primaryColor + '15' : colors.surfaceSecondary,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: borderRadius.sm,
                }}>
                  <Text style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: user.role === 'admin' ? primaryColor : user.role === 'ra' ? primaryColor : colors.textPrimary,
                    textTransform: 'uppercase',
                  }}>
                    {user.role}
                  </Text>
                </View>
              </View>
            ))}
            
            {(!usersData?.users || usersData.users.length === 0) && (
              <Text style={{ color: colors.textTertiary, textAlign: 'center', marginTop: 20 }}>No users found</Text>
            )}
            
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Activity Reports Modal */}
      <Modal
        visible={activityModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActivityModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setActivityModalVisible(false)}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Close</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>Activity Reports</Text>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView style={{ flex: 1, padding: spacing.lg }}>
            <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>
              Activity for {tenant?.name} (Last 30 days)
            </Text>

            {activityLoading ? (
              <ActivityIndicator size="large" color={primaryColor} style={{ marginTop: 40 }} />
            ) : activityData ? (
              <View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'Events', value: activityData.events || 0, icon: 'calendar', color: primaryColor },
                    { label: 'Announcements', value: activityData.announcements || 0, icon: 'megaphone', color: primaryColor },
                    { label: 'Messages', value: activityData.messages || 0, icon: 'chatbubbles', color: primaryColor },
                    { label: 'Maintenance', value: activityData.maintenance || 0, icon: 'construct', color: primaryColor },
                    { label: 'Bookings', value: activityData.bookings || 0, icon: 'bookmark', color: colors.error },
                    { label: 'Shoutouts', value: activityData.shoutouts || 0, icon: 'star', color: colors.warning },
                    { label: 'New Users', value: activityData.new_users || 0, icon: 'person-add', color: primaryColor },
                  ].map((stat) => (
                    <View
                      key={stat.label}
                      style={{
                        width: '47%',
                        backgroundColor: colors.background,
                        borderRadius: borderRadius.md,
                        padding: spacing.lg,
                      }}
                    >
                      <Ionicons name={stat.icon} size={24} color={stat.color} />
                      <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.textPrimary, marginTop: 8 }}>
                        {stat.value}
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.textSecondary }}>{stat.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <Ionicons name="analytics-outline" size={48} color={colors.borderDark} />
                <Text style={{ color: colors.textTertiary, marginTop: 12 }}>No activity data available</Text>
              </View>
            )}
            
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Add Activity Modal */}
      <Modal
        visible={addActivityModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddActivityModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setAddActivityModalVisible(false)}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>Add Activity</Text>
            <TouchableOpacity onPress={handleAddActivity} disabled={addActivity.isPending}>
              {addActivity.isPending ? (
                <ActivityIndicator size="small" color={primaryColor} />
              ) : (
                <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1, padding: spacing.lg }}>
            {/* Activity Type Selector */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 10 }}>Activity Type</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
              {ACTIVITY_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  onPress={() => setNewActivity({ ...newActivity, type: type.id })}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 12,
                    borderRadius: borderRadius.md,
                    backgroundColor: newActivity.type === type.id ? `${type.color}15` : colors.background,
                    borderWidth: 2,
                    borderColor: newActivity.type === type.id ? type.color : 'transparent',
                  }}
                >
                  <Ionicons name={type.icon} size={18} color={newActivity.type === type.id ? type.color : colors.textSecondary} />
                  <Text style={{ marginLeft: 6, fontSize: 13, fontWeight: '600', color: newActivity.type === type.id ? type.color : colors.textSecondary }}>
                    {type.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Activity Name */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Activity Name *</Text>
            <TextInput
              style={{
                backgroundColor: colors.background,
                borderRadius: borderRadius.md,
                padding: 14,
                fontSize: 16,
                color: colors.textPrimary,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: colors.border,
              }}
              placeholder="e.g., Basketball Club"
              placeholderTextColor={colors.textTertiary}
              value={newActivity.name}
              onChangeText={(text) => setNewActivity({ ...newActivity, name: text })}
            />

            {/* Description */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Description (optional)</Text>
            <TextInput
              style={{
                backgroundColor: colors.background,
                borderRadius: borderRadius.md,
                padding: 14,
                fontSize: 16,
                color: colors.textPrimary,
                minHeight: 100,
                borderWidth: 1,
                borderColor: colors.border,
                textAlignVertical: 'top',
              }}
              placeholder="Brief description of the activity..."
              placeholderTextColor={colors.textTertiary}
              multiline
              value={newActivity.description}
              onChangeText={(text) => setNewActivity({ ...newActivity, description: text })}
            />

            <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 16, textAlign: 'center' }}>
              Long press on an activity to remove it
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Contact Person Modal */}
      <Modal
        visible={contactModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setContactModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setContactModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.secondary} />
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>Change Contact Person</Text>
            <TouchableOpacity onPress={handleSaveContact} disabled={contactSaving}>
              <Text style={{ color: contactSaving ? colors.textTertiary : colors.primary, fontWeight: '600' }}>
                {contactSaving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: spacing.lg }}>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 20 }}>
              Update the primary contact (admin) for {tenant?.name}. Changing the email will also update the admin login credentials.
            </Text>

            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>Contact Name</Text>
            <TextInput
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: borderRadius.md,
                padding: 14,
                fontSize: 16,
                color: colors.textPrimary,
                marginBottom: 16,
              }}
              value={contactName}
              onChangeText={setContactName}
              placeholder="Full name"
              autoCapitalize="words"
            />

            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>Contact Email</Text>
            <TextInput
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: borderRadius.md,
                padding: 14,
                fontSize: 16,
                color: colors.textPrimary,
                marginBottom: 16,
              }}
              value={contactEmail}
              onChangeText={setContactEmail}
              placeholder="email@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={{
              backgroundColor: primaryColor + '15',
              borderWidth: 1,
              borderColor: colors.warning,
              borderRadius: borderRadius.md,
              padding: 12,
              marginTop: 8,
            }}>
              <Text style={{ fontSize: 13, color: primaryColor }}>
                If the email changes, the admin login for this college will be updated to use the new email address.
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Add Admin Modal */}
      <Modal visible={addAdminModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setAddAdminModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.secondary} />
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>Add Administrator</Text>
            <TouchableOpacity onPress={handleAddAdmin} disabled={addingAdmin}>
              <Text style={{ color: addingAdmin ? colors.textTertiary : colors.primary, fontWeight: '600' }}>
                {addingAdmin ? 'Sending...' : 'Send Invite'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: spacing.lg }}>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 20 }}>
              Add a new administrator to {tenant?.name}. They will receive an invitation email with login instructions.
            </Text>

            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>Full Name</Text>
            <TextInput
              style={{
                backgroundColor: colors.surfaceSecondary,
                borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md,
                padding: 14, fontSize: 16, color: colors.textPrimary, marginBottom: 16,
              }}
              value={newAdminName}
              onChangeText={setNewAdminName}
              placeholder="John Smith"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="words"
            />

            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>Email Address</Text>
            <TextInput
              style={{
                backgroundColor: colors.surfaceSecondary,
                borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md,
                padding: 14, fontSize: 16, color: colors.textPrimary, marginBottom: 16,
              }}
              value={newAdminEmail}
              onChangeText={setNewAdminEmail}
              placeholder="admin@college.edu"
              placeholderTextColor={colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={{
              backgroundColor: primaryColor + '15',
              borderRadius: borderRadius.md,
              padding: 12, marginTop: 8,
            }}>
              <Text style={{ fontSize: 13, color: primaryColor }}>
                The new admin will receive an email with an invite code to set up their account and will have full admin access to {tenant?.name}.
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
