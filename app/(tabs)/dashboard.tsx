import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, TextInput } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import StayMap from '@/components/StayMap';
import * as Location from 'expo-location';
import { useLocationStay } from '@/contexts/LocationStayContext';
import { useData } from '@/components/contexts/DataContext';
import { localDay } from '@/utils/tracking';
import { Link } from 'expo-router';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

export default function Dashboard() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const ko = i18n.language.startsWith('ko');
  const { entries, getActiveGoals } = useData();
  const todayCount = entries.filter(e => localDay(new Date(e.date)) === localDay(new Date())).reduce((sum, e) => sum + e.count, 0);
  const { settings: staySettings, setSettings: setStaySettings, enabled: stayEnabled, toggleEnabled, setFromCurrentLocation, runtime } = useLocationStay();
  const mapRef = useRef<any>(null);

  const handleSetFromCurrentLocation = async () => {
    await setFromCurrentLocation();
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      let status = perm.status;
      if (status !== Location.PermissionStatus.GRANTED) {
        const res = await Location.requestForegroundPermissionsAsync();
        status = res.status;
      }
      if (status !== Location.PermissionStatus.GRANTED) {
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          500,
        );
      }
    } catch (e) {
      console.error('Failed to move map to current location', e);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 16, backgroundColor: colors.surface },
    title: { fontSize: 28, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
    content: { flex: 1, padding: 16 },
    card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 },
    inputRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
    input: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: colors.text, backgroundColor: colors.background },
    label: { color: colors.textSecondary, fontSize: 12, marginTop: 8 },
    map: { width: '100%', height: 220, borderRadius: 12, overflow: 'hidden', marginTop: 8 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  });

  return (
    <View style={styles.container}>
      <ScreenHeader title={ko ? '오늘의 기록' : 'Today'} subtitle={user?.nickname || user?.email || 'SMOK'} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{ko ? '작은 기록부터 시작해요' : 'Start with a small record'}</Text>
            <View style={{ flexDirection: 'row', gap: 24, marginVertical: 16 }}>
              <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 36, fontWeight: '800' }}>{todayCount}</Text><Text style={styles.label}>{ko ? '오늘 기록한 개비' : 'Cigarettes recorded today'}</Text></View>
              <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 36, fontWeight: '800' }}>{getActiveGoals().length}</Text><Text style={styles.label}>{ko ? '진행 중인 목표' : 'Active goals'}</Text></View>
            </View>
            <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>{ko ? '기록이 없는 날이 금연한 날을 뜻하지는 않습니다. 오늘의 상황을 함께 기록해보세요.' : 'A day without records does not confirm a smoke-free day. Add the context of your day.'}</Text>
            <Link href="/(tabs)" asChild><TouchableOpacity accessibilityRole="button" style={{ backgroundColor: colors.primary, padding: 16, borderRadius: 12, marginTop: 20, alignItems: 'center' }}><Text style={{ color: colors.onPrimary, fontWeight: '700' }}>{ko ? '흡연 기록하기' : 'Record smoking'}</Text></TouchableOpacity></Link>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('dashboardStay.sectionTitle')}</Text>
            <View style={styles.rowBetween}>
              <Text style={{ color: colors.textSecondary }}>{t('dashboardStay.featureLabel')}</Text>
              <Switch value={stayEnabled} onValueChange={(v) => toggleEnabled(v)} />
            </View>
            <Text style={styles.label}>{t('dashboardStay.targetAutoLabel')}</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder={t('dashboardStay.radiusPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={String(staySettings.radius ?? 50)}
                onChangeText={(txt) => {
                  const v = parseInt(txt, 10);
                  setStaySettings({ radius: isFinite(v as any) ? Math.max(5, v || 0) : 50 });
                }}
              />
            </View>
            <Text style={{ color: colors.textSecondary, marginTop: 6 }}>{t('dashboardStay.timeHint')}</Text>
            <View style={{ marginTop: 8 }}>
              <TouchableOpacity onPress={handleSetFromCurrentLocation} style={{ alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>{t('dashboardStay.setFromCurrent')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.map}>
              <StayMap ref={mapRef} latitude={staySettings.latitude} longitude={staySettings.longitude} radius={staySettings.radius} color={colors.primary} onSelect={(latitude: number, longitude: number) => setStaySettings({ latitude, longitude })} />
            </View>
            <View style={{ marginTop: 12 }}>
              <Text style={{ color: colors.textSecondary }}>
                {t('dashboardStay.statusPrefix')}: {runtime.inside ? t('dashboardStay.statusInside') : t('dashboardStay.statusOutside')} · {t('dashboardStay.statusElapsed')}: {Math.floor((runtime.elapsedMs || 0) / 60000)}{t('dashboardStay.statusMinutes')} · {runtime.hasNotifiedForCurrentStay ? t('dashboardStay.statusNotifiedYes') : t('dashboardStay.statusNotifiedNo')}
              </Text>
            </View>
          </View>
          {/* Other dashboard sections removed as requested */}
        </View>
      </ScrollView>
    </View>
  );
}
