import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, TextInput } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import MapView, { Marker, Circle, MapPressEvent } from 'react-native-maps';
import { useLocationStay } from '@/contexts/LocationStayContext';

export default function Dashboard() {
  const { colors, theme } = useTheme();
  const { signOut, user } = useAuth();
  const { t } = useTranslation();
  const { settings: staySettings, setSettings: setStaySettings, enabled: stayEnabled, toggleEnabled, setFromCurrentLocation, runtime } = useLocationStay();

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
          {/* Other dashboard sections removed as requested */}
        </View>
      </ScrollView>
    </View>
  );
}
