import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '@/components/contexts/ThemeContext';
import { useNotification } from '@/components/contexts/NotificationContext';
import { useData } from '@/components/contexts/DataContext';
import { Calendar, Plus, Minus, Clock, BarChart2 } from 'lucide-react-native';
// Using a simple View instead of LinearGradient for now
import DateTimePicker from '@react-native-community/datetimepicker';

export default function LogTab() {
  const { colors, theme } = useTheme();
  const { addEntry, getEntriesByDate, getWeeklySummary, goals } = useData();
  const { scheduleEncouragement, scheduleGoalReminder } = useNotification();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [count, setCount] = useState(1);
  const [todayTotal, setTodayTotal] = useState(0);
  const [weeklyTotal, setWeeklyTotal] = useState(0);

  useEffect(() => {
    const entries = getEntriesByDate(new Date());
    const total = entries.reduce((sum, entry) => sum + entry.count, 0);
    setTodayTotal(total);
    
    const weekly = getWeeklySummary();
    const weekTotal = weekly.reduce((sum, day) => sum + day.cigarettes, 0);
    setWeeklyTotal(weekTotal);

    // Send encouragement notification on mount (once per session)
    const encouragements = theme === 'redMean'
      ? [
          'You failed yesterday. Will today be any different?',
          'Craving? Go for a walk instead of lighting up. Prove you can.',
          'Remember: Every cigarette is a step backward.']
      : [
          'You are stronger than your cravings! Try a deep breath or a walk.',
          'Craving? Call a friend, chew gum, or go for a walk!',
          'Every smoke-free hour is a win. Keep it up!'];
    scheduleEncouragement(
      encouragements[Math.floor(Math.random() * encouragements.length)],
      10
    );
    // Goal reminder
    if (goals.length > 0) {
      const goal = goals[0];
      const msg = theme === 'redMean'
        ? `Your goal: ${goal.target}. Are you failing already?`
        : `Don't forget your goal: ${goal.target}. You can do this!`;
      scheduleGoalReminder(msg, 30);
    }
  }, [theme, goals]);

  const getMotivationalMessage = () => {
    if (todayTotal === 0) return 'Great job! You\'re smoke-free today! 🎉';
    if (todayTotal < 3) return `You've had ${todayTotal} today. Keep it up!`;
    return 'Track your journey to a smoke-free life';
  };

  const handleLogEntry = async () => {
    try {
      await addEntry(count);
      Alert.alert('Success', `Logged ${count} cigarette(s)`);
      setCount(1);
      // Encourage again after logging
      const encouragements = theme === 'redMean'
        ? [
            'Not your best. Try harder next time.',
            'You know you can do better. Don’t make excuses.',
            'You logged another one. Are you proud?']
        : [
            'Every log is a step to awareness. You got this!',
            'Remember your goal. Try a healthy alternative next time!',
            'Keep going! Every small win counts.'];
      scheduleEncouragement(
        encouragements[Math.floor(Math.random() * encouragements.length)],
        10
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to log entry');
    }
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
    }
  };

  const incrementCount = () => setCount(prev => Math.min(prev + 1, 100));
  const decrementCount = () => setCount(prev => Math.max(1, prev - 1));

  const styles = StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
    },
    headerGradient: {
      paddingTop: 60,
      paddingBottom: 30,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 5,
    },
    headerContent: {
      paddingHorizontal: 24,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: '#fff',
      marginBottom: 8,
    },
    headerSubtitle: {
      fontSize: 16,
      color: 'rgba(255,255,255,0.8)',
      marginBottom: 8,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 20,
    },
    statCard: {
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      flex: 1,
      marginHorizontal: 5,
    },
    statValue: {
      color: '#fff',
      fontSize: 24,
      fontWeight: 'bold',
      marginVertical: 4,
    },
    statLabel: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 14,
    },
    section: {
      marginBottom: 24,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
    },
    inputText: {
      marginLeft: 12,
      fontSize: 16,
      flex: 1,
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
      marginBottom: 4,
    },
    counterContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      overflow: 'hidden',
    },
    counterButton: {
      padding: 16,
      borderRightWidth: 1,
      borderLeftWidth: 1,
      borderColor: colors.border,
    },
    counterText: {
      flex: 1,
      textAlign: 'center',
      fontSize: 18,
      fontWeight: '600',
    },
    dateText: {
      marginLeft: 12,
      fontSize: 16,
    },
    countContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    countButton: {
      padding: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    countText: {
      fontSize: 24,
      fontWeight: 'bold',
      minWidth: 40,
      textAlign: 'center',
    },
    logButton: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
      borderRadius: 12,
      marginTop: 16,
    },
    logButtonText: {
      fontSize: 16,
      fontWeight: '600',
      marginRight: 8,
    },
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      padding: 24,
      backgroundColor: colors.surface,
      borderRadius: 16,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
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
      marginBottom: 16,
    },
    content: {
      flex: 1,
      padding: 16,
      paddingTop: 0,
    },
    comingSoonCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 32,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: theme === 'redMean' ? 'solid' : 'dashed',
    },
    icon: {
      marginBottom: 16,
    },
    comingSoonTitle: {
      fontSize: 24,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    comingSoonText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    quickActions: {
      marginTop: 32,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    actionCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 20,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionText: {
      fontSize: 16,
      color: colors.text,
      marginLeft: 12,
      fontWeight: '500',
    },
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Stats Header */}
        <View style={[styles.headerGradient, { backgroundColor: colors.primary }]}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Today's Progress</Text>
            <Text style={styles.headerSubtitle}>{getMotivationalMessage()}</Text>
            
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Clock size={24} color="#fff" />
                <Text style={styles.statValue}>{todayTotal}</Text>
                <Text style={styles.statLabel}>Today</Text>
              </View>
              <View style={styles.statCard}>
                <BarChart2 size={24} color="#fff" />
                <Text style={styles.statValue}>{weeklyTotal}</Text>
                <Text style={styles.statLabel}>This Week</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Log Entry Section */}
        <View style={styles.content}>
          <View style={[styles.section, { marginBottom: 24 }]}>
            <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>Log Smoking Event</Text>
            
            <View style={styles.card}>
              <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 8 }]}>Date & Time</Text>
              <TouchableOpacity 
                style={[styles.inputContainer, { borderColor: colors.border }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Calendar size={20} color={colors.primary} />
                <Text style={[styles.inputText, { color: colors.text }]}>
                  {selectedDate.toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </Text>
              </TouchableOpacity>
              
              {showDatePicker && (
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                />
              )}
              
              <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16, marginBottom: 8 }]}>
                Number of Cigarettes
              </Text>
              <View style={[styles.counterContainer, { borderColor: colors.border }]}>
                <TouchableOpacity 
                  style={[styles.counterButton, { borderColor: colors.border }]}
                  onPress={decrementCount}
                >
                  <Minus size={24} color={colors.text} />
                </TouchableOpacity>
                
                <Text style={[styles.counterText, { color: colors.text, fontSize: 18, fontWeight: '600' }]}>
                  {count}
                </Text>
                
                <TouchableOpacity 
                  style={[styles.counterButton, { borderColor: colors.border }]}
                  onPress={incrementCount}
                >
                  <Plus size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity 
                style={[styles.logButton, { backgroundColor: colors.primary }]}
                onPress={handleLogEntry}
              >
                <Text style={[styles.logButtonText, { color: '#fff' }]}>Log Entry</Text>
                <Plus size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}