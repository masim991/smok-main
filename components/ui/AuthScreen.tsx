import React, { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { localTestMode } from '@/lib/localTest';

export function AuthScreen({ mode }: { mode: 'login' | 'signup' }) {
  const signup = mode === 'signup';
  const { colors } = useTheme();
  const { signIn, signUp, loading, startLocalTest } = useAuth();
  const { language, setLanguage } = useSettings();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const label = (k: string, en: string) => language === 'ko' ? k : en;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [nickname, setNickname] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const lock = useRef(false);
  const disabled = submitting || loading || emailSent;
  const submit = async () => {
    if (lock.current || disabled) return;
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError(label('올바른 이메일 주소를 입력해주세요.', 'Enter a valid email address.')); return; }
    if (!password || (signup && password.length < 8)) { setError(signup ? label('비밀번호는 8자 이상으로 입력해주세요.', 'Use at least 8 characters.') : label('비밀번호를 입력해주세요.', 'Enter your password.')); return; }
    if (signup && confirmation !== password) { setError(label('비밀번호 확인이 일치하지 않습니다.', 'The passwords do not match.')); return; }
    lock.current = true;
    setSubmitting(true);
    try {
      if (signup) {
        const result = await signUp(email.trim(), password, nickname.trim() || undefined);
        if (result.error) { setError(result.error); return; }
        if (result.emailSent) { setEmailSent(true); setPassword(''); setConfirmation(''); return; }
      } else {
        const result = await signIn(email.trim(), password);
        if (result.error) { setError(result.error); return; }
      }
      router.replace('/(tabs)/dashboard');
    } catch { setError(label('연결을 확인한 후 다시 시도해주세요.', 'Check your connection and try again.')); }
    finally { lock.current = false; setSubmitting(false); }
  };
  const inputStyle = [styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }];
  const labelStyle = [styles.label, { color: colors.text }];
  const primaryText = { color: colors.background === '#FFFFFF' ? '#fff' : colors.background };
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}>
        <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.brand, { color: colors.primary }]}>SMOK</Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>{label('오늘의 작은 기록, 내일의 변화', 'Small records today. Change tomorrow.')}</Text>
          <View style={styles.languages}>
            {(['ko', 'en'] as const).map(value => <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: language === value }} onPress={() => setLanguage(value)} style={[styles.language, { borderColor: language === value ? colors.primary : colors.border, backgroundColor: language === value ? colors.primary : colors.background }]}><Text style={[{ fontWeight: '600', color: colors.text }, language === value && primaryText]}>{value === 'ko' ? '한국어' : 'English'}</Text></TouchableOpacity>)}
          </View>
          {localTestMode ? <>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{label('로컬 테스트', 'Local test')}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{label('서버 계정 없이 기능을 확인합니다. 테스트 기록은 이 기기에 분리 저장되며 서버로 전송하지 않습니다.', 'Try the app without a server account. Test records are stored separately on this device and are not sent to a server.')}</Text>
            <TouchableOpacity accessibilityRole="button" disabled={loading} onPress={() => { startLocalTest(); router.replace('/(tabs)/dashboard'); }} style={[styles.submit, { backgroundColor: colors.primary, opacity: loading ? 0.55 : 1 }]}><Text style={[styles.submitText, primaryText]}>{label('로컬 테스트 시작', 'Start local test')}</Text></TouchableOpacity>
          </> : <>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{t(signup ? 'auth.signupTitle' : 'auth.signInTitle')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t(signup ? 'auth.signupSubtitle' : 'auth.signInSubtitle')}</Text>
          {emailSent ? <View accessibilityLiveRegion="polite" style={[styles.message, { borderColor: colors.success }]}><Text style={labelStyle}>{t('auth.verifyTitle')}</Text><Text style={{ color: colors.textSecondary, lineHeight: 22 }}>{t('auth.verifyBody')}</Text><Text style={{ color: colors.text, marginTop: 8 }}>{email.trim()}</Text></View> : <>
            {signup && <><Text style={labelStyle}>{label('닉네임 (선택)', 'Nickname (optional)')}</Text><TextInput style={inputStyle} accessibilityLabel={label('닉네임', 'Nickname')} autoComplete="nickname" value={nickname} onChangeText={setNickname} maxLength={40} editable={!disabled} placeholder={t('auth.nicknamePlaceholder')} placeholderTextColor={colors.textSecondary} /></>}
            <Text style={labelStyle}>{t('auth.email')}</Text>
            <TextInput style={inputStyle} accessibilityLabel={t('auth.email')} autoComplete="email" textContentType="emailAddress" autoCorrect={false} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} maxLength={254} editable={!disabled} placeholder="you@example.com" placeholderTextColor={colors.textSecondary} />
            <Text style={labelStyle}>{t('auth.password')}</Text>
            <TextInput style={inputStyle} accessibilityLabel={t('auth.password')} autoComplete={signup ? 'new-password' : 'current-password'} textContentType={signup ? 'newPassword' : 'password'} autoCapitalize="none" autoCorrect={false} secureTextEntry value={password} onChangeText={setPassword} editable={!disabled} onSubmitEditing={signup ? undefined : submit} returnKeyType={signup ? 'next' : 'go'} />
            {signup && <><Text style={[styles.hint, { color: colors.textSecondary }]}>{label('비밀번호는 8자 이상으로 설정해주세요.', 'Choose a password of at least 8 characters.')}</Text><Text style={labelStyle}>{label('비밀번호 확인', 'Confirm password')}</Text><TextInput style={inputStyle} accessibilityLabel={label('비밀번호 확인', 'Confirm password')} autoComplete="new-password" textContentType="newPassword" autoCapitalize="none" autoCorrect={false} secureTextEntry value={confirmation} onChangeText={setConfirmation} editable={!disabled} onSubmitEditing={submit} returnKeyType="go" /></>}
            {!!error && <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[styles.message, { borderColor: colors.error }]}><Text style={{ color: colors.text, lineHeight: 22 }}>{error}</Text></View>}
            <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled, busy: submitting }} disabled={disabled} onPress={submit} style={[styles.submit, { backgroundColor: colors.primary, opacity: disabled ? 0.55 : 1 }]}>{submitting && <ActivityIndicator color={primaryText.color} />}<Text style={[styles.submitText, primaryText]}>{submitting ? t(signup ? 'auth.creatingAccount' : 'auth.signingIn') : t(signup ? 'auth.signUp' : 'auth.signIn')}</Text></TouchableOpacity>
          </>}
          <Link href={signup ? '/auth/login' : '/auth/signup'} style={[styles.link, { color: colors.primary }]}>{t(signup ? 'auth.signInTitle' : 'auth.createAccount')}</Link>
          </>}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20 },
  form: { width: '100%', maxWidth: 460, alignSelf: 'center', borderWidth: 1, borderRadius: 24, padding: 24 },
  brand: { fontSize: 32, fontWeight: '800', letterSpacing: 4, textAlign: 'center' },
  tagline: { fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  languages: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 24 },
  language: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12, borderWidth: 1 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 14, lineHeight: 22, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 16 },
  hint: { fontSize: 13, lineHeight: 20, marginTop: -6, marginBottom: 16 },
  message: { padding: 14, borderWidth: 1, borderRadius: 12, marginBottom: 16 },
  submit: { minHeight: 50, borderRadius: 12, padding: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  submitText: { fontSize: 16, fontWeight: '700' },
  link: { textAlign: 'center', fontWeight: '600', paddingVertical: 16, marginTop: 8 },
});
