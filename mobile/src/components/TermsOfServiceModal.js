import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors, spacing, borderRadius } from '../theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TERMS_SECTIONS, TERMS_LAST_UPDATED } from '../constants/termsOfService';

export default function TermsOfServiceModal({ visible, onClose, primaryColor = colors.primary }) {
  const { themeColors: colors } = useAppTheme();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Terms & Privacy</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <Text style={styles.updatedDate}>Last Updated: {TERMS_LAST_UPDATED}</Text>

          {TERMS_SECTIONS.map((section, index) => (
            <View key={index} style={styles.section}>
              <Text style={[
                styles.sectionHeading,
                !section.content && styles.mainHeading,
              ]}>
                {section.heading}
              </Text>
              {section.content ? (
                <Text style={styles.sectionContent}>{section.content}</Text>
              ) : null}
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: primaryColor }]}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 20,
    paddingBottom: 40,
  },
  updatedDate: {
    fontSize: 13,
    color: colors.textTertiary,
    marginBottom: 16,
  },
  section: {
    marginBottom: 20,
  },
  mainHeading: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 8,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  sectionContent: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  closeButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textInverse,
  },
});
