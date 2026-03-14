import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedScreen } from '../../components/AnimatedScreen';
import ModuleHeader from '../../components/ModuleHeader';
import { useTenant } from '../../contexts/TenantContext';
import { colors as defaultColors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useAppTheme } from '../../contexts/ThemeContext';

export default function WellbeingScreen({ navigation }) {
  const { branding } = useTenant();
  const { themeColors: colors } = useAppTheme();
  const primaryColor = branding?.primaryColor || colors.primary;

  const sections = [
    {
      title: 'Pastoral Care',
      description: 'Book one-on-one sessions with pastoral care staff for personal support',
      icon: 'heart',
      screen: null,
    },
    {
      title: 'Wellness Resources',
      description: 'Access mental health resources, self-care guides, and wellness tips',
      icon: 'sparkles',
      screen: null,
    },
    {
      title: 'Safe Disclosure',
      description: 'Report incidents or concerns in a safe and confidential environment',
      icon: 'shield-checkmark',
      screen: 'SafeDisclosure',
    },
  ];

  const emergencyContacts = [
    { title: 'Emergency Services', number: '000', description: 'Police, Ambulance, Fire', priority: 'high' },
    { title: '1800 RESPECT', number: '1800 737 732', description: '24/7 Sexual assault, family violence counseling' },
    { title: 'Lifeline', number: '13 11 14', description: '24/7 Crisis support & suicide prevention' },
    { title: 'Campus Security', number: 'Contact', description: '24/7 On-campus emergency' },
  ];

  const handleCall = (phone) => {
    if (phone !== 'Contact') {
      Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']}>
      <ModuleHeader title="Wellbeing" onBack={() => navigation.goBack()} />
      <AnimatedScreen>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={{
          backgroundColor: primaryColor,
          padding: spacing.xl,
          paddingTop: spacing.lg,
          borderBottomLeftRadius: borderRadius.xxl,
          borderBottomRightRadius: borderRadius.xxl,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <View style={{
              width: 48,
              height: 48,
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: borderRadius.md,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Ionicons name="heart" size={24} color={colors.textInverse} />
            </View>
            <View style={{ marginLeft: spacing.md }}>
              <Text style={{ 
                color: colors.textInverse, 
                fontSize: 20, 
                fontWeight: '700',
                letterSpacing: -0.3,
              }}>
                Your Wellbeing
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 2 }}>
                Support when you need it
              </Text>
            </View>
          </View>
        </View>

        {/* Main Sections */}
        <View style={{ padding: spacing.lg, paddingTop: spacing.xl }}>
          <Text style={{ ...typography.caption, marginBottom: spacing.md }}>SUPPORT SERVICES</Text>
          
          {sections.map((section, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => section.screen && navigation.navigate(section.screen)}
              activeOpacity={0.7}
              style={{
                backgroundColor: colors.surface,
                borderRadius: borderRadius.lg,
                padding: spacing.lg,
                marginBottom: spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.border,
                ...shadows.sm,
              }}
            >
              <View style={{
                width: 52,
                height: 52,
                borderRadius: borderRadius.md,
                backgroundColor: `${primaryColor}15`,
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: spacing.md,
              }}>
                <Ionicons name={section.icon} size={24} color={primaryColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.label, marginBottom: 4 }}>
                  {section.title}
                </Text>
                <Text style={{ ...typography.bodySmall, lineHeight: 18 }} numberOfLines={2}>
                  {section.description}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Emergency Contacts */}
        <View style={{ padding: spacing.lg, paddingTop: 0 }}>
          <Text style={{ ...typography.caption, marginBottom: spacing.md }}>EMERGENCY CONTACTS</Text>
          
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border,
          }}>
            {emergencyContacts.map((contact, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => handleCall(contact.number)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: spacing.lg,
                  borderBottomWidth: index < emergencyContacts.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                  backgroundColor: contact.priority === 'high' ? colors.errorLight : colors.surface,
                }}
              >
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: borderRadius.md,
                  backgroundColor: contact.priority === 'high' ? colors.error : colors.surfaceSecondary,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: spacing.md,
                }}>
                  <Ionicons 
                    name="call" 
                    size={18} 
                    color={contact.priority === 'high' ? colors.textInverse : colors.textSecondary} 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ 
                    ...typography.label, 
                    color: contact.priority === 'high' ? colors.error : colors.textPrimary,
                  }}>
                    {contact.title}
                  </Text>
                  <Text style={{ ...typography.bodySmall, marginTop: 2 }}>
                    {contact.description}
                  </Text>
                </View>
                <View style={{
                  backgroundColor: contact.priority === 'high' ? colors.error : colors.surfaceSecondary,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: borderRadius.md,
                }}>
                  <Text style={{ 
                    fontSize: 14, 
                    fontWeight: '700', 
                    color: contact.priority === 'high' ? colors.textInverse : primaryColor,
                    letterSpacing: 0.5,
                  }}>
                    {contact.number}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Support Message */}
        <View style={{ 
          margin: spacing.lg, 
          marginTop: 0,
          padding: spacing.lg, 
          backgroundColor: primaryColor + '15', 
          borderRadius: borderRadius.lg,
          borderWidth: 1,
          borderColor: primaryColor,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Ionicons name="information-circle" size={20} color={primaryColor} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={{ fontSize: 14, color: primaryColor, fontWeight: '600', marginBottom: 4 }}>
                You're not alone
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
                If you're struggling, please reach out. Your college community is here to support you.
              </Text>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
      </AnimatedScreen>
    </SafeAreaView>
  );
}
