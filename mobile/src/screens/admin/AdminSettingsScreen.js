import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import AdminScreenHeader from '../../components/AdminScreenHeader';
import api from '../../services/api';
import { colors, borderRadius, spacing } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';

export default function AdminSettingsScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const { isSuperAdmin } = useAuth();
  
  const [moduleSettings, setModuleSettings] = useState({
    events: true,
    announcements: true,
    messages: true,
    jobs: true,
    dining: true,
    maintenance: true,
    recognition: true,
    wellbeing: true,
    cocurricular: true,
  });

  // Contact person state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [editingContact, setEditingContact] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const [contactLoading, setContactLoading] = useState(true);
  const [tenantCode, setTenantCode] = useState('');

  useEffect(() => {
    fetchTenantInfo();
  }, []);

  const fetchTenantInfo = async () => {
    try {
      const res = await api.get('/tenants');
      if (res.data && res.data.length > 0) {
        const t = res.data[0];
        setContactName(t.contact_person_name || '');
        setContactEmail(t.contact_person_email || '');
        setTenantCode(t.code || '');
      }
    } catch (err) {
      console.error('Failed to fetch tenant info', err);
    } finally {
      setContactLoading(false);
    }
  };

  const handleSaveContact = async () => {
    if (!contactName.trim() || !contactEmail.trim()) {
      Alert.alert('Error', 'Name and email are required');
      return;
    }
    setContactSaving(true);
    try {
      await api.put(`/tenants/${tenantCode}/contact-person`, {
        contact_person_name: contactName.trim(),
        contact_person_email: contactEmail.trim(),
      });
      Alert.alert('Success', 'Contact person updated');
      setEditingContact(false);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update contact person');
    } finally {
      setContactSaving(false);
    }
  };

  const toggleModule = (module) => {
    setModuleSettings({ ...moduleSettings, [module]: !moduleSettings[module] });
    // In production, this would call an API to update settings
  };

  const modules = [
    { id: 'events', label: 'Events', icon: 'calendar' },
    { id: 'announcements', label: 'News', icon: 'megaphone' },
    { id: 'messages', label: 'Messages', icon: 'chatbubbles' },
    { id: 'jobs', label: 'College Jobs', icon: 'briefcase' },
    { id: 'dining', label: 'Dining', icon: 'restaurant' },
    { id: 'maintenance', label: 'Maintenance', icon: 'construct' },
    { id: 'recognition', label: 'Recognition', icon: 'star' },
    { id: 'wellbeing', label: 'Wellbeing', icon: 'heart' },
    { id: 'cocurricular', label: 'Co-Curricular', icon: 'people' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }} edges={['bottom']}>
      <AdminScreenHeader
        title="Settings"
        onBack={() => navigation.goBack()}
      />

      <ScrollView>
        {/* Module Settings */}
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 }}>
            Module Settings
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 16 }}>
            Enable or disable features for your college
          </Text>
          
          <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.lg }}>
            {modules.map((module, index) => (
              <View
                key={module.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: spacing.lg,
                  borderBottomWidth: index < modules.length - 1 ? 1 : 0,
                  borderBottomColor: colors.surfaceSecondary,
                }}
              >
                <Ionicons name={module.icon} size={22} color={colors.secondary} />
                <Text style={{ flex: 1, marginLeft: 12, fontSize: 15, color: colors.textPrimary }}>
                  {module.label}
                </Text>
                <Switch
                  value={moduleSettings[module.id]}
                  onValueChange={() => toggleModule(module.id)}
                  trackColor={{ false: colors.border, true: primaryColor + '15' }}
                  thumbColor={moduleSettings[module.id] ? primaryColor : colors.textTertiary}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Contact Person */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 }}>
            Contact Person
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 16 }}>
            Primary admin contact for this college
          </Text>

          <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg }}>
            {contactLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : editingContact ? (
              <View style={{ gap: 12 }}>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>Name</Text>
                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: borderRadius.md,
                      padding: 12,
                      fontSize: 15,
                      color: colors.textPrimary,
                    }}
                    value={contactName}
                    onChangeText={setContactName}
                    placeholder="Full name"
                    autoCapitalize="words"
                  />
                </View>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>Email</Text>
                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: borderRadius.md,
                      padding: 12,
                      fontSize: 15,
                      color: colors.textPrimary,
                    }}
                    value={contactEmail}
                    onChangeText={setContactEmail}
                    placeholder="email@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                <View style={{
                  backgroundColor: primaryColor + '15',
                  borderWidth: 1,
                  borderColor: primaryColor,
                  borderRadius: borderRadius.md,
                  padding: 10,
                }}>
                  <Text style={{ fontSize: 12, color: primaryColor }}>
                    Changing the email will update admin login credentials.
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                  <TouchableOpacity
                    onPress={() => { setEditingContact(false); fetchTenantInfo(); }}
                    style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.border }}
                  >
                    <Text style={{ color: colors.textSecondary, fontWeight: '500' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSaveContact}
                    disabled={contactSaving}
                    style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: borderRadius.sm, backgroundColor: contactSaving ? primaryColor + '15' : colors.primary }}
                  >
                    <Text style={{ color: colors.textInverse, fontWeight: '600' }}>
                      {contactSaving ? 'Saving...' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Ionicons name="person-outline" size={18} color={colors.secondary} />
                  <Text style={{ marginLeft: 8, fontSize: 15, color: colors.textPrimary, fontWeight: '500' }}>
                    {contactName || 'Not set'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                  <Ionicons name="mail-outline" size={18} color={colors.secondary} />
                  <Text style={{ marginLeft: 8, fontSize: 14, color: colors.textSecondary }}>
                    {contactEmail || 'No email set'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setEditingContact(true)}
                  style={{ alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: borderRadius.sm, backgroundColor: primaryColor + '15' }}
                >
                  <Text style={{ color: colors.primary, fontWeight: '500', fontSize: 14 }}>Edit Contact</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Super Admin Only */}
        {isSuperAdmin && (
          <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 }}>
              Super Admin Tools
            </Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 16 }}>
              Advanced administration options
            </Text>
            
            <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.lg }}>
              <TouchableOpacity
                onPress={() => Alert.alert('User Provisioning', 'This feature allows bulk user import via CSV.')}
                style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.surfaceSecondary }}
              >
                <Ionicons name="cloud-upload" size={22} color={primaryColor} />
                <Text style={{ flex: 1, marginLeft: 12, fontSize: 15, color: colors.textPrimary }}>
                  User Provisioning
                </Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => Alert.alert('API Keys', 'Manage API keys for integrations.')}
                style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.surfaceSecondary }}
              >
                <Ionicons name="key" size={22} color={colors.warning} />
                <Text style={{ flex: 1, marginLeft: 12, fontSize: 15, color: colors.textPrimary }}>
                  API Keys
                </Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => Alert.alert('Backup', 'Export all college data for backup.')}
                style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}
              >
                <Ionicons name="download" size={22} color={primaryColor} />
                <Text style={{ flex: 1, marginLeft: 12, fontSize: 15, color: colors.textPrimary }}>
                  Data Backup
                </Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Danger Zone */}
        <View style={{ padding: 20, paddingTop: 0 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.error, marginBottom: 16 }}>
            Danger Zone
          </Text>
          
          <View style={{ backgroundColor: colors.errorLight, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.error }}>
            <TouchableOpacity
              onPress={() => Alert.alert(
                'Clear All Data',
                'This action cannot be undone. Are you sure?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Clear', style: 'destructive', onPress: () => Alert.alert('Cleared', 'Data has been cleared.') },
                ]
              )}
              style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}
            >
              <Ionicons name="trash" size={22} color={colors.error} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '500', color: colors.error }}>
                  Clear All Data
                </Text>
                <Text style={{ fontSize: 12, color: colors.error, marginTop: 2 }}>
                  Permanently delete all college data
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
