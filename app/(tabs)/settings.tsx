import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Bell, BellOff, Palette, Plus, Minus, Moon, Sun, Skull } from 'lucide-react-native';
import { notificationService } from '@/components/services/notifications/LocalNotifications';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/components/contexts/DataContext';

type SettingsSectionProps = {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  style?: any;
};

// 설정 섹션 공통 컨테이너 컴포넌트
const SettingsSection = ({ title, icon, children, style }: SettingsSectionProps) => {
  const { colors } = useTheme();

  const sectionStyles = StyleSheet.create({
    section: {
      margin: 16,
      borderRadius: 12,
      borderWidth: 1,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    sectionHeader: {
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 12,
      color: colors.primary,
    },
    sectionContent: {
      padding: 8,
    },
  });

  return (
    <View style={[sectionStyles.section, style]}>
      <View style={sectionStyles.sectionHeader}>
        {icon}
        <Text style={sectionStyles.sectionTitle} numberOfLines={1} ellipsizeMode="tail">{title}</Text>
      </View>
      <View style={sectionStyles.sectionContent}>{children}</View>
    </View>
  );
};

// 설정 탭 메인 컴포넌트: 테마/언어/알림/계정 등 사용자 환경 설정 제공
export default function SettingsTab() {
  const { colors, theme, setTheme, isRedMeanUnlocked, unlockRedMean } = useTheme();
  const {
    remindersPerDay,
    setRemindersPerDay,
    notificationsEnabled,
    setNotificationsEnabled: setNotificationsEnabledContext,
    notificationTime,
    setNotificationTime: setNotificationTimeContext,
    language,
    setLanguage
  } = useSettings();
  const [themeToggleCount, setThemeToggleCount] = useState(0);
  const { t } = useTranslation();
  const { user, updateNickname, deleteAccount } = useAuth();
  const { getActiveGoals } = useData();

  // 알림 설정 초기화 및 권한 확인
  useEffect(() => {
    const loadNotificationSettings = async () => {
      try {
        if (notificationsEnabled) {
          const hasPermission = await notificationService.requestPermissions();
          if (!hasPermission) {
            await setNotificationsEnabledContext(false);
          }
        }
      } catch (error) {
        console.error('Error loading notification settings:', error);
      }
    };

    loadNotificationSettings();
  }, [notificationsEnabled, setNotificationsEnabledContext]);

  // 알림 온/오프 스위치 핸들러
  const toggleNotifications = async (value: boolean) => {
    try {
      if (value) {
        const hasPermission = await notificationService.requestPermissions();
        await setNotificationsEnabledContext(hasPermission);

        if (hasPermission) {
          // Schedule notifications with current settings
          await notificationService.scheduleMotivationalReminders({
            enabled: true,
            reminderTime: notificationTime,
            remindersPerDay: remindersPerDay,
          });

          Alert.alert(
            'Notifications Enabled',
            `You'll receive ${remindersPerDay} reminder${remindersPerDay > 1 ? 's' : ''} per day starting at ${notificationTime}.`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            'Permission Required',
            'Please enable notifications in your device settings to receive reminders.',
            [{ text: 'OK' }]
          );
        }
      } else {
        await setNotificationsEnabledContext(false);
        await notificationService.cancelAllNotifications();
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
      await setNotificationsEnabledContext(false);
    }
  };

  // 리마인더 횟수 조정 핸들러
  const adjustReminders = async (increment: boolean) => {
    const newValue = increment
      ? Math.min(remindersPerDay + 1, 10)
      : Math.max(remindersPerDay - 1, 0);
    setRemindersPerDay(newValue);

    // Update notifications if they're enabled
    if (notificationsEnabled) {
      try {
        await notificationService.scheduleMotivationalReminders({
          enabled: true,
          reminderTime: notificationTime,
          remindersPerDay: newValue,
        });
      } catch (error) {
        console.error('Error updating notification schedule:', error);
      }
    }
  };

  // 테마 순환 토글(라이트 → 다크 → 레드민)
  const handleThemeToggle = () => {
    const newCount = themeToggleCount + 1;
    setThemeToggleCount(newCount);

    if (newCount === 10 && !isRedMeanUnlocked) {
      unlockRedMean();
      Alert.alert(
        '🔓 Red Mean Mode Unlocked!',
        "You've discovered the harsh truth mode. This brutal theme will push you with tough love and unforgiving motivation.",
        [{ text: 'Embrace the Challenge', style: 'destructive' }]
      );
    }

    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme(isRedMeanUnlocked ? 'redMean' : 'light');
    else setTheme('light');
  };

  // 현재 테마에 맞는 아이콘 반환
  const getThemeIcon = () => {
    switch (theme) {
      case 'dark':
        return <Moon size={20} color={colors.text} />;
      case 'redMean':
        return <Skull size={20} color={colors.text} />;
      default:
        return <Sun size={20} color={colors.text} />;
    }
  };

  // 현재 테마 라벨 반환
  const getThemeLabel = () => {
    switch (theme) {
      case 'dark':
        return t('settings.dark');
      case 'redMean':
        return t('settings.redMean');
      default:
        return t('settings.light');
    }
  };

  // 테마별 동기부여 문구 반환
  const getMotivationalMessage = () => {
    switch (theme) {
      case 'redMean':
        return 'BRUTAL MODE: Stay focused!';
      case 'dark':
        return 'Dark Mode: Stay strong.';
      default:
        return 'Light Mode: Keep going!';
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
      paddingTop: 60,
      paddingHorizontal: 24,
      paddingBottom: 24,
    },
    timePickerButton: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      alignItems: 'center',
      marginTop: 4,
    },
    warningCard: {
      marginTop: 16,
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '500',
    },
    content: {
      flex: 1,
    },
    section: { marginBottom: 32 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    sectionTitle: { fontSize: 20, fontWeight: '600', marginLeft: 8 },
    sectionContent: { paddingTop: 8, paddingHorizontal: 16 },
    settingCard: { backgroundColor: colors.surface, borderRadius: 12, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    settingLabel: { fontSize: 16, fontWeight: '500', color: colors.text },
    settingDescription: { fontSize: 14, color: colors.textSecondary, marginTop: 4, lineHeight: 20 },
    reminderControls: { flexDirection: 'row', alignItems: 'center' },
    reminderButton: { backgroundColor: colors.primary, borderRadius: 8, padding: 8, marginHorizontal: 8 },
    reminderCount: { fontSize: 18, fontWeight: '600', color: colors.text, minWidth: 30, textAlign: 'center' },
    themeButton: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', minWidth: 120, justifyContent: 'center' },
    themeButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', marginLeft: 6, flexShrink: 1, textAlign: 'center' },
    notificationTypeButton: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      alignItems: 'center',
    },
    notificationTypeText: {
      fontSize: 14,
      fontWeight: '500',
      textAlign: 'center',
    },
    unlockHint: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', marginTop: 8 },
    redMeanWarning: { backgroundColor: theme === 'redMean' ? colors.error : colors.surface, borderRadius: 12, padding: 16, marginTop: 16, borderWidth: 2, borderColor: colors.error },
    warningText: { fontSize: 14, color: theme === 'redMean' ? colors.text : colors.error, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
    languagePromptBox: { borderWidth: 1, borderRadius: 8, padding: 12 },
    languageOptionButton: { borderWidth: 1, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 12, alignItems: 'center' },
    languageOptionText: { fontSize: 14, fontWeight: '600' },
  });
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.text }]}>
          {t('settings.title')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('settings.subtitle')}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: 100, // Proper padding for tab bar
        }}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <SettingsSection
          title={t('settings.profile')}
          icon={<Palette size={20} color={colors.primary} />}
        >
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>{t('settings.nickname')}</Text>
                <Text style={styles.settingDescription}>{t('settings.nicknameDesc')}</Text>
              </View>
              <TouchableOpacity
                style={[styles.themeButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  Alert.prompt(
                    t('settings.nicknamePromptTitle'),
                    '',
                    [
                      { text: t('common.cancel'), style: 'cancel' },
                      {
                        text: t('common.save'),
                        onPress: async (value?: string) => {
                          if (typeof value === 'string') {
                            const { error } = await updateNickname(value.trim());
                            if (error) {
                              Alert.alert(t('common.error'), error);
                            }
                          }
                        },
                      },
                    ],
                    'plain-text',
                    user?.nickname || ''
                  );
                }}
              >
                <Text style={styles.themeButtonText}>{user?.nickname || '-'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SettingsSection>
        <SettingsSection
          title={t('settings.account')}
          icon={<Palette size={20} color={colors.primary} />}
        >
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>{t('settings.deleteAccount')}</Text>
                <Text style={styles.settingDescription}>{t('settings.deleteAccountDesc')}</Text>
              </View>
              <TouchableOpacity
                style={[styles.themeButton, { backgroundColor: colors.error }]}
                onPress={() => {
                  const activeCount = getActiveGoals().length;
                  const message = activeCount > 0
                    ? t('settings.deleteWarnBodyActive', { count: activeCount })
                    : t('settings.deleteWarnBody');
                  Alert.alert(
                    t('settings.deleteWarnTitle'),
                    message,
                    [
                      { text: t('settings.deleteConfirmNo'), style: 'cancel' },
                      {
                        text: t('settings.deleteConfirmYes'),
                        style: 'destructive',
                        onPress: async () => {
                          const res = await deleteAccount();
                          if (res.error) {
                            Alert.alert(t('common.error'), res.error);
                          } else {
                            Alert.alert(t('settings.deleted'));
                          }
                        },
                      },
                    ]
                  );
                }}
              >
                <Text style={styles.themeButtonText}>{t('settings.deleteAccount')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SettingsSection>
        <SettingsSection
          title={t('settings.appearance')}
          icon={<Palette size={20} color={colors.primary} />}
        >
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View>
                <Text style={styles.settingLabel}>{t('settings.theme')}</Text>
                <Text style={styles.settingDescription}>
                  {getMotivationalMessage()}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.themeButton, { backgroundColor: colors.primary }]}
                onPress={handleThemeToggle}
              >
                {getThemeIcon()}
                <Text style={styles.themeButtonText}>{getThemeLabel()}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SettingsSection>

        <SettingsSection
          title={t('settings.language')}
          icon={<Palette size={20} color={colors.primary} />}
        >
          <View style={styles.settingCard}>
            <View style={{ marginBottom: 12 }}>
              <View style={[styles.languagePromptBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Text style={[styles.settingDescription, { textAlign: 'center' }]} numberOfLines={2} ellipsizeMode="tail">
                  {t('settings.languageDesc')}
                </Text>
              </View>
            </View>
            <View>
              <TouchableOpacity
                style={[
                  styles.languageOptionButton,
                  {
                    backgroundColor: language === 'ko' ? colors.primary : colors.surface,
                    borderColor: language === 'ko' ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setLanguage('ko')}
              >
                <Text style={[styles.languageOptionText, { color: language === 'ko' ? '#fff' : colors.text }]} numberOfLines={1} ellipsizeMode="tail">{t('settings.korean')}</Text>
                {language === 'ko' && (
                  <Text style={{ color: '#fff', fontWeight: '700' }}>✓</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.languageOptionButton,
                  {
                    backgroundColor: language === 'en' ? colors.primary : colors.surface,
                    borderColor: language === 'en' ? colors.primary : colors.border,
                    marginTop: 8,
                  },
                ]}
                onPress={() => setLanguage('en')}
              >
                <Text style={[styles.languageOptionText, { color: language === 'en' ? '#fff' : colors.text }]} numberOfLines={1} ellipsizeMode="tail">{t('settings.english')}</Text>
                {language === 'en' && (
                  <Text style={{ color: '#fff', fontWeight: '700' }}>✓</Text>
                )}
              </TouchableOpacity>
              <Text style={[styles.settingDescription, { marginTop: 10, textAlign: 'center', color: colors.textSecondary }]}>
                {t('settings.languageCurrent')}: {language === 'ko' ? t('settings.korean') : t('settings.english')}
              </Text>
            </View>
          </View>
        </SettingsSection>

        <SettingsSection
          title={t('settings.notifications')}
          icon={notificationsEnabled ?
            <Bell size={20} color={colors.primary} /> :
            <BellOff size={20} color={colors.textSecondary} />
          }
        >
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>{t('settings.enableLocal')}</Text>
                <Text style={styles.settingDescription}>
                  {notificationsEnabled ? t('settings.enableLocalDescOn') : t('settings.enableLocalDescOff')}
                </Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={toggleNotifications}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            {notificationsEnabled && (
              <>
                <View style={{ marginTop: 16 }}>
                  <Text style={[styles.settingLabel, { marginBottom: 8 }]}>{t('settings.dailyReminderTime')}</Text>
                  <TouchableOpacity
                    style={[styles.timePickerButton, { borderColor: colors.border }]}
                    onPress={async () => {
                      Alert.alert(
                        'Set Reminder Time',
                        'Choose your preferred reminder time',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: '7:00 AM',
                            onPress: async () => {
                              await setNotificationTimeContext('07:00');
                              if (notificationsEnabled) {
                                await notificationService.scheduleMotivationalReminders({
                                  enabled: true,
                                  reminderTime: '07:00',
                                  remindersPerDay: remindersPerDay,
                                });
                              }
                            }
                          },
                          {
                            text: '9:00 AM',
                            onPress: async () => {
                              await setNotificationTimeContext('09:00');
                              if (notificationsEnabled) {
                                await notificationService.scheduleMotivationalReminders({
                                  enabled: true,
                                  reminderTime: '09:00',
                                  remindersPerDay: remindersPerDay,
                                });
                              }
                            }
                          },
                          {
                            text: '12:00 PM',
                            onPress: async () => {
                              await setNotificationTimeContext('12:00');
                              if (notificationsEnabled) {
                                await notificationService.scheduleMotivationalReminders({
                                  enabled: true,
                                  reminderTime: '12:00',
                                  remindersPerDay: remindersPerDay,
                                });
                              }
                            }
                          },
                          {
                            text: '6:00 PM',
                            onPress: async () => {
                              await setNotificationTimeContext('18:00');
                              if (notificationsEnabled) {
                                await notificationService.scheduleMotivationalReminders({
                                  enabled: true,
                                  reminderTime: '18:00',
                                  remindersPerDay: remindersPerDay,
                                });
                              }
                            }
                          },
                          {
                            text: '9:00 PM',
                            onPress: async () => {
                              await setNotificationTimeContext('21:00');
                              if (notificationsEnabled) {
                                await notificationService.scheduleMotivationalReminders({
                                  enabled: true,
                                  reminderTime: '21:00',
                                  remindersPerDay: remindersPerDay,
                                });
                              }
                            }
                          }
                        ]
                      );
                    }}
                  >
                    <Text style={{ fontSize: 16, color: colors.text }}>{notificationTime}</Text>
                  </TouchableOpacity>
                  <Text style={[styles.settingDescription, { marginTop: 8 }]}>
                    {t('settings.firstReminderAt')}
                  </Text>
                </View>

                <View style={{ marginTop: 16 }}>
                  <Text style={[styles.settingLabel, { marginBottom: 8 }]}>Notification Types</Text>

                  <TouchableOpacity
                    style={[styles.notificationTypeButton, { borderColor: colors.border, backgroundColor: colors.background }]}
                    onPress={() => {
                      Alert.alert(
                        theme === 'redMean' ? 'MOTIVATION TYPE' : 'Motivation Style',
                        theme === 'redMean' ? 'CHOOSE YOUR BATTLE STYLE' : 'Choose your preferred motivation style',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: theme === 'redMean' ? 'GENTLE ENCOURAGEMENT' : 'Gentle & Supportive',
                            onPress: () => console.log('Gentle motivation selected')
                          },
                          {
                            text: theme === 'redMean' ? 'FIRM DISCIPLINE' : 'Firm & Direct',
                            onPress: () => console.log('Firm motivation selected')
                          },
                          {
                            text: theme === 'redMean' ? 'BRUTAL HONESTY' : 'Tough Love',
                            onPress: () => console.log('Tough motivation selected')
                          }
                        ]
                      );
                    }}
                  >
                    <Text style={[styles.notificationTypeText, { color: colors.text }]}>
                      {theme === 'redMean' ? 'MOTIVATION STYLE: BRUTAL' : 'Motivation Style: Supportive'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.notificationTypeButton, { borderColor: colors.border, backgroundColor: colors.background, marginTop: 8 }]}
                    onPress={() => {
                      Alert.alert(
                        theme === 'redMean' ? 'CRAVING ALERTS' : 'Craving Support',
                        theme === 'redMean' ? 'ENABLE ANTI-WEAKNESS ALERTS?' : 'Get help when cravings hit?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: theme === 'redMean' ? 'ENABLE BATTLE MODE' : 'Enable Support',
                            onPress: () => {
                              Alert.alert(
                                theme === 'redMean' ? 'BATTLE MODE ACTIVATED' : 'Craving Support Enabled',
                                theme === 'redMean' ? 'YOU WILL RECEIVE IMMEDIATE DISCIPLINE WHEN WEAKNESS STRIKES' : 'You\'ll get instant support notifications during tough moments'
                              );
                            }
                          }
                        ]
                      );
                    }}
                  >
                    <Text style={[styles.notificationTypeText, { color: colors.text }]}>
                      {theme === 'redMean' ? 'CRAVING BATTLE ALERTS' : 'Craving Support Notifications'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.notificationTypeButton, { borderColor: colors.border, backgroundColor: colors.background, marginTop: 8 }]}
                    onPress={() => {
                      Alert.alert(
                        theme === 'redMean' ? 'ACHIEVEMENT REPORTS' : 'Progress Updates',
                        theme === 'redMean' ? 'RECEIVE VICTORY NOTIFICATIONS?' : 'Get notified about your progress?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: theme === 'redMean' ? 'ENABLE VICTORY REPORTS' : 'Enable Updates',
                            onPress: () => {
                              Alert.alert(
                                theme === 'redMean' ? 'VICTORY REPORTS ENABLED' : 'Progress Updates Enabled',
                                theme === 'redMean' ? 'YOU WILL BE NOTIFIED OF YOUR CONQUESTS AND FAILURES' : 'You\'ll receive weekly progress summaries and milestone celebrations'
                              );
                            }
                          }
                        ]
                      );
                    }}
                  >
                    <Text style={[styles.notificationTypeText, { color: colors.text }]}>
                      {theme === 'redMean' ? 'VICTORY/DEFEAT REPORTS' : 'Weekly Progress Updates'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </SettingsSection>

        <SettingsSection
          title={t('settings.reminders.title')}
          icon={<Minus size={20} color={colors.primary} />}
        >
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>
                  {theme === 'redMean' ? t('settings.reminders.dailyRed') : t('settings.reminders.daily')}
                </Text>
                <Text style={styles.settingDescription}>
                  {theme === 'redMean'
                    ? t('settings.reminders.dailyDescRed')
                    : t('settings.reminders.dailyDesc')}
                </Text>
              </View>
              <View style={styles.reminderControls}>
                <TouchableOpacity style={styles.reminderButton} onPress={() => adjustReminders(false)}>
                  <Minus size={16} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.reminderCount}>{remindersPerDay}</Text>
                <TouchableOpacity style={styles.reminderButton} onPress={() => adjustReminders(true)}>
                  <Plus size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.settingRow, { marginTop: 16 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>
                  {theme === 'redMean' ? t('settings.reminders.weekendRed') : t('settings.reminders.weekend')}
                </Text>
                <Text style={styles.settingDescription}>
                  {theme === 'redMean'
                    ? t('settings.reminders.weekendDescRed')
                    : t('settings.reminders.weekendDesc')}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.themeButton, { backgroundColor: colors.primary, minWidth: 80 }]}
                onPress={() => {
                  Alert.alert(
                    theme === 'redMean' ? t('settings.reminders.weekendDialog.titleRed') : t('settings.reminders.weekendDialog.title'),
                    theme === 'redMean' ? t('settings.reminders.weekendDialog.messageRed') : t('settings.reminders.weekendDialog.message'),
                    [
                      { text: t('common.cancel'), style: 'cancel' },
                      {
                        text: theme === 'redMean' ? t('settings.reminders.weekendDialog.sameRed') : t('settings.reminders.weekendDialog.same'),
                        onPress: () => console.log('Weekend same as weekdays')
                      },
                      {
                        text: theme === 'redMean' ? t('settings.reminders.weekendDialog.fewerRed') : t('settings.reminders.weekendDialog.fewer'),
                        onPress: () => console.log('Weekend reduced')
                      },
                      {
                        text: theme === 'redMean' ? t('settings.reminders.weekendDialog.noneRed') : t('settings.reminders.weekendDialog.none'),
                        onPress: () => console.log('Weekend disabled')
                      }
                    ]
                  );
                }}
              >
                <Text style={styles.themeButtonText}>
                  {theme === 'redMean' ? t('settings.enabledRed') : t('settings.enabled')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SettingsSection>

        <SettingsSection
          title={t('settings.cost.title')}
          icon={<Plus size={20} color={colors.primary} />}
        >
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>{t('settings.cost.packCost')}</Text>
                <Text style={styles.settingDescription}>
                  {t('settings.cost.packCostDesc')}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.themeButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  Alert.prompt(
                    t('settings.cost.packCostPromptTitle'),
                    t('settings.cost.packCostPromptBody'),
                    [
                      { text: t('common.cancel'), style: 'cancel' },
                      {
                        text: t('common.save'),
                        onPress: (value?: string) => {
                          if (value && value.trim()) {
                            // TODO: Save pack cost to settings
                            console.log('Pack cost:', value);
                          }
                        }
                      }
                    ],
                    'plain-text',
                    '₩4,500'
                  );
                }}
              >
                <Text style={styles.themeButtonText}>₩4,500</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.settingRow, { marginTop: 16 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>{t('settings.cost.cigsPerPack')}</Text>
                <Text style={styles.settingDescription}>
                  {t('settings.cost.cigsPerPackDesc')}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.themeButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  Alert.alert(
                    t('settings.cost.cigsPerPackPromptTitle'),
                    t('settings.cost.cigsPerPackPromptBody'),
                    [
                      { text: t('common.cancel'), style: 'cancel' },
                      { text: '20', onPress: () => console.log('20 cigarettes') },
                      { text: '25', onPress: () => console.log('25 cigarettes') },
                      { text: '30', onPress: () => console.log('30 cigarettes') }
                    ]
                  );
                }}
              >
                <Text style={styles.themeButtonText}>20</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SettingsSection>

        {theme === 'redMean' && (
          <View style={styles.redMeanWarning}>
            <Text style={styles.warningText}>
              ⚠️ RED MEAN MODE ACTIVE ⚠️{'\n'}
              This mode uses harsh language and brutal honesty to motivate you.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
