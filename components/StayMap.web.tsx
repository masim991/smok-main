import React, { forwardRef } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import type { StayMapProps } from './StayMap.types';
export default forwardRef(function StayMap({ latitude, longitude }: StayMapProps, _ref) {
  const { i18n } = useTranslation(); const { colors } = useTheme();
  return <View style={{ flex: 1, padding: 20, justifyContent: 'center', backgroundColor: colors.surface }}><Text style={{ color: colors.text }}>{i18n.language.startsWith('ko') ? '지도 선택과 체류 알림은 모바일 앱에서 사용할 수 있습니다.' : 'Map selection and stay alerts are available in the mobile app.'}</Text>{latitude != null && longitude != null && <Text style={{ color: colors.textSecondary, marginTop: 12 }}>{latitude.toFixed(5)}, {longitude.toFixed(5)}</Text>}</View>;
});
