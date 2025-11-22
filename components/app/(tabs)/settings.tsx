import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Settings as SettingsIcon, Bell, Palette, Plus, Minus, Moon, Sun, Skull } from 'lucide-react-native';

export default function SettingsTab() {
  const { colors, theme, setTheme, isRedMeanUnlocked, unlockRedMean } = useTheme();
  const { remindersPerDay, setRemindersPerDay } = useSettings();
  const [themeToggleCount, setThemeToggleCount] = useState(0);

  const getMotivationalMessage = () => {
    switch (theme) {
      case 'redMean':
        return 'CONFIGURE YOUR TOOLS OF DISCIPLINE';
      case 'dark':
        return 'Customize your journey through the darkness';
      default:
        return 'Personalize your quit journey experience';
    }
  };

  const handleThemeToggle = () => {
    const newCount = themeToggleCount + 1;
    setThemeToggleCount(newCount);

    if (newCount === 10 && !isRedMeanUnlocked) {
      unlockRedMean();
      Alert.alert(
        '🔓 Red Mean Mode Unlocked!',
        'You\'ve discovered the harsh truth mode. This brutal theme will push you with tough love and unforgiving motivation.',
        [{ text: 'Embrace the Challenge', style: 'destructive' }]
      );
    }

    // Cycle through themes
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      if (isRedMeanUnlocked) {
        setTheme('redMean');
      } else {
        setTheme('light');
      }
    } else {
      setTheme('light');
    }
  };

  const adjustReminders = (increment: boolean) => {
    const newValue = increment 
      ? Math.min(remindersPerDay + 1, 10)
      : Math.max(remindersPerDay - 1, 0);
    setRemindersPerDay(newValue);
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'dark':
        return <Moon size={24} color={colors.text} />;
      case 'redMean':
        return <Skull size={24} color={colors.text} />;
      default:
        return <Sun size={24} color={colors.text} />;
    }
  };

  const getThemeLabel = () => {
    switch (theme) {
      case 'dark':
        return 'Dark Mode';
      case 'redMean':
        return 'Red Mean Mode';
      default:
        return 'Light Mode';
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
    },
    content: {
      flex: 1,
      padding: 24,
    },
    section: {
      marginBottom: 32,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
      flexDirection: 'row',
      alignItems: 'center',
    },
    sectionTitleText: {
      marginLeft: 8,
    },
    settingCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 20,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    settingLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
      flex: 1,
    },
    settingDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
      lineHeight: 20,
    },
    reminderControls: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    reminderButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      padding: 8,
      marginHorizontal: 8,
    },
    reminderCount: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      minWidth: 30,
      textAlign: 'center',
    },
    themeButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
    },
    themeButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 8,
    },
    unlockHint: {
      fontSize: 12,
      color: colors.textSecondary,
      fontStyle: 'italic',
      marginTop: 8,
    },
    redMeanWarning: {
      backgroundColor: theme === 'redMean' ? colors.error : colors.surface,
      borderRadius: 12,
      padding: 16,
      marginTop: 16,
      borderWidth: 2,
      borderColor: colors.error,
    },
    warningText: {
      fontSize: 14,
      color: theme === 'redMean' ? colors.text : colors.error,
      fontWeight: '600',
      textAlign: 'center',
      lineHeight: 20,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>⚙️ Settings</Text>
        <Text style={styles.subtitle}>{getMotivationalMessage()}</Text>
      </View>
      
      <ScrollView style={styles.content}>
        {/* Notifications Section */}
        <View style={styles.section}>
          <View style={styles.sectionTitle}>
            <Bell size={20} color={colors.primary} />
            <Text style={[styles.sectionTitleText, { color: colors.text }]}>
              {theme === 'redMean' ? 'Discipline Reminders' : 'Notifications'}
            </Text>
          </View>
          
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>
                  {theme === 'redMean' ? 'Daily Reality Checks' : 'Daily Reminders'}
                </Text>
                <Text style={styles.settingDescription}>
                  {theme === 'redMean' 
                    ? 'How many times per day should we remind you of your commitment?'
                    : 'Gentle reminders to stay motivated throughout your day'
                  }
                </Text>
              </View>
              <View style={styles.reminderControls}>
                <TouchableOpacity
                  style={styles.reminderButton}
                  onPress={() => adjustReminders(false)}
                >
                  <Minus size={16} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.reminderCount}>{remindersPerDay}</Text>
                <TouchableOpacity
                  style={styles.reminderButton}
                  onPress={() => adjustReminders(true)}
                >
                  <Plus size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <View style={styles.sectionTitle}>
            <Palette size={20} color={colors.primary} />
            <Text style={[styles.sectionTitleText, { color: colors.text }]}>
              {theme === 'redMean' ? 'Visual Discipline' : 'Appearance'}
            </Text>
          </View>
          
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>
                  {theme === 'redMean' ? 'Motivation Style' : 'Theme'}
                </Text>
                <Text style={styles.settingDescription}>
                  {theme === 'redMean' 
                    ? 'Current mode: Brutal honesty and unforgiving motivation'
                    : 'Choose between light and dark themes for your comfort'
                  }
                </Text>
                {!isRedMeanUnlocked && (
                  <Text style={styles.unlockHint}>
                    Tap theme button 10 times to unlock a secret mode...
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.themeButton}
                onPress={handleThemeToggle}
              >
                {getThemeIcon()}
                <Text style={styles.themeButtonText}>{getThemeLabel()}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {theme === 'redMean' && (
            <View style={styles.redMeanWarning}>
              <Text style={styles.warningText}>
                ⚠️ RED MEAN MODE ACTIVE ⚠️{'\n'}
                This mode uses harsh language and brutal honesty to motivate you. 
                It's designed for those who need tough love to quit smoking.
              </Text>
            </View>
          )}
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <View style={styles.sectionTitle}>
            <SettingsIcon size={20} color={colors.primary} />
            <Text style={[styles.sectionTitleText, { color: colors.text }]}>
              {theme === 'redMean' ? 'Battle Stats' : 'App Info'}
            </Text>
          </View>
          
          <View style={styles.settingCard}>
            <Text style={styles.settingLabel}>
              {theme === 'redMean' ? '🚭 Quit Journey - Hardcore Edition' : '🚭 Quit Journey'}
            </Text>
            <Text style={styles.settingDescription}>
              Version 1.0.0 - Demo{'\n'}
              {theme === 'redMean' 
                ? 'Built to break your smoking addiction through discipline and truth'
                : 'Your companion for a healthier, smoke-free life'
              }
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}