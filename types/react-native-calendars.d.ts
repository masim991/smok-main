declare module 'react-native-calendars' {
  import * as React from 'react';
  import { ViewStyle, TextStyle } from 'react-native';

  export interface DateObject {
    dateString: string; // e.g. '2025-09-09'
    day: number;
    month: number;
    timestamp: number;
    year: number;
  }

  export interface CalendarTheme {
    calendarBackground?: string;
    dayTextColor?: string;
    monthTextColor?: string;
    textDisabledColor?: string;
    todayTextColor?: string;
    arrowColor?: string;
  }

  export interface MarkedDate {
    selected?: boolean;
    selectedColor?: string;
    selectedTextColor?: string;
    [key: string]: any;
  }

  export interface CalendarProps {
    theme?: CalendarTheme;
    markedDates?: Record<string, MarkedDate>;
    firstDay?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    onDayPress?: (day: DateObject) => void;
    // Accept arbitrary props to avoid typing friction
    [key: string]: any;
  }

  export class Calendar extends React.Component<CalendarProps> {}
}
