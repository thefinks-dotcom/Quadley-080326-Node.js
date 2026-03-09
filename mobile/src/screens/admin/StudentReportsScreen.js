import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  FlatList,
  Modal,
  Alert,
  Linking,
} from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import debounce from 'lodash/debounce';
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import { generateReportCSV, exportAsCSV, getExportFilename } from '../../utils/exportUtils';
import { useTenant } from '../../contexts/TenantContext';

export default function StudentReportsScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Debounce search
  const debouncedSearch = useCallback(
    debounce((text) => setDebouncedQuery(text), 300),
    []
  );

  const handleSearchChange = (text) => {
    setSearchQuery(text);
    debouncedSearch(text);
  };

  // Fetch available years
  const { data: yearsData } = useQuery({
    queryKey: ['reportYears'],
    queryFn: async () => {
      const response = await api.get(`${ENDPOINTS.STUDENT_REPORTS}/years`);
      return response.data;
    },
  });

  // Fetch available floors
  const { data: floorsData } = useQuery({
    queryKey: ['reportFloors'],
    queryFn: async () => {
      const response = await api.get(`${ENDPOINTS.STUDENT_REPORTS}/floors`);
      return response.data;
    },
  });

  // Fetch activity types
  const { data: activityTypes } = useQuery({
    queryKey: ['activityTypes'],
    queryFn: async () => {
      const response = await api.get(`${ENDPOINTS.STUDENT_REPORTS}/activity-types`);
      return response.data;
    },
  });

  // Search students
  const { data: searchResults, isLoading, refetch } = useQuery({
    queryKey: ['studentSearch', debouncedQuery, selectedYear, selectedFloor, selectedActivity],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedQuery) params.append('query', debouncedQuery);
      if (selectedYear) params.append('year', selectedYear);
      if (selectedFloor) params.append('floor', selectedFloor);
      if (selectedActivity) params.append('activity_type', selectedActivity);
      params.append('include_inactive', 'true');
      
      const response = await api.get(`${ENDPOINTS.STUDENT_REPORTS}/search?${params.toString()}`);
      return response.data;
    },
  });

  // Fetch student detail
  const { data: studentDetail, isLoading: loadingDetail, refetch: refetchDetail } = useQuery({
    queryKey: ['studentDetail', selectedStudent?.student_id],
    queryFn: async () => {
      if (!selectedStudent?.student_id) return null;
      const response = await api.get(`${ENDPOINTS.STUDENT_REPORTS}/student/${selectedStudent.student_id}`);
      return response.data;
    },
    enabled: !!selectedStudent?.student_id,
  });

  const students = searchResults?.students || [];

  const handleExportCSV = async () => {
    if (!students || students.length === 0) {
      Alert.alert('No Data', 'No students to export');
      return;
    }
    
    setExporting(true);
    try {
      const sections = [
        {
          title: 'Student Report',
          type: 'table',
          headers: ['name', 'email', 'floor', 'room', 'year', 'role', 'event_count', 'announcement_reads', 'last_activity'],
          data: students.map(s => ({
            name: `${s.first_name || ''} ${s.last_name || ''}`.trim(),
            email: s.email,
            floor: s.floor || 'N/A',
            room: s.room || 'N/A',
            year: s.year || 'N/A',
            role: s.role || 'student',
            event_count: s.event_rsvps || 0,
            announcement_reads: s.announcement_reads || 0,
            last_activity: s.last_activity ? formatDate(s.last_activity) : 'N/A',
          }))
        }
      ];
      
      const csvContent = generateReportCSV(sections);
      const filename = getExportFilename('student_report');
      await exportAsCSV(csvContent, filename);
    } catch (error) {
      Alert.alert('Export Failed', error.message || 'Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setSelectedYear(null);
    setSelectedFloor(null);
    setSelectedActivity(null);
    setFilterModalVisible(false);
  };

  const activeFiltersCount = [selectedYear, selectedFloor, selectedActivity].filter(Boolean).length;

  const renderStudent = ({ item }) => (
    <TouchableOpacity
      onPress={() => {
        setSelectedStudent(item);
        setDetailModalVisible(true);
      }}
      style={{
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        padding: spacing.lg,
        marginBottom: spacing.md,
        shadowColor: colors.textPrimary,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
            {item.first_name} {item.last_name}
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 2 }}>{item.email}</Text>
          <View style={{ flexDirection: 'row', marginTop: 8, flexWrap: 'wrap', gap: 6 }}>
            <View style={{ backgroundColor: primaryColor + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.md }}>
              <Text style={{ fontSize: 12, color: primaryColor, textTransform: 'capitalize' }}>{item.role}</Text>
            </View>
            {item.floor && (
              <View style={{ backgroundColor: primaryColor + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.md }}>
                <Text style={{ fontSize: 12, color: primaryColor }}>{item.floor}</Text>
              </View>
            )}
            {item.enrollment_year && (
              <View style={{ backgroundColor: primaryColor + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.md }}>
                <Text style={{ fontSize: 12, color: primaryColor }}>Class of {item.enrollment_year}</Text>
              </View>
            )}
            {!item.is_active && (
              <View style={{ backgroundColor: colors.errorLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.md }}>
                <Text style={{ fontSize: 12, color: colors.error }}>Inactive</Text>
              </View>
            )}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: primaryColor }}>{item.total_activities}</Text>
          <Text style={{ fontSize: 11, color: colors.textSecondary }}>Activities</Text>
        </View>
      </View>
      
      {/* Activity mini-stats */}
      <View style={{ flexDirection: 'row', marginTop: 12, flexWrap: 'wrap', gap: 12 }}>
        {item.activity_counts.events_attended > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="calendar" size={14} color={primaryColor} />
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 4 }}>{item.activity_counts.events_attended} events</Text>
          </View>
        )}
        {item.activity_counts.clubs_joined > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="people" size={14} color={primaryColor} />
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 4 }}>{item.activity_counts.clubs_joined} clubs</Text>
          </View>
        )}
        {item.activity_counts.jobs_held > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="briefcase" size={14} color={colors.warning} />
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 4 }}>{item.activity_counts.jobs_held} jobs</Text>
          </View>
        )}
        {(item.activity_counts.mentoring_sessions > 0 || item.activity_counts.tutoring_sessions > 0) && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="school" size={14} color={primaryColor} />
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 4 }}>
              {item.activity_counts.mentoring_sessions + item.activity_counts.tutoring_sessions} academic
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const ActivitySection = ({ title, icon, color, items, renderItem }) => {
    if (!items || items.length === 0) return null;
    return (
      <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Ionicons name={icon} size={18} color={color} />
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginLeft: 8 }}>{title}</Text>
          <View style={{ backgroundColor: color + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.md, marginLeft: 8 }}>
            <Text style={{ fontSize: 12, color: color, fontWeight: '600' }}>{items.length}</Text>
          </View>
        </View>
        {items.slice(0, 5).map((item, index) => (
          <View key={index} style={{ backgroundColor: colors.background, padding: 10, borderRadius: borderRadius.sm, marginBottom: 6 }}>
            {renderItem(item)}
          </View>
        ))}
        {items.length > 5 && (
          <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: 4 }}>
            +{items.length - 5} more
          </Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={{
        backgroundColor: primaryColor,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color={colors.surface} />
          </TouchableOpacity>
          <Text style={{ color: colors.textInverse, fontSize: 20, fontWeight: 'bold', flex: 1 }}>Student Reports</Text>
          <TouchableOpacity 
            onPress={handleExportCSV} 
            disabled={exporting}
            style={{ 
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: exporting ? 'rgba(255,255,255,0.3)' : primaryColor,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 20,
            }}
            data-testid="export-student-reports-btn"
          >
            {exporting ? (
              <ActivityIndicator size="small" color={colors.surface} />
            ) : (
              <Ionicons name="download-outline" size={18} color={colors.surface} />
            )}
            <Text style={{ color: colors.textInverse, fontWeight: '600', marginLeft: 4, fontSize: 13 }}>Export</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={{
          flexDirection: 'row',
          backgroundColor: 'rgba(255,255,255,0.2)',
          borderRadius: borderRadius.md,
          alignItems: 'center',
          paddingHorizontal: 12,
        }}>
          <Ionicons name="search" size={20} color="rgba(255,255,255,0.8)" />
          <TextInput
            style={{
              flex: 1,
              color: colors.textInverse,
              paddingVertical: 12,
              paddingHorizontal: 8,
              fontSize: 16,
            }}
            placeholder="Search by name or email..."
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={searchQuery}
            onChangeText={handleSearchChange}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); setDebouncedQuery(''); }}>
              <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Button */}
        <TouchableOpacity
          onPress={() => setFilterModalVisible(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: activeFiltersCount > 0 ? colors.surface : 'rgba(255,255,255,0.2)',
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 20,
            alignSelf: 'flex-start',
            marginTop: 12,
          }}
        >
          <Ionicons name="filter" size={18} color={activeFiltersCount > 0 ? primaryColor : colors.surface} />
          <Text style={{ color: activeFiltersCount > 0 ? primaryColor : colors.surface, marginLeft: 6, fontWeight: '500' }}>
            Filters {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      <View style={{ flex: 1, padding: spacing.lg }}>
        {isLoading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={primaryColor} />
          </View>
        ) : (
          <>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: spacing.md }}>
              {searchResults?.total || 0} students found
            </Text>
            <FlatList
              data={searchResults?.students || []}
              keyExtractor={(item, index) => item.student_id || `student-${index}`}
              renderItem={renderStudent}
              refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
              ListEmptyComponent={
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Ionicons name="people-outline" size={48} color={colors.borderDark} />
                  <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 12 }}>No students found</Text>
                </View>
              }
            />
          </>
        )}
      </View>

      {/* Filter Modal */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={clearFilters}>
              <Text style={{ color: colors.error, fontSize: 16 }}>Clear</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>Filters</Text>
            <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
              <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, padding: spacing.lg }}>
            {/* Year Filter */}
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>Enrollment Year</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 24, gap: 8 }}>
              <TouchableOpacity
                onPress={() => setSelectedYear(null)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 20,
                  backgroundColor: !selectedYear ? primaryColor : colors.surfaceSecondary,
                }}
              >
                <Text style={{ color: !selectedYear ? colors.surface : colors.textSecondary, fontWeight: '500' }}>All Years</Text>
              </TouchableOpacity>
              {yearsData?.years?.map((y) => (
                <TouchableOpacity
                  key={y.year}
                  onPress={() => setSelectedYear(y.year)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    backgroundColor: selectedYear === y.year ? primaryColor : colors.surfaceSecondary,
                  }}
                >
                  <Text style={{ color: selectedYear === y.year ? colors.surface : colors.textSecondary, fontWeight: '500' }}>
                    {y.year} ({y.student_count})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Floor Filter */}
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>Floor</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 24, gap: 8 }}>
              <TouchableOpacity
                onPress={() => setSelectedFloor(null)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 20,
                  backgroundColor: !selectedFloor ? primaryColor : colors.surfaceSecondary,
                }}
              >
                <Text style={{ color: !selectedFloor ? colors.surface : colors.textSecondary, fontWeight: '500' }}>All Floors</Text>
              </TouchableOpacity>
              {floorsData?.floors?.map((f) => (
                <TouchableOpacity
                  key={f.floor}
                  onPress={() => setSelectedFloor(f.floor)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    backgroundColor: selectedFloor === f.floor ? primaryColor : colors.surfaceSecondary,
                  }}
                >
                  <Text style={{ color: selectedFloor === f.floor ? colors.surface : colors.textSecondary, fontWeight: '500' }}>
                    {f.floor} ({f.student_count})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Activity Type Filter */}
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>Activity Type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 24, gap: 8 }}>
              <TouchableOpacity
                onPress={() => setSelectedActivity(null)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 20,
                  backgroundColor: !selectedActivity ? primaryColor : colors.surfaceSecondary,
                }}
              >
                <Text style={{ color: !selectedActivity ? colors.surface : colors.textSecondary, fontWeight: '500' }}>All Activities</Text>
              </TouchableOpacity>
              {activityTypes?.activity_types?.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  onPress={() => setSelectedActivity(a.id)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    backgroundColor: selectedActivity === a.id ? primaryColor : colors.surfaceSecondary,
                  }}
                >
                  <Text style={{ color: selectedActivity === a.id ? colors.surface : colors.textSecondary, fontWeight: '500' }}>{a.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Student Detail Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ width: 60 }} />
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>Student Activity</Text>
            <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
              <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>Close</Text>
            </TouchableOpacity>
          </View>
          
          {loadingDetail ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={primaryColor} />
            </View>
          ) : studentDetail ? (
            <ScrollView style={{ flex: 1, padding: spacing.lg }}>
              {/* Student Info */}
              <View style={{ backgroundColor: primaryColor + '15', padding: spacing.lg, borderRadius: borderRadius.lg, marginBottom: 16 }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.textPrimary }}>
                  {studentDetail.student.first_name} {studentDetail.student.last_name}
                </Text>
                <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>{studentDetail.student.email}</Text>
                <View style={{ flexDirection: 'row', marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
                  <View style={{ backgroundColor: primaryColor + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.lg }}>
                    <Text style={{ color: primaryColor, textTransform: 'capitalize' }}>{studentDetail.student.role}</Text>
                  </View>
                  {studentDetail.student.floor && (
                    <View style={{ backgroundColor: primaryColor + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.lg }}>
                      <Text style={{ color: primaryColor }}>{studentDetail.student.floor}</Text>
                    </View>
                  )}
                  {studentDetail.student.enrollment_year && (
                    <View style={{ backgroundColor: primaryColor + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.lg }}>
                      <Text style={{ color: primaryColor }}>Class of {studentDetail.student.enrollment_year}</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Activity Summary */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16, gap: 8 }}>
                {Object.entries(studentDetail.activity_summary).map(([key, value]) => (
                  <View key={key} style={{ backgroundColor: colors.surfaceSecondary, padding: 12, borderRadius: borderRadius.md, minWidth: '30%' }}>
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.textPrimary }}>{value}</Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</Text>
                  </View>
                ))}
              </View>

              {/* Activity Details */}
              <ActivitySection
                title="Events Attended"
                icon="calendar"
                color={primaryColor}
                items={studentDetail.activities.events}
                renderItem={(item) => (
                  <>
                    <Text style={{ fontWeight: '500', color: colors.textPrimary }}>{item.title}</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>{item.date} • {item.category}</Text>
                  </>
                )}
              />

              <ActivitySection
                title="Jobs & Positions"
                icon="briefcase"
                color={colors.warning}
                items={studentDetail.activities.jobs}
                renderItem={(item) => (
                  <>
                    <Text style={{ fontWeight: '500', color: colors.textPrimary }}>{item.title}</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>Status: {item.status} • {item.category}</Text>
                  </>
                )}
              />

              <ActivitySection
                title="Clubs & Societies"
                icon="people"
                color={primaryColor}
                items={studentDetail.activities.clubs}
                renderItem={(item) => (
                  <>
                    <Text style={{ fontWeight: '500', color: colors.textPrimary }}>{item.name}</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>Role: {item.role} • {item.category}</Text>
                  </>
                )}
              />

              <ActivitySection
                title="Study Groups"
                icon="book"
                color={primaryColor}
                items={studentDetail.activities.study_groups}
                renderItem={(item) => (
                  <>
                    <Text style={{ fontWeight: '500', color: colors.textPrimary }}>{item.name}</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>{item.subject} • {item.role}</Text>
                  </>
                )}
              />

              {(studentDetail.activities.mentoring.as_mentor.length > 0 || studentDetail.activities.mentoring.as_mentee.length > 0) && (
                <View style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Ionicons name="hand-left" size={18} color={colors.error} />
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginLeft: 8 }}>Mentoring</Text>
                  </View>
                  {studentDetail.activities.mentoring.as_mentor.length > 0 && (
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>As Mentor: {studentDetail.activities.mentoring.as_mentor.length} sessions</Text>
                  )}
                  {studentDetail.activities.mentoring.as_mentee.length > 0 && (
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>As Mentee: {studentDetail.activities.mentoring.as_mentee.length} sessions</Text>
                  )}
                </View>
              )}

              {(studentDetail.activities.tutoring.as_tutor.length > 0 || studentDetail.activities.tutoring.as_student.length > 0) && (
                <View style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Ionicons name="school" size={18} color={primaryColor} />
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginLeft: 8 }}>Tutoring</Text>
                  </View>
                  {studentDetail.activities.tutoring.as_tutor.length > 0 && (
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>As Tutor: {studentDetail.activities.tutoring.as_tutor.length} sessions</Text>
                  )}
                  {studentDetail.activities.tutoring.as_student.length > 0 && (
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>As Student: {studentDetail.activities.tutoring.as_student.length} sessions</Text>
                  )}
                </View>
              )}

              <ActivitySection
                title="Shoutouts Given"
                icon="star"
                color={colors.warning}
                items={studentDetail.activities.shoutouts_given}
                renderItem={(item) => (
                  <>
                    <Text style={{ fontWeight: '500', color: colors.textPrimary }}>To: {item.to_user_name}</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }} numberOfLines={2}>{item.message}</Text>
                  </>
                )}
              />

              <ActivitySection
                title="Shoutouts Received"
                icon="heart"
                color={colors.error}
                items={studentDetail.activities.shoutouts_received}
                renderItem={(item) => (
                  <>
                    <Text style={{ fontWeight: '500', color: colors.textPrimary }}>From: {item.from_user_name}</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }} numberOfLines={2}>{item.message}</Text>
                  </>
                )}
              />

              <View style={{ height: 40 }} />
            </ScrollView>
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: colors.textSecondary }}>No data available</Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
