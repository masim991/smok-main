import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useData } from '@/components/contexts/DataContext';
import { useTheme } from '@/contexts/ThemeContext';

export function DataStatus() {
  const { isLoading, error, syncStatus, retrySync } = useData();
  const { colors } = useTheme();
  const { i18n } = useTranslation();
  const ko = i18n.language.startsWith('ko');
  const busy = isLoading || syncStatus === 'syncing';
  const problem = !!error || syncStatus === 'offline';
  const message = error
    ? (ko ? '기록을 불러오지 못했어요. 저장된 원본은 보존됩니다.' : 'Could not load your records. Your saved data is preserved.')
    : isLoading
      ? (ko ? '기록을 불러오는 중이에요.' : 'Loading your records…')
      : syncStatus === 'syncing'
        ? (ko ? '기기에 저장됨 · 계정에 저장하는 중이에요.' : 'Saved on this device · Saving to your account…')
        : syncStatus === 'offline'
          ? (ko ? '기기에 저장됨 · 연결되면 계정에 다시 저장해요.' : 'Saved on this device · We will save to your account when connected.')
          : syncStatus === 'synced'
            ? (ko ? '기기와 계정에 저장됨' : 'Saved on this device and in your account')
            : (ko ? '기기에 저장됨' : 'Saved on this device');
  return <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    {busy && <ActivityIndicator size="small" color={colors.primary} accessibilityLabel={ko ? '저장 상태 확인 중' : 'Checking saved records'} />}
    <Text accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={[styles.message, { color: error ? colors.error : colors.textSecondary }]}>{message}</Text>
    {problem && <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => { void retrySync(); }} style={[styles.button, { borderColor: colors.border, opacity: busy ? 0.5 : 1 }]}>
      <Text style={{ color: colors.primary, fontWeight: '600' }}>{ko ? '다시 시도' : 'Retry'}</Text>
    </TouchableOpacity>}
  </View>;
}
const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  message: { flex: 1, fontSize: 12, lineHeight: 18 },
  button: { paddingHorizontal: 12, paddingVertical: 12, minHeight: 44, borderWidth: 1, borderRadius: 8, justifyContent: 'center' },
});
