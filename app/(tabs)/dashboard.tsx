import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/components/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Link, router } from 'expo-router';
import { Target, Calendar, Map, Settings } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

export default function Dashboard() {
  const { colors, theme } = useTheme();
  const { getActiveGoals } = useData();
  const { signOut, user } = useAuth();
  const { t } = useTranslation();
  const activeGoals = getActiveGoals();

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 16, backgroundColor: colors.surface },
    title: { fontSize: 28, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
    content: { flex: 1, padding: 16 },
    card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 },
    goalItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    goalTitle: { color: colors.text, fontWeight: '600' },
    goalDesc: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    tile: { width: '48%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, alignItems: 'center' },
    tileText: { color: colors.text, fontWeight: '700', marginTop: 8 },
    footer: { marginTop: 16, alignItems: 'center' },
    signOutBtn: { marginTop: 8, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: colors.error },
    signOutText: { color: '#fff', fontWeight: '700' },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{theme === 'redMean' ? 'YOUR BATTLE HUB' : t('dashboard.title')}</Text>
        <Text style={styles.subtitle}>{user?.nickname || user?.email || 'Guest'}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('dashboard.activeGoals')}</Text>
            {activeGoals.length === 0 ? (
              <Text style={{ color: colors.textSecondary }}>{t('dashboard.noActive')}</Text>
            ) : (
              activeGoals.map((g) => (
                <View key={g.id} style={styles.goalItem}>
                  <Text style={styles.goalTitle}>{g.title}</Text>
                  {!!g.description && <Text style={styles.goalDesc}>{g.description}</Text>}
                </View>
              ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('dashboard.quickActions')}</Text>
            <View style={styles.grid}>
              <Link href="/(tabs)" asChild>
                <TouchableOpacity style={styles.tile}>
                  <Calendar color={colors.primary} />
                  <Text style={styles.tileText}>{t('dashboard.tiles.log')}</Text>
                </TouchableOpacity>
              </Link>
              <Link href="/(tabs)/goals" asChild>
                <TouchableOpacity style={styles.tile}>
                  <Target color={colors.primary} />
                  <Text style={styles.tileText}>{t('dashboard.tiles.goals')}</Text>
                </TouchableOpacity>
              </Link>
              <Link href="/(tabs)/history" asChild>
                <TouchableOpacity style={styles.tile}>
                  <Calendar color={colors.primary} />
                  <Text style={styles.tileText}>{t('dashboard.tiles.history')}</Text>
                </TouchableOpacity>
              </Link>
              <Link href="/(tabs)/map" asChild>
                <TouchableOpacity style={styles.tile}>
                  <Map color={colors.primary} />
                  <Text style={styles.tileText}>{t('dashboard.tiles.map')}</Text>
                </TouchableOpacity>
              </Link>
              <Link href="/(tabs)/settings" asChild>
                <TouchableOpacity style={styles.tile}>
                  <Settings color={colors.primary} />
                  <Text style={styles.tileText}>{t('dashboard.tiles.settings')}</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity onPress={async () => { await signOut(); router.replace({ pathname: '/auth/login' } as any); }} style={styles.signOutBtn}>
              <Text style={styles.signOutText}>{t('dashboard.signOut')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
