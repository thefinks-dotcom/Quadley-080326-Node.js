import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { useTenant } from '../../contexts/TenantContext';

export default function AdminMessagesScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const [activeTab, setActiveTab] = useState('conversations');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: conversations, isLoading: loadingConversations, refetch: refetchConversations } = useQuery({
    queryKey: ['adminConversations'],
    queryFn: async () => {
      const response = await api.get(ENDPOINTS.CONVERSATIONS);
      return response.data;
    },
  });

  const { data: groups, isLoading: loadingGroups, refetch: refetchGroups } = useQuery({
    queryKey: ['adminMessageGroups'],
    queryFn: async () => {
      const response = await api.get(ENDPOINTS.MESSAGE_GROUPS);
      return response.data;
    },
  });

  const isLoading = activeTab === 'conversations' ? loadingConversations : loadingGroups;
  const data = activeTab === 'conversations' ? conversations : groups;

  const filteredData = data?.filter((item) => {
    const name = activeTab === 'conversations' ? item.other_user_name : item.name;
    return name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const renderItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('Chat', {
        id: activeTab === 'conversations' ? item.conversation_id : item.id,
        name: activeTab === 'conversations' ? item.other_user_name : item.name,
        type: activeTab === 'conversations' ? 'direct' : 'group',
      })}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceSecondary,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          backgroundColor: activeTab === 'conversations' ? primaryColor + '15' : primaryColor + '15',
          borderRadius: 24,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 12,
        }}
      >
        <Ionicons
          name={activeTab === 'conversations' ? 'person' : 'people'}
          size={22}
          color={activeTab === 'conversations' ? primaryColor : primaryColor}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
          {activeTab === 'conversations' ? item.other_user_name : item.name}
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
          {item.last_message || (activeTab === 'group' ? `${item.members?.length || 0} members` : 'No messages yet')}
        </Text>
      </View>
      {item.unread_count > 0 && (
        <View style={{ backgroundColor: primaryColor, paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.md }}>
          <Text style={{ color: colors.textInverse, fontSize: 12, fontWeight: '600' }}>{item.unread_count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }}>
      {/* Header */}
      <View style={{ backgroundColor: colors.surface, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.textPrimary }}>Messages</Text>
      </View>

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
      <View style={{ flexDirection: 'row', backgroundColor: colors.surface, paddingHorizontal: 16 }}>
        <TouchableOpacity
          onPress={() => setActiveTab('conversations')}
          style={{ flex: 1, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: activeTab === 'conversations' ? primaryColor : 'transparent' }}
        >
          <Text style={{ textAlign: 'center', fontWeight: '600', color: activeTab === 'conversations' ? primaryColor : colors.textSecondary }}>
            Direct Messages
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('groups')}
          style={{ flex: 1, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: activeTab === 'groups' ? primaryColor : 'transparent' }}
        >
          <Text style={{ textAlign: 'center', fontWeight: '600', color: activeTab === 'groups' ? primaryColor : colors.textSecondary }}>Groups</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item, index) => item.id || item.conversation_id || `msg-${index}`}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => { refetchConversations(); refetchGroups(); }} />
          }
          ListEmptyComponent={
            <View style={{ padding: spacing.xxl, alignItems: 'center' }}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.textTertiary} />
              <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 12 }}>No messages yet</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
