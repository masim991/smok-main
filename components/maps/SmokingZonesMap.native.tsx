import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, Modal, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import type { MapPressEvent, Region, LongPressEvent } from 'react-native-maps';
import * as Location from 'expo-location';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { supabase, type SmokingZone } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { localTestMode } from '@/lib/localTest';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

export default function SmokingZonesMap() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const mapRef = useRef<any>(null);
  const [region, setRegion] = useState<Region>({ latitude: 37.5665, longitude: 126.978, latitudeDelta: 0.05, longitudeDelta: 0.05 });
  const regionRef = useRef(region); regionRef.current = region;
  const queryRevision = useRef(0);
  const mounted = useRef(true);
  const [error, setError] = useState('');
  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [zones, setZones] = useState<SmokingZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [locationChoiceVisible, setLocationChoiceVisible] = useState(false);
  const [listVisible, setListVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<SmokingZone | null>(null);
  const [pendingCoord, setPendingCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const clientId = user?.id ?? null;
  const [selectingOnMap, setSelectingOnMap] = useState(false);

  useEffect(() => {
    let active = true;
    mounted.current = true;
    if (localTestMode) { setLoading(false); return () => { mounted.current = false; }; }
    let channel: ReturnType<typeof supabase.channel> | undefined;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(t('map.locationPermissionTitle'), t('map.locationPermissionBody'));
          setLoading(false);
          await fetchZones(regionRef.current);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
        const initialRegion: Region = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        if (!active) return;
        setRegion(initialRegion);
        setMyLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLoading(false);
        await fetchZones(initialRegion);
        if (!active) return;

        channel = supabase.channel('zones-changes')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'smoking_zones' }, () => {
            void fetchZones(regionRef.current);
          })
          .subscribe();
      } catch {
        setLoading(false);
        if (active) await fetchZones(regionRef.current);
      }
    })();
    return () => { active = false; mounted.current = false; if (channel) void supabase.removeChannel(channel); };
    // The mount effect owns one location request and one live subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseUseMyLocation = () => {
    if (myLocation) setPendingCoord(myLocation);
    else if (region) setPendingCoord({ latitude: region.latitude, longitude: region.longitude });
    setLocationChoiceVisible(false);
    setNewTitle('');
    setNewDesc('');
    setAddModalVisible(true);
    setSelectingOnMap(false);
  };

  const choosePickOnMap = () => {
    if (region) setPendingCoord({ latitude: region.latitude, longitude: region.longitude });
    setLocationChoiceVisible(false);
    setNewTitle('');
    setNewDesc('');
    setAddModalVisible(true);
    setSelectingOnMap(true);
  };

  const deleteZone = async (z: SmokingZone) => {
    try {
      const { error } = await supabase.from('smoking_zones').delete().eq('id', z.id).eq('created_by', user?.id ?? '');
      if (error) throw error;
      if (region) fetchZones(region);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || String(e));
    }
  };

  const updateZone = async () => {
    if (!editTarget) return;
    try {
      const { error } = await supabase
        .from('smoking_zones')
        .update({ title: newTitle, description: newDesc })
        .eq('id', editTarget.id).eq('created_by', user?.id ?? '');
      if (error) throw error;
      setEditTarget(null);
      setAddModalVisible(false);
      if (region) fetchZones(region);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || String(e));
    }
  };

  const fetchZones = async (r: Region) => {
    if (localTestMode) return;
    const revision = ++queryRevision.current;
    const latMin = r.latitude - r.latitudeDelta * 0.5;
    const latMax = r.latitude + r.latitudeDelta * 0.5;
    const lonMin = r.longitude - r.longitudeDelta * 0.5;
    const lonMax = r.longitude + r.longitudeDelta * 0.5;
    const { data, error } = await supabase
      .from('smoking_zones')
      .select('*')
      .gte('latitude', latMin)
      .lte('latitude', latMax)
      .gte('longitude', lonMin)
      .lte('longitude', lonMax)
      .order('created_at', { ascending: false });
    if (!mounted.current || revision !== queryRevision.current) return;
    if (error) setError(t('map.addFailed'));
    else { setError(''); if (data) setZones(data as SmokingZone[]); }
  };

  const onRegionChangeComplete = (r: Region) => {
    setRegion(r);
    fetchZones(r);
  };

  const centerOnMe = async () => {
    if (!myLocation || !mapRef.current) return;
    mapRef.current.animateToRegion({
      latitude: myLocation.latitude,
      longitude: myLocation.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 500);
  };

  const handleLongPress = (e: LongPressEvent) => {
    if (localTestMode) return;
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPendingCoord({ latitude, longitude });
    setNewTitle('');
    setNewDesc('');
    setAddModalVisible(true);
  };

  const saveZone = async () => {
    if (localTestMode) return;
    let coord = pendingCoord;
    if (!coord && region) {
      coord = { latitude: region.latitude, longitude: region.longitude };
    }
    if (!coord) return;
    try {
      const { error } = await supabase.from('smoking_zones').insert({
        title: newTitle || t('map.zoneTitle'),
        description: newDesc || null,
        latitude: coord.latitude,
        longitude: coord.longitude,
        created_by: clientId,
      });
      if (error) {
        Alert.alert(t('common.error'), `${t('map.addFailed')}: ${error.message || 'unknown error'}`);
        return;
      }
      Alert.alert(t('map.added'));
      setAddModalVisible(false);
      setSelectingOnMap(false);
      setPendingCoord(null);
      if (region) fetchZones(region);
    } catch (e: any) {
      Alert.alert(t('common.error'), `${t('map.addFailed')}: ${e?.message || e}`);
    }
  };

  if (localTestMode) return <View style={{ flex: 1, backgroundColor: colors.background }}><ScreenHeader title={t('map.title')} subtitle="SMOK · Local test" /><Text style={{ padding: 24, color: colors.text, lineHeight: 24 }}>로컬 테스트에서는 위치를 요청하거나 서버에 구역을 등록하지 않습니다. 네이티브 지도·위치 알림은 실제 기기에서 별도로 검증해야 합니다.</Text></View>;
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {loading && <ActivityIndicator accessibilityLabel={t('map.loading')} />}
      {!!error && <TouchableOpacity accessibilityRole="button" onPress={() => void fetchZones(region)} style={{ padding: 16 }}><Text accessibilityRole="alert" style={{ color: colors.error }}>{error} · {t('common.save')}</Text></TouchableOpacity>}
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">{t('map.title')}</Text>
      </View>
      <View style={{ flex: 1 }}>
        {region && (
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            initialRegion={region}
            onRegionChangeComplete={onRegionChangeComplete}
            onLongPress={handleLongPress}
            onPress={(e: MapPressEvent) => {
              if (selectingOnMap) {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                setPendingCoord({ latitude, longitude });
              }
            }}
          >
            {myLocation && (
              <Marker coordinate={myLocation} pinColor={colors.primary} />
            )}
            {pendingCoord && (
              <Marker
                coordinate={pendingCoord}
                draggable
                onDragEnd={(e) => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  setPendingCoord({ latitude, longitude });
                }}
              >
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 26 }}>🚬</Text>
                  <Text style={{ fontSize: 10, color: colors.textSecondary }} numberOfLines={1} ellipsizeMode="tail">{t('map.zoneTitle')}</Text>
                </View>
              </Marker>
            )}
            {zones.map((z) => (
              <Marker key={z.id} coordinate={{ latitude: z.latitude, longitude: z.longitude }} title={z.title} description={z.description || undefined}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 24 }}>🚬</Text>
                </View>
              </Marker>
            ))}
          </MapView>
        )}
      </View>
      {selectingOnMap && (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 24, height: 24 }}>
            <View style={{ position: 'absolute', left: 11, top: 0, bottom: 0, width: 2, backgroundColor: colors.primary, borderRadius: 1 }} />
            <View style={{ position: 'absolute', top: 11, left: 0, right: 0, height: 2, backgroundColor: colors.primary, borderRadius: 1 }} />
          </View>
        </View>
      )}

      <View style={[styles.fabRow, { backgroundColor: 'transparent' }]}>
        <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={centerOnMe}>
          <Text style={[styles.fabText, { color: '#fff' }]} numberOfLines={1} ellipsizeMode="tail">{t('map.useMyLocation')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
          onPress={() => setLocationChoiceVisible(true)}
        >
          <Text style={[styles.fabText, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">{t('map.addZone')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.fab, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]} onPress={() => setListVisible(true)}>
          <Text style={[styles.fabText, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">{t('map.viewZones')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: selectingOnMap ? colors.error : colors.surface, borderWidth: 1, borderColor: colors.border }]}
          onPress={() => setSelectingOnMap((v) => !v)}
        >
          <Text style={[styles.fabText, { color: selectingOnMap ? '#fff' : colors.text }]} numberOfLines={1} ellipsizeMode="tail">{selectingOnMap ? t('map.exitSelectMode') : t('map.pickOnMap')}</Text>
        </TouchableOpacity>
        {selectingOnMap && (
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: colors.primary }]}
            onPress={() => {
              setNewTitle('');
              setNewDesc('');
              setAddModalVisible(true);
            }}
          >
            <Text style={[styles.fabText, { color: '#fff' }]} numberOfLines={1} ellipsizeMode="tail">{t('map.confirmCenter')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={addModalVisible} transparent animationType="fade" onRequestClose={() => setAddModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>{t('map.zoneTitle')}</Text>
            <TextInput value={newTitle} onChangeText={setNewTitle} style={[styles.input, { borderColor: colors.border, color: colors.text }]} placeholderTextColor={colors.textSecondary} />
            <Text style={[styles.inputLabel, { color: colors.text, marginTop: 12 }]}>{t('map.zoneDescription')}</Text>
            <TextInput value={newDesc} onChangeText={setNewDesc} style={[styles.input, { borderColor: colors.border, color: colors.text }]} placeholderTextColor={colors.textSecondary} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
              <TouchableOpacity onPress={() => { setAddModalVisible(false); setEditTarget(null); }} style={[styles.modalBtn, { borderColor: colors.border }]}>
                <Text style={{ color: colors.text }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { if (editTarget) void updateZone(); else void saveZone(); }} style={[styles.modalBtn, { backgroundColor: colors.primary, marginLeft: 8 }]}> 
                <Text style={{ color: '#fff' }}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={locationChoiceVisible} transparent animationType="fade" onRequestClose={() => setLocationChoiceVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={2} ellipsizeMode="tail">{t('map.chooseLocation')}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
              <TouchableOpacity onPress={() => setLocationChoiceVisible(false)} style={[styles.modalBtn, { borderColor: colors.border }]}> 
                <Text style={{ color: colors.text }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={choosePickOnMap} style={[styles.modalBtn, { backgroundColor: colors.surface, borderColor: colors.border, marginLeft: 8 }]}> 
                <Text style={{ color: colors.text }}>{t('map.pickOnMap')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={chooseUseMyLocation} style={[styles.modalBtn, { backgroundColor: colors.primary, marginLeft: 8 }]}> 
                <Text style={{ color: '#fff' }}>{t('map.useMyLocation')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={listVisible} transparent animationType="fade" onRequestClose={() => setListVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border, maxHeight: '70%' }]}>
            <Text style={[styles.title, { color: colors.text }]}>{t('map.zonesList')}</Text>
            <View style={{ marginTop: 12 }}>
              {zones.length === 0 ? (
                <Text style={{ color: colors.textSecondary }}>{t('map.noZones')}</Text>
              ) : (
                zones.map((z) => {
                  const isMine = !!clientId && z.created_by === clientId;

  return (
                    <View key={z.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.border }}>
                      <Text style={{ color: colors.text, fontWeight: '600' }}>{z.title}</Text>
                      {!!z.description && <Text style={{ color: colors.textSecondary }}>{z.description}</Text>}
                      <View style={{ flexDirection: 'row', marginTop: 8 }}>
                        <TouchableOpacity
                          style={[styles.modalBtn, { borderColor: colors.border }]}
                          onPress={() => {
                            setListVisible(false);
                            setRegion((r) => r ? { ...r, latitude: z.latitude, longitude: z.longitude } : r);
                            setTimeout(() => {
                              mapRef.current?.animateToRegion({ latitude: z.latitude, longitude: z.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
                            }, 0);
                          }}
                        >
                          <Text style={{ color: colors.text }} numberOfLines={1} ellipsizeMode="tail">{t('map.centerHere')}</Text>
                        </TouchableOpacity>
                        {isMine && (
                          <>
                            <TouchableOpacity
                              style={[styles.modalBtn, { borderColor: colors.border, marginLeft: 8 }]}
                              onPress={() => {
                                setEditTarget(z);
                                setNewTitle(z.title);
                                setNewDesc(z.description || '');
                                setListVisible(false);
                                setAddModalVisible(true);
                              }}
                            >
                              <Text style={{ color: colors.text }} numberOfLines={1} ellipsizeMode="tail">{t('map.edit')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.modalBtn, { backgroundColor: colors.error, marginLeft: 8 }]}
                              onPress={() => {
                                Alert.alert(t('map.deleteTitle'), t('map.deleteConfirm'), [
                                  { text: t('common.cancel'), style: 'cancel' },
                                  { text: t('map.delete'), style: 'destructive', onPress: () => deleteZone(z) },
                                ]);
                              }}
                            >
                              <Text style={{ color: '#fff' }} numberOfLines={1} ellipsizeMode="tail">{t('map.delete')}</Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
              <TouchableOpacity onPress={() => setListVisible(false)} style={[styles.modalBtn, { borderColor: colors.border }]}> 
                <Text style={{ color: colors.text }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: '700' },
  fabRow: { position: 'absolute', bottom: 24, left: 16, right: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  fab: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, marginRight: 8, marginBottom: 8, maxWidth: '48%' },
  fabText: { fontSize: 12, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { width: '86%', borderRadius: 12, borderWidth: 1, padding: 16 },
  inputLabel: { fontSize: 14, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 6 },
  modalBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
});
