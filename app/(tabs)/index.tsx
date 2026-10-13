import { appAlert } from '@/utils/alerts';
import React, { useState, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { localDateKey, calendarDate } from '@/components/ui/localDate';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { Plus, Minus, X } from 'lucide-react-native';
import { Calendar as RNCalendar, DateObject } from 'react-native-calendars';
import { setCalendarLocale } from '@/components/ui/calendarLocale';
import { useData } from '@/components/contexts/DataContext';
import { useTranslation } from 'react-i18next';

export default function LogTab() {
  const { colors, theme } = useTheme();
  const { entries, addEntry, removeEntry } = useData();
  const { t, i18n } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<string>(localDateKey());
  const [showAddModal, setShowAddModal] = useState(false);
  const [smokeCount, setSmokeCount] = useState('1');
  const [emotion, setEmotion] = useState('');
  const [contextText, setContextText] = useState('');
  const [place, setPlace] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const saveLock = useRef(false);
  const ko = i18n.language.startsWith('ko');
  setCalendarLocale(i18n.language);
  const label = (k: string, en: string) => ko ? k : en;
  const todayEntries = entries.filter(e => localDateKey(e.date) === localDateKey());
  const todayCount = todayEntries.reduce((sum, e) => sum + e.count, 0);
  const confirmedToday = todayEntries.some(e => e.count === 0 && e.notes === '[checkin:smoke-free]');
  const confirmSmokeFree = async () => {
    if (saveLock.current || todayCount > 0 || confirmedToday) return;
    saveLock.current = true; setIsSaving(true);
    try { await addEntry(0, '[checkin:smoke-free]'); setSelectedDate(localDateKey()); }
    catch { appAlert(t('common.error'), t('log.addError')); }
    finally { saveLock.current = false; setIsSaving(false); }
  };
  const formatNotes = (notes: string) => notes.startsWith('[trg] ')
    ? notes.slice(6).split(';').map(part => {
      const separator = part.indexOf('=');
      const key = part.slice(0, separator);
      const value = part.slice(separator + 1);
      const names: Record<string, string> = { e: t('triggers.emotion'), c: t('triggers.context'), p: t('triggers.place') };
      return `${names[key] || key}: ${value}`;
    }).join(' · ')
    : notes;

  // Marked dates for the calendar
  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};

    // Group entries by date
    const entriesByDate: Record<string, number> = {};
    entries.forEach(entry => {
      const date = localDateKey(entry.date);
      entriesByDate[date] = (entriesByDate[date] || 0) + entry.count;
    });

    // Create marked dates
    Object.entries(entriesByDate).forEach(([date, count]) => {
      let markedColor;
      if (count === 0) {
        markedColor = theme === 'redMean' ? colors.primary : colors.success;
      } else if (count <= 3) {
        markedColor = theme === 'redMean' ? '#F59E0B' : colors.warning;
      } else {
        markedColor = theme === 'redMean' ? '#FFFFFF' : colors.error;
      }

      marks[date] = {
        selected: true,
        selectedColor: markedColor,
        customStyles: {
          container: {
            borderRadius: 12,
          },
          text: {
            color: theme === 'redMean' && count > 3 ? colors.background :
                  count > 0 ? '#fff' :
                  theme === 'redMean' ? colors.background : colors.text,
            fontWeight: 'bold',
          },
        },
      };
    });

    // Add selected date
    if (selectedDate) {
      marks[selectedDate] = {
        ...marks[selectedDate],
        selected: true,
        selectedColor: colors.primary,
        customStyles: {
          ...marks[selectedDate]?.customStyles,
          container: {
            borderRadius: 12,
            borderWidth: 2,
            borderColor: theme === 'redMean' ? '#FFFFFF' : colors.background,
          },
          text: {
            color: colors.onPrimary,
            fontWeight: 'bold',
          },
        },
      };
    }

    return marks;
  }, [entries, selectedDate, theme, colors]);

  // Get entries for selected date
  const selectedDateEntries = useMemo(() => {
    if (!selectedDate) return [];
    return entries.filter(e => localDateKey(e.date) === selectedDate);
  }, [entries, selectedDate]);

  const handleAddSmoke = async () => {
    if (saveLock.current) return;
    const count = Number(smokeCount);
    if (!/^\d+$/.test(smokeCount) || !Number.isSafeInteger(count) || count <= 0 || count > 200) {
      appAlert(t('log.invalidCountTitle'), t('log.invalidCountBody'));
      return;
    }

    saveLock.current = true;
    setIsSaving(true);
    try {
      const tagParts: string[] = [];
      if (emotion.trim()) tagParts.push(`e=${emotion.trim()}`);
      if (contextText.trim()) tagParts.push(`c=${contextText.trim()}`);
      if (place.trim()) tagParts.push(`p=${place.trim()}`);
      const noteTag = tagParts.length > 0 ? `[trg] ${tagParts.join(';')}` : undefined;

      await addEntry(count, noteTag);
      setSelectedDate(localDateKey());

      // Tags share the entry ownership, persistence and outbox.
      setSmokeCount('1');
      setEmotion('');
      setContextText('');
      setPlace('');
      setShowAddModal(false);
    } catch {
      appAlert(t('common.error'), t('log.addError'));
    } finally {
      saveLock.current = false;
      setIsSaving(false);
    }
  };

  const handleRemoveEntry = async (id: string) => {
    try {
      await removeEntry(id);
    } catch {
      appAlert(t('common.error'), t('log.removeError'));
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: 60,
      paddingHorizontal: 24,
      paddingBottom: 24,
      backgroundColor: colors.surface,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      lineHeight: 22,
      fontWeight: '500',
    },
    content: {
      flex: 1,
    },
    calendarContainer: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      margin: 16,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    entriesContainer: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      margin: 16,
      padding: 16,
    },
    entryItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    entryText: {
      color: colors.text,
      fontSize: 16,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
      padding: 20,
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 24,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
    },
    inputContainer: {
      marginBottom: 20,
    },
    inputLabel: {
      color: colors.text,
      marginBottom: 8,
      fontSize: 16,
    },
    input: {
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 12,
      color: colors.text,
      fontSize: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title={t('log.title')} subtitle={label('작은 기록이 변화를 만듭니다. 오늘의 흡연과 상황을 돌아보세요.', 'Small records create change. Reflect on today’s smoking and triggers.')} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: 100, // Proper padding for tab bar
        }}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={[styles.entriesContainer, { marginBottom: 0, borderWidth: 1, borderColor: colors.border }]}>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{label('오늘 기록한 흡연량', 'Cigarettes logged today')}</Text>
          <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 36, fontWeight: '700', marginTop: 8 }}>{todayCount} <Text style={{ fontSize: 16 }}>{label('개비', 'cigarettes')}</Text></Text>
          <Text style={{ color: colors.textSecondary, marginTop: 8, lineHeight: 22 }}>{label('기록이 없는 날은 금연으로 자동 판단하지 않습니다.', 'A day without records is not automatically counted as smoke-free.')}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: isSaving || todayCount > 0 || confirmedToday }} disabled={isSaving || todayCount > 0 || confirmedToday} onPress={() => appAlert(label('오늘 금연을 확인할까요?', 'Confirm a smoke-free day?'), label('오늘 담배를 피우지 않았을 때 기록하세요. 금연일 목표는 날짜가 끝난 뒤 계산합니다. 이후 흡연했다면 흡연 기록을 추가해주세요.', 'Confirm only if you have not smoked today. Goals count this after the day ends. Add a smoking record if that changes.'), [{ text: t('common.cancel'), style: 'cancel' }, { text: label('금연 확인', 'Confirm'), onPress: () => { void confirmSmokeFree(); } }])} style={{ marginTop: 16, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, opacity: todayCount > 0 || isSaving ? 0.5 : 1 }}><Text style={{ color: colors.primary, fontWeight: '700' }}>{confirmedToday ? label('오늘 금연 확인됨', 'Smoke-free day confirmed') : label('오늘 금연 확인', 'Confirm smoke-free today')}</Text></TouchableOpacity>
        </View>
        <View style={styles.calendarContainer}>
          <RNCalendar
            markingType="custom"
            firstDay={1}
            key={`calendar-${theme}-${ko}`}
            onDayPress={(day: DateObject) => setSelectedDate(day.dateString)}
            markedDates={markedDates}
            theme={{
              backgroundColor: colors.surface,
              calendarBackground: colors.surface,
              textSectionTitleColor: colors.text,
              selectedDayBackgroundColor: theme === 'redMean' ? colors.error : colors.primary,
              selectedDayTextColor: '#ffffff',
              todayTextColor: theme === 'redMean' ? colors.text : colors.primary,
              dayTextColor: colors.text,
              textDisabledColor: colors.textSecondary,
              dotColor: colors.primary,
              selectedDotColor: '#ffffff',
              arrowColor: theme === 'redMean' ? colors.text : colors.primary,
              monthTextColor: colors.text,
              textDayFontWeight: '500',
              textMonthFontWeight: 'bold',
              textDayHeaderFontWeight: '500',
              textDayFontSize: 14,
              textMonthFontSize: 16,
              textDayHeaderFontSize: 12,
              todayBackgroundColor: colors.surface,
              todayButtonTextColor: theme === 'redMean' ? colors.text : colors.primary,
            } as any}
          />
        </View>

        <View style={styles.entriesContainer}>
          <Text style={[{ color: colors.text, marginBottom: 16, fontSize: 18, fontWeight: '600' }]}>
            {calendarDate(selectedDate).toLocaleDateString(i18n.language, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </Text>

          {selectedDateEntries.length === 0 ? (
            <Text style={{ color: colors.textSecondary, textAlign: 'center', marginVertical: 16 }}>
              {theme === 'redMean'
                ? t('log.redMean.noEntries')
                : t('log.noEntries')}
            </Text>
          ) : (
            selectedDateEntries.map(entry => (
              <View key={entry.id} style={styles.entryItem}>
                <Text style={[styles.entryText, { flex: 1, marginRight: 12 }]}>
                  {entry.count === 0 ? label('금연 확인 · 직접 기록', 'Smoke-free confirmation · Self-reported') : t('log.cigarettesCount', { count: entry.count })}
                  {entry.count > 0 && entry.notes && ` · ${formatNotes(entry.notes)}`}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={label('흡연 기록 삭제', 'Delete smoking record')}
                  hitSlop={8}
                  onPress={() => appAlert(label('기록을 삭제할까요?', 'Delete this record?'), label('삭제한 기록은 복원할 수 없습니다.', 'This cannot be undone.'), [{ text: t('common.cancel'), style: 'cancel' }, { text: label('삭제', 'Delete'), style: 'destructive', onPress: () => handleRemoveEntry(entry.id) }])}
                  style={{
                    padding: 12,
                    minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center',
                    borderRadius: 20,
                    backgroundColor: colors.error + '20',
                  }}
                >
                  <X size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))
          )}

          <TouchableOpacity
            style={[
              styles.button,
              {
                backgroundColor: colors.primary,
                borderWidth: theme === 'redMean' ? 2 : 0,
                borderColor: theme === 'redMean' ? colors.text : 'transparent'
              }
            ]}
            accessibilityRole="button"
            onPress={() => setShowAddModal(true)}
          >
            <Text style={[
              styles.buttonText,
              { color: colors.onPrimary }
            ]}>
              {label('오늘 흡연 기록하기', 'Log smoking today')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Add Smoke Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => { if (!isSaving) setShowAddModal(false); }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {theme === 'redMean' ? t('log.redMean.logFailure') : t('log.addButton')}
              </Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={label('닫기', 'Close')} hitSlop={12} disabled={isSaving} onPress={() => setShowAddModal(false)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>
                {theme === 'redMean' ? t('log.redMean.howMany') : t('log.howMany')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity
                  style={{
                    padding: 12,
                    backgroundColor: colors.background,
                    borderTopLeftRadius: 8,
                    borderBottomLeftRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                  accessibilityRole="button" accessibilityLabel={label('흡연량 줄이기', 'Decrease count')}
                  onPress={() => setSmokeCount(prev => Math.max(1, (Number(prev) || 1) - 1).toString())}
                >
                  <Minus size={20} color={colors.text} />
                </TouchableOpacity>
                <TextInput
                  style={[styles.input, { textAlign: 'center', borderLeftWidth: 0, borderRightWidth: 0, borderRadius: 0 }]}
                  value={smokeCount}
                  onChangeText={setSmokeCount}
                  accessibilityLabel={t('log.howMany')}
                  maxLength={3}
                  editable={!isSaving}
                  keyboardType="numeric"
                  selectTextOnFocus
                />
                <TouchableOpacity
                  style={{
                    padding: 12,
                    backgroundColor: colors.background,
                    borderTopRightRadius: 8,
                    borderBottomRightRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                  accessibilityRole="button" accessibilityLabel={label('흡연량 늘리기', 'Increase count')}
                  onPress={() => setSmokeCount(prev => (Math.min(200, (Number(prev) || 0) + 1)).toString())}
                >
                  <Plus size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Trigger inputs (optional) inside modal */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t('triggers.emotion')}</Text>
              <TextInput
                style={styles.input}
                value={emotion}
                onChangeText={setEmotion}
                maxLength={160}
                editable={!isSaving}
                placeholder={t('triggers.emotionPh')}
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t('triggers.context')}</Text>
              <TextInput
                style={styles.input}
                value={contextText}
                onChangeText={setContextText}
                maxLength={160}
                editable={!isSaving}
                placeholder={t('triggers.contextPh')}
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t('triggers.place')}</Text>
              <TextInput
                style={styles.input}
                value={place}
                onChangeText={setPlace}
                maxLength={160}
                editable={!isSaving}
                placeholder={t('triggers.placePh')}
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            {isSaving && <ActivityIndicator color={colors.primary} accessibilityLabel={label('저장 중', 'Saving')} />}
            <TouchableOpacity
              style={[
                styles.button,
                {
                  backgroundColor: colors.primary,
                  borderWidth: theme === 'redMean' ? 2 : 0,
                  borderColor: theme === 'redMean' ? colors.text : 'transparent'
                }
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled: isSaving, busy: isSaving }}
              disabled={isSaving}
              onPress={handleAddSmoke}
            >
              <Text style={[
                styles.buttonText,
                { color: colors.onPrimary }
              ]}>
                {isSaving ? label('저장 중…', 'Saving…') : t('log.logEntry')}
              </Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
