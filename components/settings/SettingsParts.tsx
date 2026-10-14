import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, Alert } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { startBackgroundLocation, stopBackgroundLocation, isBackgroundLocationStarted } from '@/components/services/location/BackgroundLocation';

type SettingsSectionProps = {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  style?: any;
};

// 설정 섹션 공통 컨테이너 컴포넌트
export const SettingsSection = ({ title, icon, children, style }: SettingsSectionProps) => {
  const { colors } = useTheme();

  const sectionStyles = StyleSheet.create({
    section: {
      margin: 16,
      borderRadius: 12,
      borderWidth: 1,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    sectionHeader: {
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 12,
      color: colors.primary,
    },
    sectionContent: {
      padding: 8,
    },
  });

  return (
    <View style={[sectionStyles.section, style]}>
      <View style={sectionStyles.sectionHeader}>
        {icon}
        <Text style={sectionStyles.sectionTitle} numberOfLines={1} ellipsizeMode="tail">{title}</Text>
      </View>
      <View style={sectionStyles.sectionContent}>{children}</View>
    </View>
  );
};

export function BackgroundToggle() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const started = await isBackgroundLocationStarted();
      if (mounted) setEnabled(started);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const onToggle = async (value: boolean) => {
    try {
      if (value) {
        const ok = await startBackgroundLocation();
        if (!ok) {
          Alert.alert(t('settings.background.permissionTitle'), t('settings.background.permissionBody'));
          setEnabled(false);
          return;
        }
        setEnabled(true);
      } else {
        await stopBackgroundLocation();
        setEnabled(false);
      }
    } catch (e) {
      console.error('[BG Toggle] error:', e);
    }
  };

  return (
    <Switch
      value={enabled}
      onValueChange={onToggle}
      trackColor={{ false: colors.border, true: colors.primary }}
      thumbColor="#FFFFFF"
    />
  );
}

// 설정 탭 메인 컴포넌트: 테마/언어/알림/계정 등 사용자 환경 설정 제공
