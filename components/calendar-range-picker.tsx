import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type CalendarRangePickerProps = {
  disabled?: boolean;
  isDark: boolean;
  onChangeMonth: (offset: number) => void;
  onDone: () => void;
  onSelect: (day: Date) => void;
  rangeEnd: Date | null;
  rangeStart: Date | null;
  visibleMonth: Date;
};

export function CalendarRangePicker({
  disabled = false,
  isDark,
  onChangeMonth,
  onDone,
  onSelect,
  rangeEnd,
  rangeStart,
  visibleMonth,
}: CalendarRangePickerProps) {
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const minSelectableDate = startOfDay(new Date());
  const maxSelectableDate = addMonths(minSelectableDate, 6);
  const canGoPrevious = !disabled && addMonths(visibleMonth, -1).getTime() >= startOfMonth(minSelectableDate).getTime();
  const canGoNext = !disabled && addMonths(visibleMonth, 1).getTime() <= startOfMonth(maxSelectableDate).getTime();
  const cells = buildCalendarCells(visibleMonth);

  return (
    <View className={`mt-3 rounded-[26px] border p-4 ${isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white'} ${disabled ? 'opacity-70' : ''}`}>
      <View className="mb-4 flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canGoPrevious }}
          disabled={!canGoPrevious}
          onPress={() => onChangeMonth(-1)}
          className={`h-10 w-10 items-center justify-center rounded-full ${
            !canGoPrevious ? 'opacity-40' : ''
          } ${isDark ? 'bg-white/10' : 'bg-zinc-100'}`}>
          <Ionicons name="chevron-back" size={20} color={isDark ? '#FFFFFF' : '#18181B'} />
        </Pressable>
        <Text className={`text-lg font-black ${titleClass}`}>
          {monthNames[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canGoNext }}
          disabled={!canGoNext}
          onPress={() => onChangeMonth(1)}
          className={`h-10 w-10 items-center justify-center rounded-full ${
            !canGoNext ? 'opacity-40' : ''
          } ${isDark ? 'bg-white/10' : 'bg-zinc-100'}`}>
          <Ionicons name="chevron-forward" size={20} color={isDark ? '#FFFFFF' : '#18181B'} />
        </Pressable>
      </View>

      <View className="mb-2 flex-row">
        {weekdayLabels.map((label, index) => (
          <Text key={`${label}-${index}`} className={`flex-1 text-center text-xs font-black ${mutedClass}`}>
            {label}
          </Text>
        ))}
      </View>

      <View className="flex-row flex-wrap">
        {cells.map((day, index) => {
          if (!day) {
            return <View key={`blank-${index}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
          }

          const selected = sameDay(day, rangeStart) || sameDay(day, rangeEnd);
          const inRange = isInRange(day, rangeStart, rangeEnd);
          const dayDisabled = disabled || day.getTime() < minSelectableDate.getTime() || day.getTime() > maxSelectableDate.getTime();

          return (
            <View key={day.toISOString()} className="p-0.5" style={{ width: `${100 / 7}%`, aspectRatio: 1 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: dayDisabled }}
                disabled={dayDisabled}
                onPress={() => onSelect(day)}
                className={`h-full items-center justify-center rounded-2xl ${
                  dayDisabled
                    ? isDark
                      ? 'bg-white/[0.03]'
                      : 'bg-zinc-50'
                    : selected
                      ? 'bg-violet'
                      : inRange
                        ? 'bg-violet/20'
                        : isDark
                          ? 'bg-white/5'
                          : 'bg-zinc-100'
                }`}>
                <Text className={`font-black ${dayDisabled ? 'text-zinc-500/50' : selected ? 'text-white' : titleClass}`}>
                  {day.getDate()}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <Text className={`mt-3 text-center text-xs font-semibold ${mutedClass}`}>
        {rangeStart && rangeEnd
          ? `${durationDays(rangeStart, rangeEnd)} day${durationDays(rangeStart, rangeEnd) === 1 ? '' : 's'} selected`
          : rangeStart
            ? 'Choose an end date'
            : 'Choose a start date'}
      </Text>
      <Text className={`mt-1 text-center text-xs font-semibold ${mutedClass}`}>
        Dates can run from today through {formatDateLabel(maxSelectableDate)}.
      </Text>
      {rangeStart && rangeEnd ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onDone}
          className={`mt-3 min-h-11 items-center justify-center rounded-full bg-violet px-5 ${disabled ? 'opacity-60' : ''}`}>
          <Text className="text-sm font-black text-white">Done</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

export function formatDateLabel(date: Date) {
  return `${monthNames[date.getMonth()]} ${date.getDate()}`;
}

export function formatDateRange(start: Date, end: Date) {
  const suffix = start.getFullYear() === end.getFullYear() ? '' : `, ${end.getFullYear()}`;
  return `${formatDateLabel(start)} - ${formatDateLabel(end)}${suffix}`;
}

function buildCalendarCells(month: Date) {
  const firstDay = startOfMonth(month);
  const daysInMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: firstDay.getDay() }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(firstDay.getFullYear(), firstDay.getMonth(), day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function sameDay(left: Date | null, right: Date | null) {
  return Boolean(
    left &&
      right &&
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate(),
  );
}

function isInRange(day: Date, start: Date | null, end: Date | null) {
  return Boolean(start && end && day.getTime() > start.getTime() && day.getTime() < end.getTime());
}

function durationDays(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}
