import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTenant } from '../contexts/TenantContext';
import { colors, borderRadius } from '../theme';

const ModuleHeader = ({ title, subtitle, onBack, onAdd }) => {
  const { branding } = useTenant();
  const primaryColor = branding?.primaryColor || colors.primary;
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        backgroundColor: primaryColor,
        paddingTop: insets.top + 10,
        paddingBottom: 22,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomLeftRadius: borderRadius.xxl,
        borderBottomRightRadius: borderRadius.xxl,
      }}
    >
      {onBack ? (
        <TouchableOpacity
          onPress={onBack}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: 'rgba(255,255,255,0.25)',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 36, marginRight: 12 }} />
      )}

      <View style={{ flex: 1 }}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold', letterSpacing: -0.3 }}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 1 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {onAdd ? (
        <TouchableOpacity
          onPress={onAdd}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: 'rgba(255,255,255,0.25)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 36 }} />
      )}
    </View>
  );
};

export default ModuleHeader;
