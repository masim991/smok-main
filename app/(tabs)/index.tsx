import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Calendar as CalendarIcon, Plus, Minus, X } from 'lucide-react-native';
import { Calendar as RNCalendar, DateObject } from 'react-native-calendars';
import { useData } from '@/components/contexts/DataContext';
import { useTranslation } from 'react-i18next';

export default function LogTab() {
  const { colors, theme } = useTheme();
  const { entries, addEntry, removeEntry, getEntriesByDate } = useData();
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [smokeCount, setSmokeCount] = useState('1');

  const getMotivationalMessage = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayEntries = entries.filter(e => e.date.startsWith(today));
    const todayCount = todayEntries.reduce((sum, e) => sum + e.count, 0);
    
    if (todayCount === 0) {
      return theme === 'redMean' 
        ? t('log.redMean.noFailures') 
        : t('log.noFailures');
    }
    
    return theme === 'redMean'
      ? t('log.redMean.todayWeakness', { count: todayCount })
      : t('log.loggedToday', { count: todayCount });
  };

  // Marked dates for the calendar
  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    
    // Group entries by date
    const entriesByDate: Record<string, number> = {};
    entries.forEach(entry => {
      const date = entry.date.split('T')[0];
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
            color: theme === 'redMean' ? colors.background : '#fff',
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
    return entries.filter(e => e.date.startsWith(selectedDate));
  }, [entries, selectedDate]);

  const handleAddSmoke = async () => {
    const count = parseInt(smokeCount, 10);
    if (isNaN(count) || count <= 0) {
      Alert.alert(t('log.invalidCountTitle'), t('log.invalidCountBody'));
      return;
    }
    
    try {
      await addEntry(count);
      setSmokeCount('1');
      setShowAddModal(false);
    } catch (error) {
      Alert.alert(t('common.error'), t('log.addError'));
    }
  };

  const handleRemoveEntry = async (id: string) => {
    try {
      await removeEntry(id);
    } catch (error) {
      Alert.alert(t('common.error'), t('log.removeError'));
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
      <View style={styles.header}>
        <Text style={styles.title}>📅 {t('log.title')}</Text>
        <Text style={styles.subtitle}>{getMotivationalMessage()}</Text>
      </View>
      
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ 
          paddingBottom: 100, // Proper padding for tab bar
        }}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.calendarContainer}>
          <RNCalendar
            key={`calendar-${theme}`}
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
            {new Date(selectedDate).toLocaleDateString(undefined, { 
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
                <Text style={styles.entryText}>
                  {t('log.cigarettesCount', { count: entry.count })}
                  {entry.notes && `: ${entry.notes}`}
                </Text>
                <TouchableOpacity 
                  onPress={() => handleRemoveEntry(entry.id)}
                  style={{
                    padding: 8,
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
            onPress={() => setShowAddModal(true)}
          >
            <Text style={[
              styles.buttonText,
              { color: theme === 'redMean' ? colors.background : '#fff' }
            ]}>
              {theme === 'redMean' ? t('log.redMean.logFailure') : t('log.addButton')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Add Smoke Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {theme === 'redMean' ? t('log.redMean.logFailure') : t('log.addButton')}
              </Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
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
                  onPress={() => setSmokeCount(prev => Math.max(1, parseInt(prev) - 1).toString())}
                >
                  <Minus size={20} color={colors.text} />
                </TouchableOpacity>
                <TextInput
                  style={[styles.input, { textAlign: 'center', borderLeftWidth: 0, borderRightWidth: 0, borderRadius: 0 }]}
                  value={smokeCount}
                  onChangeText={setSmokeCount}
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
                  onPress={() => setSmokeCount(prev => (parseInt(prev) + 1).toString())}
                >
                  <Plus size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>
            
            <TouchableOpacity 
              style={[
                styles.button, 
                { 
                  backgroundColor: colors.primary,
                  borderWidth: theme === 'redMean' ? 2 : 0,
                  borderColor: theme === 'redMean' ? colors.text : 'transparent'
                }
              ]}
              onPress={handleAddSmoke}
            >
              <Text style={[
                styles.buttonText,
                { color: theme === 'redMean' ? colors.background : '#fff' }
              ]}>
                {theme === 'redMean' ? t('log.redMean.confirmFailure') : t('log.logEntry')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}