import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  ActivityIndicator, TextInput, Modal, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedScreen } from '../../components/AnimatedScreen';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { borderRadius, spacing, shadows } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useTenant } from '../../contexts/TenantContext';

export default function MessagesScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessageModalVisible, setNewMessageModalVisible] = useState(false);
  const [newGroupModalVisible, setNewGroupModalVisible] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState('');

  const { data: conversations, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => { const r = await api.get(ENDPOINTS.CONVERSATIONS); return r.data || []; },
    refetchInterval: 10000,
  });

  const { data: allUsers, isLoading: loadingUsers } = useQuery({
    queryKey: ['allUsers'],
    queryFn: async () => { const r = await api.get(ENDPOINTS.USER_SEARCH); return r.data || []; },
  });

  const filteredUsers = userSearchQuery.length > 0
    ? allUsers?.filter(u =>
        u.first_name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        u.last_name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(userSearchQuery.toLowerCase())
      )
    : allUsers;

  const filteredConversations = conversations?.filter((conv) => {
    if (activeTab === 'direct' && conv.type !== 'direct') return false;
    if (activeTab === 'groups' && conv.type !== 'group') return false;
    if (searchQuery) {
      const name = conv.type === 'direct' ? conv.other_user?.name : conv.group_name;
      return name?.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  }) || [];

  const totalUnread = conversations?.reduce((sum, conv) => sum + (conv.unread_count || 0), 0) || 0;

  const toggleUserSelection = (selectedUser) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u.id === selectedUser.id);
      return isSelected ? prev.filter(u => u.id !== selectedUser.id) : [...prev, selectedUser];
    });
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
      setTimeout(() => { try { refetch(); } catch (e) {} }, 500);
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.detail || 'Failed to create group');
    }
  };

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

  const renderConversation = ({ item, index }) => {
    const isGroup = item.type === 'group';
    const name = isGroup ? item.group_name : item.other_user?.name;
    const lastMessage = item.last_message?.content;
    const timestamp = item.last_message?.timestamp || item.timestamp;
    const unread = item.unread_count > 0;

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('Chat', {
          id: item.conversation_id || item.id,
          name, type: item.type, userId: item.other_user?.id,
        })}
        activeOpacity={0.7}
        testID={`conversation-${item.conversation_id || item.id || index}`}
        style={{
          backgroundColor: colors.surface,
          marginHorizontal: spacing.lg,
          marginBottom: spacing.sm,
          borderRadius: borderRadius.lg,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: unread ? primaryColor + '40' : colors.border,
        }}
      >
        {unread && <View style={{ height: 3, backgroundColor: primaryColor }} />}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
          <View style={{
            width: 44, height: 44,
            backgroundColor: secondaryColor + '18',
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

  if (isLoading) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={primaryColor} /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']} testID="messages-screen">
      <AnimatedScreen>
      {/* Hero Header */}
      <View style={{
        backgroundColor: primaryColor,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.xl,
        borderBottomLeftRadius: borderRadius.xxl,
        borderBottomRightRadius: borderRadius.xxl,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {navigation.canGoBack() && (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ width: 36, height: 36, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm }}
            >
              <Ionicons name="chevron-back" size={22} color={colors.textInverse} />
            </TouchableOpacity>
          )}
          {!navigation.canGoBack() && (
            <View style={{ width: 44, height: 44, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="chatbubbles" size={22} color={colors.textInverse} />
            </View>
          )}
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={{ color: colors.textInverse, fontSize: 20, fontWeight: '700', letterSpacing: -0.4 }}>Messages</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2, fontWeight: '500' }}>
              {totalUnread > 0 ? `${totalUnread} unread` : `${conversations?.length || 0} conversations`}
            </Text>
          </View>
        </View>
        {/* Search integrated into header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: 'rgba(255,255,255,0.15)',
          borderRadius: borderRadius.md,
          paddingHorizontal: 12,
          marginTop: spacing.md,
        }}>
          <Ionicons name="search" size={16} color="rgba(255,255,255,0.5)" />
          <TextInput
            style={{ flex: 1, paddingVertical: 10, paddingLeft: 8, fontSize: 14, color: colors.textInverse }}
            placeholder="Search conversations..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            testID="messages-search-input"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Pill Tabs */}
      <View style={{
        flexDirection: 'row',
        marginHorizontal: spacing.lg,
        marginTop: spacing.lg,
        marginBottom: spacing.md,
        backgroundColor: colors.surfaceSecondary,
        borderRadius: borderRadius.md,
        padding: 3,
      }}>
        {[
          { key: 'all', label: 'All', count: conversations?.length || 0 },
          { key: 'direct', label: 'Direct', count: conversations?.filter(c => c.type === 'direct').length || 0 },
          { key: 'groups', label: 'Groups', count: conversations?.filter(c => c.type === 'group').length || 0 },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            testID={`tab-${tab.key}`}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: spacing.sm + 2,
              borderRadius: borderRadius.sm + 2,
              backgroundColor: activeTab === tab.key ? colors.surface : 'transparent',
              ...(activeTab === tab.key ? shadows.sm : {}),
            }}
          >
            <Text style={{ fontWeight: '600', fontSize: 13, color: activeTab === tab.key ? colors.textPrimary : colors.textTertiary }}>
              {tab.label}
            </Text>
            <View style={{
              backgroundColor: activeTab === tab.key ? primaryColor + '18' : secondaryColor + '20',
              paddingHorizontal: 6, paddingVertical: 1,
              borderRadius: 10, marginLeft: 6,
            }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: activeTab === tab.key ? primaryColor : colors.textTertiary }}>
                {tab.count}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Conversations List */}
      <FlatList
        data={filteredConversations}
        keyExtractor={(item, index) => item.conversation_id || item.id || `conv-${index}`}
        renderItem={renderConversation}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={primaryColor} />}
        contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={{ padding: spacing.xxxl, alignItems: 'center' }}>
            <View style={{ width: 56, height: 56, backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.lg, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg }}>
              <Ionicons name="chatbubbles-outline" size={24} color={colors.textTertiary} />
            </View>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>No conversations yet</Text>
            <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 4, textAlign: 'center' }}>Tap + to start a new message</Text>
          </View>
        }
      />
      </AnimatedScreen>

      {/* FABs */}
      <View style={{ position: 'absolute', bottom: 90, right: 24 }}>
        <TouchableOpacity
          onPress={() => setNewGroupModalVisible(true)}
          testID="new-group-fab"
          style={{ width: 44, height: 44, backgroundColor: primaryColor, borderRadius: borderRadius.lg, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm, ...shadows.md }}
        >
          <Ionicons name="people" size={20} color={colors.textInverse} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setNewMessageModalVisible(true)}
          testID="new-message-fab"
          style={{ width: 52, height: 52, backgroundColor: primaryColor, borderRadius: borderRadius.xl, justifyContent: 'center', alignItems: 'center', ...shadows.lg }}
        >
          <Ionicons name="create" size={24} color={colors.textInverse} />
        </TouchableOpacity>
      </View>

      {/* New Message Modal */}
      <Modal visible={newMessageModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setNewMessageModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => { setNewMessageModalVisible(false); setUserSearchQuery(''); }} testID="new-msg-cancel">
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>New Message</Text>
            <View style={{ width: 50 }} />
          </View>
          <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, paddingHorizontal: 12 }}>
              <Ionicons name="search" size={18} color={colors.textTertiary} />
              <TextInput
                style={{ flex: 1, paddingVertical: 10, paddingLeft: 8, fontSize: 15, color: colors.textPrimary }}
                placeholder="Search by name..." placeholderTextColor={colors.textTertiary}
                value={userSearchQuery} onChangeText={setUserSearchQuery} autoFocus
                testID="new-msg-search"
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
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderLight || colors.border + '30' }}
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
                <View style={{ padding: spacing.xxxl, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, color: colors.textTertiary }}>No users found</Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* New Group Modal */}
      <Modal visible={newGroupModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setNewGroupModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => { setNewGroupModalVisible(false); setSelectedUsers([]); setGroupName(''); setUserSearchQuery(''); }} testID="new-group-cancel">
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>New Group</Text>
            <TouchableOpacity onPress={handleCreateGroup} testID="create-group-btn">
              <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>Create</Text>
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={{ padding: spacing.lg }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>Group Name</Text>
              <TextInput
                style={{ backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: 12, fontSize: 15, color: colors.textPrimary }}
                placeholder="Enter group name..." placeholderTextColor={colors.textTertiary}
                value={groupName} onChangeText={setGroupName} testID="group-name-input"
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
                  placeholder="Search users..." placeholderTextColor={colors.textTertiary}
                  value={userSearchQuery} onChangeText={setUserSearchQuery} testID="group-member-search"
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
                      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderLight || colors.border + '30' }}>
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
