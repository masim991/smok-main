import { LocaleConfig } from 'react-native-calendars';
LocaleConfig.locales.ko = { monthNames: Array.from({ length: 12 }, (_, i) => `${i + 1}월`), monthNamesShort: Array.from({ length: 12 }, (_, i) => `${i + 1}월`), dayNames: ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'], dayNamesShort: ['일','월','화','수','목','금','토'], today: '오늘' };
export function setCalendarLocale(language: string) { LocaleConfig.defaultLocale = language.startsWith('ko') ? 'ko' : ''; }
