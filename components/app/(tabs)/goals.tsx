import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useTheme } from '@/components/contexts/ThemeContext';
import { Target, Trophy, Calendar, TrendingDown } from 'lucide-react-native';
import { useData, GoalType } from '@/components/contexts/DataContext';
import type { Goal } from '@/components/contexts/DataContext';

export default function GoalsTab() {
  const { colors, theme } = useTheme();
  const { goals, addGoal } = useData();

  const [goalType, setGoalType] = useState<GoalType>('reduction');
  const [target, setTarget] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAddGoal = async () => {
    if (!target || isNaN(Number(target))) {
      Alert.alert('Invalid Target', 'Please enter a valid target number.');
      return;
    }
    setAdding(true);
    try {
      await addGoal({
        type: goalType,
        target: Number(target),
        title: goalType === 'reduction' ? 'Daily Reduction' : goalType === 'smoke_free_days' ? 'Smoke-Free Days' : 'Milestone',
        description: 'User-defined goal',
        currentValue: 0,
        difficulty: 'easy',
        icon: 'target',
      });
      setTarget('');
      Alert.alert('Goal Added', 'Your goal has been added!');
    } catch (e) {
      Alert.alert('Error', 'Failed to add goal.');
    }
    setAdding(false);
  };

  const getMotivationalMessage = () => {
    switch (theme) {
      case 'redMean':
        return 'SET IMPOSSIBLE GOALS. FAIL BETTER.';
      case 'dark':
        return 'Define your path through the shadows of addiction';
      default:
        return 'Set meaningful goals and celebrate your progress';
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
    goalTypes: {
      marginTop: 32,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    goalCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 20,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    goalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    goalTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginLeft: 12,
    },
    goalDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
  });

  const goalTypes = [
    {
      icon: TrendingDown,
      title: theme === 'redMean' ? 'Reduce Your Poison' : 'Daily Reduction',
      description: theme === 'redMean' 
        ? 'Cut down the number of cigarettes you poison yourself with daily'
        : 'Gradually reduce your daily cigarette count'
    },
    {
      icon: Calendar,
      title: theme === 'redMean' ? 'Survive Smoke-Free Days' : 'Smoke-Free Days',
      description: theme === 'redMean'
        ? 'Challenge yourself to survive entire days without weakness'
        : 'Set targets for consecutive smoke-free days'
    },
    {
      icon: Trophy,
      title: theme === 'redMean' ? 'Milestone Conquests' : 'Milestone Goals',
      description: theme === 'redMean'
        ? 'Conquer major milestones: 1 week, 1 month, 1 year of freedom'
        : 'Celebrate important milestones in your quit journey'
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🎯 Goals</Text>
        <Text style={styles.subtitle}>{getMotivationalMessage()}</Text>
      </View>
      
      <ScrollView style={styles.content}>
        {/* Add Goal Section */}
        <View style={styles.comingSoonCard}>
          <Text style={styles.comingSoonTitle}>Set a New Goal</Text>
          <View style={{ flexDirection: 'row', marginBottom: 12 }}>
            <TouchableOpacity onPress={() => setGoalType('reduction')} style={{ marginRight: 8, padding: 8, borderRadius: 8, backgroundColor: goalType === 'reduction' ? colors.primary : colors.surface }}>
              <TrendingDown size={18} color={goalType === 'reduction' ? '#fff' : colors.text} />
              <Text style={{ color: goalType === 'reduction' ? '#fff' : colors.text, fontSize: 12 }}>Reduce</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setGoalType('smoke_free_days')} style={{ marginRight: 8, padding: 8, borderRadius: 8, backgroundColor: goalType === 'smoke_free_days' ? colors.primary : colors.surface }}>
              <Calendar size={18} color={goalType === 'smoke_free_days' ? '#fff' : colors.text} />
              <Text style={{ color: goalType === 'smoke_free_days' ? '#fff' : colors.text, fontSize: 12 }}>Smoke-Free</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setGoalType('milestone')} style={{ padding: 8, borderRadius: 8, backgroundColor: goalType === 'milestone' ? colors.primary : colors.surface }}>
              <Trophy size={18} color={goalType === 'milestone' ? '#fff' : colors.text} />
              <Text style={{ color: goalType === 'milestone' ? '#fff' : colors.text, fontSize: 12 }}>Milestone</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, marginBottom: 12, color: colors.text, width: '100%', backgroundColor: colors.surface }}
            placeholder={goalType === 'reduction' ? 'Max cigarettes/day' : goalType === 'smoke_free_days' ? 'Days smoke-free' : 'Milestone target'}
            placeholderTextColor={colors.textSecondary}
            value={target}
            onChangeText={setTarget}
            keyboardType="numeric"
          />
          <TouchableOpacity style={{ backgroundColor: colors.primary, padding: 12, borderRadius: 8 }} onPress={handleAddGoal} disabled={adding}>
            <Text style={{ color: '#fff', fontWeight: 'bold', textAlign: 'center' }}>{adding ? 'Adding...' : 'Add Goal'}</Text>
          </TouchableOpacity>
        </View>

        {/* List Goals */}
        <View style={styles.goalTypes}>
          <Text style={styles.sectionTitle}>
            {theme === 'redMean' ? 'Types of Challenges' : 'Goal Types'}
          </Text>
          
          {goalTypes.map((goal, index: number) => (
            <View key={index} style={styles.goalCard}>
              <View style={styles.goalHeader}>
                <goal.icon size={24} color={colors.primary} />
                <Text style={styles.goalTitle}>{goal.title}</Text>
              </View>
              <Text style={styles.goalDescription}>{goal.description}</Text>
            </View>
          ))}
        </View>

        {/* User Goals List */}
        <View style={{ marginTop: 24 }}>
          <Text style={styles.sectionTitle}>Your Goals</Text>
          {goals.length === 0 && <Text style={{ color: colors.textSecondary }}>No goals set yet.</Text>}
          {goals.map((goal: Goal) => (
            <View key={goal.id} style={styles.goalCard}>
              <View style={styles.goalHeader}>
                {goal.type === 'reduction' && <TrendingDown size={20} color={colors.primary} />}
                {goal.type === 'smoke_free_days' && <Calendar size={20} color={colors.primary} />}
                {goal.type === 'milestone' && <Trophy size={20} color={colors.primary} />}
                <Text style={styles.goalTitle}>{goal.type.charAt(0).toUpperCase() + goal.type.slice(1).replace('_', ' ')}</Text>
              </View>
              <Text style={styles.goalDescription}>Target: {goal.target} {goal.type === 'reduction' ? 'cigarettes/day' : goal.type === 'smoke_free_days' ? 'days smoke-free' : 'milestone'}</Text>
              <Text style={{ color: goal.status === 'active' ? colors.primary : colors.textSecondary, marginTop: 4 }}>
                {goal.status.charAt(0).toUpperCase() + goal.status.slice(1)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}