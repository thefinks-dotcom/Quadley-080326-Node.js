import React, { useState, useRef } from 'react';
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
  Share,
} from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { useTenant } from '../../contexts/TenantContext';
import AdminScreenHeader from '../../components/AdminScreenHeader';

export default function AdminUsersScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [addUserModalVisible, setAddUserModalVisible] = useState(false);
  const [bulkImportModalVisible, setBulkImportModalVisible] = useState(false);
  const [bulkImportResults, setBulkImportResults] = useState(null);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [emailEditModalVisible, setEmailEditModalVisible] = useState(false);
  const [emailEditUser, setEmailEditUser] = useState(null);
  const [emailEditValue, setEmailEditValue] = useState('');
  const [newStudent, setNewStudent] = useState({
    email: '',
    first_name: '',
    last_name: '',
    role: 'student',
    floor: '',
    room: '',
  });
  const queryClient = useQueryClient();
  
  // Refs for input focus
  const lastNameRef = useRef(null);
  const emailRef = useRef(null);
  const floorRef = useRef(null);
  const roomRef = useRef(null);

  const { data: users, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      const response = await api.get(ENDPOINTS.USERS_LIST);
      return response.data;
    },
  });

  const updateUserRole = useMutation({
    mutationFn: async ({ userId, role }) => {
      const response = await api.patch(`${ENDPOINTS.ADMIN_USERS}/${userId}`, { role });
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'User role updated!');
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update user');
    },
  });

  const toggleUserStatus = useMutation({
    mutationFn: async ({ userId, active }) => {
      const response = await api.patch(`/auth/users/${userId}/status`, { active });
      return response.data;
    },
    onSuccess: (_, variables) => {
      Alert.alert('Success', `User ${variables.active ? 'activated' : 'deactivated'} successfully!`);
      setStatusModalVisible(false);
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update user status');
    },
  });

  const inviteStudent = useMutation({
    mutationFn: async (studentData) => {
      const response = await api.post('/admin/users/invite', studentData);
      return response.data;
    },
    onSuccess: (data) => {
      const message = data.email_sent 
        ? `Invitation sent to ${data.user.email}! They will receive an email to set up their password.`
        : `Student added but email could not be sent. Please resend the invitation.`;
      Alert.alert('Success', message);
      setAddUserModalVisible(false);
      setNewStudent({ email: '', first_name: '', last_name: '', role: 'student', floor: '', room: '' });
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to invite student');
    },
  });

  const [uploadProgress, setUploadProgress] = useState(0);

  const bulkImport = useMutation({
    mutationFn: async (fileUri) => {
      setUploadProgress(0);
      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        name: 'students.csv',
        type: 'text/csv',
      });
      const response = await api.post('/admin/users/bulk-invite', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        },
      });
      return response.data;
    },
    onSuccess: (data) => {
      setUploadProgress(100);
      setBulkImportResults(data);
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    },
    onError: (error) => {
      setUploadProgress(0);
      Alert.alert('Import Failed', error.response?.data?.detail || 'Failed to import students');
    },
  });

  const resendInvite = useMutation({
    mutationFn: async (userId) => {
      const response = await api.post(`/admin/users/resend-invite/${userId}`);
      return response.data;
    },
    onSuccess: (data) => {
      Alert.alert('Success', data.message);
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to resend invitation');
    },
  });

  const updateUserEmail = useMutation({
    mutationFn: async ({ userId, email }) => {
      const response = await api.patch(`/admin/users/${userId}/email`, { email });
      return response.data;
    },
    onSuccess: (_, variables) => {
      Alert.alert('Success', `Email updated to ${variables.email}`);
      setEmailEditModalVisible(false);
      setEmailEditUser(null);
      setEmailEditValue('');
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update email');
    },
  });

  const handleEmailEditSave = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailEditValue.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }
    if (!emailRegex.test(emailEditValue.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    updateUserEmail.mutate({ userId: emailEditUser.id, email: emailEditValue.trim().toLowerCase() });
  };

  const handlePickCSVFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', '*/*'],
        copyToCacheDirectory: true,
      });
      
      if (result.canceled) {
        return;
      }
      
      const file = result.assets?.[0];
      if (!file) {
        Alert.alert('Error', 'No file selected');
        return;
      }
      
      // More lenient CSV check - also check mime type
      const fileName = file.name?.toLowerCase() || '';
      const mimeType = file.mimeType?.toLowerCase() || '';
      const isCSV = fileName.endsWith('.csv') || 
                    mimeType.includes('csv') || 
                    mimeType.includes('comma-separated') ||
                    mimeType === 'text/plain';
      
      if (!isCSV) {
        Alert.alert('Error', `Please select a CSV file. Selected: ${file.name || 'unknown'}`);
        return;
      }
      
      // Reset previous results and start import
      setBulkImportResults(null);
      setBulkImportModalVisible(true);
      bulkImport.mutate(file.uri);
    } catch (error) {
      console.error('File picker error:', error);
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await api.get('/admin/users/bulk-invite/template');
      const template = response.data.template;
      
      const fileName = 'student_import_template.csv';
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, template, { encoding: FileSystem.EncodingType.UTF8 });
      
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(filePath, { 
          mimeType: 'text/csv',
          dialogTitle: 'Download Template',
          UTI: 'public.comma-separated-values-text'
        });
      } else {
        await Share.share({ message: template, title: 'Student Import Template' });
      }
    } catch (error) {
      console.error('Template download error:', error);
      Alert.alert('Error', 'Failed to download template');
    }
  };

  const handleInviteStudent = () => {
    if (!newStudent.email || !newStudent.first_name || !newStudent.last_name) {
      Alert.alert('Error', 'Please fill in first name, last name, and email');
      return;;
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newStudent.email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    inviteStudent.mutate(newStudent);
  };

  const handleToggleStatus = () => {
    if (!selectedUser) return;
    const newStatus = selectedUser.active === false;
    toggleUserStatus.mutate({ userId: selectedUser.id, active: newStatus });
  };

  const exportUsersCSV = async () => {
    try {
      const usersToExport = filteredUsers;
      
      if (!usersToExport || usersToExport.length === 0) {
        Alert.alert('Info', 'No users to export');
        return;
      }
      
      // Create CSV content
      const headers = ['First Name', 'Last Name', 'Email', 'Role', 'Floor', 'Room', 'Status'];
      const rows = usersToExport.map(user => [
        user.first_name || '',
        user.last_name || '',
        user.email,
        user.role || 'student',
        user.floor || '',
        user.room || '',
        user.pending_setup ? 'Pending' : (user.active !== false ? 'Active' : 'Inactive')
      ]);
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      
      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      
      if (isAvailable) {
        // Write to file and share
        const fileName = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
        const filePath = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(filePath, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
        await Sharing.shareAsync(filePath, { 
          mimeType: 'text/csv', 
          dialogTitle: 'Export Users',
          UTI: 'public.comma-separated-values-text'
        });
      } else {
        // Fallback to Share API with text content
        await Share.share({
          message: csvContent,
          title: 'Users Export',
        });
      }
    } catch (error) {
      console.error('Export error:', error);
      // Try fallback share method
      try {
        const usersToExport = filteredUsers;
        const headers = ['First Name', 'Last Name', 'Email', 'Role', 'Floor', 'Room', 'Status'];
        const rows = usersToExport.map(user => [
          user.first_name || '',
          user.last_name || '',
          user.email,
          user.role || 'student',
          user.floor || '',
          user.room || '',
          user.pending_setup ? 'Pending' : (user.active !== false ? 'Active' : 'Inactive')
        ]);
        const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        
        await Share.share({
          message: csvContent,
          title: 'Users Export',
        });
      } catch (fallbackError) {
        Alert.alert('Error', 'Failed to export users. Please try again.');
      }
    }
  };

  const roles = ['all', 'pending', 'student', 'ra', 'admin'];

  const filteredUsers = users?.filter((user) => {
    const matchesSearch =
      user.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (selectedRole === 'all') return matchesSearch;
    if (selectedRole === 'pending') return matchesSearch && user.pending_setup === true;
    return matchesSearch && user.role === selectedRole;
  })?.sort((a, b) => {
    // Put pending users at top
    if (a.pending_setup && !b.pending_setup) return -1;
    if (!a.pending_setup && b.pending_setup) return 1;
    return 0;
  }) || [];

  const getRoleBadgeColor = (role, isPending) => {
    if (isPending) return primaryColor;
    switch (role) {
      case 'admin': return primaryColor;
      case 'ra': return primaryColor;
      default: return primaryColor;
    }
  };

  const handleRoleChange = (user) => {
    const roleOptions = ['student', 'ra', 'admin'];
    Alert.alert(
      'Change Role',
      `Select new role for ${user.first_name} ${user.last_name}`,
      [
        ...roleOptions.map((role) => ({
          text: role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' '),
          onPress: () => updateUserRole.mutate({ userId: user.id, role }),
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleUserPress = (user) => {
    const isPending = user.pending_setup;
    const buttons = [];
    
    if (isPending) {
      buttons.push({
        text: 'Resend Invitation',
        onPress: () => {
          api.post(`/admin/users/${user.id}/activate`).then(res => {
            Alert.alert('Sent!', `Fresh invite sent to ${user.email}\n\nInvite code: ${res.data.invite_code}`);
            queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
          }).catch(err => {
            Alert.alert('Error', err.response?.data?.detail || 'Failed to send invite');
          });
        },
      });
      buttons.push({
        text: 'Force Activate (Temp Password)',
        onPress: () => {
          Alert.alert(
            'Force Activate',
            `This will activate ${user.first_name} with a temporary password. They must change it on first login.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Activate',
                onPress: () => {
                  api.post(`/admin/users/${user.id}/force-activate`).then(res => {
                    Alert.alert(
                      'User Activated',
                      `Temporary password:\n\n${res.data.temporary_password}\n\nShare this with the user. They must change it on first login.`,
                    );
                    queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
                  }).catch(err => {
                    Alert.alert('Error', err.response?.data?.detail || 'Failed to activate');
                  });
                },
              },
            ]
          );
        },
      });
    }
    
    buttons.push({
      text: 'Change Email',
      onPress: () => {
        setEmailEditUser(user);
        setEmailEditValue(user.email);
        setEmailEditModalVisible(true);
      },
    });

    buttons.push({ 
      text: 'Change Role', 
      onPress: () => handleRoleChange(user) 
    });
    
    buttons.push({ text: 'Cancel', style: 'cancel' });
    
    const statusText = isPending ? 'Pending Setup' : (user.active !== false ? 'Active' : 'Inactive');
    const locationInfo = user.floor || user.room 
      ? `\nLocation: ${[user.floor, user.room].filter(Boolean).join(', ')}`
      : '';
    
    Alert.alert(
      `${user.first_name} ${user.last_name}`,
      `Email: ${user.email}\nRole: ${user.role}\nStatus: ${statusText}${locationInfo}`,
      buttons
    );
  };

  const renderUser = ({ item }) => {
    const isPending = item.pending_setup;
    return (
      <TouchableOpacity
        onPress={() => handleUserPress(item)}
        data-testid={`user-item-${item.id}`}
        style={{
          backgroundColor: colors.surface,
          padding: spacing.lg,
          borderBottomWidth: 1,
          borderBottomColor: colors.surfaceSecondary,
          flexDirection: 'row',
          alignItems: 'center',
          opacity: item.active === false && !isPending ? 0.6 : 1,
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            backgroundColor: isPending ? primaryColor + '15' : (item.active === false ? colors.border : primaryColor + '15'),
            borderRadius: 24,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
          }}
        >
          {isPending ? (
            <Ionicons name="time-outline" size={24} color={colors.warning} />
          ) : (
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: item.active === false ? colors.textTertiary : primaryColor }}>
              {item.first_name?.[0]}{item.last_name?.[0]}
            </Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
              {item.first_name} {item.last_name}
            </Text>
            {isPending && (
              <View style={{ marginLeft: 8, backgroundColor: primaryColor + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ color: primaryColor, fontSize: 10, fontWeight: '600' }}>PENDING</Text>
              </View>
            )}
            {item.active === false && !isPending && (
              <View style={{ marginLeft: 8, backgroundColor: colors.errorLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ color: colors.error, fontSize: 10, fontWeight: '600' }}>INACTIVE</Text>
              </View>
            )}
          </View>
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 2 }}>
            {item.email}
          </Text>
          {(item.floor || item.room) && (
            <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
              {[item.floor && `Floor: ${item.floor}`, item.room && `Room: ${item.room}`].filter(Boolean).join(' • ')}
            </Text>
          )}
        </View>
        <View
          style={{
            backgroundColor: `${getRoleBadgeColor(item.role)}20`,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: borderRadius.md,
          }}
        >
          <Text
            style={{
              color: getRoleBadgeColor(item.role),
              fontSize: 12,
              fontWeight: '600',
              textTransform: 'capitalize',
            }}
          >
            {item.role?.replace('_', ' ')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const activeCount = users?.filter(u => u.active !== false && !u.pending_setup).length || 0;
  const pendingCount = users?.filter(u => u.pending_setup).length || 0;
  const inactiveCount = users?.filter(u => u.active === false && !u.pending_setup).length || 0;

  const handleAdd = () => {
    Alert.alert(
      'Add Users',
      'How would you like to add users?',
      [
        { text: 'Single Student', onPress: () => setAddUserModalVisible(true) },
        { text: 'Upload CSV', onPress: handlePickCSVFile },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleCancelAddUser = () => {
    setAddUserModalVisible(false);
    setNewStudent({ email: '', first_name: '', last_name: '', role: 'student', floor: '', room: '' });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }} edges={['bottom']}>
      <AdminScreenHeader
        title="Users"
        subtitle={isLoading ? 'Loading...' : `${filteredUsers.length} user${filteredUsers.length !== 1 ? 's' : ''} • ${activeCount} active${pendingCount > 0 ? ` • ${pendingCount} pending` : ''}`}
        onBack={() => navigation.goBack()}
        onAdd={handleAdd}
      />
      {isLoading && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: secondaryColor }}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      )}
      {!isLoading && <>

      {/* Search + Export */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: spacing.sm }}>
          <TouchableOpacity 
            onPress={exportUsersCSV}
            data-testid="export-users-btn"
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSecondary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: borderRadius.sm }}
          >
            <Ionicons name="download-outline" size={18} color={colors.textPrimary} />
            <Text style={{ marginLeft: 6, color: colors.textPrimary, fontWeight: '500', fontSize: 14 }}>Export</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
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
            placeholder="Search users..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            data-testid="search-users-input"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Role Filter - Fixed height container */}
      <View style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10 }}
        >
          {roles.map((role) => (
            <TouchableOpacity
              key={role}
              onPress={() => setSelectedRole(role)}
              data-testid={`filter-${role}`}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 20,
                backgroundColor: selectedRole === role ? primaryColor : colors.surfaceSecondary,
                marginHorizontal: 4,
                minWidth: 70,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: selectedRole === role ? colors.surface : colors.textSecondary,
                  fontWeight: '600',
                  fontSize: 14,
                  textTransform: 'capitalize',
                }}
              >
                {role.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Users List */}
      <FlatList
        data={filteredUsers}
        keyExtractor={(item, index) => item.id || `item-${index}`}
        renderItem={renderUser}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={{ padding: spacing.xxl, alignItems: 'center' }}>
            <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
            <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 12 }}>
              No users found
            </Text>
          </View>
        }
      />

      {/* Add Student Modal */}
      <Modal
        visible={addUserModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCancelAddUser}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={handleCancelAddUser} data-testid="cancel-add-student">
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>Add User</Text>
            <TouchableOpacity onPress={handleInviteStudent} disabled={inviteStudent.isPending} data-testid="send-invite-btn">
              <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>
                {inviteStudent.isPending ? 'Sending...' : 'Send Invite'}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {/* Info Banner */}
            <View style={{ backgroundColor: primaryColor + '15', padding: 12, borderRadius: borderRadius.md, marginBottom: 20, borderWidth: 1, borderColor: primaryColor }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="mail" size={20} color={primaryColor} />
                <Text style={{ color: primaryColor, fontWeight: '600', marginLeft: 8 }}>Email Invitation</Text>
              </View>
              <Text style={{ color: primaryColor, fontSize: 13, marginTop: 4 }}>
                The student will receive an email to set up their own password.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', marginBottom: 16 }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>First Name *</Text>
                <TextInput
                  style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary }}
                  placeholder="John"
                  placeholderTextColor={colors.textTertiary}
                  value={newStudent.first_name}
                  onChangeText={(text) => setNewStudent({ ...newStudent, first_name: text })}
                  returnKeyType="next"
                  onSubmitEditing={() => lastNameRef.current?.focus()}
                  data-testid="first-name-input"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Last Name *</Text>
                <TextInput
                  ref={lastNameRef}
                  style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary }}
                  placeholder="Doe"
                  placeholderTextColor={colors.textTertiary}
                  value={newStudent.last_name}
                  onChangeText={(text) => setNewStudent({ ...newStudent, last_name: text })}
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                  data-testid="last-name-input"
                />
              </View>
            </View>

            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Email Address *</Text>
            <TextInput
              ref={emailRef}
              style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary, marginBottom: 16 }}
              placeholder="student@example.com"
              placeholderTextColor={colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              value={newStudent.email}
              onChangeText={(text) => setNewStudent({ ...newStudent, email: text })}
              returnKeyType="next"
              onSubmitEditing={() => floorRef.current?.focus()}
              data-testid="email-input"
            />

            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Role</Text>
            <View style={{ flexDirection: 'row', marginBottom: 16, backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 3 }}>
              {[
                { key: 'student', label: 'Student' },
                { key: 'ra', label: 'RA' },
                { key: 'admin', label: 'Admin' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setNewStudent({ ...newStudent, role: opt.key })}
                  style={{
                    flex: 1, paddingVertical: 10, borderRadius: borderRadius.sm,
                    backgroundColor: newStudent.role === opt.key ? primaryColor : 'transparent',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{
                    fontSize: 14, fontWeight: '600',
                    color: newStudent.role === opt.key ? 'white' : colors.textSecondary,
                  }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', marginBottom: 16 }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Floor</Text>
                <TextInput
                  ref={floorRef}
                  style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary }}
                  placeholder="e.g., Floor 1"
                  placeholderTextColor={colors.textTertiary}
                  value={newStudent.floor}
                  onChangeText={(text) => setNewStudent({ ...newStudent, floor: text })}
                  returnKeyType="next"
                  onSubmitEditing={() => roomRef.current?.focus()}
                  data-testid="floor-input"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Room Number</Text>
                <TextInput
                  ref={roomRef}
                  style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 16, color: colors.textPrimary }}
                  placeholder="e.g., 101"
                  placeholderTextColor={colors.textTertiary}
                  value={newStudent.room}
                  onChangeText={(text) => setNewStudent({ ...newStudent, room: text })}
                  returnKeyType="done"
                  onSubmitEditing={handleInviteStudent}
                  data-testid="room-input"
                />
              </View>
            </View>

            <View style={{ backgroundColor: primaryColor + '15', padding: 12, borderRadius: borderRadius.md, marginTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="information-circle" size={20} color={colors.warning} />
                <Text style={{ color: primaryColor, fontWeight: '600', marginLeft: 8 }}>How it works</Text>
              </View>
              <Text style={{ color: primaryColor, fontSize: 13, marginTop: 4 }}>
                1. An invitation email with a code will be sent{'\n'}
                2. They download the app and tap "Join with Invite Code"{'\n'}
                3. They enter the code, set a password, and they're in!
              </Text>
            </View>

            {/* Bulk Import Option */}
            <TouchableOpacity
              onPress={() => {
                setAddUserModalVisible(false);
                setTimeout(() => handlePickCSVFile(), 300);
              }}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                marginTop: 20, padding: 14,
                backgroundColor: colors.surfaceSecondary,
                borderRadius: borderRadius.md,
                borderWidth: 1, borderColor: colors.border,
              }}
            >
              <Ionicons name="cloud-upload-outline" size={20} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontWeight: '500', marginLeft: 8 }}>
                Import multiple students via CSV
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Status Toggle Modal */}
      <Modal
        visible={statusModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setStatusModalVisible(false);
          setSelectedUser(null);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: spacing.xxl, width: '100%', maxWidth: 340 }}>
            {/* Icon */}
            <View style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: selectedUser?.active !== false ? primaryColor + '15' : primaryColor + '15',
              justifyContent: 'center',
              alignItems: 'center',
              alignSelf: 'center',
              marginBottom: 16,
            }}>
              <Ionicons
                name={selectedUser?.active !== false ? 'close-circle' : 'checkmark-circle'}
                size={32}
                color={selectedUser?.active !== false ? primaryColor : primaryColor}
              />
            </View>

            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary, textAlign: 'center', marginBottom: 8 }}>
              {selectedUser?.active !== false ? 'Deactivate User' : 'Activate User'}
            </Text>

            <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 16 }}>
              {selectedUser?.active !== false 
                ? `Are you sure you want to deactivate ${selectedUser?.first_name} ${selectedUser?.last_name}? They will no longer be able to log in.`
                : `Are you sure you want to activate ${selectedUser?.first_name} ${selectedUser?.last_name}? They will be able to log in again.`
              }
            </Text>

            {/* User Info */}
            <View style={{ backgroundColor: colors.background, borderRadius: borderRadius.md, padding: 12, marginBottom: 20 }}>
              <Text style={{ fontSize: 13, color: colors.textPrimary }}><Text style={{ fontWeight: '600' }}>Email:</Text> {selectedUser?.email}</Text>
              <Text style={{ fontSize: 13, color: colors.textPrimary, marginTop: 4 }}><Text style={{ fontWeight: '600' }}>Role:</Text> {selectedUser?.role}</Text>
              <Text style={{ fontSize: 13, color: colors.textPrimary, marginTop: 4 }}><Text style={{ fontWeight: '600' }}>Current Status:</Text> {selectedUser?.pending_setup ? 'Pending Setup' : (selectedUser?.active !== false ? 'Active' : 'Inactive')}</Text>
            </View>

            {/* Buttons */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  setStatusModalVisible(false);
                  setSelectedUser(null);
                }}
                style={{ flex: 1, paddingVertical: 14, borderRadius: borderRadius.md, backgroundColor: colors.surfaceSecondary }}
              >
                <Text style={{ textAlign: 'center', color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleToggleStatus}
                disabled={toggleUserStatus.isPending}
                data-testid="confirm-status-toggle"
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: borderRadius.md,
                  backgroundColor: selectedUser?.active !== false ? primaryColor : primaryColor,
                }}
              >
                <Text style={{ textAlign: 'center', color: colors.textInverse, fontWeight: '600' }}>
                  {toggleUserStatus.isPending ? 'Processing...' : (selectedUser?.active !== false ? 'Deactivate' : 'Activate')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Email Edit Modal */}
      <Modal
        visible={emailEditModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => { setEmailEditModalVisible(false); setEmailEditUser(null); setEmailEditValue(''); }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: spacing.xxl, width: '100%', maxWidth: 340 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: primaryColor + '15', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 16 }}>
              <Ionicons name="mail-outline" size={26} color={primaryColor} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary, textAlign: 'center', marginBottom: 4 }}>
              Change Email
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 }}>
              {emailEditUser?.first_name} {emailEditUser?.last_name}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 6 }}>Current email</Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 16, padding: 10, backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md }}>
              {emailEditUser?.email}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 6 }}>New email address</Text>
            <TextInput
              style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 15, color: colors.textPrimary, marginBottom: 24, borderWidth: 1, borderColor: primaryColor + '40' }}
              placeholder="new@example.com"
              placeholderTextColor={colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              value={emailEditValue}
              onChangeText={setEmailEditValue}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => { setEmailEditModalVisible(false); setEmailEditUser(null); setEmailEditValue(''); }}
                style={{ flex: 1, paddingVertical: 14, borderRadius: borderRadius.md, backgroundColor: colors.surfaceSecondary }}
              >
                <Text style={{ textAlign: 'center', color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleEmailEditSave}
                disabled={updateUserEmail.isPending}
                style={{ flex: 1, paddingVertical: 14, borderRadius: borderRadius.md, backgroundColor: primaryColor }}
              >
                <Text style={{ textAlign: 'center', color: colors.textInverse, fontWeight: '600' }}>
                  {updateUserEmail.isPending ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bulk Import Results Modal */}
      <Modal
        visible={bulkImportModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setBulkImportModalVisible(false);
          setBulkImportResults(null);
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ width: 60 }} />
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>Bulk Import</Text>
            <TouchableOpacity 
              onPress={() => {
                setBulkImportModalVisible(false);
                setBulkImportResults(null);
              }}
              data-testid="close-bulk-import"
            >
              <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>Done</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={{ flex: 1, padding: spacing.lg }}>
            {bulkImport.isPending && (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                {/* Progress Bar */}
                <View style={{ width: '100%', marginBottom: 20 }}>
                  <View style={{ height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' }}>
                    <View 
                      style={{ 
                        height: '100%', 
                        backgroundColor: primaryColor, 
                        borderRadius: 4,
                        width: `${uploadProgress}%`,
                      }} 
                    />
                  </View>
                  <Text style={{ textAlign: 'center', marginTop: 8, fontSize: 14, color: colors.textSecondary }}>
                    {uploadProgress < 100 ? `Uploading... ${uploadProgress}%` : 'Processing students...'}
                  </Text>
                </View>
                <ActivityIndicator size="large" color={primaryColor} />
                <Text style={{ marginTop: 16, fontSize: 16, color: colors.textSecondary }}>
                  {uploadProgress < 100 ? 'Uploading file...' : 'Creating student accounts...'}
                </Text>
              </View>
            )}
            
            {bulkImportResults && (
              <>
                {/* Summary */}
                <View style={{ flexDirection: 'row', marginBottom: 20 }}>
                  <View style={{ flex: 1, backgroundColor: primaryColor + '15', padding: spacing.lg, borderRadius: borderRadius.md, marginRight: 8, alignItems: 'center' }}>
                    <Text style={{ fontSize: 28, fontWeight: 'bold', color: primaryColor }}>{bulkImportResults.successful}</Text>
                    <Text style={{ fontSize: 13, color: primaryColor }}>Successful</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: bulkImportResults.failed > 0 ? colors.errorLight : colors.surfaceSecondary, padding: spacing.lg, borderRadius: borderRadius.md, marginLeft: 8, alignItems: 'center' }}>
                    <Text style={{ fontSize: 28, fontWeight: 'bold', color: bulkImportResults.failed > 0 ? colors.error : colors.textTertiary }}>{bulkImportResults.failed}</Text>
                    <Text style={{ fontSize: 13, color: bulkImportResults.failed > 0 ? colors.error : colors.textSecondary }}>Failed</Text>
                  </View>
                </View>
                
                <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 }}>
                  Total rows processed: {bulkImportResults.total_rows}
                </Text>
                
                {/* Success message */}
                {bulkImportResults.successful > 0 && (
                  <View style={{ backgroundColor: primaryColor + '15', padding: 12, borderRadius: borderRadius.md, marginBottom: 16, borderWidth: 1, borderColor: primaryColor }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="checkmark-circle" size={20} color={primaryColor} />
                      <Text style={{ color: primaryColor, fontWeight: '600', marginLeft: 8 }}>Students Added</Text>
                    </View>
                    <Text style={{ color: primaryColor, fontSize: 13, marginTop: 4 }}>
                      {bulkImportResults.successful} student{bulkImportResults.successful !== 1 ? 's' : ''} will receive invitation emails to set up their passwords.
                    </Text>
                  </View>
                )}
                
                {/* Errors */}
                {bulkImportResults.errors && bulkImportResults.errors.length > 0 && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>
                      Errors ({bulkImportResults.errors.length})
                    </Text>
                    {bulkImportResults.errors.map((error, index) => (
                      <View key={index} style={{ backgroundColor: colors.errorLight, padding: 12, borderRadius: borderRadius.sm, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: colors.error }}>
                        <Text style={{ fontWeight: '600', color: colors.error, fontSize: 13 }}>
                          Row {error.row}: {error.name || error.email || 'Unknown'}
                        </Text>
                        {error.errors.map((err, errIndex) => (
                          <Text key={errIndex} style={{ color: colors.error, fontSize: 12, marginTop: 2 }}>• {err}</Text>
                        ))}
                      </View>
                    ))}
                  </View>
                )}
                
                {/* Successfully created users */}
                {bulkImportResults.created_users && bulkImportResults.created_users.length > 0 && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>
                      Created Students ({bulkImportResults.created_users.length})
                    </Text>
                    {bulkImportResults.created_users.map((user, index) => (
                      <View key={index} style={{ backgroundColor: colors.background, padding: 12, borderRadius: borderRadius.sm, marginBottom: 8 }}>
                        <Text style={{ fontWeight: '600', color: colors.textPrimary, fontSize: 14 }}>{user.name}</Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{user.email}</Text>
                        {(user.floor || user.room) && (
                          <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 2 }}>
                            {[user.floor, user.room && `Room ${user.room}`].filter(Boolean).join(' • ')}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      </>}
    </SafeAreaView>
  );
}
