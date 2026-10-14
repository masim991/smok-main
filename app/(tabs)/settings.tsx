import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch, Platform } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Bell, BellOff, Palette, Plus, Minus, Moon, Sun, Skull, Target as TargetIcon, Map as MapIcon } from 'lucide-react-native';
import { notificationService } from '@/components/services/notifications/LocalNotifications';
import { SettingsSection, BackgroundToggle } from '@/components/settings/SettingsParts';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/components/contexts/DataContext';
import { startWearableDetection, stopWearableDetection } from '@/components/services/detection/WearableDetection';
import { startAudioDetection, stopAudioDetection } from '@/components/services/detection/AudioDetection';

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
    setLanguage,
    smartNotificationsEnabled,
    setSmartNotificationsEnabled,
    dailyGoalTarget,
    setDailyGoalTarget,
    geofenceAutoCount,
    setGeofenceAutoCount,
    wearableDetectionEnabled,
    setWearableDetectionEnabled,
    audioDetectionEnabled,
    setAudioDetectionEnabled,
    stayMinutes,
    setStayMinutes,
    stayNotificationMode,
    setStayNotificationMode,
  } = useSettings();
  const [themeToggleCount, setThemeToggleCount] = useState(0);
  const { t } = useTranslation();
  const { user, updateNickname, deleteAccount } = useAuth();
  const { getActiveGoals, entries, addEntry, syncError, retrySync, legacyDataAvailable, importLegacyData } = useData();

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

  // 스마트 알림: 최근 데이터에서 상위 피크 시간대(최대 3개)를 계산해 예약
  const computePeakHours = () => {
    const counts = Array(24).fill(0);
    try {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      entries.forEach(e => {
        const d = new Date(e.date);
        if (d >= since) {
          counts[d.getHours()] += e.count;
        }
      });
    } catch {}
    const ranked = counts
      .map((v, i) => ({ h: i, v }))
      .sort((a, b) => b.v - a.v)
      .filter(x => x.v > 0)
      .slice(0, 3);
    if (ranked.length === 0) {
      // fallback: 아침/점심/저녁
      return ['09:00', '12:00', '18:00'];
    }
    return ranked.map(x => `${String(x.h).padStart(2, '0')}:00`);
  };

  const toggleSmartNotifications = async (value: boolean) => {
    try {
      await setSmartNotificationsEnabled(value);
      if (value) {
        const hasPermission = await notificationService.requestPermissions();
        if (!hasPermission) {
          await setSmartNotificationsEnabled(false);
          Alert.alert(t('settings.smart.permissionTitle'), t('settings.smart.permissionBody'));
          return;
        }
        const times = computePeakHours();
        await notificationService.scheduleSmartReminders(times);
        Alert.alert(t('settings.smart.enabledTitle'), t('settings.smart.enabledBody', { times: times.join(', ') }));
      } else {
        await notificationService.cancelAllNotifications();
      }
    } catch (e) {
      console.error('Smart notifications toggle error:', e);
    }
  };

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
            t('settings.local.enabledTitle'),
            t('settings.local.enabledBody', { count: remindersPerDay, time: notificationTime }),
            [{ text: t('common.save') }]
          );
        } else {
          Alert.alert(
            t('settings.local.permissionTitle'),
            t('settings.local.permissionBody'),
            [{ text: t('common.save') }]
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

  // 테마별 동기부여 문구 반환 (i18n)
  const getMotivationalMessage = () => {
    switch (theme) {
      case 'redMean':
        return t('settings.themeDesc.redMean');
      case 'dark':
        return t('settings.themeDesc.dark');
      default:
        return t('settings.themeDesc.light');
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
        {(syncError || legacyDataAvailable) && (
          <SettingsSection title={t('sync.title')} icon={<Bell size={20} color={colors.primary} />}>
            {syncError && (
              <View style={styles.settingCard}>
                <Text accessibilityRole="alert" style={styles.settingDescription}>{t('sync.problem')} {syncError}</Text>
                <TouchableOpacity style={[styles.themeButton, { backgroundColor: colors.primary }]} onPress={() => { void retrySync(); }}>
                  <Text style={styles.themeButtonText}>{t('sync.retry')}</Text>
                </TouchableOpacity>
              </View>
            )}
            {legacyDataAvailable && user && (
              <View style={styles.settingCard}>
                <Text style={styles.settingDescription}>{t('sync.legacy')}</Text>
                <TouchableOpacity style={[styles.themeButton, { backgroundColor: colors.primary }]} onPress={() => {
                  Alert.alert(t('sync.import'), t('sync.importConfirm'), [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('sync.import'), onPress: async () => {
                      try { await importLegacyData(); Alert.alert(t('sync.imported')); }
                      catch (error) { Alert.alert(t('common.error'), String(error)); }
                    } },
                  ]);
                }}>
                  <Text style={styles.themeButtonText}>{t('sync.import')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </SettingsSection>
        )}
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

        {/* 흡연 구역 체류 설정 */}
        <SettingsSection
          title={t('settings.geofence.dwellTitle') || '흡연 구역 체류 설정'}
          icon={<MapIcon size={20} color={colors.primary} />}
        >
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>{t('settings.geofence.dwell.minutesLabel')}</Text>
                <Text style={styles.settingDescription}>{t('settings.geofence.dwell.minutesDesc')}</Text>
              </View>
              <TouchableOpacity
                style={[styles.themeButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  if (Platform.OS === 'ios') {
                    Alert.prompt(
                      '체류 시간 설정',
                      '분 단위로 입력하세요(최소 1분)',
                      [
                        { text: t('common.cancel'), style: 'cancel' },
                        {
                          text: t('common.save'),
                          onPress: async (v?: string) => {
                            const n = v ? parseInt(v, 10) : NaN;
                            if (!Number.isNaN(n) && n >= 1 && n <= 60) {
                              await setStayMinutes(n);
                            } else {
                              Alert.alert(t('common.error'), '1~60 사이의 값을 입력하세요.');
                            }
                          },
                        },
                      ],
                      'plain-text',
                      String(stayMinutes || 2)
                    );
                  } else {
                    Alert.alert(
                      '체류 시간 설정',
                      '원하는 값을 선택하세요',
                      [
                        { text: '1', onPress: async () => setStayMinutes(1) },
                        { text: '2', onPress: async () => setStayMinutes(2) },
                        { text: '3', onPress: async () => setStayMinutes(3) },
                        { text: '5', onPress: async () => setStayMinutes(5) },
                        { text: '10', onPress: async () => setStayMinutes(10) },
                        { text: t('common.cancel'), style: 'cancel' },
                      ]
                    );
                  }
                }}
              >
                <Text style={styles.themeButtonText}>{stayMinutes || 2}분</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>{t('settings.geofence.dwell.notifModeLabel')}</Text>
                <Text style={styles.settingDescription}>{t('settings.geofence.desc')}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.notificationTypeButton, { borderColor: colors.border, backgroundColor: stayNotificationMode === 'once' ? colors.primary : colors.background, flex: 1 }]}
                onPress={() => setStayNotificationMode('once')}
              >
                <Text style={[styles.notificationTypeText, { color: stayNotificationMode === 'once' ? '#fff' : colors.text }]}>{t('settings.geofence.dwell.once')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.notificationTypeButton, { borderColor: colors.border, backgroundColor: stayNotificationMode === 'every_block' ? colors.primary : colors.background, flex: 1 }]}
                onPress={() => setStayNotificationMode('every_block')}
              >
                <Text style={[styles.notificationTypeText, { color: stayNotificationMode === 'every_block' ? '#fff' : colors.text }]}>{t('settings.geofence.dwell.everyBlock')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SettingsSection>

        {/* 흡연 구역 자동 기록 */}
        <SettingsSection
          title={t('settings.geofence.title') || '흡연 구역 자동 기록'}
          icon={<MapIcon size={20} color={colors.primary} />}
        >
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>{t('settings.geofence.enable') || '흡연 구역 체류 시 자동 기록'}</Text>
                <Text style={styles.settingDescription}>
                  {t('settings.geofence.desc') || '저장된 흡연 구역 반경 안에 일정 시간 이상 머무르면 경고와 함께 흡연 기록이 자동으로 추가됩니다.'}
                </Text>
              </View>
              <Switch
                value={geofenceAutoCount}
                onValueChange={setGeofenceAutoCount}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </SettingsSection>

        {/* 웨어러블 감지 */}
        <SettingsSection
          title={t('settings.wearable.title') || '웨어러블 감지'}
          icon={<TargetIcon size={20} color={colors.primary} />}
        >
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>{t('settings.wearable.enable') || '웨어러블로 감지(SpO2 + 움직임)'}</Text>
                <Text style={styles.settingDescription}>
                  {t('settings.wearable.desc') || '산소포화도와 움직임 패턴을 비교해 흡연 가능성을 추정합니다.'}
                </Text>
              </View>
              <Switch
                value={wearableDetectionEnabled}
                onValueChange={async (v) => {
                  await setWearableDetectionEnabled(v);
                  if (v) {
                    const ok = await startWearableDetection(async () => {
                      try {
                        await addEntry(1, '[#wearable] motion+SpO2');
                        await notificationService.scheduleEncouragementNotification('', 0);
                      } catch {}
                    });
                    if (!ok) {
                      Alert.alert(t('common.error'), t('settings.wearable.unavailable') || '웨어러블 센서를 사용할 수 없습니다.');
                      await setWearableDetectionEnabled(false);
                    }
                  } else {
                    await stopWearableDetection();
                  }
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </SettingsSection>

        {/* 오디오 감지 */}
        <SettingsSection
          title={t('settings.audio.title') || '오디오 감지'}
          icon={<Bell size={20} color={colors.primary} />}
        >
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>{t('settings.audio.enable') || '라이터/흡연 소리 감지'}</Text>
                <Text style={styles.settingDescription}>
                  {t('settings.audio.desc') || '웨어러블이 없을 때 라이터/들이마시는 소리를 감지해 경고 및 자동 기록을 수행합니다.'}
                </Text>
              </View>
              <Switch
                value={audioDetectionEnabled}
                onValueChange={async (v) => {
                  await setAudioDetectionEnabled(v);
                  if (v) {
                    const ok = await startAudioDetection(async () => {
                      try {
                        await addEntry(1, '[#audio] lighter/smoke sound');
                        await notificationService.scheduleEncouragementNotification('', 0);
                      } catch {}
                    });
                    if (!ok) {
                      Alert.alert(t('common.error'), t('settings.audio.unavailable') || '오디오 감지를 사용할 수 없습니다.');
                      await setAudioDetectionEnabled(false);
                    }
                  } else {
                    await stopAudioDetection();
                  }
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </SettingsSection>

        {/* Smart Notifications */}
        <SettingsSection
          title={t('settings.smart.title')}
          icon={<Bell size={20} color={colors.primary} />}
        >
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>{t('settings.smart.enable')}</Text>
                <Text style={styles.settingDescription}>
                  {t('settings.smart.desc')}
                </Text>
              </View>
              <Switch
                value={smartNotificationsEnabled}
                onValueChange={toggleSmartNotifications}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <TouchableOpacity
              style={[styles.notificationTypeButton, { borderColor: colors.border, backgroundColor: colors.background, marginTop: 12 }]}
              onPress={async () => {
                const times = computePeakHours();
                await notificationService.scheduleSmartReminders(times);
                Alert.alert(t('settings.smart.optimizedTitle'), t('settings.smart.optimizedBody', { times: times.join(', ') }));
              }}
            >
              <Text style={[styles.notificationTypeText, { color: colors.text }]}>
                {t('settings.smart.optimizeNow')}
              </Text>
            </TouchableOpacity>
          </View>
        </SettingsSection>

        {/* Daily Goal */}
        <SettingsSection
          title={t('settings.dailyGoal.title')}
          icon={<TargetIcon size={20} color={colors.primary} />}
        >
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>{t('settings.dailyGoal.label')}</Text>
                <Text style={styles.settingDescription}>
                  {t('settings.dailyGoal.desc')}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.themeButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  if (Platform.OS === 'ios') {
                    Alert.prompt(
                      t('settings.dailyGoal.promptTitle'),
                      t('settings.dailyGoal.promptBody'),
                      [
                        { text: t('common.cancel'), style: 'cancel' },
                        {
                          text: t('common.save'),
                          onPress: async (value?: string) => {
                            const n = value ? parseInt(value, 10) : NaN;
                            if (!Number.isNaN(n) && n >= 0 && n <= 20) {
                              await setDailyGoalTarget(n);
                            } else {
                              Alert.alert(t('common.error'), t('settings.dailyGoal.invalid'));
                            }
                          }
                        }
                      ],
                      'plain-text',
                      String(dailyGoalTarget || 0)
                    );
                  } else {
                    Alert.alert(
                      t('settings.dailyGoal.promptTitle'),
                      t('settings.dailyGoal.promptBody'),
                      [
                        { text: '0', onPress: async () => setDailyGoalTarget(0) },
                        { text: '5', onPress: async () => setDailyGoalTarget(5) },
                        { text: '10', onPress: async () => setDailyGoalTarget(10) },
                        { text: '15', onPress: async () => setDailyGoalTarget(15) },
                        { text: '20', onPress: async () => setDailyGoalTarget(20) },
                        { text: t('common.cancel'), style: 'cancel' },
                      ]
                    );
                  }
                }}
              >
                <Text style={styles.themeButtonText}>{dailyGoalTarget || 0}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SettingsSection>

        {/* Background Location Tracking */}
        <SettingsSection
          title={t('settings.background.title')}
          icon={<MapIcon size={20} color={colors.primary} />}
        >
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>{t('settings.background.enable')}</Text>
                <Text style={styles.settingDescription}>
                  {t('settings.background.desc')}
                </Text>
              </View>
              <BackgroundToggle />
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
                        t('settings.reminderSet.title'),
                        t('settings.reminderSet.body'),
                        [
                          { text: t('common.cancel'), style: 'cancel' },
                          {
                            text: '07:00',
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
                            text: '09:00',
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
                            text: '12:00',
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
                            text: '18:00',
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
                            text: '21:00',
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
                  <Text style={[styles.settingLabel, { marginBottom: 8 }]}>{t('settings.notificationTypesTitle')}</Text>

                  <TouchableOpacity
                    style={[styles.notificationTypeButton, { borderColor: colors.border, backgroundColor: colors.background }]}
                    onPress={() => {
                      Alert.alert(
                        t('settings.motivation.title'),
                        t('settings.motivation.body'),
                        [
                          { text: t('common.cancel'), style: 'cancel' },
                          {
                            text: t('settings.motivation.gentle'),
                            onPress: () => console.log('Gentle motivation selected')
                          },
                          {
                            text: t('settings.motivation.firm'),
                            onPress: () => console.log('Firm motivation selected')
                          },
                          {
                            text: t('settings.motivation.tough'),
                            onPress: () => console.log('Tough motivation selected')
                          }
                        ]
                      );
                    }}
                  >
                    <Text style={[styles.notificationTypeText, { color: colors.text }]}>{t('settings.motivation.selected')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.notificationTypeButton, { borderColor: colors.border, backgroundColor: colors.background, marginTop: 8 }]}
                    onPress={() => {
                      Alert.alert(
                        t('settings.craving.title'),
                        t('settings.craving.body'),
                        [
                          { text: t('common.cancel'), style: 'cancel' },
                          {
                            text: t('settings.craving.enable'),
                            onPress: () => {
                              Alert.alert(t('settings.craving.enabledTitle'), t('settings.craving.enabledBody'));
                            }
                          }
                        ]
                      );
                    }}
                  >
                    <Text style={[styles.notificationTypeText, { color: colors.text }]}>{t('settings.craving.selected')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.notificationTypeButton, { borderColor: colors.border, backgroundColor: colors.background, marginTop: 8 }]}
                    onPress={() => {
                      Alert.alert(
                        t('settings.progress.title'),
                        t('settings.progress.body'),
                        [
                          { text: t('common.cancel'), style: 'cancel' },
                          {
                            text: t('settings.progress.enable'),
                            onPress: () => {
                              Alert.alert(t('settings.progress.enabledTitle'), t('settings.progress.enabledBody'));
                            }
                          }
                        ]
                      );
                    }}
                  >
                    <Text style={[styles.notificationTypeText, { color: colors.text }]}>{t('settings.progress.selected')}</Text>
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
            <Text style={styles.warningText}>{t('settings.redMeanWarning')}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
