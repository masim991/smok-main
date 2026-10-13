import { useMemo, useState, useEffect } from "react"

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,

} from "react-native"
import { localDateKey, calendarDate } from '@/components/ui/localDate'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { useTheme } from "@/contexts/ThemeContext"
import { useTranslation } from 'react-i18next'
import { useData } from "@/components/contexts/DataContext"
import type { SmokeEntry } from "@/components/contexts/DataContext"
import { Calendar as RNCalendar, type DateObject } from "react-native-calendars"
import { setCalendarLocale } from '@/components/ui/calendarLocale'
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp,
  Activity,
  Target as TargetIcon
} from "lucide-react-native"



// Types for BarChart props
interface BarData {
  day?: string
  date?: string
  week?: number
  average?: number
  startDate?: string
  endDate?: string
  cigarettes: number
}

interface BarChartProps {
  data: BarData[]
  width: number
  height: number
  color: string
  isMonthly?: boolean
  daysShort?: string[]
  labels?: string[]
}

const BarChart = ({ data, width, height, color, isMonthly = false, daysShort, labels }: BarChartProps) => {
  if (!data || data.length === 0) return null

  const maxValue = Math.max(...data.map((d) => d.cigarettes), 1)
  const slotWidth = (width - 40) / data.length
  const barWidth = Math.max(1, slotWidth * 0.6)

  const getXAxisLabel = (item: BarData, index: number) => {
    if (labels && labels[index] !== undefined) return labels[index]
    if (isMonthly && item.week !== undefined) return `W${item.week}`
    if (item.day) return item.day.substring(0, 1)
    const localDays = daysShort ?? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    return (localDays[index] || '').substring(0, 1)
  }

  return (
    <View style={{ width, height, paddingHorizontal: 20 }}>
      <View style={{ flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
        {data.map((item, index) => (
          <View key={index} accessible accessibilityLabel={`${getXAxisLabel(item, index)}: ${item.cigarettes}`} style={{ alignItems: "center", width: slotWidth }}>
            <View
              style={{
                width: barWidth,
                height: (item.cigarettes / maxValue) * (height - 40),
                backgroundColor: color,
                borderTopLeftRadius: 4,
                borderTopRightRadius: 4,
                marginHorizontal: 0,
              }}
            />
            <Text style={{ fontSize: 10, color: color, marginTop: 4, fontWeight: '600' }}>
              {getXAxisLabel(item, index)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}





export default function HistoryTab() {
  const { colors, theme } = useTheme()
  const { t, i18n } = useTranslation()
  setCalendarLocale(i18n.language)
  const { width: screenWidth } = useWindowDimensions()
  const ko = i18n.language.startsWith('ko')
  const label = (k: string, en: string) => ko ? k : en
  const { entries, getActiveGoals } = useData()
  const daysShort = t('labels.daysShort', { returnObjects: true }) as string[]
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'week' | 'month'>('week')
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(true)
  const [isStatsExpanded, setIsStatsExpanded] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    average: 0,
    trend: 0,
    streak: 0,
  })



  // Calculate statistics
  useEffect(() => {
    if (entries.length === 0) { setStats({ total: 0, average: 0, trend: 0, streak: 0 }); return; }

    // Calculate total cigarettes
    const total = entries.reduce((sum, entry) => sum + entry.count, 0);

    // Calculate average per day
    const entriesByDate = new Map();
    entries.forEach(entry => {
      const date = localDateKey(entry.date);
      entriesByDate.set(date, (entriesByDate.get(date) || 0) + entry.count);
    });
    const average = Math.round((total / entriesByDate.size) * 10) / 10;

    // Compare equally sized calendar periods, independent of entry ordering.
    const today = calendarDate(localDateKey());
    const startRecent = new Date(today); startRecent.setDate(today.getDate() - 6);
    const startPrevious = new Date(today); startPrevious.setDate(today.getDate() - 13);
    let recent = 0, previous = 0;
    entries.forEach(e => {
      const date = calendarDate(localDateKey(e.date));
      if (date >= startRecent && date <= today) recent += e.count;
      else if (date >= startPrevious && date < startRecent) previous += e.count;
    });
    const trend = previous > 0 ? ((recent - previous) / previous) * 100 : 0;
    // This is a logging streak. Missing records never prove abstinence.
    let streak = 0;
    const cursor = new Date(today);
    while (entriesByDate.has(localDateKey(cursor))) {
      streak += 1; cursor.setDate(cursor.getDate() - 1);
    }

    setStats({
      total,
      average,
      trend,
      streak,
    });
  }, [entries]);

  // Helper function to get monthly trend data and marked dates
  const getMonthlyTrend = useMemo(() => {
    const monthlyData: { date: string, cigarettes: number }[] = [];
    const markedDates: Record<string, { marked: boolean, dotColor: string, selectedColor?: string }> = {};

    // Group entries by date to get daily totals
    const dailyTotals: Record<string, number> = {};
    entries.forEach(entry => {
      const dateKey = localDateKey(entry.date);
      dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + entry.count;
    });

    // Process entries to create monthly data and marked dates with color coding
    Object.entries(dailyTotals).forEach(([dateKey, count]) => {
      const date = new Date(dateKey);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      // Color coding based on cigarette count
      let dotColor = colors.success; // Green for smoke-free days
      let selectedColor = colors.success;

      if (count > 0) {
        if (count <= 3) {
          dotColor = colors.warning; // Yellow for light smoking (1-3)
          selectedColor = colors.warning;
        } else if (count <= 10) {
          dotColor = colors.error; // Orange for moderate smoking (4-10)
          selectedColor = colors.error;
        } else {
          dotColor = theme === 'redMean' ? '#8B0000' : '#DC143C'; // Dark red for heavy smoking (10+)
          selectedColor = theme === 'redMean' ? '#8B0000' : '#DC143C';
        }
      }

      // Add to marked dates with color coding
      markedDates[dateKey] = {
        marked: true,
        dotColor,
        selectedColor
      };

      // Add to monthly data
      const existingMonth = monthlyData.find(item => item.date === monthKey);
      if (existingMonth) {
        existingMonth.cigarettes += count;
      } else {
        monthlyData.push({
          date: monthKey,
          cigarettes: count
        });
      }
    });

    // Sort monthly data
    monthlyData.sort((a, b) => a.date.localeCompare(b.date));

    // Generate weekly data for the current week
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);

    const weeklyData: BarData[] = Array(7).fill(0).map((_, i) => {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      const dateKey = localDateKey(currentDate);

      const dayTotal = dailyTotals[dateKey] || 0;

      return {
        date: dateKey,
        day: (daysShort && daysShort[i]) || undefined,
        cigarettes: dayTotal
      };
    });

    return {
      monthlyData,
      markedDates,
      weeklyData
    };
  }, [entries, theme, colors, daysShort]);

  // Get encouragement message based on selected date (i18n)
  const getEncouragement = (iso: string) => {
    const entryCount = entries.filter((e: SmokeEntry) => localDateKey(e.date) === iso).reduce((sum: number, e: SmokeEntry) => sum + e.count, 0)
    if (entryCount === 0) return label('이 날짜에는 흡연 기록이 없습니다.', 'No smoking records for this date.')
    if (entryCount <= 3) return t('history.encouragement.low')
    return t('history.encouragement.high')
  }

  // Calculate selected date total
  const selectedTotal = selectedDate
    ? entries
      .filter((e: SmokeEntry) => localDateKey(e.date) === selectedDate)
      .reduce((sum: number, e: SmokeEntry) => sum + e.count, 0)
    : 0;

  const prevMonthTotal = getMonthlyTrend.monthlyData.length > 1
    ? getMonthlyTrend.monthlyData[getMonthlyTrend.monthlyData.length - 2]?.cigarettes
    : getMonthlyTrend.monthlyData[getMonthlyTrend.monthlyData.length - 1]?.cigarettes || 0;

  const percentageChange = prevMonthTotal > 0
    ? Math.round(((getMonthlyTrend.monthlyData[getMonthlyTrend.monthlyData.length - 1]?.cigarettes - prevMonthTotal) / prevMonthTotal) * 100)
    : 0;

  const styles = StyleSheet.create({
    // Stats styles
    statCard: {
      flexGrow: 1,
      flexBasis: '44%',
      minWidth: 110,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
      borderRadius: 8,
      marginHorizontal: 4,
      marginBottom: 8,
    },
    statValue: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
    },
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
    content: {
      flex: 1,
    },
    scrollContainer: {
      paddingTop: 0,
      paddingBottom: 0,
    },
    scrollView: {
      flex: 1,
    },
    statsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 24,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    sectionContainer: {
      marginBottom: 20,
      backgroundColor: colors.surface,
      borderRadius: 14,
      overflow: 'hidden',
      marginHorizontal: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 3,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 18,
      backgroundColor: colors.surface,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
      marginLeft: 8,
    },
    sectionContent: {
      padding: 20,
      paddingTop: 0,
      paddingBottom: 20,
    },
    // Goal Selector Styles
    goalSelector: {
      margin: 16,
      marginBottom: 8,
      borderRadius: 12,
      borderWidth: 1,
      padding: 16,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    goalSelectorContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    goalInfo: {
      flex: 1,
    },
    goalName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    goalDescription: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    goalList: {
      marginHorizontal: 16,
      marginBottom: 16,
      borderRadius: 12,
      borderWidth: 1,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    goalItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      backgroundColor: colors.surface,
      borderBottomColor: colors.border,
    },
    goalIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    goalTextContainer: {
      flex: 1,
    },
    goalItemName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    goalItemDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      opacity: 0.8,
    },
    selectedIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    // Stats Overview
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 12,
      gap: 12,
    },
    statItem: {
      alignItems: 'center',
      flex: 1,
      padding: 12,
      backgroundColor: colors.background,
      borderRadius: 10,
      marginTop: 4,
    },
    legendRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 16,
      marginBottom: 12,
      gap: 20,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      padding: 6,
      borderRadius: 8,
      backgroundColor: colors.background + '40',
    },
    legendSwatch: {
      width: 16,
      height: 16,
      borderRadius: 8,
      marginRight: 5,
    },
    legendText: {
      fontSize: 12,
      color: colors.text,
    },
    calendarContainer: {
      borderRadius: 8,
      overflow: 'hidden',
      marginBottom: 16,
    },
    calendar: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.surface,
      ...(theme === 'dark' ? {
        calendarBackground: colors.background,
        monthTextColor: colors.text,
        textSectionTitleColor: colors.text,
        dayTextColor: colors.text,
        textDisabledColor: colors.textSecondary,
        todayTextColor: colors.primary,
        arrowColor: colors.primary,
        textDayFontWeight: '500',
        textMonthFontWeight: 'bold',
        textDayHeaderFontWeight: '500',
        textDayFontSize: 14,
        textMonthFontSize: 16,
        textDayHeaderFontSize: 12,
      } : {})
    },
    selectedDateContainer: {
      marginTop: 16,
      padding: 16,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    selectedDateText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 4,
    },
    selectedDateCount: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme === 'redMean' ? colors.error : colors.primary,
      marginVertical: 4,
    },
    selectedDateMessage: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 8,
      fontStyle: 'italic',
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      marginHorizontal: 16,
      marginBottom: 16,
      borderRadius: 12,
      padding: 4,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 8,
    },
    tabText: {
      fontSize: 16,
      fontWeight: '600',
    },
    activeTab: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    tabSelector: {
      flexDirection: 'row',
      borderRadius: 12,
      padding: 6,
      marginBottom: 20,
      gap: 8,
    },
    tabButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      alignItems: 'center',
      borderWidth: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    tabButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    chartContainer: {
      marginTop: 16,
    },
    chartHeader: {
      marginBottom: 16,
      alignItems: 'center',
    },
    chartTitle: {
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 4,
      textAlign: 'center',
    },
    trendIndicator: {
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
    },
    chartWrapper: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    analysisRow: {
      flexDirection: 'row',
      gap: 12,
    },
    card: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    cardValue: {
      fontSize: 20,
      fontWeight: '700',
      color: theme === 'redMean' ? colors.error : colors.primary,
      textAlign: 'center',
    },
    listItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    listText: { color: colors.text, fontSize: 14 },
    listCount: { color: colors.textSecondary, fontSize: 14, marginLeft: 8 },
  })



  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title={t('history.title')} subtitle={t('history.subtitle')} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: 100, // Proper padding for tab bar
        }}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.sectionContainer}>
          <TouchableOpacity
            style={styles.sectionHeader}
            accessibilityRole="button" accessibilityState={{ expanded: isStatsExpanded }}
            onPress={() => setIsStatsExpanded(!isStatsExpanded)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Activity size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>{t('history.progressOverview')}</Text>
            </View>
            {isStatsExpanded ? (
              <ChevronUp size={20} color={colors.text} />
            ) : (
              <ChevronDown size={20} color={colors.text} />
            )}
          </TouchableOpacity>

          {isStatsExpanded && (
            <View style={styles.sectionContent}>
              <View style={[styles.tabSelector, { backgroundColor: colors.background }]}>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    {
                      backgroundColor: activeTab === 'week' ? colors.primary : 'transparent',
                      borderColor: activeTab === 'week' ? colors.primary : colors.border,
                    }
                  ]}
                  onPress={() => setActiveTab('week')}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.tabButtonText,
                    {
                      color: activeTab === 'week' ? '#fff' : colors.text,
                      fontWeight: activeTab === 'week' ? '700' : '500',
                    }
                  ]}>
                    {t('history.weekly')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    {
                      backgroundColor: activeTab === 'month' ? colors.primary : 'transparent',
                      borderColor: activeTab === 'month' ? colors.primary : colors.border,
                    }
                  ]}
                  onPress={() => setActiveTab('month')}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.tabButtonText,
                    {
                      color: activeTab === 'month' ? '#fff' : colors.text,
                      fontWeight: activeTab === 'month' ? '700' : '500',
                    }
                  ]}>
                    {t('history.monthly')}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.statsContainer}>
                <View style={[styles.statCard, { backgroundColor: colors.background }]}>
                  <Text style={[styles.statValue, { color: colors.primary }]}>{stats.total}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary, fontSize: 12 }]}>{t('history.stats.total')}</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.background }]}>
                  <Text style={[styles.statValue, { color: colors.primary }]}>{stats.average}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary, fontSize: 12 }]}>{label('기록일 평균', 'Average per logged day')}</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.background }]}>
                  <Text
                    style={[
                      styles.statValue,
                      {
                        color: stats.trend < 0 ? colors.success : colors.error,
                        fontSize: 18
                      }
                    ]}
                  >
                    {stats.trend >= 0 ? '+' : ''}{stats.trend.toFixed(1)}%
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary, fontSize: 12 }]}>{label('최근 7일 변화', 'Last 7 days change')}</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.background }]}>
                  <Text style={[styles.statValue, { color: colors.primary }]}>{stats.streak}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary, fontSize: 12 }]}>{label('연속 기록일', 'Logging streak')}</Text>
                </View>
              </View>

              <View style={styles.chartContainer}>
                <View style={styles.chartHeader}>
                  <Text style={[styles.chartTitle, { color: colors.text }]}>
                    {activeTab === 'week'
                      ? (theme === 'redMean' ? t('history.titles.weekRed') : t('history.titles.week'))
                      : (theme === 'redMean' ? t('history.titles.monthRed') : t('history.titles.month'))}
                  </Text>
                  {activeTab === 'month' && percentageChange !== 0 && (
                    <Text style={[styles.trendIndicator, {
                      color: percentageChange < 0 ? colors.success : colors.error
                    }]}>
                      {percentageChange > 0 ? '↗️' : '↘️'} {Math.abs(percentageChange)}%
                      {theme === 'redMean'
                        ? (percentageChange > 0 ? ` ${t('history.change.worse')}` : ` ${t('history.change.better')}`)
                        : (percentageChange > 0 ? ` ${t('history.change.increase')}` : ` ${t('history.change.decrease')}`)}
                  </Text>
                  )}
                </View>
                <View style={styles.chartWrapper}>
                  <BarChart
                    data={activeTab === 'week' ? getMonthlyTrend.weeklyData : getMonthlyTrend.monthlyData.slice(-6)}
                    width={Math.max(180, screenWidth - 64)}
                    height={200}
                    color={theme === 'redMean' ? colors.error : colors.primary}
                    isMonthly={activeTab === 'month'}
                    daysShort={daysShort}
                  />
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Calendar View */}
        <View style={styles.sectionContainer}>
          <TouchableOpacity
            style={styles.sectionHeader}
            accessibilityRole="button" accessibilityState={{ expanded: isCalendarExpanded }}
            onPress={() => setIsCalendarExpanded(!isCalendarExpanded)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <CalendarIcon size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>
                {theme === 'redMean' ? t('history.calendar.titleRed') : t('history.calendar.title')}
              </Text>
            </View>
            {isCalendarExpanded ? (
              <ChevronUp size={20} color={colors.text} />
            ) : (
              <ChevronDown size={20} color={colors.text} />
            )}
          </TouchableOpacity>

          {isCalendarExpanded && (
            <View style={styles.sectionContent}>
              <View style={[styles.calendarContainer, { backgroundColor: colors.surface }]}>
                <RNCalendar
                  key={`calendar-${theme}-${i18n.language}`}
                  onDayPress={(day: DateObject) => setSelectedDate(day.dateString)}
                  markedDates={{
                    ...getMonthlyTrend.markedDates,
                    ...(selectedDate
                      ? {
                        [selectedDate]: {
                          selected: true,
                          selectedColor: getMonthlyTrend.markedDates[selectedDate]?.selectedColor || (theme === "redMean" ? colors.error : colors.primary),
                          selectedTextColor: "#ffffff",
                          marked: getMonthlyTrend.markedDates[selectedDate]?.marked || false,
                          dotColor: getMonthlyTrend.markedDates[selectedDate]?.dotColor || colors.primary,
                        },
                      }
                      : {}),
                  }}
                  theme={{
                    // @ts-ignore - textSectionTitleColor is valid but not in the type definition
                    textSectionTitleColor: colors.text,
                    calendarBackground: colors.surface,
                    selectedDayBackgroundColor: theme === "redMean" ? colors.error : colors.primary,
                    selectedDayTextColor: "#ffffff",
                    todayTextColor: theme === "redMean" ? colors.text : colors.primary,
                    dayTextColor: colors.text,
                    textDisabledColor: colors.textSecondary,
                    dotColor: colors.primary,
                    selectedDotColor: "#ffffff",
                    arrowColor: theme === "redMean" ? colors.text : colors.primary,
                    monthTextColor: colors.text,
                    textDayFontWeight: "500",
                    textMonthFontWeight: "bold",
                    textDayHeaderFontWeight: "500",
                    textDayFontSize: 14,
                    textMonthFontSize: 16,
                    textDayHeaderFontSize: 12,
                    backgroundColor: colors.surface,
                    textSectionTitleDisabledColor: colors.textSecondary,
                    todayBackgroundColor: colors.surface,
                    todayButtonTextColor: theme === "redMean" ? colors.text : colors.primary,
                    textDayStyle: { color: colors.text },
                  }}
                  style={styles.calendar}
                />
              </View>

              {selectedDate && (
                <View style={styles.selectedDateContainer}>
                  <Text style={styles.selectedDateText}>
                    {calendarDate(selectedDate).toLocaleDateString(i18n.language, {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </Text>
                  <Text style={styles.selectedDateCount}>
                    {selectedTotal} {t('history.units.cigarettes', { count: selectedTotal })}
                  </Text>
                  <Text style={styles.selectedDateMessage}>{getEncouragement(selectedDate)}</Text>
                </View>
              )}

              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendSwatch, { backgroundColor: colors.success }]} />
                  <Text style={styles.legendText}>{theme === 'redMean' ? t('history.legend.strong') : t('history.legend.smokeFree')}</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendSwatch, { backgroundColor: colors.warning }]} />
                  <Text style={styles.legendText}>{theme === 'redMean' ? t('history.legend.weak') : t('history.legend.light')}</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendSwatch, { backgroundColor: colors.error }]} />
                  <Text style={styles.legendText}>{theme === 'redMean' ? t('history.legend.failed') : t('history.legend.heavy')}</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}><TargetIcon size={20} color={colors.primary} /><Text style={styles.sectionTitle}>{label('기록에서 확인한 변화', 'Insights from your records')}</Text></View>
          <View style={styles.sectionContent}>
            <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>{label('금연일과 절약 금액은 확인된 기준선과 금연 기록이 필요합니다. 기록이 없는 날은 통계에서 금연일로 간주하지 않습니다.', 'Smoke-free days and savings need a confirmed baseline and abstinence records. Missing records are not treated as smoke-free days.')}</Text>
            <Text style={{ color: colors.textSecondary, marginTop: 8, lineHeight: 22 }}>{label('변화율은 최근 7일과 이전 7일의 기록량을 비교합니다. 이전 기록량이 0이면 비교값은 0으로 표시됩니다.', 'Change compares logged totals for the last 7 days and the preceding 7 days. When the previous total is zero, the comparison displays zero.')}</Text>
          </View>
        </View>

        {/* Pattern Analysis */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Activity size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>{t('history.reports.title')}</Text>
            </View>
          </View>
          <View style={styles.sectionContent}>
            {/* Weekday chart */}
            <Text style={[styles.chartTitle, { color: colors.text }]}>{t('history.reports.weekday')}</Text>
            <View style={styles.chartWrapper}>
              {(() => {
                const weekdayBuckets = Array(7).fill(0)
                entries.forEach((e: SmokeEntry) => {
                  try {
                    const d = new Date(e.date)
                    const day = d.getDay()
                    weekdayBuckets[day] += e.count
                  } catch {}
                })
                const data = weekdayBuckets.map((v, i) => ({ cigarettes: v, day: daysShort?.[i] || '' }))
                return (
                  <BarChart
                    data={data}
                    width={Math.max(180, screenWidth - 64)}
                    height={160}
                    color={theme === 'redMean' ? colors.error : colors.primary}
                    daysShort={daysShort}
                  />
                )
              })()}
            </View>

            {/* Hourly chart */}
            <Text style={[styles.chartTitle, { color: colors.text, marginTop: 16 }]}>{t('history.reports.hourly')}</Text>
            <View style={styles.chartWrapper}>
              {(() => {
                const hourly = Array(24).fill(0)
                entries.forEach((e: SmokeEntry) => {
                  try {
                    const d = new Date(e.date)
                    const h = d.getHours()
                    hourly[h] += e.count
                  } catch {}
                })
                const labels = Array.from({ length: 24 }, (_, i) => (i % 3 === 0 ? String(i) : ''))
                const data = hourly.map((v) => ({ cigarettes: v }))
                return (
                  <BarChart
                    data={data}
                    width={Math.max(180, screenWidth - 64)}
                    height={160}
                    color={theme === 'redMean' ? colors.error : colors.primary}
                    labels={labels}
                  />
                )
              })()}
            </View>

            {/* Goal vs Actual + Trend */}
            <View style={[styles.analysisRow, { marginTop: 16 }]}>
              {(() => {
                const todayKey = localDateKey()
                const todayTotal = entries.filter(e => localDateKey(e.date) === todayKey).reduce((s, e) => s + e.count, 0)
                const actGoals = getActiveGoals ? getActiveGoals() : []
                const dailyTarget = actGoals
                  .filter(g => g.type === 'reduction' && g.reductionMode !== 'percentage')
                  .map(g => g.target)
                  .filter(tgt => typeof tgt === 'number' && tgt > 0 && tgt <= 10)
                  .sort((a, b) => a - b)[0]
                return (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>{t('history.reports.goalVsActual.title')}</Text>
                    <Text style={[styles.cardValue, { marginBottom: 4 }]}>
                      {t('history.reports.goalVsActual.today')}: {todayTotal}
                      {typeof dailyTarget === 'number' ? ` / ${t('history.reports.goalVsActual.target')}: ${dailyTarget}` : ''}
                    </Text>
                  </View>
                )
              })()}

              {(() => {
                const today = new Date()
                const start2 = new Date(today)
                start2.setDate(today.getDate() - 14)
                const prevStart = new Date(today)
                prevStart.setDate(today.getDate() - 28)
                const prevEnd = new Date(today)
                prevEnd.setDate(today.getDate() - 15)
                let recent = 0, previous = 0
                entries.forEach(e => {
                  const d = new Date(e.date)
                  if (d >= start2 && d <= today) recent += e.count
                  else if (d >= prevStart && d <= prevEnd) previous += e.count
                })
                const pct = previous > 0 ? Math.round(((recent - previous) / previous) * 100) : 0
                const up = pct > 0
                const msg = pct === 0
                  ? '—'
                  : up
                  ? t('history.reports.trend.increase', { percent: Math.abs(pct) })
                  : t('history.reports.trend.decrease', { percent: Math.abs(pct) })
                return (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>{t('history.reports.trend.title')}</Text>
                    <Text style={[styles.cardValue, { color: up ? colors.error : colors.success }]}>{msg}</Text>
                  </View>
                )
              })()}
            </View>
          </View>
        </View>

        {/* Trigger Analysis */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Activity size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>{t('triggers.analysisTitle')}</Text>
            </View>
          </View>
          <View style={styles.sectionContent}>
            {(() => {
              // Parse [trg] tags from entry notes
              const counters = {
                emotion: new Map<string, number>(),
                context: new Map<string, number>(),
                place: new Map<string, number>(),
              }
              try {
                entries.forEach((e: SmokeEntry) => {
                  if (!e.notes) return
                  const m = e.notes.match(/\[trg\]\s*([^]+)$/)
                  if (!m) return
                  const parts = m[1].split(';').map(s => s.trim())
                  parts.forEach(p => {
                    const [k, v] = p.split('=')
                    if (!v) return
                    const val = v.trim()
                    if (!val) return
                    if (k === 'e') counters.emotion.set(val, (counters.emotion.get(val) || 0) + e.count)
                    if (k === 'c') counters.context.set(val, (counters.context.get(val) || 0) + e.count)
                    if (k === 'p') counters.place.set(val, (counters.place.get(val) || 0) + e.count)
                  })
                })
              } catch {}

              const toTop = (m: Map<string, number>) => Array.from(m.entries()).sort((a,b)=>b[1]-a[1]).slice(0,3)
              const topE = toTop(counters.emotion)
              const topC = toTop(counters.context)
              const topP = toTop(counters.place)

              const empty = topE.length===0 && topC.length===0 && topP.length===0
              if (empty) {
                return <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>{t('triggers.none')}</Text>
              }

              return (
                <View style={{ gap: 12 }}>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>{t('triggers.topEmotions')}</Text>
                    {topE.map(([k,v]) => (
                      <View key={`e-${k}`} style={styles.listItem}>
                        <Text style={styles.listText}>{k}</Text>
                        <Text style={styles.listCount}>{v}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>{t('triggers.topContexts')}</Text>
                    {topC.map(([k,v]) => (
                      <View key={`c-${k}`} style={styles.listItem}>
                        <Text style={styles.listText}>{k}</Text>
                        <Text style={styles.listCount}>{v}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>{t('triggers.topPlaces')}</Text>
                    {topP.map(([k,v]) => (
                      <View key={`p-${k}`} style={styles.listItem}>
                        <Text style={styles.listText}>{k}</Text>
                        <Text style={styles.listCount}>{v}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )
            })()}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
