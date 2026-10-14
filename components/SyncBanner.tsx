import { Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useData } from '@/components/contexts/DataContext'
import { useTheme } from '@/contexts/ThemeContext'

export function SyncBanner() {
  const { syncError, retrySync } = useData()
  const { colors } = useTheme()
  const { t } = useTranslation()
  if (!syncError) return null
  return (
    <View style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.error, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' }}>
      <Text accessibilityRole="alert" style={{ color: colors.text, flex: 1, fontSize: 12 }} numberOfLines={2}>
        {t('sync.problem')} {syncError}
      </Text>
      <Pressable accessibilityRole="button" onPress={() => { void retrySync() }} style={{ padding: 8 }}>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>{t('sync.retry')}</Text>
      </Pressable>
    </View>
  )
}
