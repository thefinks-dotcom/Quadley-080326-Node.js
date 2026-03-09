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

export default function ChatScreen({ route, navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const { id, name, type, userId, isNew } = route.params || {};
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const flatListRef = useRef();
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const typingTimeoutRef = useRef(null);

  // Handle missing params
  if (!id) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.borderDark} />
        <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Select a conversation to start chatting</Text>
      </SafeAreaView>
    );
  }

  // Set navigation header
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

  // Fetch messages
  const { data: messages, isLoading, refetch } = useQuery({
    queryKey: ['chatMessages', id, type, userId],
    queryFn: async () => {
      try {
        let endpoint;
        if (type === 'direct') {
          // For direct messages, try both the conversation_id and user_id format
          endpoint = `${ENDPOINTS.CONVERSATIONS}/${id}/messages`;
        } else {
          endpoint = `${ENDPOINTS.MESSAGE_GROUPS}/${id}/messages`;
        }
        const response = await api.get(endpoint);
        return response.data || [];
      } catch (error) {
        // If conversation doesn't exist yet, return empty array
        if (error.response?.status === 404) {
          return [];
        }
        throw error;
      }
    },
    refetchInterval: 3000, // Poll every 3 seconds for real-time feel
  });

  // Check typing status (simulated - would use WebSockets in production)
  useEffect(() => {
    const checkTyping = async () => {
      try {
        const response = await api.get(`/messages/typing/${id}`);
        setOtherTyping(response.data?.is_typing && response.data?.user_id !== user?.id);
      } catch {
        // Ignore errors
      }
    };
    
    const interval = setInterval(checkTyping, 2000);
    return () => clearInterval(interval);
  }, [id, user?.id]);

  // Send typing indicator
  const sendTypingIndicator = useCallback(async (typing) => {
    try {
      await api.post(`/messages/typing/${id}`, { is_typing: typing });
    } catch {
      // Ignore errors
    }
  }, [id]);

  // Handle typing
  const handleTextChange = (text) => {
    setMessage(text);
    
    if (!isTyping && text.length > 0) {
      setIsTyping(true);
      sendTypingIndicator(true);
    }
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendTypingIndicator(false);
    }, 2000);
  };

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async ({ content, fileUrl }) => {
      const payload = {
        content: content || '',
        file_url: fileUrl,
      };
      
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
      
      // Invalidate and refetch with the correct conversation_id if returned
      if (data?.conversation_id) {
        queryClient.invalidateQueries(['chatMessages', data.conversation_id]);
      }
      queryClient.invalidateQueries(['chatMessages', id]);
      queryClient.invalidateQueries(['conversations']);
      refetch();
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to send message');
    },
  });

  // Delete message mutation
  const deleteMutation = useMutation({
    mutationFn: async (messageId) => {
      await api.delete(`${ENDPOINTS.MESSAGES}/${messageId}`);
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries(['conversations']);
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to delete message');
    },
  });

  // Mark messages as read
  useEffect(() => {
    const markRead = async () => {
      try {
        if (type === 'direct') {
          await api.put(`${ENDPOINTS.CONVERSATIONS}/${id}/read`);
        } else {
          await api.put(`${ENDPOINTS.MESSAGE_GROUPS}/${id}/read`);
        }
        queryClient.invalidateQueries(['conversations']);
      } catch {
        // Ignore errors
      }
    };
    
    if (messages?.length > 0) {
      markRead();
    }
  }, [id, type, messages?.length]);

  const handleSend = () => {
    if (message.trim() || selectedImage) {
      sendMutation.mutate({ 
        content: message.trim(),
        fileUrl: selectedImage,
      });
    }
  };

  const handleAttachment = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library', 'Choose File'],
          cancelButtonIndex: 0,
        },
        async (buttonIndex) => {
          if (buttonIndex === 1) {
            takePhoto();
          } else if (buttonIndex === 2) {
            pickImage();
          } else if (buttonIndex === 3) {
            pickDocument();
          }
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

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]) {
      uploadImage(result.assets[0].uri);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Media library permission is required');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]) {
      uploadImage(result.assets[0].uri);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        uploadFile(result.assets[0]);
      }
    } catch (error) {
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
      
      formData.append('file', {
        uri,
        name: filename,
        type: fileType,
      });

      const response = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSelectedImage(response.data.url);
    } catch (error) {
      Alert.alert('Error', 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const uploadFile = async (file) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      });

      const response = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSelectedImage(response.data.url);
    } catch (error) {
      Alert.alert('Error', 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMessage = (messageId) => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(messageId) },
      ]
    );
  };

  const handleLongPress = (item) => {
    if (item.sender_id === user?.id) {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Cancel', 'Delete Message'],
            destructiveButtonIndex: 1,
            cancelButtonIndex: 0,
          },
          (buttonIndex) => {
            if (buttonIndex === 1) {
              handleDeleteMessage(item.id);
            }
          }
        );
      } else {
        Alert.alert('Message Options', '', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => handleDeleteMessage(item.id) },
        ]);
      }
    }
  };

  const renderMessage = ({ item, index }) => {
    const isOwnMessage = item.sender_id === user?.id;
    const messageTime = item.timestamp ? format(new Date(item.timestamp), 'h:mm a') : '';
    const showSenderName = type === 'group' && !isOwnMessage;
    
    // Check if we should show date separator
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
          style={{
            flexDirection: isOwnMessage ? 'row-reverse' : 'row',
            marginBottom: 8,
            paddingHorizontal: 16,
          }}
        >
          <View
            style={{
              maxWidth: '75%',
              backgroundColor: isOwnMessage ? primaryColor : colors.surface,
              borderRadius: 18,
              borderTopRightRadius: isOwnMessage ? 4 : 18,
              borderTopLeftRadius: isOwnMessage ? 18 : 4,
              padding: 12,
              ...shadows.sm,
            }}
          >
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
                    style={{ 
                      width: 200, 
                      height: 150, 
                      borderRadius: borderRadius.md,
                      backgroundColor: colors.surfaceSecondary,
                    }} 
                    resizeMode="cover"
                  />
                ) : (
                  <TouchableOpacity 
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.2)' : colors.surfaceSecondary,
                      padding: 10,
                      borderRadius: borderRadius.sm,
                    }}
                  >
                    <Ionicons name="document" size={24} color={isOwnMessage ? colors.textInverse : primaryColor} />
                    <Text style={{ 
                      marginLeft: 8, 
                      color: isOwnMessage ? colors.textInverse : primaryColor,
                      fontWeight: '500',
                    }}>
                      Attachment
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {item.content && (
              <Text style={{ fontSize: 15, color: isOwnMessage ? colors.textInverse : colors.textPrimary, lineHeight: 20 }}>
                {item.content}
              </Text>
            )}
            <Text
              style={{
                fontSize: 11,
                color: isOwnMessage ? 'rgba(255,255,255,0.7)' : colors.textTertiary,
                marginTop: 4,
                textAlign: isOwnMessage ? 'right' : 'left',
              }}
            >
              {messageTime}
            </Text>
          </View>
        </TouchableOpacity>
      </>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={primaryColor} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }} edges={[]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={90}
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

        {/* Typing Indicator */}
        {otherTyping && (
          <View style={{ paddingHorizontal: 20, paddingVertical: 8 }}>
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center',
              backgroundColor: colors.surface,
              padding: 10,
              borderRadius: borderRadius.lg,
              alignSelf: 'flex-start',
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

        {/* Selected Image Preview */}
        {selectedImage && (
          <View style={{ padding: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image 
                source={{ uri: selectedImage }} 
                style={{ width: 60, height: 60, borderRadius: borderRadius.sm }} 
              />
              <TouchableOpacity 
                onPress={() => setSelectedImage(null)}
                style={{ marginLeft: 12 }}
              >
                <Ionicons name="close-circle" size={24} color={colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Input */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            padding: 12,
            paddingBottom: Platform.OS === 'ios' ? 90 : 12,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <TouchableOpacity
            onPress={handleAttachment}
            disabled={uploading}
            style={{
              width: 40,
              height: 40,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={primaryColor} />
            ) : (
              <Ionicons name="attach" size={24} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'flex-end',
              backgroundColor: colors.surfaceSecondary,
              borderRadius: 24,
              paddingHorizontal: 16,
              marginHorizontal: 8,
              minHeight: 44,
              maxHeight: 120,
            }}
          >
            <TextInput
              style={{
                flex: 1,
                paddingVertical: 12,
                fontSize: 16,
                color: colors.textPrimary,
                maxHeight: 100,
              }}
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
              width: 44,
              height: 44,
              backgroundColor: (message.trim() || selectedImage) ? primaryColor : colors.border,
              borderRadius: 22,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {sendMutation.isPending ? (
              <ActivityIndicator color={colors.textInverse} size="small" />
            ) : (
              <Ionicons name="send" size={20} color={(message.trim() || selectedImage) ? colors.textInverse : colors.textTertiary} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
