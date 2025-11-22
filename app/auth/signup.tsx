import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Link, router } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function Signup() {
  const { colors } = useTheme();
  const { signUp, loading } = useAuth();
  const { language, setLanguage } = useSettings();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: 'center' },
    title: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 8, textAlign: 'center' },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 24, textAlign: 'center' },
    langRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 16 },
    langBtn: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginHorizontal: 4 },
    langBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    langBtnText: { color: colors.text, fontWeight: '700' },
    langBtnTextActive: { color: '#fff' },
    input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.text, marginBottom: 12 },
    button: { backgroundColor: colors.primary, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 4 },
    buttonText: { color: '#fff', fontWeight: '700' },
    link: { color: colors.primary, fontWeight: '600', textAlign: 'center', marginTop: 12 },
  });

  const handleSignup = async () => {
    if (!email || !password) {
      Alert.alert(t('common.error'), t('auth.signInSubtitle'));
      return;
    }
    setSubmitting(true);
    const { error, emailSent } = await signUp(email.trim(), password, nickname.trim() || undefined);
    setSubmitting(false);
    if (error) {
      Alert.alert('Sign-up failed', error);
      return;
    }
    if (emailSent) {
      Alert.alert(t('auth.verifyTitle'), t('auth.verifyBody'), [
        { text: 'OK', onPress: () => router.replace({ pathname: '/auth/login' } as any) },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.langRow}>
        <TouchableOpacity
          style={[styles.langBtn, language === 'ko' && styles.langBtnActive]}
          onPress={() => setLanguage('ko')}
        >
          <Text style={[styles.langBtnText, language === 'ko' && styles.langBtnTextActive]}>한국어</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
          onPress={() => setLanguage('en')}
        >
          <Text style={[styles.langBtnText, language === 'en' && styles.langBtnTextActive]}>English</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>{t('auth.signupTitle')}</Text>
      <Text style={styles.subtitle}>{t('auth.signupSubtitle')}</Text>

      <TextInput
        style={styles.input}
        placeholder={t('auth.nicknamePlaceholder')}
        placeholderTextColor={colors.textSecondary}
        value={nickname}
        onChangeText={setNickname}
      />
      <TextInput
        style={styles.input}
        placeholder={t('auth.email')}
        placeholderTextColor={colors.textSecondary}
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder={t('auth.password')}
        placeholderTextColor={colors.textSecondary}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={submitting || loading}>
        <Text style={styles.buttonText}>{submitting ? t('auth.creatingAccount') : t('auth.signUp')}</Text>
      </TouchableOpacity>

      <Link href={{ pathname: '/auth/login' } as any} style={styles.link}>{t('auth.signInTitle')}</Link>
    </View>
  );
}
