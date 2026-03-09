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

const RELATIONSHIP_TYPES = [
  'Romantic / Personal Intimate',
  'Close Personal Friendship',
  'Family Relationship',
  'Financial Dependency',
  'Prior Supervisory Relationship',
  'Other',
];

const PARTY_ROLES = ['student', 'ra', 'admin', 'college_admin', 'staff', 'tutor', 'other'];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', bg: '#DBEAFE', text: '#1D4ED8' },
  { value: 'under_review', label: 'Under Review', bg: '#FEF3C7', text: '#B45309' },
  { value: 'management_plan_issued', label: 'Plan Issued', bg: '#EDE9FE', text: '#6D28D9' },
  { value: 'resolved', label: 'Resolved', bg: '#D1FAE5', text: '#065F46' },
  { value: 'closed', label: 'Closed', bg: '#F3F4F6', text: '#6B7280' },
];

const TYPE_COLORS = {
  'Romantic / Personal Intimate': { bg: '#FFF1F2', text: '#BE123C' },
  'Close Personal Friendship': { bg: '#FFF7ED', text: '#C2410C' },
  'Family Relationship': { bg: '#FEFCE8', text: '#A16207' },
  'Financial Dependency': { bg: '#F0FDFA', text: '#0F766E' },
  'Prior Supervisory Relationship': { bg: '#EEF2FF', text: '#4338CA' },
  'Other': { bg: '#F9FAFB', text: '#6B7280' },
};

const emptyForm = {
  disclosed_by_name: '',
  disclosed_by_role: 'student',
  disclosed_by_id: '',
  other_party_name: '',
  other_party_role: 'student',
  other_party_id: '',
  relationship_type: RELATIONSHIP_TYPES[0],
  disclosure_date: new Date().toISOString().split('T')[0],
  notes: '',
};

function StatusBadge({ status }) {
  const cfg = STATUS_OPTIONS.find(o => o.value === status) || { label: status, bg: '#F3F4F6', text: '#6B7280' };
  return (
    <View style={{ backgroundColor: cfg.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: cfg.text }}>{cfg.label}</Text>
    </View>
  );
}

function TypeBadge({ type }) {
  const cfg = TYPE_COLORS[type] || { bg: '#F9FAFB', text: '#6B7280' };
  return (
    <View style={{ backgroundColor: cfg.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
      <Text style={{ fontSize: 11, fontWeight: '500', color: cfg.text }} numberOfLines={1}>{type}</Text>
    </View>
  );
}

export default function RelationshipDisclosuresScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;

  const [disclosures, setDisclosures] = useState([]);
  const [stats, setStats] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [partySearch, setPartySearch] = useState('');
  const [otherPartySearch, setOtherPartySearch] = useState('');
  const [saving, setSaving] = useState(false);

  const [selectedDisclosure, setSelectedDisclosure] = useState(null);
  const [updateForm, setUpdateForm] = useState({ status: '', resolution_notes: '', management_plan: '' });
  const [updating, setUpdating] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showRelTypePicker, setShowRelTypePicker] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [discRes, statsRes, usersRes] = await Promise.all([
        api.get('/relationship-disclosures'),
        api.get('/relationship-disclosures/stats'),
        api.get('/users'),
      ]);
      setDisclosures(Array.isArray(discRes.data) ? discRes.data : []);
      setStats(statsRes.data);
      setAllUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
    } catch {
      Alert.alert('Error', 'Failed to load disclosures');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const submitDisclosure = async () => {
    if (!form.disclosed_by_name || !form.other_party_name) {
      Alert.alert('Error', 'Both party names are required');
      return;
    }
    setSaving(true);
    try {
      await api.post('/relationship-disclosures', form);
      Alert.alert('Success', 'Disclosure logged successfully');
      setShowAddModal(false);
      setForm(emptyForm);
      setPartySearch('');
      setOtherPartySearch('');
      loadData();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to log disclosure');
    } finally {
      setSaving(false);
    }
  };

  const updateDisclosure = async () => {
    setUpdating(true);
    try {
      const res = await api.patch(`/relationship-disclosures/${selectedDisclosure.id}`, updateForm);
      setSelectedDisclosure(res.data);
      Alert.alert('Success', 'Disclosure updated');
      loadData();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to update disclosure');
    } finally {
      setUpdating(false);
    }
  };

  const filteredDisclosures = disclosures.filter(d => {
    if (statusFilter && d.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        d.disclosed_by_name?.toLowerCase().includes(q) ||
        d.other_party_name?.toLowerCase().includes(q) ||
        d.relationship_type?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredUsers = (query, excludeId) => {
    if (!query) return [];
    const q = query.toLowerCase();
    return allUsers.filter(u =>
      u.id !== excludeId &&
      (`${u.first_name} ${u.last_name}`.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
    ).slice(0, 6);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={primaryColor} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{ backgroundColor: primaryColor, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ width: 36, height: 36, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>Relationship Disclosures</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>Governance tracking</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowAddModal(true)}
            style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center' }}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13, marginLeft: 4 }}>Log</Text>
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        {stats && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { label: 'Total', value: stats.total, color: '#BFDBFE' },
              { label: 'Active', value: stats.active + stats.under_review, color: '#FDE68A' },
              { label: 'Plans', value: stats.management_plan_issued, color: '#DDD6FE' },
              { label: 'Resolved', value: stats.resolved, color: '#A7F3D0' },
            ].map(s => (
              <View key={s.label} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 8, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>{s.value}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 2 }}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Alert banner */}
      {stats && (stats.active + stats.under_review) > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB', borderBottomWidth: 1, borderBottomColor: '#FDE68A', padding: 12, paddingHorizontal: 16 }}>
          <Ionicons name="warning" size={16} color="#D97706" style={{ marginRight: 8 }} />
          <Text style={{ fontSize: 12, color: '#B45309', flex: 1 }}>
            {stats.active + stats.under_review} active disclosure{(stats.active + stats.under_review) !== 1 ? 's' : ''} require governance attention
          </Text>
        </View>
      )}

      {/* Search & filter */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSecondary, borderRadius: 12, paddingHorizontal: 12, marginBottom: 8 }}>
          <Ionicons name="search" size={16} color={colors.textTertiary} />
          <TextInput
            style={{ flex: 1, paddingVertical: 10, paddingLeft: 8, fontSize: 14, color: colors.textPrimary }}
            placeholder="Search by name or type..."
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            onPress={() => setStatusFilter('')}
            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 8, backgroundColor: !statusFilter ? primaryColor : colors.surfaceSecondary }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: !statusFilter ? '#fff' : colors.textSecondary }}>All</Text>
          </TouchableOpacity>
          {STATUS_OPTIONS.map(s => (
            <TouchableOpacity
              key={s.value}
              onPress={() => setStatusFilter(statusFilter === s.value ? '' : s.value)}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 8, backgroundColor: statusFilter === s.value ? primaryColor : colors.surfaceSecondary }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: statusFilter === s.value ? '#fff' : colors.textSecondary }}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* List */}
      <FlatList
        data={filteredDisclosures}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={primaryColor} />}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Ionicons name="heart-outline" size={48} color={colors.textTertiary} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginTop: 12 }}>No disclosures found</Text>
            <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 4 }}>Logged disclosures will appear here</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => {
              setSelectedDisclosure(item);
              setUpdateForm({ status: item.status, resolution_notes: item.resolution_notes || '', management_plan: item.management_plan || '' });
            }}
            style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, ...shadows.sm }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{item.disclosed_by_name}</Text>
                  <Text style={{ fontSize: 13, color: colors.textTertiary, marginHorizontal: 6 }}>↔</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{item.other_party_name}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <TypeBadge type={item.relationship_type} />
                  <Text style={{ fontSize: 11, color: colors.textTertiary, textTransform: 'capitalize' }}>
                    {item.disclosed_by_role} ↔ {item.other_party_role}
                  </Text>
                </View>
                {item.notes ? (
                  <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 6 }} numberOfLines={1}>{item.notes}</Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <StatusBadge status={item.status} />
                <Text style={{ fontSize: 11, color: colors.textTertiary }}>
                  {new Date(item.disclosure_date).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Add Disclosure Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary }}>Log Disclosure</Text>
            <TouchableOpacity onPress={submitDisclosure} disabled={saving || !form.disclosed_by_name || !form.other_party_name}>
              {saving ? <ActivityIndicator size="small" color={primaryColor} /> : (
                <Text style={{ color: (!form.disclosed_by_name || !form.other_party_name) ? colors.textTertiary : primaryColor, fontSize: 16, fontWeight: '600' }}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, marginBottom: 20 }}>
              <Ionicons name="shield-checkmark" size={16} color="#2563EB" style={{ marginRight: 8 }} />
              <Text style={{ fontSize: 12, color: '#1D4ED8', flex: 1 }}>Confidential governance record. Only college administrators can view this.</Text>
            </View>

            {/* Party 1 */}
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 }}>Party 1 — Disclosing Person</Text>
            {form.disclosed_by_id ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: primaryColor + '10', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                <View>
                  <Text style={{ fontWeight: '600', fontSize: 13, color: colors.textPrimary }}>{form.disclosed_by_name}</Text>
                  <Text style={{ fontSize: 12, color: colors.textTertiary, textTransform: 'capitalize' }}>{form.disclosed_by_role}</Text>
                </View>
                <TouchableOpacity onPress={() => setForm(f => ({ ...f, disclosed_by_id: '', disclosed_by_name: '', disclosed_by_role: 'student' }))}>
                  <Ionicons name="close-circle" size={22} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ marginBottom: 16 }}>
                <TextInput
                  style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 12, fontSize: 14, color: colors.textPrimary, marginBottom: 6 }}
                  placeholder="Search user or type name..."
                  placeholderTextColor={colors.textTertiary}
                  value={partySearch}
                  onChangeText={t => { setPartySearch(t); setForm(f => ({ ...f, disclosed_by_name: t })); }}
                />
                {filteredUsers(partySearch, form.other_party_id).map(u => (
                  <TouchableOpacity
                    key={u.id}
                    onPress={() => { setForm(f => ({ ...f, disclosed_by_id: u.id, disclosed_by_name: `${u.first_name} ${u.last_name}`, disclosed_by_role: u.role })); setPartySearch(''); }}
                    style={{ paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                  >
                    <Text style={{ fontSize: 13, color: colors.textPrimary }}>{u.first_name} {u.last_name} <Text style={{ color: colors.textTertiary, textTransform: 'capitalize' }}>({u.role})</Text></Text>
                  </TouchableOpacity>
                ))}
                <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 4, marginBottom: 4 }}>Role</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {PARTY_ROLES.map(r => (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setForm(f => ({ ...f, disclosed_by_role: r }))}
                      style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: form.disclosed_by_role === r ? primaryColor : colors.surfaceSecondary }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '500', color: form.disclosed_by_role === r ? '#fff' : colors.textSecondary, textTransform: 'capitalize' }}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Party 2 */}
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 }}>Party 2 — Other Person</Text>
            {form.other_party_id ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: primaryColor + '10', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                <View>
                  <Text style={{ fontWeight: '600', fontSize: 13, color: colors.textPrimary }}>{form.other_party_name}</Text>
                  <Text style={{ fontSize: 12, color: colors.textTertiary, textTransform: 'capitalize' }}>{form.other_party_role}</Text>
                </View>
                <TouchableOpacity onPress={() => setForm(f => ({ ...f, other_party_id: '', other_party_name: '', other_party_role: 'student' }))}>
                  <Ionicons name="close-circle" size={22} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ marginBottom: 16 }}>
                <TextInput
                  style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 12, fontSize: 14, color: colors.textPrimary, marginBottom: 6 }}
                  placeholder="Search user or type name..."
                  placeholderTextColor={colors.textTertiary}
                  value={otherPartySearch}
                  onChangeText={t => { setOtherPartySearch(t); setForm(f => ({ ...f, other_party_name: t })); }}
                />
                {filteredUsers(otherPartySearch, form.disclosed_by_id).map(u => (
                  <TouchableOpacity
                    key={u.id}
                    onPress={() => { setForm(f => ({ ...f, other_party_id: u.id, other_party_name: `${u.first_name} ${u.last_name}`, other_party_role: u.role })); setOtherPartySearch(''); }}
                    style={{ paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                  >
                    <Text style={{ fontSize: 13, color: colors.textPrimary }}>{u.first_name} {u.last_name} <Text style={{ color: colors.textTertiary, textTransform: 'capitalize' }}>({u.role})</Text></Text>
                  </TouchableOpacity>
                ))}
                <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 4, marginBottom: 4 }}>Role</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {PARTY_ROLES.map(r => (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setForm(f => ({ ...f, other_party_role: r }))}
                      style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: form.other_party_role === r ? primaryColor : colors.surfaceSecondary }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '500', color: form.other_party_role === r ? '#fff' : colors.textSecondary, textTransform: 'capitalize' }}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Relationship Type */}
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 }}>Relationship Type</Text>
            <TouchableOpacity
              onPress={() => setShowRelTypePicker(true)}
              style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <Text style={{ fontSize: 14, color: colors.textPrimary }}>{form.relationship_type}</Text>
              <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
            </TouchableOpacity>

            {/* Date */}
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 }}>Date of Disclosure</Text>
            <TextInput
              style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 12, fontSize: 14, color: colors.textPrimary, marginBottom: 16 }}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textTertiary}
              value={form.disclosure_date}
              onChangeText={t => setForm(f => ({ ...f, disclosure_date: t }))}
            />

            {/* Notes */}
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 }}>Notes (optional)</Text>
            <TextInput
              style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 12, fontSize: 14, color: colors.textPrimary, minHeight: 80, textAlignVertical: 'top', marginBottom: 30 }}
              placeholder="Context, circumstances, or any relevant details..."
              placeholderTextColor={colors.textTertiary}
              value={form.notes}
              onChangeText={t => setForm(f => ({ ...f, notes: t }))}
              multiline
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Relationship Type Picker */}
      <Modal visible={showRelTypePicker} transparent animationType="slide" onRequestClose={() => setShowRelTypePicker(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setShowRelTypePicker(false)}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 }}>Relationship Type</Text>
            {RELATIONSHIP_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                onPress={() => { setForm(f => ({ ...f, relationship_type: t })); setShowRelTypePicker(false); }}
                style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Text style={{ fontSize: 14, color: colors.textPrimary }}>{t}</Text>
                {form.relationship_type === t && <Ionicons name="checkmark" size={18} color={primaryColor} />}
              </TouchableOpacity>
            ))}
            <View style={{ height: 20 }} />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Disclosure Detail Modal */}
      <Modal visible={!!selectedDisclosure} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedDisclosure(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setSelectedDisclosure(null)}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Close</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary }}>Disclosure Details</Text>
            <TouchableOpacity onPress={updateDisclosure} disabled={updating}>
              {updating ? <ActivityIndicator size="small" color={primaryColor} /> : (
                <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
          {selectedDisclosure && (
            <ScrollView style={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 14 }}>
                  <Text style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 4 }}>Party 1</Text>
                  <Text style={{ fontWeight: '600', fontSize: 14, color: colors.textPrimary }}>{selectedDisclosure.disclosed_by_name}</Text>
                  <Text style={{ fontSize: 12, color: colors.textTertiary, textTransform: 'capitalize', marginTop: 2 }}>{selectedDisclosure.disclosed_by_role}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 14 }}>
                  <Text style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 4 }}>Party 2</Text>
                  <Text style={{ fontWeight: '600', fontSize: 14, color: colors.textPrimary }}>{selectedDisclosure.other_party_name}</Text>
                  <Text style={{ fontSize: 12, color: colors.textTertiary, textTransform: 'capitalize', marginTop: 2 }}>{selectedDisclosure.other_party_role}</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                <TypeBadge type={selectedDisclosure.relationship_type} />
                <StatusBadge status={selectedDisclosure.status} />
                <Text style={{ fontSize: 12, color: colors.textTertiary }}>{new Date(selectedDisclosure.disclosure_date).toLocaleDateString()}</Text>
              </View>

              {selectedDisclosure.notes ? (
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>Notes</Text>
                  <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 12 }}>
                    <Text style={{ fontSize: 14, color: colors.textPrimary }}>{selectedDisclosure.notes}</Text>
                  </View>
                </View>
              ) : null}

              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 }}>Update Status</Text>
              <TouchableOpacity
                onPress={() => setShowStatusPicker(true)}
                style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Text style={{ fontSize: 14, color: colors.textPrimary }}>
                  {STATUS_OPTIONS.find(o => o.value === updateForm.status)?.label || updateForm.status}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
              </TouchableOpacity>

              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 }}>Management Plan</Text>
              <TextInput
                style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 12, fontSize: 14, color: colors.textPrimary, minHeight: 80, textAlignVertical: 'top', marginBottom: 16 }}
                placeholder="Describe the management plan..."
                placeholderTextColor={colors.textTertiary}
                value={updateForm.management_plan}
                onChangeText={t => setUpdateForm(f => ({ ...f, management_plan: t }))}
                multiline
              />

              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 }}>Resolution Notes</Text>
              <TextInput
                style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 12, fontSize: 14, color: colors.textPrimary, minHeight: 80, textAlignVertical: 'top', marginBottom: 30 }}
                placeholder="Notes on resolution..."
                placeholderTextColor={colors.textTertiary}
                value={updateForm.resolution_notes}
                onChangeText={t => setUpdateForm(f => ({ ...f, resolution_notes: t }))}
                multiline
              />
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Status Picker */}
      <Modal visible={showStatusPicker} transparent animationType="slide" onRequestClose={() => setShowStatusPicker(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setShowStatusPicker(false)}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 }}>Update Status</Text>
            {STATUS_OPTIONS.map(s => (
              <TouchableOpacity
                key={s.value}
                onPress={() => { setUpdateForm(f => ({ ...f, status: s.value })); setShowStatusPicker(false); }}
                style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Text style={{ fontSize: 14, color: colors.textPrimary }}>{s.label}</Text>
                {updateForm.status === s.value && <Ionicons name="checkmark" size={18} color={primaryColor} />}
              </TouchableOpacity>
            ))}
            <View style={{ height: 20 }} />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
