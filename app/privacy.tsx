import React from 'react';
import { ScrollView, Text, View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
export default function PrivacyInfo() {
  const { colors } = useTheme(); const { i18n } = useTranslation(); const ko = i18n.language.startsWith('ko');
  const paragraphs = ko ? [
    'SMOK는 개인의 흡연 기록과 목표 관리를 돕습니다. 의료 진단이나 검증된 흡연 감지 서비스를 제공하지 않습니다.',
    '이메일과 닉네임은 계정 관리에 사용합니다. 입력한 흡연 개수·시각·메모·목표는 기기에 저장되고 로그인한 계정의 Supabase 서버와 동기화됩니다. 메모에는 원하지 않는 개인정보를 적지 마세요.',
    '체류 알림은 선택 기능입니다. 사용자가 기능을 켜고 권한을 허용하면 선택한 장소와 현재 위치를 기기에서 비교합니다. 백그라운드 권한을 허용한 경우 앱이 화면에 없을 때도 작동할 수 있습니다. 체류 알림을 끄거나 운영체제 설정에서 위치 권한을 철회할 수 있습니다.',
    '위치·소리·움직임만으로 흡연을 확정하지 않습니다. 흡연 기록은 사용자가 직접 입력합니다. 현재 출시 준비 버전에서는 오디오·웨어러블 감지 기능을 제공하지 않습니다.',
    '등록한 흡연구역의 제목·설명·좌표는 다른 로그인 사용자에게 보입니다. 집이나 민감한 사적 장소를 등록하지 마세요. 구역이 실제로 허용된 흡연 장소인지 현장 표지판을 확인해주세요.',
    '설정에서 계정 삭제를 요청할 수 있습니다. 서버가 삭제 성공을 확인한 뒤 계정과 소유 데이터 삭제를 처리하고 현재 기기의 계정 기록을 정리합니다. 오프라인에서는 서버 계정 삭제를 완료할 수 없습니다. 로그아웃은 계정 삭제가 아닙니다.',
    '이 화면은 기능의 정보 처리 안내입니다. 정식 개인정보처리방침·운영자 연락처·공개 삭제 요청 URL은 출시 전에 확정하여 제공해야 합니다.',
  ] : [
    'SMOK supports personal smoking records and goals. It does not provide medical diagnosis or validated smoking detection.',
    'Email and nickname are used for your account. Counts, times, notes and goals are saved on your device and synchronized to your signed-in account on Supabase. Avoid adding unwanted personal information to notes.',
    'Stay alerts are optional. When enabled with permission, the app compares your chosen place and current location on your device. With background permission this can continue while the app is not visible. Disable alerts or revoke location permission in system settings at any time.',
    'Location, sound or movement does not confirm smoking. You enter records manually. Audio and wearable detection are unavailable in this release preparation version.',
    'Smoking area titles, descriptions and coordinates you submit are visible to other signed-in users. Do not submit private or sensitive places. Check on-site signs to confirm whether smoking is allowed.',
    'Request account deletion in Settings. After the server confirms success, owned account data is deleted and records on this device are cleared. Server deletion requires an internet connection. Signing out does not delete your account.',
    'This screen explains data handling. A formal privacy policy, operator contact and public deletion request URL must be finalized before launch.',
  ];
  return <View style={{ flex: 1, backgroundColor: colors.background }}><ScreenHeader title={ko ? '정보 처리 안내' : 'Data handling information'} subtitle="SMOK" /><ScrollView contentContainerStyle={{ padding: 24, maxWidth: 760, width: '100%', alignSelf: 'center' }}>{paragraphs.map(p => <Text key={p} style={{ fontSize: 16, lineHeight: 27, color: colors.text, marginBottom: 22 }}>{p}</Text>)}<TouchableOpacity accessibilityRole="button" style={{ padding: 16 }} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}><Text style={{ color: colors.primary }}>{ko ? '돌아가기' : 'Back'}</Text></TouchableOpacity></ScrollView></View>;
}
