import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { useTranslation } from 'react-i18next'

export default function SmokingZonesMapWeb() {
  const { colors } = useTheme()
  const { t } = useTranslation()
  return <View style={[styles.container, { backgroundColor: colors.background }]}>
    <Text style={[styles.title, { color: colors.text }]}>{t('map.title')}</Text>
    <View style={[styles.placeholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>{t('map.nativeOnly')}</Text>
    </View>
  </View>
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 16 },
  placeholder: { flex: 1, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', padding: 24 },
})
