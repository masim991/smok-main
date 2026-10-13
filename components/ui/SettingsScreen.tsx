import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Link, router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/components/contexts/DataContext';
import { notificationService } from '@/components/services/notifications/LocalNotifications';
import { ScreenHeader } from './ScreenHeader';
import { localTestMode } from '@/lib/localTest';

export function SettingsScreen() {
  const { colors, theme, setTheme, isRedMeanUnlocked } = useTheme();
  const settings = useSettings();
  const { user, updateNickname, deleteAccount, signOut } = useAuth();
  const { entries } = useData();
  const label = (ko: string, en: string) => settings.language === 'ko' ? ko : en;
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [time, setTime] = useState(settings.notificationTime);
  const [count, setCount] = useState(String(settings.remindersPerDay));
  const [target, setTarget] = useState(String(settings.dailyGoalTarget));
  const [minutes, setMinutes] = useState(String(settings.stayMinutes));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteWord, setDeleteWord] = useState('');
  const lock = useRef(false);
  useEffect(() => setNickname(user?.nickname || ''), [user?.nickname]);
  useEffect(() => setTime(settings.notificationTime), [settings.notificationTime]);
  useEffect(() => setCount(String(settings.remindersPerDay)), [settings.remindersPerDay]);
  useEffect(() => setTarget(String(settings.dailyGoalTarget)), [settings.dailyGoalTarget]);
  useEffect(() => setMinutes(String(settings.stayMinutes)), [settings.stayMinutes]);
  const run = async (operation: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try { await operation(); }
    catch (e) { setError(e instanceof Error ? e.message : label('저장하지 못했습니다. 다시 시도해주세요.', 'Could not save. Please try again.')); }
    finally { lock.current = false; setBusy(false); }
  };
  const validateInteger = (value: string, minimum: number, maximum: number) => /^\d+$/.test(value) && Number(value) >= minimum && Number(value) <= maximum;
  const peakTimes = () => {
    const buckets = Array(24).fill(0);
    const since = Date.now() - 30 * 86400000;
    entries.forEach(entry => { const date = new Date(entry.date); if (date.getTime() >= since && date.getTime() <= Date.now()) buckets[date.getHours()] += entry.count; });
    const ranked = buckets.map((value, hour) => ({ value, hour })).filter(item => item.value > 0).sort((a, b) => b.value - a.value).slice(0, 3);
    return ranked.length ? ranked.map(item => `${String(item.hour).padStart(2, '0')}:00`).sort() : ['09:00', '12:00', '18:00'];
  };
  const configureNotifications = (mode: 'regular' | 'smart', enabled: boolean) => run(async () => {
    if (Platform.OS === 'web') throw new Error(label('예약 알림은 Android/iOS 앱에서 사용할 수 있습니다.', 'Scheduled notifications are available in the Android/iOS app.'));
    if (enabled && !(await notificationService.requestPermissions())) throw new Error(label('기기 설정에서 알림 권한을 허용해주세요.', 'Allow notification permission in device settings.'));
    if (!enabled) {
      await notificationService.cancelAllNotifications();
      await settings.setNotificationsEnabled(false); await settings.setSmartNotificationsEnabled(false);
      setMessage(label('예약 알림을 껐습니다.', 'Scheduled reminders are off.')); return;
    }
    if (mode === 'smart') {
      const times = peakTimes();
      await notificationService.scheduleSmartReminders(times);
      await settings.setNotificationsEnabled(false); await settings.setSmartNotificationsEnabled(true);
      setMessage(`${label('예약 시간', 'Scheduled times')}: ${times.join(', ')}`);
    } else {
      await notificationService.scheduleMotivationalReminders({ enabled: true, reminderTime: settings.notificationTime, remindersPerDay: settings.remindersPerDay });
      await settings.setSmartNotificationsEnabled(false); await settings.setNotificationsEnabled(true);
      setMessage(label('일반 알림을 적용했습니다.', 'Regular reminders applied.'));
    }
  });
  const saveSchedule = () => run(async () => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !validateInteger(count, 0, 10)) throw new Error(label('시간은 HH:MM, 횟수는 0~10 사이 정수로 입력해주세요.', 'Use HH:MM time and an integer count from 0 to 10.'));
    if (settings.notificationsEnabled && Platform.OS !== 'web') await notificationService.scheduleMotivationalReminders({ enabled: true, reminderTime: time, remindersPerDay: Number(count) });
    await settings.setNotificationTime(time); await settings.setRemindersPerDay(Number(count));
    setMessage(label('시간과 횟수를 저장했습니다. 횟수가 0이면 예약 알림이 없습니다.', 'Time and count saved. A count of zero schedules no reminders.'));
  });
  const removeAccount = () => run(async () => {
    setDeleteError('');
    try {
      const result = await deleteAccount();
      if (result.error) { setDeleteError(result.error); return; }
      setConfirmDelete(false); router.replace('/auth/login');
    } catch { setDeleteError(label('계정을 삭제하지 못했습니다. 다시 시도해주세요.', 'Could not delete your account. Please try again.')); }
  });
  const text = { color: colors.text };
  const muted = { color: colors.textSecondary };
  const input = [styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }];
  const primaryText = { color: theme === 'light' ? '#fff' : colors.background };
  const button = (title: string, onPress: () => void, danger = false, disabled = busy) => <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.button, { backgroundColor: danger ? colors.error : colors.primary, opacity: disabled ? 0.5 : 1 }]}><Text style={[styles.buttonText, danger ? { color: theme === 'redMean' ? colors.background : '#fff' } : primaryText]}>{title}</Text></TouchableOpacity>;
  const section = (title: string, content: React.ReactNode) => <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}><Text accessibilityRole="header" style={[styles.heading, text]}>{title}</Text>{content}</View>;
  const toggle = (title: string, value: boolean, change: (value: boolean) => void, disabled = busy) => <View style={styles.row}><Text style={[styles.rowLabel, text]}>{title}</Text><Switch accessibilityLabel={title} value={value} onValueChange={change} disabled={disabled} trackColor={{ true: colors.primary }} /></View>;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenHeader title={label('설정', 'Settings')} subtitle={label('나에게 맞는 기록과 알림을 설정하세요.', 'Choose the tracking and reminders that suit you.')} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[styles.notice, text]}>{error}</Text>}
        {!!message && <Text accessibilityLiveRegion="polite" style={[styles.notice, text]}>{message}</Text>}
        {section(localTestMode ? label('로컬 테스트', 'Local test') : label('내 계정', 'My account'), <>
          <Text style={[styles.description, muted]}>{localTestMode ? label('테스트 기록은 이 기기에 분리 저장되며 서버로 전송하지 않습니다.', 'Test records are stored separately on this device and are not sent to a server.') : user?.email || label('로그인 정보 없음', 'No account information')}</Text>
          <Text style={[styles.label, text]}>{label('닉네임', 'Nickname')}</Text><TextInput accessibilityLabel={label('닉네임', 'Nickname')} autoComplete="nickname" value={nickname} onChangeText={setNickname} editable={!busy} maxLength={40} style={input} />
          {button(label('닉네임 저장', 'Save nickname'), () => run(async () => { if (!nickname.trim()) throw new Error(label('닉네임을 입력해주세요.', 'Enter a nickname.')); const result = await updateNickname(nickname.trim()); if (result.error) throw new Error(result.error); setMessage(label('닉네임을 저장했습니다.', 'Nickname saved.')); }))}
          {button(localTestMode ? label('테스트 종료', 'End test') : label('로그아웃', 'Sign out'), () => run(async () => { await signOut(); router.replace('/auth/login'); }))}
        </>)}
        {section(label('화면과 언어', 'Appearance and language'), <>
          <View style={styles.options}>{(['light', 'dark', ...(isRedMeanUnlocked ? ['redMean'] : [])] as ('light' | 'dark' | 'redMean')[]).map(value => <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: theme === value }} onPress={() => setTheme(value)} style={[styles.option, { borderColor: theme === value ? colors.primary : colors.border }]}><Text style={text}>{value === 'light' ? label('라이트', 'Light') : value === 'dark' ? label('다크', 'Dark') : label('빨간 테마', 'Red theme')}</Text></TouchableOpacity>)}</View>
          <View style={styles.options}>{(['ko', 'en'] as const).map(value => <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: settings.language === value }} onPress={() => settings.setLanguage(value)} style={[styles.option, { borderColor: settings.language === value ? colors.primary : colors.border }]}><Text style={text}>{value === 'ko' ? '한국어' : 'English'}</Text></TouchableOpacity>)}</View>
        </>)}
        {section(label('예약 알림', 'Scheduled reminders'), <>
          <Text style={[styles.description, muted]}>{Platform.OS === 'web' ? label('예약 알림은 Android/iOS 앱에서 지원합니다. 시간과 횟수는 여기서 저장할 수 있습니다.', 'Scheduled reminders require the Android/iOS app. You can save the time and count here.') : label('일반 알림과 패턴 알림 중 한 가지를 사용합니다.', 'Choose either regular reminders or pattern reminders.')}</Text>
          {toggle(label('일반 알림', 'Regular reminders'), settings.notificationsEnabled, value => configureNotifications('regular', value), busy || Platform.OS === 'web')}
          <Text style={[styles.label, text]}>{label('첫 알림 시간 (HH:MM)', 'First reminder (HH:MM)')}</Text><TextInput accessibilityLabel={label('첫 알림 시간', 'First reminder time')} value={time} onChangeText={setTime} editable={!busy} maxLength={5} autoCapitalize="none" style={input} />
          <Text style={[styles.label, text]}>{label('하루 알림 횟수 (0~10)', 'Reminders per day (0–10)')}</Text><TextInput accessibilityLabel={label('하루 알림 횟수', 'Daily reminder count')} value={count} onChangeText={setCount} editable={!busy} keyboardType="number-pad" maxLength={2} style={input} />
          {button(label('시간과 횟수 저장', 'Save time and count'), saveSchedule)}
          {toggle(label('흡연 패턴에 따른 알림', 'Pattern reminders'), settings.smartNotificationsEnabled, value => configureNotifications('smart', value), busy || Platform.OS === 'web')}
          <Text style={[styles.description, muted]}>{label('최근 30일 기록에서 흡연량이 많은 시간대를 최대 3개 선택합니다. 기록이 없으면 09:00, 12:00, 18:00에 예약합니다.', 'Uses up to 3 peak hours from the last 30 days of records. Without records, schedules 09:00, 12:00 and 18:00.')}</Text>
          {settings.smartNotificationsEnabled && button(label('현재 기록으로 다시 예약', 'Reschedule from current records'), () => configureNotifications('smart', true))}
        </>)}
        {section(label('하루 목표', 'Daily target'), <>
          <Text style={[styles.description, muted]}>{label('하루 흡연량 기준을 설정합니다. 0은 금연 목표입니다.', 'Set your daily cigarette target. Zero means a smoke-free goal.')}</Text>
          <TextInput accessibilityLabel={label('하루 목표 개비', 'Daily cigarette target')} value={target} onChangeText={setTarget} editable={!busy} keyboardType="number-pad" maxLength={4} style={input} />
          {button(label('하루 목표 저장', 'Save daily target'), () => run(async () => { if (!validateInteger(target, 0, 1000)) throw new Error(label('0~1000 사이 정수로 입력해주세요.', 'Enter an integer from 0 to 1000.')); await settings.setDailyGoalTarget(Number(target)); setMessage(label('하루 목표를 저장했습니다.', 'Daily target saved.')); }))}
        </>)}
        {section(label('체류 후 직접 기록 안내', 'Manual logging prompts after a stay'), <>
          <Text style={[styles.description, muted]}>{label('구역 체류는 흡연을 증명하지 않습니다. 기록은 안내를 확인한 뒤 직접 추가합니다.', 'Staying in an area does not prove smoking. Confirm the prompt and add your own record.')}</Text>
          {toggle(label('체류 후 기록 안내', 'Prompt to log after a stay'), settings.geofenceAutoCount, settings.setGeofenceAutoCount)}
          <Text style={[styles.label, text]}>{label('안내까지 체류 시간 (1~120분)', 'Stay duration before prompt (1–120 min)')}</Text><TextInput accessibilityLabel={label('체류 시간', 'Stay duration')} value={minutes} onChangeText={setMinutes} editable={!busy} keyboardType="number-pad" maxLength={3} style={input} />
          {button(label('체류 시간 저장', 'Save stay duration'), () => run(async () => { if (!validateInteger(minutes, 1, 120)) throw new Error(label('1~120 사이 정수로 입력해주세요.', 'Enter an integer from 1 to 120.')); await settings.setStayMinutes(Number(minutes)); setMessage(label('체류 시간을 저장했습니다.', 'Stay duration saved.')); }))}
          <View style={styles.options}>{(['once', 'every_block'] as const).map(value => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: settings.stayNotificationMode === value }} disabled={busy} key={value} onPress={() => settings.setStayNotificationMode(value)} style={[styles.option, { borderColor: settings.stayNotificationMode === value ? colors.primary : colors.border }]}><Text style={text}>{value === 'once' ? label('체류당 한 번', 'Once per stay') : label('설정 시간마다', 'Every interval')}</Text></TouchableOpacity>)}</View>
          <Link href="/(tabs)/dashboard" style={[styles.link, { color: colors.primary }]}>{label('구역·위치 권한 설정으로 이동', 'Configure area and location permissions')}</Link>
        </>)}
        {section(label('개인정보와 계정 삭제', 'Privacy and account deletion'), <>
          <Text style={[styles.description, muted]}>{label('흡연 기록과 위치 권한은 민감한 정보입니다. 저장과 동기화 범위를 확인해주세요.', 'Smoking records and location permissions are sensitive. Review how data is saved and synced.')}</Text>
          <Link href="/privacy" style={[styles.link, { color: colors.primary }]}>{label('개인정보 안내', 'Privacy information')}</Link>
          {button(localTestMode ? label('테스트 기록 초기화', 'Clear test records') : label('계정 삭제', 'Delete account'), () => { setDeleteError(''); setDeleteWord(''); setConfirmDelete(true); }, true)}
        </>)}
      </ScrollView>
      <Modal visible={confirmDelete} transparent animationType="fade" onRequestClose={() => { if (!busy) setConfirmDelete(false); }}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            <View style={[styles.deleteCard, { backgroundColor: colors.surface }]}>
              <Text accessibilityRole="header" style={[styles.heading, text]}>{localTestMode ? label('테스트 기록을 초기화할까요?', 'Clear test records?') : label('계정을 삭제할까요?', 'Delete your account?')}</Text>
              <Text style={[styles.description, muted]}>{localTestMode ? label('이 기기의 로컬 테스트 기록을 지우고 테스트를 종료합니다. 확인하려면 DELETE를 입력해주세요.', 'Clears local test records on this device and ends the test. Type DELETE to confirm.') : label('계정과 연결된 데이터를 삭제하며 되돌릴 수 없습니다. 확인하려면 DELETE를 입력해주세요.', 'Deletes your account and its associated data permanently. Type DELETE to confirm.')}</Text>
              <TextInput accessibilityLabel={label('삭제 확인 문구 DELETE', 'Deletion confirmation DELETE')} value={deleteWord} onChangeText={setDeleteWord} editable={!busy} autoCapitalize="characters" autoCorrect={false} style={input} />
              {!!deleteError && <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[styles.notice, text]}>{deleteError}</Text>}
              {button(busy ? label('삭제 중…', 'Deleting…') : localTestMode ? label('테스트 기록 초기화', 'Clear test records') : label('계정 영구 삭제', 'Permanently delete account'), removeAccount, true, busy || deleteWord !== 'DELETE')}
              {button(label('취소', 'Cancel'), () => setConfirmDelete(false))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, width: '100%', maxWidth: 700, alignSelf: 'center' },
  card: { padding: 20, borderRadius: 18, borderWidth: 1, marginBottom: 16 },
  heading: { fontSize: 19, fontWeight: '700', marginBottom: 14 },
  description: { fontSize: 14, lineHeight: 22, marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 8 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, gap: 12 },
  rowLabel: { fontSize: 15, flex: 1, lineHeight: 22 },
  button: { minHeight: 48, borderRadius: 10, padding: 12, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  buttonText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  option: { minHeight: 44, borderWidth: 2, borderRadius: 10, padding: 12, justifyContent: 'center' },
  link: { paddingVertical: 16, fontSize: 15, fontWeight: '600' },
  notice: { padding: 14, lineHeight: 22, marginBottom: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', padding: 24 },
  deleteCard: { width: '100%', maxWidth: 480, alignSelf: 'center', padding: 24, borderRadius: 18 },
});
