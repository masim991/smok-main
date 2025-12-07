import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, TextInput } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import MapView, { Marker, Circle, MapPressEvent } from 'react-native-maps';
import * as Location from 'expo-location';
import { useLocationStay } from '@/contexts/LocationStayContext';

export default function Dashboard() {
  const { colors, theme } = useTheme();
  const { signOut, user } = useAuth();
  const { t } = useTranslation();
  const { settings: staySettings, setSettings: setStaySettings, enabled: stayEnabled, toggleEnabled, setFromCurrentLocation, runtime } = useLocationStay();
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    if (staySettings.latitude == null || staySettings.longitude == null) {
      setFromCurrentLocation();
    }
  }, [staySettings.latitude, staySettings.longitude, setFromCurrentLocation]);

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
      <View style={styles.header}>
        <Text style={styles.title}>{t('dashboardStay.screenTitle')}</Text>
        <Text style={styles.subtitle}>{user?.nickname || user?.email || 'Guest'}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.content}>
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
              <MapView
                style={{ flex: 1 }}
                ref={mapRef}
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
