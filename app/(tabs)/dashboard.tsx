import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, TextInput } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/components/contexts/DataContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { Link, router } from 'expo-router';
import { Target, Calendar, Map, Settings } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import MapView, { Marker, Circle, MapPressEvent } from 'react-native-maps';
import { useLocationStay } from '@/contexts/LocationStayContext';

export default function Dashboard() {
  const { colors, theme } = useTheme();
  const { getActiveGoals } = useData();
  const { signOut, user } = useAuth();
  const { t } = useTranslation();
  const { entries } = useData();
  const { dailyGoalTarget } = useSettings();
  const { settings: staySettings, setSettings: setStaySettings, enabled: stayEnabled, toggleEnabled, setFromCurrentLocation, runtime } = useLocationStay();
  const activeGoals = getActiveGoals();
  const todayKey = new Date().toISOString().split('T')[0];
  const todayTotal = entries.filter(e => e.date.startsWith(todayKey)).reduce((s, e) => s + e.count, 0);
  const progress = dailyGoalTarget > 0 ? Math.min(100, Math.round((todayTotal / dailyGoalTarget) * 100)) : 0;

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
    inputRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
    input: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: colors.text, backgroundColor: colors.background },
    label: { color: colors.textSecondary, fontSize: 12, marginTop: 8 },
    map: { width: '100%', height: 220, borderRadius: 12, overflow: 'hidden', marginTop: 8 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
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
            <Text style={styles.sectionTitle}>흡연 구역 체류 알림</Text>
            <View style={styles.rowBetween}>
              <Text style={{ color: colors.textSecondary }}>기능</Text>
              <Switch value={stayEnabled} onValueChange={(v) => toggleEnabled(v)} />
            </View>
            <Text style={styles.label}>타겟 위치 설정</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="위도"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={staySettings.latitude != null ? String(staySettings.latitude) : ''}
                onChangeText={(txt) => {
                  const v = parseFloat(txt);
                  setStaySettings({ latitude: isFinite(v) ? v : null });
                }}
              />
              <TextInput
                style={styles.input}
                placeholder="경도"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={staySettings.longitude != null ? String(staySettings.longitude) : ''}
                onChangeText={(txt) => {
                  const v = parseFloat(txt);
                  setStaySettings({ longitude: isFinite(v) ? v : null });
                }}
              />
            </View>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="반경(m)"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={String(staySettings.radius ?? 50)}
                onChangeText={(txt) => {
                  const v = parseInt(txt, 10);
                  setStaySettings({ radius: isFinite(v as any) ? Math.max(5, v || 0) : 50 });
                }}
              />
            </View>
            <Text style={{ color: colors.textSecondary, marginTop: 6 }}>체류 시간은 설정 탭에서 변경할 수 있어요.</Text>
            <View style={{ marginTop: 8 }}>
              <TouchableOpacity onPress={setFromCurrentLocation} style={{ alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>현재 위치를 기준으로 설정</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.map}>
              <MapView
                style={{ flex: 1 }}
                initialRegion={{
                  latitude: staySettings.latitude ?? 37.5665,
                  longitude: staySettings.longitude ?? 126.978,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                onPress={(e: MapPressEvent) => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  setStaySettings({ latitude, longitude });
                }}
              >
                {staySettings.latitude != null && staySettings.longitude != null && (
                  <>
                    <Marker
                      coordinate={{ latitude: staySettings.latitude, longitude: staySettings.longitude }}
                      draggable
                      onDragEnd={(e) => {
                        const { latitude, longitude } = e.nativeEvent.coordinate;
                        setStaySettings({ latitude, longitude });
                      }}
                    />
                    <Circle
                      center={{ latitude: staySettings.latitude, longitude: staySettings.longitude }}
                      radius={staySettings.radius}
                      strokeColor={colors.primary}
                      fillColor={theme === 'redMean' ? 'rgba(255,0,0,0.1)' : 'rgba(0,122,255,0.1)'}
                    />
                  </>
                )}
              </MapView>
            </View>
            <View style={{ marginTop: 12 }}>
              <Text style={{ color: colors.textSecondary }}>
                상태: {runtime.inside ? '영역 안' : '영역 밖'} · 경과: {Math.floor((runtime.elapsedMs || 0) / 60000)}분 · 알림발송: {runtime.hasNotifiedForCurrentStay ? '예' : '아니오'}
              </Text>
            </View>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('settings.dailyGoal.title')}</Text>
            <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
              {t('settings.dailyGoal.label')}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{todayTotal}</Text>
              <Text style={{ color: colors.textSecondary }}>/ {dailyGoalTarget || 0}</Text>
              <Text style={{ color: theme === 'redMean' ? colors.error : colors.primary }}>{progress}%</Text>
            </View>
            <View style={{ marginTop: 8 }}>
              <Link href="/(tabs)/settings" asChild>
                <TouchableOpacity style={{ paddingVertical: 8 }}>
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>{t('settings.dailyGoal.title')}</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
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
