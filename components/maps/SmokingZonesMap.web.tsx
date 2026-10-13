import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase, type SmokingZone } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { localTestMode } from '@/lib/localTest';
export default function SmokingZonesList() {
  const { colors } = useTheme(); const { i18n } = useTranslation(); const ko = i18n.language.startsWith('ko');
  const [zones, setZones] = useState<SmokingZone[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(false);
  const load = async () => { setLoading(true); setError(false); if (localTestMode) { setZones([]); setLoading(false); return; } try { const { data, error } = await supabase.from('smoking_zones').select('id,title,description,latitude,longitude,created_at').order('created_at', { ascending: false }).limit(100); if (error) throw error; setZones(data ?? []); } catch { setError(true); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScreenHeader title={ko ? '흡연구역' : 'Smoking areas'} subtitle={ko ? '사용자가 등록한 정보입니다. 현장 표지판을 확인해주세요.' : 'Community information. Check signs at the location.'} />
    <Text style={{ padding: 20, color: colors.textSecondary }}>{ko ? '웹에서는 최근 등록된 구역을 볼 수 있습니다. 지도 선택과 위치 알림은 모바일 앱에서 사용해주세요.' : 'Browse recent areas here. Map selection and location alerts are available in the mobile app.'}</Text>
    {loading ? <ActivityIndicator accessibilityLabel={ko ? '불러오는 중' : 'Loading'} /> : error ? <View style={{ padding: 20 }}><Text accessibilityRole="alert" style={{ color: colors.error }}>{ko ? '구역을 불러오지 못했습니다.' : 'Could not load areas.'}</Text><TouchableOpacity accessibilityRole="button" onPress={load} style={{ padding: 16 }}><Text style={{ color: colors.primary }}>{ko ? '다시 시도' : 'Retry'}</Text></TouchableOpacity></View> : <FlatList data={zones} keyExtractor={z => z.id} contentContainerStyle={{ padding: 20 }} ListEmptyComponent={<Text style={{ color: colors.textSecondary }}>{ko ? '등록된 구역이 없습니다.' : 'No areas yet.'}</Text>} renderItem={({ item }) => <View style={{ padding: 20, marginBottom: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{item.title}</Text><Text style={{ color: colors.textSecondary, marginTop: 8 }}>{item.description}</Text><TouchableOpacity accessibilityRole="link" onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`)} style={{ paddingVertical: 14 }}><Text style={{ color: colors.primary }}>{ko ? '지도에서 보기 ↗' : 'View on map ↗'}</Text></TouchableOpacity></View>} />}
  </View>;
}
