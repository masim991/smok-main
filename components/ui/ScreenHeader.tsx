import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

export function ScreenHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 24, backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.accent, { backgroundColor: colors.primary }]} />
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingBottom: 24, borderBottomWidth: StyleSheet.hairlineWidth },
  accent: { width: 32, height: 4, borderRadius: 2, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.6, marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 23 },
});
