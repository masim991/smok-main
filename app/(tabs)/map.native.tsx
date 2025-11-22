import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, TextInput, Modal } from 'react-native';
import type { MapPressEvent, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { supabase, type SmokingZone } from '@/lib/supabase';
import { notificationService } from '@/components/services/notifications/LocalNotifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SmokingZonesMap() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const mapRef = useRef<any>(null);
  const MapView = useMemo(() => require('react-native-maps').default, []);
  const Marker = useMemo(() => require('react-native-maps').Marker, []);
  const [region, setRegion] = useState<Region | null>(null);
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
  const [clientId, setClientId] = useState<string | null>(null);
  const [selectingOnMap, setSelectingOnMap] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(t('map.locationPermissionTitle'), t('map.locationPermissionBody'));
          setLoading(false);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
        const initialRegion: Region = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setRegion(initialRegion);
        setMyLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLoading(false);
        await fetchZones(initialRegion);
        try {
          const id = await getOrCreateClientId();
          setClientId(id);
        } catch {}
        const channel = supabase.channel('zones-changes')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'smoking_zones' }, () => {
            if (region) fetchZones(region);
          })
          .subscribe();
        try {
          await notificationService.requestPermissions();
        } catch {}

        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 25,
            timeInterval: 10000,
          },
          (loc) => {
            const current = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            setMyLocation(current);
            checkZoneEntry(current);
          }
        );

        return () => {
          try { subscription.remove(); } catch {}
          supabase.removeChannel(channel);
        };
      } catch (e) {
        setLoading(false);
      }
    })();
  }, []);

  const getOrCreateClientId = async (): Promise<string> => {
    const key = 'clientId';
    let id = await AsyncStorage.getItem(key);
    if (!id) {
      id = generateUuid();
      await AsyncStorage.setItem(key, id);
    }
    return id;
  };

  const generateUuid = () => {
    const s: string[] = [];
    const hex = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
    for (let i = 0; i < hex.length; i++) {
      const c = hex[i];
      if (c === 'x' || c === 'y') {
        const r = Math.floor(Math.random() * 16);
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        s.push(v.toString(16));
      } else {
        s.push(c);
      }
    }
    return s.join('');
  };

  const startAddFlow = () => {
    setLocationChoiceVisible(true);
  };

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
      const { error } = await supabase.from('smoking_zones').delete().eq('id', z.id);
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
        .eq('id', editTarget.id);
      if (error) throw error;
      setEditTarget(null);
      setAddModalVisible(false);
      if (region) fetchZones(region);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || String(e));
    }
  };

  const notifiedZoneIdsRef = useRef<Set<string>>(new Set());

  const distanceMeters = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371000; // meters
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const la1 = toRad(a.latitude);
    const la2 = toRad(b.latitude);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const h = sinDLat * sinDLat + Math.cos(la1) * Math.cos(la2) * sinDLon * sinDLon;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  };

  const checkZoneEntry = (current: { latitude: number; longitude: number }) => {
    const ENTER_RADIUS_M = 60; // meters
    for (const z of zones) {
      const d = distanceMeters(current, { latitude: z.latitude, longitude: z.longitude });
      if (d <= ENTER_RADIUS_M) {
        if (!notifiedZoneIdsRef.current.has(z.id)) {
          notifiedZoneIdsRef.current.add(z.id);
          notificationService.scheduleEncouragementNotification('', 0);
        }
      } else {
        if (notifiedZoneIdsRef.current.has(z.id) && d > ENTER_RADIUS_M * 2) {
          notifiedZoneIdsRef.current.delete(z.id);
        }
      }
    }
  };

  const fetchZones = async (r: Region) => {
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
    if (!error && data) setZones(data as SmokingZone[]);
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

  const handleLongPress = (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPendingCoord({ latitude, longitude });
    setNewTitle('');
    setNewDesc('');
    setAddModalVisible(true);
  };

  const saveZone = async () => {
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
      setPendingCoord(null);
      if (region) fetchZones(region);
    } catch (e: any) {
      Alert.alert(t('common.error'), `${t('map.addFailed')}: ${e?.message || e}`);
    } finally {
      setAddModalVisible(false);
      setSelectingOnMap(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
                onDragEnd={(e: MapPressEvent) => {
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
              <TouchableOpacity onPress={() => { editTarget ? updateZone() : saveZone(); }} style={[styles.modalBtn, { backgroundColor: colors.primary, marginLeft: 8 }]}> 
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
                      <Text style={{ color: colors.textSecondary }}>{z.latitude.toFixed(5)}, {z.longitude.toFixed(5)}</Text>
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
