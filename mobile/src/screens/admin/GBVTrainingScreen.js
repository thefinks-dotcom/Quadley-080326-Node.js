import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Modal, Alert, RefreshControl, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useTenant } from '../../contexts/TenantContext';
import api from '../../services/api';
import { borderRadius, spacing, shadows } from '../../theme';

const TRAINING_TYPES = [
  'GBV Disclosure Training',
  'Trauma-Informed Response',
  'Bystander Intervention',
  'Survivor Support Coordination',
  'Mandatory Reporting Obligations',
];

const STATUS_CONFIG = {
  current:       { label: 'Current',        bg: '#D1FAE5', text: '#065F46' },
  expiring_soon: { label: 'Expiring Soon',   bg: '#FEF3C7', text: '#B45309' },
  overdue:       { label: 'Overdue',         bg: '#FEE2E2', text: '#B91C1C' },
  never_trained: { label: 'Never Trained',   bg: '#F3F4F6', text: '#6B7280' },
};

const emptyForm = {
  user_id: '',
  user_name: '',
  user_role: '',
  training_type: TRAINING_TYPES[0],
  training_date: new Date().toISOString().split('T')[0],
  notes: '',
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, bg: '#F3F4F6', text: '#6B7280' };
  return (
    <View style={{ backgroundColor: cfg.bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: cfg.text }}>{cfg.label}</Text>
    </View>
  );
}

export default function GBVTrainingScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [staffStatus, setStaffStatus] = useState([]);
  const [records, setRecords] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [showLogModal, setShowLogModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [staffRecords, setStaffRecords] = useState([]);
  const [declarationUpdating, setDeclarationUpdating] = useState(false);

  const [activeTab, setActiveTab] = useState('staff');

  useEffect(() => { loadData(); }, []);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [statsRes, recordsRes] = await Promise.all([
        api.get('/gbv-training/stats'),
        api.get('/gbv-training'),
      ]);
      setStats(statsRes.data);
      setStaffStatus(Array.isArray(statsRes.data?.staff_status) ? statsRes.data.staff_status : []);
      setRecords(Array.isArray(recordsRes.data) ? recordsRes.data : []);
    } catch {
      Alert.alert('Error', 'Failed to load training data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const openLogModal = (staffMember = null) => {
    setForm(staffMember ? {
      ...emptyForm,
      user_id: staffMember.user_id,
      user_name: staffMember.user_name,
      user_role: staffMember.user_role,
    } : emptyForm);
    setShowLogModal(true);
  };

  const submitTraining = async () => {
    if (!form.user_name || !form.training_type || !form.training_date) {
      Alert.alert('Error', 'Staff name, training type and date are required');
      return;
    }
    setSaving(true);
    try {
      await api.post('/gbv-training/record', form);
      Alert.alert('Success', 'Training record logged');
      setShowLogModal(false);
      setForm(emptyForm);
      loadData();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to log training');
    } finally {
      setSaving(false);
    }
  };

  const openStaffDetail = (member) => {
    setSelectedStaff(member);
    const memberRecords = records.filter(r => r.user_id === member.user_id);
    setStaffRecords(memberRecords);
    setShowDetailModal(true);
  };

  const toggleDeclaration = async (userId, currentValue) => {
    setDeclarationUpdating(true);
    try {
      await api.post('/gbv-training/gbv-declaration', {
        user_id: userId,
        has_declaration: !currentValue,
      });
      Alert.alert('Updated', `GBV declaration ${!currentValue ? 'confirmed' : 'removed'}`);
      setShowDetailModal(false);
      loadData();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to update declaration');
    } finally {
      setDeclarationUpdating(false);
    }
  };

  const filteredStaff = staffStatus.filter(s => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.user_name?.toLowerCase().includes(q) || s.user_role?.toLowerCase().includes(q);
    }
    return true;
  });

  const filteredRecords = records.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.user_name?.toLowerCase().includes(q) || r.training_type?.toLowerCase().includes(q);
  });

  const formatDate = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return iso; }
  };

  const roleLabel = (role) => ({
    admin: 'Admin', ra: 'RA', college_admin: 'College Admin',
    staff: 'Staff', tutor: 'Tutor', other: 'Other',
  }[role] || role);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={{ marginTop: 12, color: colors.textSecondary }}>Loading training records...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: spacing.md, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>GBV Training</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>Staff & RA compliance tracker</Text>
          </View>
          <TouchableOpacity
            onPress={() => openLogModal()}
            style={{ backgroundColor: primaryColor, paddingHorizontal: 14, paddingVertical: 8, borderRadius: borderRadius.lg, flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Log</Text>
          </TouchableOpacity>
        </View>

        {/* Compliance stat cards */}
        {stats && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.sm }}>
            {[
              { label: 'Compliant', value: stats.trained_current, color: '#10B981' },
              { label: 'Expiring', value: stats.expiring_soon, color: '#F59E0B' },
              { label: 'Overdue', value: stats.overdue, color: '#EF4444' },
              { label: 'Untrained', value: stats.never_trained, color: '#6B7280' },
            ].map(s => (
              <View key={s.label} style={{ flex: 1, backgroundColor: `${s.color}12`, borderRadius: borderRadius.md, padding: spacing.sm, alignItems: 'center' }}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: s.color }}>{s.value}</Text>
                <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 2, textAlign: 'center' }}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}
        {stats && (
          <View style={{ marginTop: spacing.sm, backgroundColor: `${primaryColor}10`, borderRadius: borderRadius.md, padding: spacing.sm }}>
            <Text style={{ fontSize: 13, color: primaryColor, fontWeight: '600', textAlign: 'center' }}>
              {stats.compliance_rate}% compliance rate · {stats.total_staff} staff tracked
            </Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {[{ key: 'staff', label: 'Staff Status' }, { key: 'records', label: 'All Records' }].map(tab => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: activeTab === tab.key ? primaryColor : 'transparent' }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: activeTab === tab.key ? primaryColor : colors.textSecondary }}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search + Filters */}
      <View style={{ backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.lg, paddingHorizontal: 12, gap: 8 }}>
          <Ionicons name="search" size={16} color={colors.textTertiary} />
          <TextInput
            style={{ flex: 1, height: 36, fontSize: 14, color: colors.textPrimary }}
            placeholder="Search staff or training type..."
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={16} color={colors.textTertiary} /></TouchableOpacity> : null}
        </View>
        {activeTab === 'staff' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { key: '', label: 'All' },
                { key: 'current', label: 'Current' },
                { key: 'expiring_soon', label: 'Expiring' },
                { key: 'overdue', label: 'Overdue' },
                { key: 'never_trained', label: 'Untrained' },
              ].map(f => (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setStatusFilter(f.key)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.full,
                    backgroundColor: statusFilter === f.key ? primaryColor : colors.surfaceSecondary,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: statusFilter === f.key ? '#fff' : colors.textSecondary }}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Content */}
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'staff' ? (
          filteredStaff.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
              <Text style={{ marginTop: 12, color: colors.textSecondary, fontSize: 15 }}>No staff found</Text>
            </View>
          ) : (
            filteredStaff.map((member, i) => (
              <TouchableOpacity
                key={member.user_id || i}
                onPress={() => openStaffDetail(member)}
                style={{
                  backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.lg,
                  marginBottom: spacing.md, ...shadows.sm,
                  borderLeftWidth: 3,
                  borderLeftColor: STATUS_CONFIG[member.status]?.text || colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>{member.user_name}</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{roleLabel(member.user_role)}</Text>
                  </View>
                  <StatusBadge status={member.status} />
                </View>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <View>
                    <Text style={{ fontSize: 11, color: colors.textTertiary }}>Last Trained</Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textPrimary, marginTop: 2 }}>
                      {formatDate(member.last_training_date)}
                    </Text>
                  </View>
                  {member.expiry_date && (
                    <View>
                      <Text style={{ fontSize: 11, color: colors.textTertiary }}>Expires</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: member.status === 'overdue' ? '#EF4444' : colors.textPrimary, marginTop: 2 }}>
                        {formatDate(member.expiry_date)}
                      </Text>
                    </View>
                  )}
                  {member.last_training_type && (
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: colors.textTertiary }}>Training Type</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textPrimary, marginTop: 2 }} numberOfLines={1}>
                        {member.last_training_type}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => openLogModal(member)}
                    style={{ backgroundColor: `${primaryColor}15`, paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.lg, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  >
                    <Ionicons name="add-circle-outline" size={14} color={primaryColor} />
                    <Text style={{ fontSize: 12, color: primaryColor, fontWeight: '600' }}>Log Training</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )
        ) : (
          filteredRecords.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="document-outline" size={48} color={colors.textTertiary} />
              <Text style={{ marginTop: 12, color: colors.textSecondary, fontSize: 15 }}>No training records</Text>
            </View>
          ) : (
            filteredRecords.map((rec, i) => (
              <View
                key={rec.id || i}
                style={{ backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>{rec.user_name}</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>{roleLabel(rec.user_role)}</Text>
                  </View>
                  <View style={{ backgroundColor: `${primaryColor}15`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: primaryColor }} numberOfLines={1}>
                      {rec.training_type}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <View>
                    <Text style={{ fontSize: 11, color: colors.textTertiary }}>Completed</Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textPrimary, marginTop: 2 }}>{formatDate(rec.training_date)}</Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 11, color: colors.textTertiary }}>Expires</Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textPrimary, marginTop: 2 }}>{formatDate(rec.expiry_date)}</Text>
                  </View>
                </View>
                {rec.notes ? (
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 8, fontStyle: 'italic' }}>{rec.notes}</Text>
                ) : null}
                <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 8 }}>
                  Recorded by {rec.recorded_by_name} · {formatDate(rec.recorded_at)}
                </Text>
              </View>
            ))
          )
        )}
      </ScrollView>

      {/* Log Training Modal */}
      <Modal visible={showLogModal} transparent animationType="slide" onRequestClose={() => setShowLogModal(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setShowLogModal(false)}
        >
          <View
            style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' }}
            onStartShouldSetResponder={() => true}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary }}>Log Training Completion</Text>
              <TouchableOpacity onPress={() => setShowLogModal(false)} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>Staff Member Name *</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, padding: 12, fontSize: 14, color: colors.textPrimary, marginBottom: 14, backgroundColor: colors.surfaceSecondary }}
                placeholder="Full name"
                placeholderTextColor={colors.textTertiary}
                value={form.user_name}
                onChangeText={v => setForm(f => ({ ...f, user_name: v }))}
              />

              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>Role *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {['admin', 'ra', 'college_admin', 'staff', 'tutor'].map(r => (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setForm(f => ({ ...f, user_role: r }))}
                      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: borderRadius.full, backgroundColor: form.user_role === r ? primaryColor : colors.surfaceSecondary, borderWidth: 1, borderColor: form.user_role === r ? primaryColor : colors.border }}
                    >
                      <Text style={{ fontSize: 13, color: form.user_role === r ? '#fff' : colors.textSecondary, fontWeight: '600' }}>{roleLabel(r)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>Training Type *</Text>
              {TRAINING_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setForm(f => ({ ...f, training_type: t }))}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: borderRadius.md, marginBottom: 8, backgroundColor: form.training_type === t ? `${primaryColor}15` : colors.surfaceSecondary, borderWidth: 1, borderColor: form.training_type === t ? primaryColor : colors.border }}
                >
                  <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: form.training_type === t ? primaryColor : colors.border, backgroundColor: form.training_type === t ? primaryColor : 'transparent', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                    {form.training_type === t && <Ionicons name="checkmark" size={11} color="#fff" />}
                  </View>
                  <Text style={{ fontSize: 13, color: colors.textPrimary, flex: 1 }}>{t}</Text>
                </TouchableOpacity>
              ))}

              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 6 }}>Date Completed (YYYY-MM-DD) *</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, padding: 12, fontSize: 14, color: colors.textPrimary, marginBottom: 14, backgroundColor: colors.surfaceSecondary }}
                placeholder="2025-01-15"
                placeholderTextColor={colors.textTertiary}
                value={form.training_date}
                onChangeText={v => setForm(f => ({ ...f, training_date: v }))}
              />

              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>Notes (optional)</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, padding: 12, fontSize: 14, color: colors.textPrimary, marginBottom: 24, backgroundColor: colors.surfaceSecondary, minHeight: 70, textAlignVertical: 'top' }}
                placeholder="Additional notes..."
                placeholderTextColor={colors.textTertiary}
                value={form.notes}
                onChangeText={v => setForm(f => ({ ...f, notes: v }))}
                multiline
              />

              <TouchableOpacity
                onPress={submitTraining}
                disabled={saving}
                style={{ backgroundColor: primaryColor, paddingVertical: 14, borderRadius: borderRadius.xl, alignItems: 'center', marginBottom: 30 }}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Save Record</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Staff Detail Modal */}
      <Modal visible={showDetailModal} transparent animationType="slide" onRequestClose={() => setShowDetailModal(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setShowDetailModal(false)}
        >
          <View
            style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' }}
            onStartShouldSetResponder={() => true}
          >
            {selectedStaff && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary }}>{selectedStaff.user_name}</Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>{roleLabel(selectedStaff.user_role)}</Text>
                  </View>
                  <StatusBadge status={selectedStaff.status} />
                  <TouchableOpacity onPress={() => setShowDetailModal(false)} style={{ marginLeft: 12, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="close" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={{ padding: 20 }}>
                  {/* GBV Declaration toggle */}
                  <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: 20 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 }}>Pre-employment GBV Declaration</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 14 }}>National Higher Education Code — Standard 1</Text>
                    <TouchableOpacity
                      onPress={() => toggleDeclaration(selectedStaff.user_id, selectedStaff.gbv_declaration)}
                      disabled={declarationUpdating}
                      style={{ backgroundColor: selectedStaff.gbv_declaration ? '#D1FAE5' : '#FEE2E2', paddingVertical: 10, paddingHorizontal: 16, borderRadius: borderRadius.lg, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}
                    >
                      {declarationUpdating ? <ActivityIndicator size="small" color={colors.textPrimary} /> : (
                        <Ionicons name={selectedStaff.gbv_declaration ? 'checkmark-circle' : 'close-circle'} size={18} color={selectedStaff.gbv_declaration ? '#065F46' : '#B91C1C'} />
                      )}
                      <Text style={{ fontWeight: '600', fontSize: 13, color: selectedStaff.gbv_declaration ? '#065F46' : '#B91C1C' }}>
                        {selectedStaff.gbv_declaration ? 'Declaration on file — tap to remove' : 'No declaration — tap to confirm'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Training history for this staff member */}
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 }}>Training History</Text>
                  {staffRecords.length === 0 ? (
                    <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.xl, padding: spacing.lg, alignItems: 'center' }}>
                      <Ionicons name="alert-circle-outline" size={28} color={colors.textTertiary} />
                      <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 8 }}>No training records found</Text>
                    </View>
                  ) : (
                    staffRecords.map((rec, i) => (
                      <View key={rec.id || i} style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: 10 }}>
                        <View style={{ backgroundColor: `${primaryColor}15`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 8 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: primaryColor }}>{rec.training_type}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 20 }}>
                          <View>
                            <Text style={{ fontSize: 11, color: colors.textTertiary }}>Completed</Text>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textPrimary }}>{formatDate(rec.training_date)}</Text>
                          </View>
                          <View>
                            <Text style={{ fontSize: 11, color: colors.textTertiary }}>Expires</Text>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textPrimary }}>{formatDate(rec.expiry_date)}</Text>
                          </View>
                        </View>
                        {rec.notes ? <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 8, fontStyle: 'italic' }}>{rec.notes}</Text> : null}
                      </View>
                    ))
                  )}

                  <TouchableOpacity
                    onPress={() => { setShowDetailModal(false); openLogModal(selectedStaff); }}
                    style={{ backgroundColor: primaryColor, paddingVertical: 13, borderRadius: borderRadius.xl, alignItems: 'center', marginTop: 8, marginBottom: 30 }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Log New Training</Text>
                  </TouchableOpacity>
                </ScrollView>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
