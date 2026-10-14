import { View, Text } from "react-native"

// Types for BarChart props
export interface BarData {
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

export const BarChart = ({ data, width, height, color, isMonthly = false, daysShort, labels }: BarChartProps) => {
  if (!data || data.length === 0) return null

  const maxValue = Math.max(...data.map((d) => d.cigarettes), 1)
  const barWidth = (width - 40) / data.length - 10

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
          <View key={index} style={{ alignItems: "center" }}>
            <View
              style={{
                width: barWidth,
                height: (item.cigarettes / maxValue) * (height - 40),
                backgroundColor: color,
                borderTopLeftRadius: 4,
                borderTopRightRadius: 4,
                marginHorizontal: 5,
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





