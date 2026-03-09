import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { useTenant } from '../../contexts/TenantContext';

export default function AdminJobsScreen() {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const [activeTab, setActiveTab] = useState('jobs');
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [applicationDetailVisible, setApplicationDetailVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newJob, setNewJob] = useState({
    title: '',
    description: '',
    category: 'General',
    hours_per_week: '',
    pay_rate: '',
  });
  const queryClient = useQueryClient();

  const { data: jobs, isLoading: loadingJobs, refetch: refetchJobs, isRefetching: refetchingJobs } = useQuery({
    queryKey: ['adminJobs'],
    queryFn: async () => {
      const response = await api.get(ENDPOINTS.JOBS);
      return response.data;
    },
  });

  const { data: applications, isLoading: loadingApps, refetch: refetchApps } = useQuery({
    queryKey: ['adminJobApplications'],
    queryFn: async () => {
      const response = await api.get(`${ENDPOINTS.JOBS}/admin/all-applications`);
      return response.data;
    },
  });

  const createJob = useMutation({
    mutationFn: async (data) => {
      const payload = {
        title: data.title,
        description: data.description,
        category: data.category,
        hours_per_week: data.hours_per_week ? parseInt(data.hours_per_week) : null,
        pay_rate: data.pay_rate || null,
      };
      const response = await api.post(ENDPOINTS.JOBS, payload);
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Job posted successfully!');
      setModalVisible(false);
      setNewJob({ title: '', description: '', category: 'General', hours_per_week: '', pay_rate: '' });
      queryClient.invalidateQueries(['adminJobs']);
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create job');
    },
  });

  const updateJob = useMutation({
    mutationFn: async ({ jobId, data }) => {
      const response = await api.patch(`${ENDPOINTS.JOBS}/${jobId}`, data);
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Job updated successfully!');
      setEditModalVisible(false);
      setSelectedJob(null);
      queryClient.invalidateQueries(['adminJobs']);
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update job');
    },
  });

  const deleteJob = useMutation({
    mutationFn: async (jobId) => {
      const response = await api.delete(`${ENDPOINTS.JOBS}/${jobId}`);
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Job deleted successfully!');
      queryClient.invalidateQueries(['adminJobs']);
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to delete job');
    },
  });

  const updateApplicationStatus = useMutation({
    mutationFn: async ({ applicationId, status }) => {
      const response = await api.patch(`${ENDPOINTS.JOBS}/applications/${applicationId}/status`, { status });
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Application status updated!');
      queryClient.invalidateQueries(['adminJobApplications']);
      queryClient.invalidateQueries(['adminJobs']);
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update status');
    },
  });

  const handleCreate = () => {
    if (!newJob.title.trim() || !newJob.description.trim()) {
      Alert.alert('Error', 'Please fill in title and description');
      return;
    }
    createJob.mutate(newJob);
  };

  const handleEditJob = (job) => {
    setSelectedJob({
      ...job,
      hours_per_week: job.hours_per_week?.toString() || '',
      pay_rate: job.pay_rate || '',
    });
    setEditModalVisible(true);
  };

  const handleDeleteJob = (job) => {
    Alert.alert(
      'Delete Job',
      `Are you sure you want to delete "${job.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteJob.mutate(job.id) },
      ]
    );
  };

  const handleSaveEdit = () => {
    if (!selectedJob.title.trim() || !selectedJob.description.trim()) {
      Alert.alert('Error', 'Please fill in title and description');
      return;
    }
    updateJob.mutate({
      jobId: selectedJob.id,
      data: {
        title: selectedJob.title,
        description: selectedJob.description,
        category: selectedJob.category,
        hours_per_week: selectedJob.hours_per_week ? parseInt(selectedJob.hours_per_week) : null,
        pay_rate: selectedJob.pay_rate || null,
        status: selectedJob.status,
      },
    });
  };

  const handleViewApplication = (application) => {
    setSelectedApplication(application);
    setApplicationDetailVisible(true);
  };

  const handleStatusChange = (application, newStatus) => {
    updateApplicationStatus.mutate({ applicationId: application.id, status: newStatus });
    setApplicationDetailVisible(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return primaryColor;
      case 'reviewing': return primaryColor;
      case 'interview': return primaryColor;
      case 'accepted': return primaryColor;
      case 'rejected': return colors.error;
      default: return colors.textSecondary;
    }
  };

  // Filter out accepted jobs from listing
  const activeJobs = jobs?.filter(job => {
    // Check if any application for this job is accepted
    const hasAcceptedApplication = applications?.some(
      app => app.job_id === job.id && app.status === 'accepted'
    );
    return !hasAcceptedApplication;
  }) || [];

  const renderJob = ({ item }) => (
    <TouchableOpacity 
      onPress={() => handleEditJob(item)}
      style={{ backgroundColor: colors.surface, marginHorizontal: spacing.lg, marginBottom: spacing.md, borderRadius: borderRadius.lg, padding: spacing.lg }}
      data-testid={`job-${item.id}`}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>{item.title}</Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>{item.category}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ backgroundColor: item.status === 'active' ? primaryColor + '15' : colors.errorLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.md, marginRight: 8 }}>
            <Text style={{ color: item.status === 'active' ? primaryColor : colors.error, fontWeight: '500', fontSize: 12, textTransform: 'capitalize' }}>
              {item.status}
            </Text>
          </View>
          <TouchableOpacity onPress={() => handleDeleteJob(item)} style={{ padding: 4 }}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 8 }} numberOfLines={2}>{item.description}</Text>
      {item.status !== 'active' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: colors.warning + '15', paddingHorizontal: 10, paddingVertical: 5, borderRadius: borderRadius.sm, alignSelf: 'flex-start' }}>
          <Ionicons name="eye-off-outline" size={14} color={colors.warning} />
          <Text style={{ fontSize: 12, color: colors.warning, fontWeight: '600', marginLeft: 4 }}>Hidden from students — tap to change to Active</Text>
        </View>
      )}
      <View style={{ flexDirection: 'row', marginTop: 12 }}>
        {item.hours_per_week && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
            <Ionicons name="time-outline" size={16} color={colors.secondary} />
            <Text style={{ color: colors.textSecondary, marginLeft: 4 }}>{item.hours_per_week} hrs/week</Text>
          </View>
        )}
        {item.pay_rate && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="cash-outline" size={16} color={primaryColor} />
            <Text style={{ color: primaryColor, marginLeft: 4, fontWeight: '500' }}>{item.pay_rate}</Text>
          </View>
        )}
      </View>
      <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 8 }}>Tap to edit</Text>
    </TouchableOpacity>
  );

  const renderApplication = ({ item }) => (
    <TouchableOpacity
      onPress={() => handleViewApplication(item)}
      style={{ backgroundColor: colors.surface, marginHorizontal: spacing.lg, marginBottom: spacing.md, borderRadius: borderRadius.lg, padding: spacing.lg }}
      data-testid={`application-${item.id}`}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>{item.applicant_name}</Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>Applied for: {item.job_title}</Text>
        </View>
        <View style={{ backgroundColor: `${getStatusColor(item.status)}20`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.md }}>
          <Text style={{ color: getStatusColor(item.status), fontWeight: '500', fontSize: 12, textTransform: 'capitalize' }}>
            {item.status}
          </Text>
        </View>
      </View>
      <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 8 }}>Tap to update status</Text>
    </TouchableOpacity>
  );

  const isLoading = activeTab === 'jobs' ? loadingJobs : loadingApps;
  
  // Filter applications by search query (applicant name)
  const filteredApplications = applications?.filter((app) =>
    app.applicant_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.job_title?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];
  
  const data = activeTab === 'jobs' ? activeJobs : filteredApplications;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }} edges={['bottom']}>
      {/* Search Bar for Applications */}
      {activeTab === 'applications' && (
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surfaceSecondary,
              borderRadius: borderRadius.md,
              paddingHorizontal: 12,
            }}
          >
            <Ionicons name="search" size={20} color={colors.textTertiary} />
            <TextInput
              style={{
                flex: 1,
                paddingVertical: 12,
                paddingHorizontal: 8,
                fontSize: 16,
                color: colors.textPrimary,
              }}
              placeholder="Search by applicant or job..."
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
      )}

      {/* Tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: colors.surface, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <TouchableOpacity
          onPress={() => setActiveTab('jobs')}
          style={{ flex: 1, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: activeTab === 'jobs' ? primaryColor : 'transparent' }}
        >
          <Text style={{ textAlign: 'center', fontWeight: '600', color: activeTab === 'jobs' ? primaryColor : colors.textSecondary }}>Jobs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('applications')}
          style={{ flex: 1, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: activeTab === 'applications' ? primaryColor : 'transparent' }}
        >
          <Text style={{ textAlign: 'center', fontWeight: '600', color: activeTab === 'applications' ? primaryColor : colors.textSecondary }}>
            Applications {applications?.length > 0 && `(${applications.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, index) => item.id || `item-${index}`}
          renderItem={activeTab === 'jobs' ? renderJob : renderApplication}
          refreshControl={
            <RefreshControl refreshing={refetchingJobs} onRefresh={() => { refetchJobs(); refetchApps(); }} />
          }
          ListEmptyComponent={
            <View style={{ padding: spacing.xxl, alignItems: 'center' }}>
              <Ionicons name="briefcase-outline" size={48} color={colors.textTertiary} />
              <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 12 }}>
                {activeTab === 'jobs' ? 'No jobs posted' : 'No applications yet'}
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingVertical: 16 }}
        />
      )}

      {activeTab === 'jobs' && (
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={{
            position: 'absolute', bottom: 24, right: 24, width: 56, height: 56,
            backgroundColor: primaryColor, borderRadius: 28, justifyContent: 'center', alignItems: 'center',
            shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8,
          }}
        >
          <Ionicons name="add" size={28} color={colors.surface} />
        </TouchableOpacity>
      )}

      {/* Create Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>Post Job</Text>
            <TouchableOpacity onPress={handleCreate} disabled={createJob.isPending}>
              <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>{createJob.isPending ? 'Posting...' : 'Post'}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, padding: spacing.lg }}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Job Title *</Text>
            <TextInput
              style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary, marginBottom: 16 }}
              placeholder="e.g., Library Assistant"
              placeholderTextColor={colors.textTertiary}
              value={newJob.title}
              onChangeText={(text) => setNewJob({ ...newJob, title: text })}
            />

            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Category</Text>
            <TextInput
              style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary, marginBottom: 16 }}
              placeholder="e.g., Administrative"
              placeholderTextColor={colors.textTertiary}
              value={newJob.category}
              onChangeText={(text) => setNewJob({ ...newJob, category: text })}
            />

            <View style={{ flexDirection: 'row', marginBottom: 16 }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Hours/Week *</Text>
                <TextInput
                  style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary }}
                  placeholder="10"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                  value={newJob.hours_per_week}
                  onChangeText={(text) => setNewJob({ ...newJob, hours_per_week: text })}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Pay Rate (Optional)</Text>
                <TextInput
                  style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary }}
                  placeholder="e.g., $15/hr"
                  placeholderTextColor={colors.textTertiary}
                  value={newJob.pay_rate}
                  onChangeText={(text) => setNewJob({ ...newJob, pay_rate: text })}
                />
              </View>
            </View>

            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Description *</Text>
            <TextInput
              style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary, height: 120, textAlignVertical: 'top' }}
              multiline
              placeholder="Job description and requirements..."
              placeholderTextColor={colors.textTertiary}
              value={newJob.description}
              onChangeText={(text) => setNewJob({ ...newJob, description: text })}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Edit Job Modal */}
      <Modal visible={editModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => { setEditModalVisible(false); setSelectedJob(null); }}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>Edit Job</Text>
            <TouchableOpacity onPress={handleSaveEdit} disabled={updateJob.isPending}>
              <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>
                {updateJob.isPending ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Title *</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}
              placeholder="Job title"
              value={selectedJob?.title || ''}
              onChangeText={(text) => setSelectedJob({ ...selectedJob, title: text })}
            />

            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Category</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
              {['General', 'Dining', 'Library', 'Gym', 'Office', 'Events', 'Tech'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setSelectedJob({ ...selectedJob, category: cat })}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                    backgroundColor: selectedJob?.category === cat ? primaryColor : colors.surfaceSecondary,
                    marginRight: 8, marginBottom: 8,
                  }}
                >
                  <Text style={{ color: selectedJob?.category === cat ? colors.surface : colors.textSecondary, fontWeight: '500' }}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Status</Text>
            <View style={{ flexDirection: 'row', marginBottom: 16 }}>
              {['active', 'draft', 'closed'].map((status) => (
                <TouchableOpacity
                  key={status}
                  onPress={() => setSelectedJob({ ...selectedJob, status })}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                    backgroundColor: selectedJob?.status === status
                      ? (status === 'active' ? primaryColor : status === 'draft' ? colors.warning : colors.error)
                      : colors.surfaceSecondary,
                    marginRight: 8,
                  }}
                >
                  <Text style={{ color: selectedJob?.status === status ? colors.surface : colors.textSecondary, fontWeight: '500', textTransform: 'capitalize' }}>{status}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', marginBottom: 16 }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Hours/Week</Text>
                <TextInput
                  style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border }}
                  placeholder="e.g., 10"
                  keyboardType="numeric"
                  value={selectedJob?.hours_per_week || ''}
                  onChangeText={(text) => setSelectedJob({ ...selectedJob, hours_per_week: text })}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Pay Rate</Text>
                <TextInput
                  style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border }}
                  placeholder="e.g., $15/hr"
                  value={selectedJob?.pay_rate || ''}
                  onChangeText={(text) => setSelectedJob({ ...selectedJob, pay_rate: text })}
                />
              </View>
            </View>

            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Description *</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary, height: 120, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.border }}
              multiline
              placeholder="Job description..."
              value={selectedJob?.description || ''}
              onChangeText={(text) => setSelectedJob({ ...selectedJob, description: text })}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Application Detail Modal */}
      <Modal visible={applicationDetailVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => { setApplicationDetailVisible(false); setSelectedApplication(null); }}>
              <Ionicons name="close" size={24} color={colors.secondary} />
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>Application Details</Text>
            <View style={{ width: 24 }} />
          </View>

          {selectedApplication && (
            <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
              {/* Applicant Info */}
              <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: 16 }}>
                <Text style={{ fontSize: 20, fontWeight: '600', color: colors.textPrimary }}>{selectedApplication.applicant_name}</Text>
                <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>{selectedApplication.applicant_email}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                  <View style={{ backgroundColor: `${getStatusColor(selectedApplication.status)}20`, paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.md }}>
                    <Text style={{ color: getStatusColor(selectedApplication.status), fontWeight: '600', textTransform: 'capitalize' }}>
                      {selectedApplication.status}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Job Info */}
              <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 8 }}>Applied For</Text>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>{selectedApplication.job_title}</Text>
              </View>

              {/* Cover Letter / Message */}
              {selectedApplication.cover_letter && (
                <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 8 }}>Cover Letter</Text>
                  <Text style={{ fontSize: 14, color: colors.textPrimary, lineHeight: 22 }}>{selectedApplication.cover_letter}</Text>
                </View>
              )}

              {/* Experience */}
              {selectedApplication.experience && (
                <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 8 }}>Experience</Text>
                  <Text style={{ fontSize: 14, color: colors.textPrimary, lineHeight: 22 }}>{selectedApplication.experience}</Text>
                </View>
              )}

              {/* Availability */}
              {selectedApplication.availability && (
                <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 8 }}>Availability</Text>
                  <Text style={{ fontSize: 14, color: colors.textPrimary }}>{selectedApplication.availability}</Text>
                </View>
              )}

              {/* Status Actions */}
              <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.md }}>Update Status</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {['pending', 'reviewing', 'interview', 'accepted', 'rejected'].map((status) => (
                    <TouchableOpacity
                      key={status}
                      onPress={() => handleStatusChange(selectedApplication, status)}
                      disabled={updateApplicationStatus.isPending}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: borderRadius.md,
                        backgroundColor: selectedApplication.status === status ? getStatusColor(status) : `${getStatusColor(status)}20`,
                        marginRight: 8,
                        marginBottom: 8,
                      }}
                    >
                      <Text style={{ 
                        color: selectedApplication.status === status ? colors.surface : getStatusColor(status), 
                        fontWeight: '600', 
                        textTransform: 'capitalize' 
                      }}>
                        {status}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
