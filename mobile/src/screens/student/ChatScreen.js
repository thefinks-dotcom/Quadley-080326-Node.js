import React, { useState, useEffect, useRef, useCallback } from 'react';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  ActionSheetIOS,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { useTenant } from '../../contexts/TenantContext';

const REPORT_CATEGORIES = [
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'threats', label: 'Threats or violence' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'spam', label: 'Spam or unwanted contact' },
  { value: 'other', label: 'Other' },
];

const checkContent = (text) => {
  const t = text.toLowerCase();
  const tier1 = [
    /\b(kill\s*(your)?self|kys)\b/,
    /\bsuicide\b/,
    /\bself.?harm\b/,
    /\bi.?will\s+kill\b/,
    /\bi.?will\s+hurt\b/,
    /i('ll| will) (find|hurt|kill) you/,
    /\bdeath\s+threat\b/,
    /bomb|shoot\s+up|mass\s+shooting/,
  ];
  const tier2 = [
    /\b(you('re| are)\s+(stupid|worthless|ugly|fat|dumb|pathetic|useless|a\s+loser))\b/,
    /\b(hate\s+you|go\s+die|drop\s+dead)\b/,
    /\b(freak|weirdo|retard|idiot)\b/,
    /\bno\s*one\s+(likes|cares\s+about)\s+you\b/,
  ];
  for (const r of tier1) {
    if (r.test(t)) return { level: 1, warning: 'This message contains language that may indicate a threat or self-harm. It cannot be sent.' };
  }
  for (const r of tier2) {
    if (r.test(t)) return { level: 2, warning: 'This message contains language that may be harmful or harassing to the recipient.' };
  }
  return { level: 0, warning: '' };
};

export default function ChatScreen({ route, navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;

  const { id, name, type, userId, isNew } = route.params || {};
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const flatListRef = useRef();
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  // convId starts as id (user ID for new convs), upgrades to actual conversation_id after first send
  const [convId, setConvId] = useState(id);
  const [otherTyping, setOtherTyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const typingTimeoutRef = useRef(null);

  // Content moderation state
  const [messagingSuspended, setMessagingSuspended] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [nudgeLevel, setNudgeLevel] = useState(0);
  const [nudgeWarning, setNudgeWarning] = useState('');
  const [pendingContent, setPendingContent] = useState('');

  // Report state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportCategory, setReportCategory] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  if (!id) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.borderDark} />
        <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Select a conversation to start chatting</Text>
      </SafeAreaView>
    );
  }

  useEffect(() => {
    navigation.setOptions({
      headerTitle: name,
      headerRight: () => (
        <TouchableOpacity
          onPress={() => Alert.alert('Chat Info', `Chat with ${name}`)}
          style={{ marginRight: 8 }}
        >
          <Ionicons name="information-circle-outline" size={24} color={primaryColor} />
        </TouchableOpacity>
      ),
    });
  }, [name, navigation]);

  const { data: messages, isLoading, refetch } = useQuery({
    queryKey: ['chatMessages', convId, type, userId],
    queryFn: async () => {
      try {
        const endpoint = type === 'direct'
          ? `${ENDPOINTS.CONVERSATIONS}/${convId}/messages`
          : `${ENDPOINTS.MESSAGE_GROUPS}/${convId}/messages`;
        const response = await api.get(endpoint);
        return response.data || [];
      } catch (error) {
        // 404 = no messages yet; 403 = new conv not yet created — both are empty, not errors
        if (error.response?.status === 404 || error.response?.status === 403) return [];
        throw error;
      }
    },
    refetchInterval: 3000,
  });

  useEffect(() => {
    const checkTyping = async () => {
      try {
        const response = await api.get(`/messages/typing/${convId}`);
        setOtherTyping(response.data?.is_typing && response.data?.user_id !== user?.id);
      } catch {}
    };
    const interval = setInterval(checkTyping, 2000);
    return () => clearInterval(interval);
  }, [convId, user?.id]);

  const sendTypingIndicator = useCallback(async (typing) => {
    try {
      await api.post(`/messages/typing/${convId}`, { is_typing: typing });
    } catch {}
  }, [convId]);

  const handleTextChange = (text) => {
    setMessage(text);
    if (!isTyping && text.length > 0) {
      setIsTyping(true);
      sendTypingIndicator(true);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendTypingIndicator(false);
    }, 2000);
  };

  const sendMutation = useMutation({
    mutationFn: async ({ content, fileUrl }) => {
      const payload = { content: content || '', file_url: fileUrl };
      if (type === 'direct') {
        payload.receiver_id = userId || id;
      } else {
        payload.group_id = id;
      }
      const response = await api.post(ENDPOINTS.MESSAGES, payload);
      return response.data;
    },
    onSuccess: (data) => {
      setMessage('');
      setSelectedImage(null);
      setIsTyping(false);
      sendTypingIndicator(false);
      // For new conversations, upgrade convId to the real conversation_id returned by the server.
      // This makes all subsequent polls use the correct endpoint instead of the bare user ID.
      if (data?.conversation_id && data.conversation_id !== convId) {
        setConvId(data.conversation_id);
        queryClient.invalidateQueries({ queryKey: ['chatMessages', data.conversation_id] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['chatMessages', convId] });
      }
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error) => {
      const detail = error.response?.data?.detail;
      if (detail && typeof detail === 'object' && detail.code === 'content_flagged') {
        const cats = (detail.categories || [])
          .map(c => c.replace(/_/g, ' '))
          .filter(Boolean)
          .join(', ');
        setNudgeLevel(1);
        setNudgeWarning(
          `This message was blocked by content moderation${cats ? ` (${cats})` : ''}. Please edit or delete your message.`
        );
        setPendingContent(message);
        setShowNudge(true);
      } else if (typeof detail === 'string' && detail.includes('suspended')) {
        setMessagingSuspended(true);
      } else {
        Alert.alert('Error', detail || 'Failed to send message');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (messageId) => {
      await api.delete(`${ENDPOINTS.MESSAGES}/${messageId}`);
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to delete message');
    },
  });

  useEffect(() => {
    const markRead = async () => {
      try {
        if (type === 'direct') {
          await api.put(`${ENDPOINTS.CONVERSATIONS}/${id}/read`);
        } else {
          await api.put(`${ENDPOINTS.MESSAGE_GROUPS}/${id}/read`);
        }
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      } catch {}
    };
    if (messages?.length > 0) markRead();
  }, [id, type, messages?.length]);

  const handleSend = () => {
    const content = message.trim();
    if (!content && !selectedImage) return;

    if (content) {
      const check = checkContent(content);
      if (check.level === 1 || check.level === 2) {
        setNudgeLevel(check.level);
        setNudgeWarning(check.warning);
        setPendingContent(content);
        setShowNudge(true);
        return;
      }
    }

    sendMutation.mutate({ content, fileUrl: selectedImage });
  };

  const submitReport = async () => {
    if (!reportTarget || !reportCategory) {
      Alert.alert('Error', 'Please select a report category');
      return;
    }
    setReportSubmitting(true);
    try {
      await api.post(`/messages/${reportTarget.id}/report`, {
        category: reportCategory,
        details: reportDetails.trim() || undefined,
      });
      Alert.alert('Report Submitted', 'Thank you for helping keep this community safe.');
      setShowReportModal(false);
      setReportTarget(null);
      setReportCategory('');
      setReportDetails('');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to submit report');
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleAttachment = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Library', 'Choose File'], cancelButtonIndex: 0 },
        async (buttonIndex) => {
          if (buttonIndex === 1) takePhoto();
          else if (buttonIndex === 2) pickImage();
          else if (buttonIndex === 3) pickDocument();
        }
      );
    } else {
      Alert.alert('Attach', 'Choose an option', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Library', onPress: pickImage },
        { text: 'Choose File', onPress: pickDocument },
      ]);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take photos');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) uploadImage(result.assets[0].uri);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Media library permission is required');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) uploadImage(result.assets[0].uri);
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (!result.canceled && result.assets?.[0]) uploadFile(result.assets[0]);
    } catch {
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const uploadImage = async (uri) => {
    setUploading(true);
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const fileType = match ? `image/${match[1]}` : 'image/jpeg';
      formData.append('file', { uri, name: filename, type: fileType });
      const response = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSelectedImage(response.data.url);
    } catch {
      Alert.alert('Error', 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const uploadFile = async (file) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' });
      const response = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSelectedImage(response.data.url);
    } catch {
      Alert.alert('Error', 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMessage = (messageId) => {
    Alert.alert('Delete Message', 'Are you sure you want to delete this message?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(messageId) },
    ]);
  };

  const handleLongPress = (item) => {
    const isOwn = item.sender_id === user?.id;
    if (isOwn) {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options: ['Cancel', 'Delete Message'], destructiveButtonIndex: 1, cancelButtonIndex: 0 },
          (buttonIndex) => { if (buttonIndex === 1) handleDeleteMessage(item.id); }
        );
      } else {
        Alert.alert('Message Options', '', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => handleDeleteMessage(item.id) },
        ]);
      }
    } else {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options: ['Cancel', 'Report Message'], destructiveButtonIndex: 1, cancelButtonIndex: 0 },
          (buttonIndex) => {
            if (buttonIndex === 1) {
              setReportTarget(item);
              setReportCategory('');
              setReportDetails('');
              setShowReportModal(true);
            }
          }
        );
      } else {
        Alert.alert('Message Options', '', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Report', style: 'destructive', onPress: () => {
            setReportTarget(item);
            setReportCategory('');
            setReportDetails('');
            setShowReportModal(true);
          }},
        ]);
      }
    }
  };

  const renderMessage = ({ item, index }) => {
    const isOwnMessage = item.sender_id === user?.id;
    const messageTime = item.timestamp ? format(new Date(item.timestamp), 'h:mm a') : '';
    const showSenderName = type === 'group' && !isOwnMessage;
    const showDateSeparator = index === 0 || (
      messages[index - 1] &&
      format(new Date(item.timestamp), 'yyyy-MM-dd') !== format(new Date(messages[index - 1].timestamp), 'yyyy-MM-dd')
    );

    return (
      <>
        {showDateSeparator && (
          <View style={{ alignItems: 'center', marginVertical: 16 }}>
            <View style={{ backgroundColor: colors.border, paddingHorizontal: 12, paddingVertical: 4, borderRadius: borderRadius.md }}>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                {format(new Date(item.timestamp), 'EEEE, MMMM d')}
              </Text>
            </View>
          </View>
        )}
        <TouchableOpacity
          onLongPress={() => handleLongPress(item)}
          delayLongPress={500}
          activeOpacity={0.8}
          style={{ flexDirection: isOwnMessage ? 'row-reverse' : 'row', marginBottom: 8, paddingHorizontal: 16 }}
        >
          <View style={{
            maxWidth: '75%',
            backgroundColor: isOwnMessage ? primaryColor : colors.surface,
            borderRadius: 18,
            borderTopRightRadius: isOwnMessage ? 4 : 18,
            borderTopLeftRadius: isOwnMessage ? 18 : 4,
            padding: 12,
            ...shadows.sm,
          }}>
            {showSenderName && (
              <Text style={{ fontSize: 12, fontWeight: '600', color: primaryColor, marginBottom: 4 }}>
                {item.sender_name}
              </Text>
            )}
            {item.file_url && (
              <View style={{ marginBottom: item.content ? 8 : 0 }}>
                {item.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                  <Image
                    source={{ uri: item.file_url }}
                    style={{ width: 200, height: 150, borderRadius: borderRadius.md, backgroundColor: colors.surfaceSecondary }}
                    resizeMode="cover"
                  />
                ) : (
                  <TouchableOpacity style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.2)' : colors.surfaceSecondary,
                    padding: 10, borderRadius: borderRadius.sm,
                  }}>
                    <Ionicons name="document" size={24} color={isOwnMessage ? colors.textInverse : primaryColor} />
                    <Text style={{ marginLeft: 8, color: isOwnMessage ? colors.textInverse : primaryColor, fontWeight: '500' }}>
                      Attachment
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {item.content && (
              <Text style={{ fontSize: 15, color: isOwnMessage ? colors.textInverse : colors.textPrimary, lineHeight: 20 }}>
                {item.removed ? <Text style={{ fontStyle: 'italic', opacity: 0.6 }}>{item.content}</Text> : item.content}
              </Text>
            )}
            <Text style={{
              fontSize: 11,
              color: isOwnMessage ? 'rgba(255,255,255,0.7)' : colors.textTertiary,
              marginTop: 4,
              textAlign: isOwnMessage ? 'right' : 'left',
            }}>
              {messageTime}
            </Text>
          </View>
        </TouchableOpacity>
      </>
    );
  };

  if (!messages && isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={primaryColor} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={[]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => item.id || `msg-${index}`}
          renderItem={renderMessage}
          contentContainerStyle={{ paddingVertical: 16, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl }}>
              <Ionicons name="chatbubble-ellipses-outline" size={64} color={colors.borderDark} />
              <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 16, textAlign: 'center' }}>
                No messages yet.{'\n'}Start the conversation!
              </Text>
            </View>
          }
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />

        {otherTyping && (
          <View style={{ paddingHorizontal: 20, paddingVertical: 8 }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: colors.surface, padding: 10,
              borderRadius: borderRadius.lg, alignSelf: 'flex-start',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textTertiary, marginRight: 4 }} />
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textTertiary, marginRight: 4 }} />
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textTertiary }} />
              </View>
              <Text style={{ marginLeft: 8, color: colors.textSecondary, fontSize: 13 }}>typing...</Text>
            </View>
          </View>
        )}

        {selectedImage && (
          <View style={{ padding: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image source={{ uri: selectedImage }} style={{ width: 60, height: 60, borderRadius: borderRadius.sm }} />
              <TouchableOpacity onPress={() => setSelectedImage(null)} style={{ marginLeft: 12 }}>
                <Ionicons name="close-circle" size={24} color={colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {messagingSuspended ? (
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#FEF2F2', borderTopWidth: 1, borderTopColor: '#FECACA',
            padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16,
          }}>
            <Ionicons name="shield-outline" size={20} color="#EF4444" style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#B91C1C' }}>Messaging suspended</Text>
              <Text style={{ fontSize: 12, color: '#EF4444', marginTop: 2 }}>Contact your RA or administrator to resolve this.</Text>
            </View>
          </View>
        ) : (
          <View style={{
            flexDirection: 'row', alignItems: 'flex-end',
            padding: 12, paddingBottom: Platform.OS === 'ios' ? 90 : 12,
            backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
          }}>
            <TouchableOpacity
              onPress={handleAttachment}
              disabled={uploading}
              style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={primaryColor} />
              ) : (
                <Ionicons name="attach" size={24} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
            <View style={{
              flex: 1, flexDirection: 'row', alignItems: 'flex-end',
              backgroundColor: colors.surfaceSecondary, borderRadius: 24,
              paddingHorizontal: 16, marginHorizontal: 8, minHeight: 44, maxHeight: 120,
            }}>
              <TextInput
                style={{ flex: 1, paddingVertical: 12, fontSize: 16, color: colors.textPrimary, maxHeight: 100 }}
                placeholder="Type a message..."
                placeholderTextColor={colors.textTertiary}
                value={message}
                onChangeText={handleTextChange}
                multiline
                maxLength={2000}
              />
            </View>
            <TouchableOpacity
              onPress={handleSend}
              disabled={(!message.trim() && !selectedImage) || sendMutation.isPending}
              style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: (message.trim() || selectedImage) ? primaryColor : colors.border,
                justifyContent: 'center', alignItems: 'center',
              }}
            >
              {sendMutation.isPending ? (
                <ActivityIndicator color={colors.textInverse} size="small" />
              ) : (
                <Ionicons name="send" size={20} color={(message.trim() || selectedImage) ? colors.textInverse : colors.textTertiary} />
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Content Nudge Modal */}
      <Modal visible={showNudge} transparent animationType="fade" onRequestClose={() => setShowNudge(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 24, width: '100%', maxWidth: 360 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                <Ionicons name="warning" size={22} color="#D97706" />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, flex: 1 }}>
                {nudgeLevel === 1 ? 'Message Blocked' : 'Think before you send'}
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 20, lineHeight: 20 }}>
              {nudgeWarning}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setShowNudge(false)}
                style={{ flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: colors.surfaceSecondary, alignItems: 'center' }}
              >
                <Text style={{ fontWeight: '600', fontSize: 14, color: colors.textPrimary }}>Edit message</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setShowNudge(false); setMessage(''); setPendingContent(''); }}
                style={{ flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: '#FEE2E2', alignItems: 'center' }}
              >
                <Text style={{ fontWeight: '600', fontSize: 14, color: '#B91C1C' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Report Message Modal */}
      <Modal visible={showReportModal} transparent animationType="slide" onRequestClose={() => setShowReportModal(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setShowReportModal(false)}
        >
          <View
            style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%' }}
            onStartShouldSetResponder={() => true}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary }}>Report Message</Text>
              <TouchableOpacity onPress={() => setShowReportModal(false)} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
              {reportTarget?.content && (
                <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 12, marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 4 }}>Reported message</Text>
                  <Text style={{ fontSize: 14, color: colors.textPrimary }} numberOfLines={3}>{reportTarget.content}</Text>
                </View>
              )}
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 10 }}>Why are you reporting this?</Text>
              {REPORT_CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.value}
                  onPress={() => setReportCategory(cat.value)}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingVertical: 12, paddingHorizontal: 14,
                    borderRadius: 12, marginBottom: 8,
                    borderWidth: 2,
                    borderColor: reportCategory === cat.value ? primaryColor : colors.border,
                    backgroundColor: reportCategory === cat.value ? primaryColor + '0F' : colors.surface,
                  }}
                >
                  <View style={{
                    width: 20, height: 20, borderRadius: 10,
                    borderWidth: 2, borderColor: reportCategory === cat.value ? primaryColor : colors.border,
                    backgroundColor: reportCategory === cat.value ? primaryColor : 'transparent',
                    justifyContent: 'center', alignItems: 'center', marginRight: 12,
                  }}>
                    {reportCategory === cat.value && <Ionicons name="checkmark" size={12} color={colors.textInverse} />}
                  </View>
                  <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: reportCategory === cat.value ? '600' : '400' }}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginTop: 8, marginBottom: 8 }}>Additional details (optional)</Text>
              <TextInput
                style={{
                  backgroundColor: colors.surfaceSecondary, borderRadius: 12,
                  padding: 12, fontSize: 14, color: colors.textPrimary,
                  minHeight: 80, textAlignVertical: 'top', marginBottom: 20,
                }}
                placeholder="Provide any additional context..."
                placeholderTextColor={colors.textTertiary}
                value={reportDetails}
                onChangeText={setReportDetails}
                multiline
              />
              <TouchableOpacity
                onPress={submitReport}
                disabled={!reportCategory || reportSubmitting}
                style={{
                  backgroundColor: !reportCategory ? colors.border : '#EF4444',
                  paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginBottom: 8,
                }}
              >
                {reportSubmitting ? (
                  <ActivityIndicator color={colors.textInverse} size="small" />
                ) : (
                  <Text style={{ color: colors.textInverse, fontWeight: '700', fontSize: 15 }}>Submit Report</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
