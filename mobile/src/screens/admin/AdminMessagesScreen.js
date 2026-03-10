import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { spacing, borderRadius } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { useTenant } from '../../contexts/TenantContext';
import AdminScreenHeader from '../../components/AdminScreenHeader';
import { format } from 'date-fns';

export default function AdminMessagesScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('conversations');
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessageModalVisible, setNewMessageModalVisible] = useState(false);
  const [newGroupModalVisible, setNewGroupModalVisible] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState('');

  const { data: conversations, isLoading: loadingConversations, refetch: refetchConversations, isRefetching } = useQuery({
    queryKey: ['adminConversations'],
    queryFn: async () => {
      const response = await api.get(ENDPOINTS.CONVERSATIONS);
      return response.data || [];
    },
    refetchInterval: 15000,
  });

  const modalOpen = newMessageModalVisible || newGroupModalVisible;
  const { data: allUsers, isLoading: loadingUsers } = useQuery({
    queryKey: ['allUsers'],
    queryFn: async () => {
      const r = await api.get(ENDPOINTS.USER_SEARCH);
      return r.data || [];
    },
    enabled: modalOpen,
    staleTime: 60 * 1000,
  });

  const filteredUsers = userSearchQuery.length > 0
    ? allUsers?.filter(u =>
        u.first_name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        u.last_name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(userSearchQuery.toLowerCase())
      )
    : allUsers;

  const directConversations = conversations?.filter(c => c.type === 'direct') || [];
  const groupConversations = conversations?.filter(c => c.type === 'group') || [];
  const activeData = activeTab === 'conversations' ? directConversations : groupConversations;

  const filteredData = searchQuery
    ? activeData.filter(item => {
        const name = item.type === 'direct' ? item.other_user?.name : item.group_name;
        return name?.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : activeData;

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      const diffDays = Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return format(date, 'h:mm a');
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return format(date, 'EEEE');
      return format(date, 'MMM d');
    } catch { return ''; }
  };

  const startDirectChat = (selectedUser) => {
    setNewMessageModalVisible(false);
    setUserSearchQuery('');
    const existingConv = conversations?.find(c => c.type === 'direct' && c.other_user?.id === selectedUser.id);
    const name = selectedUser.name || `${selectedUser.first_name} ${selectedUser.last_name}`;
    if (existingConv) {
      navigation.navigate('Chat', { id: existingConv.conversation_id, name, type: 'direct', userId: selectedUser.id });
    } else {
      navigation.navigate('Chat', { id: selectedUser.id, name, type: 'direct', userId: selectedUser.id, isNew: true });
    }
  };

  const toggleUserSelection = (selectedUser) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u.id === selectedUser.id);
      return isSelected ? prev.filter(u => u.id !== selectedUser.id) : [...prev, selectedUser];
    });
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) { Alert.alert('Error', 'Please enter a group name'); return; }
    if (!selectedUsers || selectedUsers.length < 1) { Alert.alert('Error', 'Please select at least one member'); return; }
    const validMemberIds = selectedUsers.filter(u => u && u.id).map(u => u.id);
    if (validMemberIds.length === 0) { Alert.alert('Error', 'No valid members selected'); return; }
    try {
      await api.post('/message-groups', { name: groupName.trim(), member_ids: validMemberIds });
      setNewGroupModalVisible(false);
      setSelectedUsers([]);
      setGroupName('');
      setUserSearchQuery('');
      Alert.alert('Success', `Group "${groupName.trim()}" created!`);
      queryClient.invalidateQueries({ queryKey: ['adminConversations'] });
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.detail || 'Failed to create group');
    }
  };

  const renderItem = ({ item }) => {
    const isGroup = item.type === 'group';
    const name = isGroup ? item.group_name : item.other_user?.name;
    const lastMessage = item.last_message?.content;
    const timestamp = item.last_message?.timestamp || item.timestamp;
    const unread = item.unread_count > 0;

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('Chat', {
          id: item.conversation_id || item.id,
          name,
          type: item.type,
          userId: item.other_user?.id,
        })}
        activeOpacity={0.7}
        style={{
          backgroundColor: colors.surface,
          marginHorizontal: spacing.lg,
          marginBottom: spacing.sm,
          borderRadius: borderRadius.lg,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: unread ? primaryColor + '40' : colors.border || colors.surfaceSecondary,
        }}
      >
        {unread && <View style={{ height: 3, backgroundColor: primaryColor }} />}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
          <View style={{
            width: 44, height: 44,
            backgroundColor: primaryColor + '15',
            borderRadius: borderRadius.md,
            justifyContent: 'center', alignItems: 'center',
            marginRight: 12,
          }}>
            <Ionicons name={isGroup ? 'people' : 'person'} size={20} color={primaryColor} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: unread ? '700' : '500', color: colors.textPrimary, flex: 1 }} numberOfLines={1}>
                {name}
              </Text>
              <Text style={{ fontSize: 11, color: unread ? primaryColor : colors.textTertiary, marginLeft: 8, fontWeight: '500' }}>
                {formatTimestamp(timestamp)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
              <Text style={{ fontSize: 13, color: unread ? colors.textPrimary : colors.textTertiary, flex: 1, fontWeight: unread ? '500' : '400' }} numberOfLines={1}>
                {lastMessage || (isGroup ? `${item.members?.length || 0} members` : 'Start a conversation')}
              </Text>
              {unread && (
                <View style={{ backgroundColor: primaryColor, minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginLeft: 8 }}>
                  <Text style={{ color: colors.textInverse, fontSize: 11, fontWeight: 'bold' }}>{item.unread_count > 9 ? '9+' : item.unread_count}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const totalConvs = (conversations?.length || 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }} edges={['bottom']}>
      <AdminScreenHeader
        title="Messages"
        subtitle={`${totalConvs} conversation${totalConvs !== 1 ? 's' : ''}`}
        onBack={() => navigation.goBack()}
        onAdd={() => setNewMessageModalVisible(true)}
      />

      {/* Search */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={20} color={colors.textTertiary} />
          <TextInput
            style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 8, fontSize: 16, color: colors.textPrimary }}
            placeholder="Search messages..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: colors.surface, paddingHorizontal: 16, marginBottom: spacing.sm }}>
        <TouchableOpacity
          onPress={() => setActiveTab('conversations')}
          style={{ flex: 1, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: activeTab === 'conversations' ? primaryColor : 'transparent' }}
        >
          <Text style={{ textAlign: 'center', fontWeight: '600', color: activeTab === 'conversations' ? primaryColor : colors.textSecondary }}>
            Direct ({directConversations.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('groups')}
          style={{ flex: 1, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: activeTab === 'groups' ? primaryColor : 'transparent' }}
        >
          <Text style={{ textAlign: 'center', fontWeight: '600', color: activeTab === 'groups' ? primaryColor : colors.textSecondary }}>
            Groups ({groupConversations.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loadingConversations ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item, index) => item.conversation_id || item.id || `msg-${index}`}
          renderItem={renderItem}
          contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: spacing.xxl }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetchConversations} tintColor={primaryColor} />
          }
          ListEmptyComponent={
            <View style={{ padding: spacing.xxl, alignItems: 'center' }}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.textTertiary} />
              <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 12, fontWeight: '600' }}>No conversations yet</Text>
              <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 4 }}>Tap + to start a new message</Text>
            </View>
          }
        />
      )}

      {/* New Message Modal */}
      <Modal visible={newMessageModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setNewMessageModalVisible(false); setUserSearchQuery(''); }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.surfaceSecondary }}>
            <TouchableOpacity onPress={() => { setNewMessageModalVisible(false); setUserSearchQuery(''); }}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>New Message</Text>
            <TouchableOpacity onPress={() => { setNewMessageModalVisible(false); setUserSearchQuery(''); setNewGroupModalVisible(true); }}>
              <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>New Group</Text>
            </TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, paddingHorizontal: 12 }}>
              <Ionicons name="search" size={18} color={colors.textTertiary} />
              <TextInput
                style={{ flex: 1, paddingVertical: 10, paddingLeft: 8, fontSize: 15, color: colors.textPrimary }}
                placeholder="Search by name..."
                placeholderTextColor={colors.textTertiary}
                value={userSearchQuery}
                onChangeText={setUserSearchQuery}
                autoFocus
              />
            </View>
          </View>
          {loadingUsers ? (
            <ActivityIndicator size="large" color={primaryColor} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={(item, index) => item.id || `user-${index}`}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => startDirectChat(item)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.surfaceSecondary }}
                >
                  <View style={{ width: 40, height: 40, backgroundColor: primaryColor + '15', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: primaryColor }}>{item.first_name?.[0]}{item.last_name?.[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '500', color: colors.textPrimary }}>{item.first_name} {item.last_name}</Text>
                    <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 1 }}>{item.floor || item.role}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ padding: spacing.xxl, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, color: colors.textTertiary }}>No users found</Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* New Group Modal */}
      <Modal visible={newGroupModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setNewGroupModalVisible(false); setSelectedUsers([]); setGroupName(''); setUserSearchQuery(''); }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.surfaceSecondary }}>
            <TouchableOpacity onPress={() => { setNewGroupModalVisible(false); setSelectedUsers([]); setGroupName(''); setUserSearchQuery(''); }}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>New Group</Text>
            <TouchableOpacity onPress={handleCreateGroup}>
              <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>Create</Text>
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={{ padding: spacing.lg }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>Group Name</Text>
              <TextInput
                style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 15, color: colors.textPrimary }}
                placeholder="Enter group name..."
                placeholderTextColor={colors.textTertiary}
                value={groupName}
                onChangeText={setGroupName}
              />
            </View>
            {selectedUsers.length > 0 && (
              <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>Selected ({selectedUsers.length})</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {selectedUsers.map((u, idx) => (
                    <TouchableOpacity key={u.id || `sel-${idx}`} onPress={() => toggleUserSelection(u)}
                      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: primaryColor + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.md, marginRight: 8 }}>
                      <Text style={{ color: primaryColor, fontWeight: '500', fontSize: 13 }}>{u.first_name}</Text>
                      <Ionicons name="close" size={14} color={primaryColor} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>Add Members</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, paddingHorizontal: 12 }}>
                <Ionicons name="search" size={18} color={colors.textTertiary} />
                <TextInput
                  style={{ flex: 1, paddingVertical: 10, paddingLeft: 8, fontSize: 15, color: colors.textPrimary }}
                  placeholder="Search users..."
                  placeholderTextColor={colors.textTertiary}
                  value={userSearchQuery}
                  onChangeText={setUserSearchQuery}
                />
              </View>
            </View>
            <View style={{ marginTop: spacing.md }}>
              {loadingUsers ? (
                <ActivityIndicator size="small" color={primaryColor} style={{ marginTop: 20 }} />
              ) : (
                filteredUsers?.map((item, index) => {
                  const isSelected = selectedUsers.some(u => u.id === item.id);
                  return (
                    <TouchableOpacity key={item.id || `gu-${index}`} onPress={() => toggleUserSelection(item)}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.surfaceSecondary }}>
                      <View style={{
                        width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12,
                        backgroundColor: isSelected ? primaryColor : primaryColor + '12',
                      }}>
                        {isSelected ? (
                          <Ionicons name="checkmark" size={20} color={colors.textInverse} />
                        ) : (
                          <Text style={{ fontSize: 14, fontWeight: '600', color: primaryColor }}>{item.first_name?.[0]}{item.last_name?.[0]}</Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '500', color: colors.textPrimary }}>{item.first_name} {item.last_name}</Text>
                        <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 1 }}>{item.floor || item.role}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
