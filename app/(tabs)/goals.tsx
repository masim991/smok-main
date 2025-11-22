import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/components/contexts/DataContext';
import type { Goal, GoalType } from '@/components/contexts/DataContext';
import { useTranslation } from 'react-i18next';
import {
  Check,
  Trophy,
  TrendingDown,
  Calendar as CalendarIcon,
  Plus,
  X,
  CheckCircle,
  Target,
  Flame
} from 'lucide-react-native';

interface GoalTemplate {
  id: string;
  title: string;
  redMeanTitle: string;
  description: string;
  redMeanDescription: string;
  type: GoalType;
  target: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  icon: string;
}

const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    id: 'reduce_half',
    title: 'Cut in Half',
    redMeanTitle: 'REDUCE WEAKNESS',
    description: 'Reduce your daily cigarettes by 50%',
    redMeanDescription: 'PROVE YOU CAN CONTROL YOUR PATHETIC ADDICTION',
    type: 'reduction',
    target: 50, // percentage
    difficulty: 'easy',
    icon: '📉'
  },
  {
    id: 'daily_limit_3',
    title: 'Daily Limit: 3',
    redMeanTitle: 'STRICT DISCIPLINE',
    description: 'Maximum 3 cigarettes per day',
    redMeanDescription: 'THREE FAILURES MAXIMUM. NO EXCUSES.',
    type: 'reduction',
    target: 3,
    difficulty: 'medium',
    icon: '🎯'
  },
  {
    id: 'daily_limit_1',
    title: 'Single Smoke',
    redMeanTitle: 'ONE WEAKNESS ONLY',
    description: 'Only 1 cigarette per day',
    redMeanDescription: 'ONE PATHETIC CIGARETTE. THAT\'S ALL YOU GET.',
    type: 'reduction',
    target: 1,
    difficulty: 'hard',
    icon: '🚬'
  },
  {
    id: 'weekend_warrior',
    title: 'Smoke-Free Weekends',
    redMeanTitle: 'WEEKEND STRENGTH',
    description: 'Keep weekends completely smoke-free',
    redMeanDescription: 'SHOW STRENGTH WHEN IT MATTERS MOST',
    type: 'smoke_free_days',
    target: 2,
    difficulty: 'medium',
    icon: '🏖️'
  },
  {
    id: 'workday_clean',
    title: 'Clean Workdays',
    redMeanTitle: 'PROFESSIONAL POWER',
    description: 'No smoking during work hours',
    redMeanDescription: 'BE STRONG AT WORK. NO WEAKNESS ALLOWED.',
    type: 'smoke_free_days',
    target: 5,
    difficulty: 'hard',
    icon: '💼'
  },
  {
    id: 'week_streak',
    title: '7-Day Streak',
    redMeanTitle: 'SEVEN DAY BATTLE',
    description: 'Go 7 consecutive days smoke-free',
    redMeanDescription: 'ONE WEEK WITHOUT FAILURE. PROVE YOUR WORTH.',
    type: 'streak',
    target: 7,
    difficulty: 'hard',
    icon: '🔥'
  },
  {
    id: 'month_champion',
    title: '30-Day Champion',
    redMeanTitle: 'MONTH OF POWER',
    description: 'Complete 30 days without smoking',
    redMeanDescription: 'THIRTY DAYS OF PURE DISCIPLINE AND STRENGTH',
    type: 'streak',
    target: 30,
    difficulty: 'extreme',
    icon: '🏆'
  },
  {
    id: 'morning_control',
    title: 'Morning Control',
    redMeanTitle: 'MORNING DISCIPLINE',
    description: 'No cigarettes before 12 PM',
    redMeanDescription: 'CONTROL YOUR MORNING WEAKNESS',
    type: 'milestone',
    target: 12, // hour
    difficulty: 'easy',
    icon: '🌅'
  }
];

function GoalsTab() {
  const { colors, theme } = useTheme();
  const { goals, addGoal, completeGoal, entries } = useData();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [showGoalSelection, setShowGoalSelection] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [pulseAnim] = useState(new Animated.Value(1));

  // Pulse animation for red theme
  useEffect(() => {
    if (theme === 'redMean') {
      const pulse = () => {
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]).start(() => pulse());
      };
      pulse();
    }
  }, [theme, pulseAnim]);

  const activeGoals = goals.filter((g: Goal) => g.status === 'active');
  const completedGoals = goals.filter((g: Goal) => g.status === 'completed');

  // Always show all templates for now - we'll filter later if needed
  const availableTemplates = GOAL_TEMPLATES;

  const calculateGoalProgress = (goal: Goal): number => {
    const today = new Date().toISOString().split('T')[0];
    const todayEntries = entries.filter(e => e.date.startsWith(today));
    const todayCount = todayEntries.reduce((sum, e) => sum + e.count, 0);

    switch (goal.type) {
      case 'reduction':
        if (goal.target <= 10) { // Daily limit goals
          return Math.max(0, 100 - (todayCount / goal.target) * 100);
        } else { // Percentage reduction goals
          return Math.min(100, (goal.currentValue / goal.target) * 100);
        }
      case 'streak':
        return Math.min(100, (goal.currentValue / goal.target) * 100);
      case 'smoke_free_days':
        return Math.min(100, (goal.currentValue / goal.target) * 100);
      case 'milestone':
        return goal.currentValue >= goal.target ? 100 : 0;
      default:
        return 0;
    }
  };

  const getMotivationalMessage = () => {
    const activeCount = activeGoals.length;
    const completedCount = completedGoals.length;
    const today = new Date().toISOString().split('T')[0];
    const todayEntries = entries.filter(e => e.date.startsWith(today));
    const todayCount = todayEntries.reduce((sum, e) => sum + e.count, 0);

    if (theme === 'redMean') {
      if (activeCount === 0) return t('goals.redMean.noActive');
      if (todayCount === 0) return t('goals.redMean.activeNoFailures', { count: activeCount });
      return t('goals.redMean.activeWithFailures', { active: activeCount, failures: todayCount });
    }

    if (activeCount === 0 && completedCount === 0) {
      return t('goals.motivation.startJourney');
    }

    if (activeCount > 0) {
      if (todayCount === 0) {
        return t('goals.motivation.activeNoFailures', { count: activeCount });
      }
      return t('goals.motivation.activeKeepGoing', { count: activeCount });
    }

    return t('goals.motivation.completed', { count: completedCount });
  };

  const openGoalSelection = () => {
    console.log('Opening goal selection, available templates:', availableTemplates.length);
    setSelectedTemplates([]);
    setShowGoalSelection(true);
  };

  const toggleTemplateSelection = (templateId: string) => {
    setSelectedTemplates(prev =>
      prev.includes(templateId)
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
    );
  };

  const addSelectedGoals = async () => {
    setIsLoading(true);
    try {
      for (const templateId of selectedTemplates) {
        const template = GOAL_TEMPLATES.find(tpl => tpl.id === templateId);
        if (template) {
          const newGoal = {
            type: template.type,
            target: template.target,
            title: theme === 'redMean' 
              ? t(`goals.templates.${template.id}.redMeanTitle`)
              : t(`goals.templates.${template.id}.title`),
            description: theme === 'redMean' 
              ? t(`goals.templates.${template.id}.redMeanDescription`)
              : t(`goals.templates.${template.id}.description`),
            currentValue: 0,
            difficulty: template.difficulty,
            icon: template.icon,
            redMeanTitle: template.redMeanTitle,
            redMeanDescription: template.redMeanDescription,
          };
          await addGoal(newGoal);
        }
      }
      setShowGoalSelection(false);
      Alert.alert(
        theme === 'redMean' ? t('goals.alerts.activatedTitleRed') : t('goals.alerts.successTitle'),
        theme === 'redMean'
          ? t('goals.alerts.activatedBodyRed', { count: selectedTemplates.length })
          : t('goals.alerts.addedBody', { count: selectedTemplates.length })
      );
    } catch (error) {
      console.error(error);
      Alert.alert(
        theme === 'redMean' ? t('goals.alerts.failedTitleRed') : t('common.error'),
        theme === 'redMean' ? t('goals.alerts.failedBodyRed') : t('goals.alerts.failedBody')
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    // Ensure theme-specific colors don't bleed
    const baseColors = {
      easy: theme === 'redMean' ? '#00FF00' : colors.success,
      medium: theme === 'redMean' ? '#FFFF00' : colors.warning,
      hard: theme === 'redMean' ? '#FF4444' : colors.error,
      extreme: theme === 'redMean' ? '#FFFFFF' : '#8B5CF6',
    };

    return baseColors[difficulty as keyof typeof baseColors] || colors.primary;
  };

  const getGoalIcon = (type: GoalType) => {
    switch (type) {
      case 'reduction': return TrendingDown;
      case 'smoke_free_days': return CalendarIcon;
      case 'streak': return Flame;
      case 'milestone': return Trophy;
      default: return Target;
    }
  };

  const renderGoalCard = (goal: Goal) => {
    const progress = calculateGoalProgress(goal);
    const isRedTheme = theme === 'redMean';

    return (
      <Animated.View
        key={goal.id}
        style={[
          styles.goalCard,
          {
            backgroundColor: colors.surface,
            borderColor: isRedTheme ? colors.primary : colors.border,
            borderWidth: isRedTheme ? 2 : 1,
            transform: isRedTheme ? [{ scale: pulseAnim }] : undefined,
            // Ensure theme isolation
            shadowColor: isRedTheme ? colors.primary : '#000',
            shadowOpacity: isRedTheme ? 0.3 : 0.1,
          },
          goal.status === 'completed' && styles.completedGoalCard,
        ]}
      >
        <View style={styles.goalHeader}>
          <View style={[
            styles.iconContainer,
            {
              backgroundColor: isRedTheme ? colors.primary + '40' : colors.primary + '20',
              borderWidth: isRedTheme ? 1 : 0,
              borderColor: isRedTheme ? colors.text : 'transparent',
            }
          ]}>
            <Text style={{ fontSize: 20 }}>{goal.icon}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.goalTitle, { color: colors.text }]}>
              {isRedTheme && goal.redMeanTitle ? goal.redMeanTitle : goal.title}
            </Text>
            <Text style={[styles.goalDescription, { color: colors.textSecondary }]}>
              {isRedTheme && goal.redMeanDescription ? goal.redMeanDescription : goal.description}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <View style={[
                styles.difficultyBadge,
                {
                  backgroundColor: getDifficultyColor(goal.difficulty) + '20',
                  borderColor: getDifficultyColor(goal.difficulty),
                }
              ]}>
                <Text style={[
                  styles.difficultyText,
                  { color: getDifficultyColor(goal.difficulty) }
                ]}>
                  {goal.difficulty.toUpperCase()}
                </Text>
              </View>
              {goal.status === 'active' && (
                <Text style={[styles.goalStatus, { color: colors.primary, marginLeft: 8 }]}>
                  {isRedTheme ? t('goals.status.activeRed') : t('goals.status.active')}
                </Text>
              )}
            </View>
          </View>
          <TouchableOpacity
            onPress={() => completeGoal(goal.id)}
            style={[
              styles.completeButton,
              {
                backgroundColor: goal.status === 'completed' ? 'transparent' : colors.primary,
                borderColor: colors.primary,
                borderWidth: 2,
              }
            ]}
            disabled={goal.status === 'completed'}
          >
            {goal.status === 'completed' ? (
              <CheckCircle size={20} color={colors.primary} />
            ) : (
              <Check size={20} color={isRedTheme ? colors.background : '#fff'} />
            )}
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              Progress: {goal.currentValue} / {goal.target}
            </Text>
            <Text style={{
              color: progress >= 100 ? colors.success : colors.primary,
              fontSize: 12,
              fontWeight: '600'
            }}>
              {Math.round(progress)}%
            </Text>
          </View>
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View
              style={{
                width: `${Math.min(100, progress)}%`,
                height: '100%',
                backgroundColor: progress >= 100 ? colors.success : colors.primary,
                borderRadius: 4,
              }}
            />
          </View>
          {goal.status === 'completed' && goal.completedAt && (
            <Text style={{
              color: colors.success,
              fontSize: 12,
              marginTop: 8,
              fontWeight: '600'
            }}>
              {isRedTheme ? t('goals.completedRed') : t('goals.completed')} {new Date(goal.completedAt).toLocaleDateString()}
            </Text>
          )}
        </View>
      </Animated.View>
    );
  };

  const renderGoals = () => {
    const goalsToShow = activeTab === 'active' ? activeGoals : completedGoals;

    if (goalsToShow.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>
            {theme === 'redMean' ? '⚔️' : activeTab === 'active' ? '🎯' : '🏆'}
          </Text>
          <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
            {activeTab === 'active'
              ? (theme === 'redMean' ? t('goals.empty.noActiveRed') : t('goals.empty.noActive'))
              : (theme === 'redMean' ? t('goals.empty.noCompletedRed') : t('goals.empty.noCompleted'))}
          </Text>
          <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
            {activeTab === 'active'
              ? (availableTemplates.length > 0
                ? (theme === 'redMean'
                  ? t('goals.empty.selectMissionsRed')
                  : t('goals.empty.chooseGoals'))
                : (theme === 'redMean'
                  ? t('goals.empty.allMissionsTriedRed')
                  : t('goals.empty.allGoalsTried')))
              : (theme === 'redMean'
                ? t('goals.empty.completeToSeeRed')
                : t('goals.empty.completeToSee'))}
          </Text>
          {activeTab === 'active' && availableTemplates.length > 0 && (
            <TouchableOpacity
              style={[
                styles.addButton,
                {
                  backgroundColor: colors.primary,
                  marginTop: 20,
                  borderWidth: theme === 'redMean' ? 2 : 0,
                  borderColor: theme === 'redMean' ? colors.text : 'transparent'
                }
              ]}
              onPress={openGoalSelection}
            >
              <Plus size={20} color={theme === 'redMean' ? colors.background : "#fff"} />
              <Text style={[
                styles.addButtonText,
                { color: theme === 'redMean' ? colors.background : "#fff" }
              ]}>
                {theme === 'redMean' ? t('goals.buttons.selectMissions') : t('goals.buttons.chooseGoals')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return (
      <View style={styles.goalsList}>
        {goalsToShow.map(goal => renderGoalCard(goal))}
        {activeTab === 'active' && availableTemplates.length > 0 && (
          <TouchableOpacity
            style={[styles.addGoalButton, { borderColor: colors.primary }]}
            onPress={openGoalSelection}
          >
            <Plus size={24} color={colors.primary} />
            <Text style={[styles.addGoalButtonText, { color: colors.primary }]}>
              {theme === 'redMean' ? t('goals.buttons.addMoreMissions') : t('goals.buttons.addAnotherGoal')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[
        styles.header,
        {
          backgroundColor: colors.surface,
          borderBottomWidth: theme === 'redMean' ? 2 : 0,
          borderBottomColor: theme === 'redMean' ? colors.primary : 'transparent',
        }
      ]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>
              {theme === 'redMean' ? t('goals.titleRed') : t('goals.title')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {getMotivationalMessage()}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.addHeaderButton,
              {
                backgroundColor: colors.primary,
                borderWidth: theme === 'redMean' ? 1 : 0,
                borderColor: theme === 'redMean' ? colors.text : 'transparent',
              }
            ]}
            onPress={openGoalSelection}
          >
            <Plus size={20} color={theme === 'redMean' ? colors.background : '#fff'} />
          </TouchableOpacity>
        </View>

      </View>

      {/* Enhanced Goal Selection */}
      {showGoalSelection && (
        <View
          style={[
            styles.goalSelectionContainer,
            {
              backgroundColor: colors.surface,
              borderColor: theme === 'redMean' ? colors.primary : colors.border,
              borderWidth: theme === 'redMean' ? 2 : 1,
              shadowColor: theme === 'redMean' ? colors.primary : '#000',
              shadowOpacity: theme === 'redMean' ? 0.3 : 0.1,
            }
          ]}
        >
          <View style={styles.goalSelectionHeader}>
            <Text style={[styles.goalSelectionTitle, { color: colors.text }]}>
              {theme === 'redMean' ? t('goals.select.titleRed') : t('goals.select.title')}
            </Text>
            <TouchableOpacity
              onPress={() => setShowGoalSelection(false)}
              style={[styles.closeButton, { backgroundColor: colors.border }]}
            >
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.goalSelectionSubtitle, { color: colors.textSecondary }]}>
            {theme === 'redMean'
              ? t('goals.select.subtitleRed')
              : t('goals.select.subtitle')}
          </Text>

          <ScrollView
            style={styles.goalGridScrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            <View style={styles.goalGrid}>
              {GOAL_TEMPLATES.map((template) => {
                const isSelected = selectedTemplates.includes(template.id);
                return (
                  <TouchableOpacity
                    key={template.id}
                    style={[
                      styles.goalOptionCard,
                      {
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: isSelected ? `${colors.primary}15` : colors.background,
                        borderWidth: isSelected ? 2 : 1,
                        shadowColor: isSelected ? colors.primary : '#000',
                        shadowOpacity: isSelected ? 0.2 : 0.05,
                      }
                    ]}
                    onPress={() => toggleTemplateSelection(template.id)}
                  >
                    <View style={styles.goalCardHeader}>
                      <View style={[
                        styles.goalIconContainer,
                        {
                          backgroundColor: isSelected ? `${colors.primary}25` : `${colors.primary}10`,
                          borderColor: isSelected ? colors.primary : 'transparent',
                          borderWidth: isSelected ? 1 : 0,
                        }
                      ]}>
                        <Text style={styles.goalIcon}>{template.icon}</Text>
                      </View>
                      <View style={[
                        styles.difficultyBadge,
                        {
                          backgroundColor: getDifficultyColor(template.difficulty) + '20',
                          borderColor: getDifficultyColor(template.difficulty),
                        }
                      ]}>
                        <Text style={[
                          styles.difficultyText,
                          { color: getDifficultyColor(template.difficulty) }
                        ]}>
                          {template.difficulty.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.goalCardTitle, { color: colors.text }]}> 
                      {t(`goals.templates.${template.id}.${theme === 'redMean' ? 'redMeanTitle' : 'title'}`)}
                    </Text>

                    <Text style={[styles.goalCardDescription, { color: colors.textSecondary }]}> 
                      {t(`goals.templates.${template.id}.${theme === 'redMean' ? 'redMeanDescription' : 'description'}`)}
                    </Text>

                    <View style={styles.goalCardFooter}>
                      <Text style={[styles.goalTarget, { color: colors.primary }]}>
                        🎯 {template.target} {template.type === 'reduction' && template.target > 10 ? t('goals.units.percent') :
                          template.type === 'streak' ? t('goals.units.days') :
                            template.type === 'smoke_free_days' ? t('goals.units.daysPerWeek') : t('goals.units.limit')}
                      </Text>

                      <View style={[
                        styles.selectionIndicator,
                        {
                          borderColor: isSelected ? colors.primary : colors.border,
                          backgroundColor: isSelected ? colors.primary : 'transparent',
                        }
                      ]}>
                        {isSelected && <Check size={14} color="#fff" />}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {selectedTemplates.length > 0 && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => {
                  setSelectedTemplates([]);
                  setShowGoalSelection(false);
                }}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                  {theme === 'redMean' ? t('goals.buttons.retreat') : t('common.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.activateButton,
                  {
                    backgroundColor: colors.primary,
                    borderWidth: theme === 'redMean' ? 1 : 0,
                    borderColor: theme === 'redMean' ? colors.text : 'transparent',
                    paddingHorizontal: theme === 'redMean' ? 6 : 14,
                    paddingVertical: theme === 'redMean' ? 8 : 14,
                    flex: theme === 'redMean' ? 1.5 : 2,
                  }
                ]}
                onPress={addSelectedGoals}
                disabled={isLoading}
              >
                <Text
                  style={[
                    styles.activateButtonText,
                    {
                      color: theme === 'redMean' ? colors.background : '#fff',
                      fontSize: theme === 'redMean' ? 10 : 14,
                      textAlign: 'center',
                      lineHeight: theme === 'redMean' ? 12 : 16,
                    }
                  ]}
                  numberOfLines={theme === 'redMean' ? 3 : 2}
                  adjustsFontSizeToFit
                >
                  {isLoading 
                    ? (theme === 'redMean' ? t('goals.buttons.activating') : t('goals.buttons.adding'))
                    : (theme === 'redMean' 
                        ? t('goals.buttons.activateN', { count: selectedTemplates.length })
                        : t('goals.buttons.addN', { count: selectedTemplates.length }))}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {!showGoalSelection && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
        {activeGoals.length > 0 || completedGoals.length > 0 ? (
          <>
            <View style={[
              styles.tabsContainer,
              {
                backgroundColor: theme === 'redMean' ? colors.surface : colors.background + '20',
                borderWidth: theme === 'redMean' ? 1 : 0,
                borderColor: theme === 'redMean' ? colors.border : 'transparent',
              }
            ]}>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'active' && { backgroundColor: colors.primary }
                ]}
                onPress={() => setActiveTab('active')}
              >
                <Text style={[
                  styles.tabText,
                  { color: activeTab === 'active' ? (theme === 'redMean' ? colors.background : '#fff') : colors.text }
                ]}>
                  {theme === 'redMean' ? t('goals.tabs.activeRed') : t('goals.tabs.active')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'completed' && { backgroundColor: colors.primary }
                ]}
                onPress={() => setActiveTab('completed')}
              >
                <Text style={[
                  styles.tabText,
                  { color: activeTab === 'completed' ? (theme === 'redMean' ? colors.background : '#fff') : colors.text }
                ]}>
                  {theme === 'redMean' ? t('goals.tabs.completedRed') : t('goals.tabs.completed')}
                </Text>
              </TouchableOpacity>
            </View>
            {renderGoals()}
          </>
        ) : (
          <View style={styles.emptyContainer}>
            {renderGoals()}
          </View>
        )}
        </ScrollView>
      )}

    </View>
  );
}

export default GoalsTab;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
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
  tabsContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginTop: 10,
    marginHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  goalCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  completedGoalCard: {
    opacity: 0.85,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  goalDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  goalStatus: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressBar: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  completeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  goalsList: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  addGoalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    marginTop: 16,
  },
  addGoalButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 12,
    marginTop: 20,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  addHeaderButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  modalBody: {
    flex: 1,
    marginBottom: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 20,
    borderTopWidth: 1,
  },
  modalCancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 2,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  goalOptionsContainer: {
    gap: 16,
  },
  goalOption: {
    borderRadius: 16,
    padding: 20,
  },
  goalOptionContent: {
    gap: 12,
  },
  goalOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  goalOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalOptionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  goalOptionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  goalOptionTarget: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectionCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  difficultyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  difficultyText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // Enhanced Goal Selection Styles
  goalSelectionContainer: {
    position: 'absolute',
    top: '20%',
    left: 16,
    right: 16,
    borderRadius: 16,
    padding: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
    maxHeight: '65%',
    zIndex: 1000,
  },
  goalGridScrollView: {
    maxHeight: 300,
    marginVertical: 16,
    flex: 0,
  },
  goalSelectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  goalSelectionTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  goalSelectionSubtitle: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  goalOptionCard: {
    width: '48%',
    borderRadius: 12,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  goalCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  goalIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalIcon: {
    fontSize: 20,
  },
  goalCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 18,
  },
  goalCardDescription: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  goalCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalTarget: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  selectionIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  activateButton: {
    flex: 2,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  activateButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  toggleButton: {
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});