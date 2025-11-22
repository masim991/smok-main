import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { useTheme } from '@/components/contexts/ThemeContext';
import { Svg } from 'react-native-svg';
import { useData } from '@/components/contexts/DataContext';
import { ChartBar as BarChart3, TrendingDown, Calendar } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, TouchableOpacity } from 'react-native';

const { width } = Dimensions.get('window');

export default function HistoryTab() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showFullYear, setShowFullYear] = useState(false);
  const { colors, theme } = useTheme();
  const { getWeeklySummary, entries, removeEntry } = useData();
  const [modalVisible, setModalVisible] = useState(false);
  const [fullYearModalVisible, setFullYearModalVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState<{date: string, count: number, entryIds: string[]} | null>(null);

  const getMotivationalMessage = () => {
    switch (theme) {
      case 'redMean':
        return 'WITNESS YOUR PATHETIC HISTORY OF WEAKNESS';
      case 'dark':
        return 'Analyze your journey through data and insights';
      default:
        return 'Track your progress with beautiful visualizations';
    }
  };

  const weeklyData = getWeeklySummary();

  // Generate monthly trend data from entries
  const monthlyTrend = React.useMemo(() => {
    const trend = Array.from({ length: 4 }, (_, i) => ({ week: i + 1, average: 0, count: 0 }));
    const today = new Date();
    const fourWeeksAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 28);

    entries.forEach(entry => {
      const entryDate = new Date(entry.date);
      if (entryDate >= fourWeeksAgo) {
        const diffDays = Math.floor((today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
        const weekIndex = 3 - Math.floor(diffDays / 7);
        if (weekIndex >= 0 && weekIndex < 4) {
          trend[weekIndex].average += entry.count;
          trend[weekIndex].count += 1; // We can use this to get a true average later if needed
        }
      }
    });

    // For this chart, we'll just show total per week
    return trend.map(t => ({ week: t.week, average: t.average }));
  }, [entries]);

  // Generate contribution data
  const contributionData = React.useMemo(() => {
    const days = Array.from({ length: 365 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return { date: date.toISOString().split('T')[0], count: 0 };
    }).reverse();

    entries.forEach(entry => {
      const dateString = entry.date.split('T')[0];
      const day = days.find(d => d.date === dateString);
      if (day) {
        day.count += entry.count;
      }
    });

    return days.map(d => ({ ...d, smokeFree: d.count === 0 ? 1 : 0 }));
  }, [entries]);

  // Generate month names
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

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
      padding: 16,
    },
    monthSelector: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    monthButton: {
      padding: 8,
      borderRadius: 8,
      minWidth: 40,
      alignItems: 'center',
    },
    fullYearButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    fullYearButtonText: {
      color: '#fff',
      fontSize: 12,
    },
    modalContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContent: {
      width: '90%',
      maxHeight: '80%',
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    closeButton: {
      padding: 4,
    },
    chartCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chartTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
      flexDirection: 'row',
      alignItems: 'center',
    },
    chartTitleText: {
      marginLeft: 8,
    },
    contributionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginTop: 16,
    },
    contributionDay: {
      width: 12,
      height: 12,
      margin: 1,
      borderRadius: 2,
    },
    contributionLegend: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 12,
    },
    legendText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 16,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.primary,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
  });

  const getContributionColor = (smokeFree: number) => {
    if (smokeFree === 0) return colors.border;
    return theme === 'redMean' ? colors.error : colors.success;
  };

  // Check for SVG support (Expo should always provide it, but just in case)
  let hasSvg = true;
  try {
    if (!Svg) hasSvg = false;
  } catch {
    hasSvg = false;
  }

  if (!hasSvg) {
    return (
      <View style={styles.container}>
        <Text style={{color: colors.error, padding: 24}}>SVG support is missing. Please ensure react-native-svg is installed and linked.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📊 History</Text>
        <Text style={styles.subtitle}>{getMotivationalMessage()}</Text>
      </View>
      
      <ScrollView style={styles.content}>
        <View>
          {/* Content goes here */}
        </View>
          {/* Weekly Stats */}
        <View style={styles.chartCard}>
          <View style={styles.chartTitle}>
            <BarChart3 size={20} color={colors.primary} />
            <Text style={[styles.chartTitleText, { color: colors.text }]}>
              {theme === 'redMean' ? 'Weekly Failures' : 'This Week\'s Progress'}
            </Text>
          </View>
          <View style={{marginTop: 12}}>
            {weeklyData.map((item, idx) => (
              <Text key={idx} style={{color: colors.textSecondary, fontSize: 16}}>
                {item.day}: {item.cigarettes} cigarettes
              </Text>
            ))}
          </View>
        </View>

        {/* Monthly Trend */}
        <View style={styles.chartCard}>
          <View style={styles.chartTitle}>
            <TrendingDown size={20} color={colors.success} />
            <Text style={[styles.chartTitleText, { color: colors.text }]}>
              {theme === 'redMean' ? 'Decline in Weakness' : 'Monthly Trend'}
            </Text>
          </View>
          <View style={{marginTop: 12}}>
            {monthlyTrend.map((item, idx) => (
              <Text key={idx} style={{color: colors.textSecondary, fontSize: 16}}>
                Week {item.week}: {item.average} cigarettes
              </Text>
            ))}
          </View>
        </View>

        {/* Month Selection */}
        <View style={styles.chartCard}>
          <View style={styles.chartTitle}>
            <Calendar size={20} color={colors.primary} />
            <Text style={[styles.chartTitleText, { color: colors.text }]}>
              {monthNames[selectedMonth]} {selectedYear}
            </Text>
          </View>
          
          <View style={styles.monthSelector}>
            <TouchableOpacity 
              style={styles.monthButton}
              onPress={() => setSelectedMonth(prev => (prev - 1 + 12) % 12)}
            >
              <Text style={{color: colors.text}}>‹</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.fullYearButton}
              onPress={() => setFullYearModalVisible(true)}
            >
              <Text style={styles.fullYearButtonText}>Show Full Year</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.monthButton}
              onPress={() => setSelectedMonth(prev => (prev + 1) % 12)}
            >
              <Text style={{color: colors.text}}>›</Text>
            </TouchableOpacity>
          </View>
          {/* Current Month Grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, justifyContent: 'center' }}>
            {(() => {
              const today = new Date();
              const year = today.getFullYear();
              const month = selectedMonth;
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const firstDay = new Date(year, month, 1).getDay();
              const numWeeks = Math.ceil((daysInMonth + firstDay) / 7);
              const grid: Array<Array<any>> = Array.from({ length: numWeeks }, () => Array(7).fill(null));
              let dayNum = 1;
              for (let w = 0; w < numWeeks; w++) {
                for (let d = 0; d < 7; d++) {
                  if ((w === 0 && d < firstDay) || dayNum > daysInMonth) continue;
                  const dateObj = new Date(year, month, dayNum);
                  const dateStr = dateObj.toISOString().split('T')[0];
                  const dayData = contributionData.find(c => c.date === dateStr) || { count: 0, smokeFree: 1, date: dateStr };
                  const entryIds = entries.filter(e => e.date.startsWith(dateStr)).map(e => e.id);
                  grid[w][d] = { ...dayData, entryIds };
                  dayNum++;
                }
              }
              return grid.map((week, weekIdx) => (
                <View key={weekIdx} style={{ flexDirection: 'column', marginRight: 2 }}>
                  {week.map((day, dayIdx) => {
                    if (!day) return <View key={dayIdx} style={[styles.contributionDay, { backgroundColor: 'transparent' }]} />;
                    let bg = '#e5e7eb';
                    if (day.smokeFree) {
                      bg = theme === 'redMean' ? '#b91c1c' : colors.success;
                    } else if (day.count > 0) {
                      bg = theme === 'redMean' ? '#f87171' : colors.primary;
                    }
                    return (
                      <Pressable
                        key={dayIdx}
                        style={[styles.contributionDay, { backgroundColor: bg, marginBottom: 2, marginTop: 2, width: 16, height: 16 }]}
                        onPress={() => {
                          setSelectedDay({ date: day.date, count: day.count, entryIds: day.entryIds });
                          setModalVisible(true);
                        }}
                      />
                    );
                  })}
                </View>
              ));
            })()}
          </View>
          {/* Modal for day details and remove option */}
          <Modal
            visible={modalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setModalVisible(false)}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
              <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 24, minWidth: 250 }}>
                {selectedDay && (
                  <>
                    <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18, marginBottom: 8 }}>{new Date(selectedDay.date).toLocaleDateString()}</Text>
                    <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>
                      {selectedDay.count === 0 ? 'Smoke-free!' : `${selectedDay.count} cigarettes logged`}
                    </Text>
                    {selectedDay.entryIds.length > 0 && (
                      <>
                        <Text style={{ color: colors.text, marginBottom: 8 }}>Remove a log for this day:</Text>
                        {selectedDay.entryIds.map(id => (
                          <TouchableOpacity
                            key={id}
                            style={{ backgroundColor: theme === 'redMean' ? '#b91c1c' : colors.primary, padding: 8, borderRadius: 8, marginBottom: 6 }}
                            onPress={async () => {
                              await removeEntry(id);
                              setModalVisible(false);
                            }}
                          >
                            <Text style={{ color: '#fff', textAlign: 'center' }}>Remove log {id.slice(-4)}</Text>
                          </TouchableOpacity>
                        ))}
                      </>
                    )}
                    <TouchableOpacity style={{ marginTop: 12, alignSelf: 'center' }} onPress={() => setModalVisible(false)}>
                      <Text style={{ color: colors.primary, fontWeight: 'bold' }}>Close</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </Modal>
          {/* Legend */}
          <View style={styles.contributionLegend}>
            <Text style={styles.legendText}>{theme === 'redMean' ? 'Failure' : 'Less'}</Text>
            <View style={{ flexDirection: 'row' }}>
              {[0, 1].map((level) => (
                <View
                  key={level}
                  style={[
                    styles.contributionDay,
                    { backgroundColor: level === 0 ? '#e5e7eb' : (theme === 'redMean' ? '#b91c1c' : colors.success), marginHorizontal: 2 }
                  ]}
                />
              ))}
            </View>
            <Text style={styles.legendText}>{theme === 'redMean' ? 'Victory' : 'More'}</Text>
          </View>
        </View>

        {/* Stats Summary */}
        <View style={styles.chartCard}>
          <Text style={[styles.chartTitle, { color: colors.text }]}>
            {theme === 'redMean' ? 'Battle Statistics' : 'Progress Summary'}
          </Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>127</Text>
              <Text style={styles.statLabel}>
                {theme === 'redMean' ? 'Days Survived' : 'Smoke-Free Days'}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>$847</Text>
              <Text style={styles.statLabel}>
                {theme === 'redMean' ? 'Money Not Wasted' : 'Money Saved'}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>2,540</Text>
              <Text style={styles.statLabel}>
                {theme === 'redMean' ? 'Cigarettes Avoided' : 'Cigarettes Not Smoked'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}