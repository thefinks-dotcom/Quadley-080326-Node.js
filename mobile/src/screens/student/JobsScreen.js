import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  ActivityIndicator, TextInput, Modal, Alert, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedScreen } from '../../components/AnimatedScreen';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { colors as defaultColors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';

export default function JobsScreen({ navigation }) {
  const { branding } = useTenant();
  const { themeColors: colors } = useAppTheme();
  const primaryColor = branding?.primaryColor || colors.primary;
  const [activeTab, setActiveTab] = useState('available');
  const [searchQuery, setSearchQuery] = useState('');
  const [applyModalVisible, setApplyModalVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [applicationData, setApplicationData] = useState({
    why_interested: '', availability: '', experience: '', references: '',
  });
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: jobs, isLoading: loadingJobs, refetch: refetchJobs, isRefetching: refetchingJobs } = useQuery({
    queryKey: ['studentJobs'],
    queryFn: async () => {
      const response = await api.get(ENDPOINTS.JOBS);
      return response.data;
    },
  });

  const { data: myApplications, isLoading: loadingApplications, refetch: refetchApplications, isRefetching: refetchingApplications } = useQuery({
    queryKey: ['myJobApplications'],
    queryFn: async () => {
      const response = await api.get(`${ENDPOINTS.JOBS}/my/applications`);
      return response.data;
    },
  });

  const applyMutation = useMutation({
    mutationFn: async ({ jobId, data }) => {
      const formattedData = {
        ...data,
        references: data.references ? [{ name: data.references }] : [],
      };
      const response = await api.post(`${ENDPOINTS.JOBS}/${jobId}/apply`, formattedData);
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Application submitted successfully!');
      setApplyModalVisible(false);
      setSelectedJob(null);
      setApplicationData({ why_interested: '', availability: '', experience: '', references: '' });
      queryClient.invalidateQueries(['myJobApplications']);
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to submit application');
    },
  });

  const filteredJobs = jobs?.filter((job) =>
    job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.category?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const openApplyModal = (job) => {
    setSelectedJob(job);
    setApplyModalVisible(true);
  };

  const handleApply = () => {
    if (!applicationData.why_interested.trim() || !applicationData.availability.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    applyMutation.mutate({ jobId: selectedJob.id, data: applicationData });
  };

  const jobCount = filteredJobs?.length || 0;
  const appCount = myApplications?.length || 0;

  const renderJob = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('JobDetail', { job: item })}
      activeOpacity={0.7}
      data-testid={`job-${item.id}`}
      style={{
        backgroundColor: colors.surface, marginHorizontal: spacing.lg, marginBottom: spacing.md,
        borderRadius: borderRadius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border,
      }}>
      <View style={{ height: 3, backgroundColor: primaryColor }} />
      <View style={{ padding: spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary, letterSpacing: -0.2 }}>
              {item.title}
            </Text>
            {item.category && (
              <View style={{
                backgroundColor: primaryColor + '12', paddingHorizontal: 8, paddingVertical: 3,
                borderRadius: borderRadius.sm, alignSelf: 'flex-start', marginTop: 6,
              }}>
                <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '600' }}>{item.category}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            onPress={() => openApplyModal(item)}
            data-testid={`apply-job-${item.id}`}
            style={{
              backgroundColor: primaryColor, paddingHorizontal: 12, paddingVertical: 6,
              borderRadius: borderRadius.sm, marginLeft: spacing.sm,
            }}>
            <Text style={{ color: colors.textInverse, fontWeight: '600', fontSize: 13 }}>Apply</Text>
          </TouchableOpacity>
        </View>
        {item.description && (
          <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: spacing.sm, lineHeight: 18 }} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          marginTop: spacing.md, paddingTop: spacing.md,
          borderTopWidth: 1, borderTopColor: colors.borderLight,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
            <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 4, fontWeight: '500' }}>
              {item.hours_per_week} hrs/week
            </Text>
          </View>
          {item.pay_rate && (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="cash-outline" size={14} color={primaryColor} />
              <Text style={{ fontSize: 12, color: primaryColor, marginLeft: 4, fontWeight: '600' }}>
                {item.pay_rate}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderApplication = ({ item }) => (
    <View data-testid={`application-${item.id}`} style={{
      backgroundColor: colors.surface, marginHorizontal: spacing.lg, marginBottom: spacing.sm,
      borderRadius: borderRadius.lg, padding: spacing.lg, flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderColor: colors.border,
    }}>
      <View style={{
        width: 44, height: 44, backgroundColor: primaryColor + '12',
        borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md,
      }}>
        <Ionicons name="briefcase-outline" size={20} color={primaryColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary, letterSpacing: -0.2 }}>
          {item.job_title}
        </Text>
        <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
          Applied {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
      <View style={{
        backgroundColor: item.status === 'rejected' ? colors.errorLight : primaryColor + '15',
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: borderRadius.sm,
      }}>
        <Text style={{
          fontSize: 11, fontWeight: '600', textTransform: 'capitalize',
          color: item.status === 'rejected' ? colors.error : primaryColor,
        }}>
          {item.status || 'Pending'}
        </Text>
      </View>
    </View>
  );

  const isLoading = activeTab === 'available' ? loadingJobs : loadingApplications;
  const data = activeTab === 'available' ? filteredJobs : myApplications;

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={primaryColor} />
      </SafeAreaView>
    );
  }

  const ListHeader = (
    <View>
      {/* Hero Header */}
      <View style={{
        backgroundColor: primaryColor, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl,
        borderBottomLeftRadius: borderRadius.xxl, borderBottomRightRadius: borderRadius.xxl,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{
            width: 44, height: 44, backgroundColor: 'rgba(255,255,255,0.15)',
            borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center',
          }}>
            <Ionicons name="briefcase" size={22} color={colors.textInverse} />
          </View>
          <View style={{ marginLeft: spacing.md, flex: 1 }}>
            <Text style={{ color: colors.textInverse, fontSize: 20, fontWeight: '700', letterSpacing: -0.4 }}>Jobs</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2, fontWeight: '500' }}>
              {jobCount} available · {appCount} applied
            </Text>
          </View>
        </View>
        {activeTab === 'available' && (
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: borderRadius.md,
            paddingHorizontal: spacing.md, marginTop: spacing.md,
          }}>
            <Ionicons name="search" size={18} color="rgba(255,255,255,0.5)" />
            <TextInput
              data-testid="search-jobs-input"
              style={{
                flex: 1, paddingVertical: 10, paddingHorizontal: spacing.sm,
                fontSize: 15, color: colors.textInverse,
              }}
              placeholder="Search jobs..." placeholderTextColor="rgba(255,255,255,0.4)"
              value={searchQuery} onChangeText={setSearchQuery}
            />
          </View>
        )}
      </View>

      {/* Pill Tabs */}
      <View style={{
        flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.md,
        backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 3,
      }}>
        {[
          { key: 'available', label: 'Available', count: jobCount, icon: 'briefcase-outline' },
          { key: 'applications', label: 'Applications', count: appCount, icon: 'document-text-outline' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            data-testid={`tab-${tab.key}`}
            style={{
              flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              paddingVertical: spacing.sm + 2, borderRadius: borderRadius.sm + 2,
              backgroundColor: activeTab === tab.key ? colors.surface : 'transparent',
              ...(activeTab === tab.key ? shadows.sm : {}),
            }}>
            <Ionicons name={tab.icon} size={16} color={activeTab === tab.key ? primaryColor : colors.textTertiary} />
            <Text style={{
              marginLeft: 6, fontWeight: '600', fontSize: 13,
              color: activeTab === tab.key ? colors.textPrimary : colors.textTertiary,
            }}>
              {tab.label}
            </Text>
            <View style={{
              backgroundColor: activeTab === tab.key ? primaryColor + '18' : colors.border,
              paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, marginLeft: 6,
            }}>
              <Text style={{
                fontSize: 11, fontWeight: '700',
                color: activeTab === tab.key ? primaryColor : colors.textTertiary,
              }}>
                {tab.count}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']} data-testid="jobs-screen">
      <AnimatedScreen>
      {/* List — header is inside FlatList so pull-to-refresh works from the top */}
      <FlatList
        data={data}
        keyExtractor={(item, index) => item.id || `item-${index}`}
        renderItem={activeTab === 'available' ? renderJob : renderApplication}
        ListHeaderComponent={ListHeader}
        refreshControl={
          <RefreshControl
            refreshing={refetchingJobs || refetchingApplications}
            onRefresh={() => { refetchJobs(); refetchApplications(); }}
            tintColor={primaryColor}
            colors={[primaryColor]}
          />
        }
        ListEmptyComponent={
          <View style={{ padding: spacing.xxxl, alignItems: 'center' }}>
            <View style={{
              width: 56, height: 56, backgroundColor: colors.surfaceSecondary,
              borderRadius: borderRadius.lg, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg,
            }}>
              <Ionicons
                name={activeTab === 'available' ? 'briefcase-outline' : 'document-text-outline'}
                size={24} color={colors.textTertiary}
              />
            </View>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 }}>
              {activeTab === 'available' ? 'No jobs available' : 'No applications yet'}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textTertiary, textAlign: 'center' }}>
              {activeTab === 'available' ? 'Check back later for new opportunities' : 'Apply to jobs to track your applications'}
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 80 }}
      />
      </AnimatedScreen>

      {/* Apply Modal */}
      <Modal visible={applyModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setApplyModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border,
            }}>
              <TouchableOpacity onPress={() => setApplyModalVisible(false)}>
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>Apply</Text>
              <TouchableOpacity onPress={handleApply} disabled={applyMutation.isPending}>
                <Text style={{ color: applyMutation.isPending ? colors.textTertiary : primaryColor, fontSize: 16, fontWeight: '600' }}>
                  {applyMutation.isPending ? 'Sending...' : 'Submit'}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 150 }} keyboardShouldPersistTaps="handled">
              <View style={{
                backgroundColor: primaryColor + '10', padding: spacing.lg, borderRadius: borderRadius.md,
                marginBottom: spacing.xl, borderWidth: 1, borderColor: primaryColor + '20',
              }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 }}>
                  {selectedJob?.title}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textTertiary }}>{selectedJob?.category}</Text>
              </View>

              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>Why are you interested? *</Text>
              <TextInput
                data-testid="input-why-interested"
                style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 15, color: colors.textPrimary, height: 100, textAlignVertical: 'top', marginBottom: 16 }}
                multiline placeholder="Tell us why you're interested..." placeholderTextColor={colors.textTertiary}
                value={applicationData.why_interested} onChangeText={(t) => setApplicationData({ ...applicationData, why_interested: t })}
              />

              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>Availability *</Text>
              <TextInput
                data-testid="input-availability"
                style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 15, color: colors.textPrimary, height: 80, textAlignVertical: 'top', marginBottom: 16 }}
                multiline placeholder="When are you available to work?" placeholderTextColor={colors.textTertiary}
                value={applicationData.availability} onChangeText={(t) => setApplicationData({ ...applicationData, availability: t })}
              />

              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>Relevant Experience (Optional)</Text>
              <TextInput
                data-testid="input-experience"
                style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 15, color: colors.textPrimary, height: 80, textAlignVertical: 'top', marginBottom: 16 }}
                multiline placeholder="Any relevant experience..." placeholderTextColor={colors.textTertiary}
                value={applicationData.experience} onChangeText={(t) => setApplicationData({ ...applicationData, experience: t })}
              />

              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>References (Optional)</Text>
              <TextInput
                data-testid="input-references"
                style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 15, color: colors.textPrimary, height: 80, textAlignVertical: 'top', marginBottom: 24 }}
                multiline placeholder="List any references..." placeholderTextColor={colors.textTertiary}
                value={applicationData.references} onChangeText={(t) => setApplicationData({ ...applicationData, references: t })}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
