import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { format, addDays, subDays } from 'date-fns';
import { formatDate, formatForApi, formatDateLong, DATE_FORMATS } from '../../utils/dateUtils';
import { useTenant } from '../../contexts/TenantContext';
import AdminScreenHeader from '../../components/AdminScreenHeader';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const DIETARY_TAGS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Nut-Free', 'Halal', 'Kosher'];

export default function AdminDiningMenuScreen({ navigation }) {
  const { themeColors: colors } = useAppTheme();
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const secondaryColor = branding?.secondaryColor || colors.background;

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [modalVisible, setModalVisible] = useState(false);
  const [csvModalVisible, setCsvModalVisible] = useState(false);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResults, setCsvResults] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    meal_type: 'Breakfast',
    dietary_tags: [],
    nutrition_info: '',
  });
  const queryClient = useQueryClient();

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  const { data: menu, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['adminDiningMenu', dateStr],
    queryFn: async () => {
      const response = await api.get(`${ENDPOINTS.DINING}/menu?date=${dateStr}`);
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post(`${ENDPOINTS.DINING}/menu`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDiningMenu'] });
      queryClient.invalidateQueries({ queryKey: ['diningMenu'] });
      setModalVisible(false);
      resetForm();
      Alert.alert('Success', 'Menu item added successfully');
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to add menu item');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await api.put(`${ENDPOINTS.DINING}/menu/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDiningMenu'] });
      queryClient.invalidateQueries({ queryKey: ['diningMenu'] });
      setModalVisible(false);
      resetForm();
      Alert.alert('Success', 'Menu item updated successfully');
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update menu item');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await api.delete(`${ENDPOINTS.DINING}/menu/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDiningMenu'] });
      queryClient.invalidateQueries({ queryKey: ['diningMenu'] });
      Alert.alert('Success', 'Menu item deleted');
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to delete menu item');
    },
  });

  const clearDateMutation = useMutation({
    mutationFn: async (date) => {
      const response = await api.delete(`${ENDPOINTS.DINING}/menu/clear-date/${date}`);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminDiningMenu'] });
      queryClient.invalidateQueries({ queryKey: ['diningMenu'] });
      Alert.alert('Success', `Cleared ${data.items_deleted} items for ${dateStr}`);
    },
    onError: (error) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to clear menu');
    },
  });

  const handleCsvUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const file = result.assets[0];
      
      // More lenient file type check
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

      setCsvUploading(true);
      setCsvResults(null);

      // Read file content
      const fileContent = await FileSystem.readAsStringAsync(file.uri);
      
      // Create form data
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        type: 'text/csv',
        name: file.name || 'menu.csv',
      });

      const response = await api.post(`${ENDPOINTS.DINING}/menu/bulk-upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setCsvResults(response.data);
      queryClient.invalidateQueries({ queryKey: ['adminDiningMenu'] });
      queryClient.invalidateQueries({ queryKey: ['diningMenu'] });
      
      if (response.data.success_count > 0) {
        Alert.alert('Success', `Uploaded ${response.data.success_count} menu items`);
      }

    } catch (error) {
      console.error('CSV upload error:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to upload CSV file');
    } finally {
      setCsvUploading(false);
    }
  };

  const handleClearDate = () => {
    Alert.alert(
      'Clear Menu',
      `Are you sure you want to delete ALL menu items for ${format(selectedDate, 'MMMM d, yyyy')}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive', 
          onPress: () => clearDateMutation.mutate(dateStr) 
        },
      ]
    );
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      meal_type: 'Breakfast',
      dietary_tags: [],
      nutrition_info: '',
    });
    setEditingItem(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description,
      meal_type: item.meal_type,
      dietary_tags: item.dietary_tags || [],
      nutrition_info: item.nutrition_info || '',
    });
    setModalVisible(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter a menu item name');
      return;
    }
    if (!formData.description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }

    const data = {
      ...formData,
      date: dateStr,
    };

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (item) => {
    Alert.alert(
      'Delete Menu Item',
      `Are you sure you want to delete "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(item.id) },
      ]
    );
  };

  const toggleDietaryTag = (tag) => {
    setFormData((prev) => ({
      ...prev,
      dietary_tags: prev.dietary_tags.includes(tag)
        ? prev.dietary_tags.filter((t) => t !== tag)
        : [...prev.dietary_tags, tag],
    }));
  };

  const groupedMenu = MEAL_TYPES.reduce((acc, type) => {
    acc[type] = (menu || []).filter((item) => item.meal_type === type);
    return acc;
  }, {});

  const renderMenuItem = ({ item }) => (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        padding: spacing.lg,
        marginBottom: spacing.md,
        shadowColor: colors.textPrimary,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>{item.name}</Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>{item.description}</Text>
          {item.dietary_tags?.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 6 }}>
              {item.dietary_tags.map((tag) => (
                <View
                  key={tag}
                  style={{
                    backgroundColor: primaryColor + '15',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: borderRadius.md,
                  }}
                >
                  <Text style={{ fontSize: 12, color: primaryColor }}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
          {item.nutrition_info && (
            <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 6 }}>
              <Ionicons name="nutrition-outline" size={12} /> {item.nutrition_info}
            </Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => openEditModal(item)}
            style={{ padding: 8 }}
            data-testid={`edit-menu-item-${item.id}`}
          >
            <Ionicons name="pencil" size={20} color={primaryColor} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            style={{ padding: 8 }}
            data-testid={`delete-menu-item-${item.id}`}
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: secondaryColor }} edges={['bottom']}>
      <AdminScreenHeader
        title="Dining Menu"
        subtitle={`${menu?.length || 0} item${(menu?.length || 0) !== 1 ? 's' : ''}`}
        onBack={() => navigation.goBack()}
        onAdd={openAddModal}
      />

      {/* Date Navigation */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <TouchableOpacity
          onPress={() => setSelectedDate(subDays(selectedDate, 1))}
          style={{ padding: 8 }}
          data-testid="prev-date-btn"
        >
          <Ionicons name="chevron-back" size={24} color={primaryColor} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>
            {format(selectedDate, 'EEEE')}
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary }}>
            {formatDate(selectedDate)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setSelectedDate(addDays(selectedDate, 1))}
          style={{ padding: 8 }}
          data-testid="next-date-btn"
        >
          <Ionicons name="chevron-forward" size={24} color={primaryColor} />
        </TouchableOpacity>
      </View>

      {/* Action Buttons */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          gap: 12,
        }}
      >
        <TouchableOpacity
          onPress={() => setCsvModalVisible(true)}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: primaryColor + '15',
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: borderRadius.sm,
            borderWidth: 1,
            borderColor: primaryColor,
          }}
          data-testid="csv-upload-btn"
        >
          <Ionicons name="cloud-upload-outline" size={18} color={primaryColor} />
          <Text style={{ marginLeft: 6, color: primaryColor, fontWeight: '600' }}>CSV Upload</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleClearDate}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.errorLight,
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: borderRadius.sm,
            borderWidth: 1,
            borderColor: colors.error,
          }}
          data-testid="clear-date-btn"
        >
          <Ionicons name="trash-outline" size={18} color={colors.error} />
          <Text style={{ marginLeft: 6, color: colors.error, fontWeight: '600' }}>Clear Day</Text>
        </TouchableOpacity>
      </View>

      {/* Menu Content */}
      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.lg }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        >
          {MEAL_TYPES.map((mealType) => (
            <View key={mealType} style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                <Ionicons
                  name={
                    mealType === 'Breakfast'
                      ? 'sunny-outline'
                      : mealType === 'Lunch'
                      ? 'restaurant-outline'
                      : mealType === 'Dinner'
                      ? 'moon-outline'
                      : 'cafe-outline'
                  }
                  size={20}
                  color={primaryColor}
                />
                <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginLeft: 8 }}>
                  {mealType}
                </Text>
                <Text style={{ fontSize: 14, color: colors.textTertiary, marginLeft: 8 }}>
                  ({groupedMenu[mealType]?.length || 0} items)
                </Text>
              </View>
              {groupedMenu[mealType]?.length > 0 ? (
                groupedMenu[mealType].map((item) => (
                  <View key={item.id}>{renderMenuItem({ item })}</View>
                ))
              ) : (
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: borderRadius.md,
                    padding: spacing.xxl,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: colors.textTertiary }}>No items for {mealType}</Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Add Button */}
      <TouchableOpacity
        onPress={openAddModal}
        style={{
          position: 'absolute',
          bottom: 24,
          right: 24,
          backgroundColor: primaryColor,
          width: 56,
          height: 56,
          borderRadius: 28,
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: colors.textPrimary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 5,
        }}
        data-testid="add-menu-item-btn"
      >
        <Ionicons name="add" size={28} color={colors.surface} />
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.5)',
              justifyContent: 'flex-end',
            }}
          >
            <View
              style={{
                backgroundColor: colors.surface,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                maxHeight: '90%',
              }}
            >
              {/* Modal Header */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: spacing.lg,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>
                  {editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setModalVisible(false);
                    resetForm();
                  }}
                  data-testid="close-modal-btn"
                >
                  <Ionicons name="close" size={24} color={colors.secondary} />
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={{ padding: spacing.lg }}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 40 }}
              >
                {/* Item Name */}
                <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 6 }}>
                  Item Name *
                </Text>
                <TextInput
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="e.g., Scrambled Eggs"
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: borderRadius.sm,
                    padding: 12,
                    fontSize: 16,
                    marginBottom: 16,
                  }}
                  data-testid="menu-item-name-input"
                />

                {/* Description */}
                <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 6 }}>
                  Description *
                </Text>
                <TextInput
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  placeholder="Describe the dish..."
                  multiline
                  numberOfLines={3}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: borderRadius.sm,
                    padding: 12,
                    fontSize: 16,
                    marginBottom: 16,
                    minHeight: 80,
                    textAlignVertical: 'top',
                  }}
                  data-testid="menu-item-description-input"
                />

                {/* Meal Type */}
                <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 6 }}>
                  Meal Type *
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {MEAL_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setFormData({ ...formData, meal_type: type })}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 20,
                        backgroundColor: formData.meal_type === type ? primaryColor : colors.surfaceSecondary,
                        borderWidth: 1,
                        borderColor: formData.meal_type === type ? primaryColor : colors.border,
                      }}
                      data-testid={`meal-type-${type.toLowerCase()}`}
                    >
                      <Text
                        style={{
                          color: formData.meal_type === type ? colors.surface : colors.textPrimary,
                          fontWeight: '500',
                        }}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Dietary Tags */}
                <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 6 }}>
                  Dietary Tags
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {DIETARY_TAGS.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => toggleDietaryTag(tag)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: borderRadius.lg,
                        backgroundColor: formData.dietary_tags.includes(tag) ? primaryColor + '15' : colors.surfaceSecondary,
                        borderWidth: 1,
                        borderColor: formData.dietary_tags.includes(tag) ? primaryColor : colors.border,
                      }}
                      data-testid={`dietary-tag-${tag.toLowerCase()}`}
                    >
                      <Text
                        style={{
                          color: formData.dietary_tags.includes(tag) ? primaryColor : colors.textPrimary,
                          fontSize: 13,
                        }}
                      >
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Nutrition Info */}
                <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 6 }}>
                  Nutrition Info (optional)
                </Text>
                <TextInput
                  value={formData.nutrition_info}
                  onChangeText={(text) => setFormData({ ...formData, nutrition_info: text })}
                  placeholder="e.g., 350 cal, 20g protein"
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: borderRadius.sm,
                    padding: 12,
                    fontSize: 16,
                    marginBottom: 24,
                  }}
                  data-testid="menu-item-nutrition-input"
                />

                {/* Submit Button */}
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  style={{
                    backgroundColor: primaryColor,
                    paddingVertical: 14,
                    borderRadius: borderRadius.sm,
                    alignItems: 'center',
                    marginBottom: 24,
                    opacity: createMutation.isPending || updateMutation.isPending ? 0.7 : 1,
                  }}
                  data-testid="submit-menu-item-btn"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <ActivityIndicator color={colors.surface} />
                  ) : (
                    <Text style={{ color: colors.textInverse, fontSize: 16, fontWeight: '600' }}>
                      {editingItem ? 'Update Item' : 'Add Item'}
                    </Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* CSV Upload Modal */}
      <Modal visible={csvModalVisible} animationType="slide" transparent>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: '85%',
            }}
          >
            {/* Modal Header */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: spacing.lg,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>
                Upload Menu CSV
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setCsvModalVisible(false);
                  setCsvResults(null);
                }}
                data-testid="close-csv-modal-btn"
              >
                <Ionicons name="close" size={24} color={colors.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: spacing.lg }}>
              {/* CSV Format Instructions */}
              <View
                style={{
                  backgroundColor: primaryColor + '15',
                  borderRadius: borderRadius.md,
                  padding: spacing.lg,
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: primaryColor, marginBottom: 8 }}>
                  CSV Format
                </Text>
                <Text style={{ fontSize: 12, color: primaryColor, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
                  name,description,meal_type,date,dietary_tags,nutrition_info
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 8 }}>
                  Example row:
                </Text>
                <Text style={{ fontSize: 11, color: primaryColor, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginTop: 4 }}>
                  Pancakes,Fluffy buttermilk pancakes,Breakfast,2025-01-20,Vegetarian,350 cal
                </Text>
              </View>

              {/* Tips */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 }}>
                  Tips:
                </Text>
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                    • meal_type: Breakfast, Lunch, Dinner, or Snacks
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                    • date format: YYYY-MM-DD (e.g., 2025-01-20)
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                    • dietary_tags: separate with | (e.g., Vegetarian|Gluten-Free)
                  </Text>
                </View>
              </View>

              {/* Upload Button */}
              <TouchableOpacity
                onPress={handleCsvUpload}
                disabled={csvUploading}
                style={{
                  backgroundColor: primaryColor,
                  paddingVertical: 14,
                  borderRadius: borderRadius.sm,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  marginBottom: 16,
                  opacity: csvUploading ? 0.7 : 1,
                }}
                data-testid="select-csv-btn"
              >
                {csvUploading ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <>
                    <Ionicons name="document-outline" size={20} color={colors.surface} />
                    <Text style={{ color: colors.textInverse, fontSize: 16, fontWeight: '600', marginLeft: 8 }}>
                      Select CSV File
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Results */}
              {csvResults && (
                <View
                  style={{
                    backgroundColor: csvResults.failed_count > 0 ? colors.errorLight : primaryColor + '15',
                    borderRadius: borderRadius.md,
                    padding: spacing.lg,
                    marginBottom: 24,
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>
                    Upload Results
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 16, marginBottom: spacing.md }}>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ fontSize: 24, fontWeight: '700', color: primaryColor }}>
                        {csvResults.success_count}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>Successful</Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ fontSize: 24, fontWeight: '700', color: colors.error }}>
                        {csvResults.failed_count}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>Failed</Text>
                    </View>
                  </View>

                  {csvResults.errors?.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.error, marginBottom: 6 }}>
                        Errors:
                      </Text>
                      {csvResults.errors.slice(0, 5).map((error, idx) => (
                        <Text key={idx} style={{ fontSize: 12, color: colors.error, marginBottom: 4 }}>
                          • {error}
                        </Text>
                      ))}
                      {csvResults.errors.length > 5 && (
                        <Text style={{ fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' }}>
                          ... and {csvResults.errors.length - 5} more errors
                        </Text>
                      )}
                    </View>
                  )}

                  {csvResults.items_created?.length > 0 && (
                    <View style={{ marginTop: 12 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: primaryColor, marginBottom: 6 }}>
                        Items Created:
                      </Text>
                      {csvResults.items_created.slice(0, 5).map((item, idx) => (
                        <Text key={idx} style={{ fontSize: 12, color: primaryColor, marginBottom: 2 }}>
                          • {item.name} ({item.meal_type})
                        </Text>
                      ))}
                      {csvResults.items_created.length > 5 && (
                        <Text style={{ fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' }}>
                          ... and {csvResults.items_created.length - 5} more items
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
