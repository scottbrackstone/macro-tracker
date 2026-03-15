import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import { API_BASE_URL, fetchJson, ping } from "../api/client";
import ProgressBar from "../components/ProgressBar";
import { colors, fonts } from "../theme";

export default function DashboardScreen() {
  const [summary, setSummary] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
  });
  const [targets, setTargets] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
  });
  const [recents, setRecents] = useState([]);
  const [dailyLogs, setDailyLogs] = useState([]);
  const [weeklySummaries, setWeeklySummaries] = useState([]);
  const [streak, setStreak] = useState(0);
  const [error, setError] = useState("");
  const [apiStatus, setApiStatus] = useState("checking");
  const [apiMessage, setApiMessage] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const navigation = useNavigation();

  const calendarDays = [-1, 0, 1, 2, 3, 4, 5, 6, 7];
  const formatDateParam = (dateValue) =>
    dateValue.toISOString().slice(0, 10);
  const formatDayLabel = (dateValue) =>
    dateValue.toLocaleDateString(undefined, { weekday: "short" });
  const formatDayNumber = (dateValue) =>
    dateValue.toLocaleDateString(undefined, { day: "numeric" });
  const buildDate = (offset) => {
    const base = new Date();
    const next = new Date(base);
    next.setDate(base.getDate() + offset);
    return next;
  };

  const formatShortDate = (dateValue) =>
    dateValue.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  const loadData = useCallback(async () => {
    try {
      await ping();
      setApiStatus("connected");
      setApiMessage(`Connected to ${API_BASE_URL}`);
    } catch (err) {
      setApiStatus("error");
      setApiMessage(`Cannot reach API at ${API_BASE_URL}`);
      setError(err.message);
      return;
    }

    try {
      const dateParam = formatDateParam(selectedDate);
      const today = new Date();
      const weeklyStart = new Date(today);
      weeklyStart.setDate(today.getDate() - 6);
      const weeklyParams = `start_date=${formatDateParam(
        weeklyStart
      )}&end_date=${formatDateParam(today)}`;
      const [summaryResponse, recentsResponse, logsResponse, targetsResponse, weeklyResponse] =
        await Promise.all([
        fetchJson(`/daily-summary?target_date=${dateParam}`),
        fetchJson("/recents"),
        fetchJson(`/daily-logs?target_date=${dateParam}`),
        fetchJson("/macro-target"),
        fetchJson(`/daily-summaries?${weeklyParams}`),
      ]);
      setSummary(summaryResponse);
      setRecents(recentsResponse);
      setDailyLogs(logsResponse);
      setTargets(targetsResponse);
      setWeeklySummaries(weeklyResponse);
      const streakCount = computeStreak(weeklyResponse);
      setStreak(streakCount);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleDelete = async (logId) => {
    try {
      await fetchJson(`/log-meal/${logId}`, { method: "DELETE" });
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const mealsPerDay = Math.max(1, targets.meals_per_day || 3);
  const mealSlots = useMemo(
    () => Array.from({ length: mealsPerDay }, (_, idx) => idx + 1),
    [mealsPerDay]
  );
  const groupedMeals = useMemo(() => {
    const groups = {};
    mealSlots.forEach((slot) => {
      groups[slot] = [];
    });
    dailyLogs.forEach((log) => {
      const slot = log.meal_slot || 1;
      if (!groups[slot]) {
        groups[slot] = [];
      }
      groups[slot].push(log);
    });
    return groups;
  }, [dailyLogs, mealSlots]);

  const mealTotals = useMemo(() => {
    const totals = {};
    mealSlots.forEach((slot) => {
      totals[slot] = { calories: 0, protein: 0, carbs: 0, fats: 0 };
    });
    dailyLogs.forEach((log) => {
      const slot = log.meal_slot || 1;
      if (!totals[slot]) {
        totals[slot] = { calories: 0, protein: 0, carbs: 0, fats: 0 };
      }
      totals[slot].calories += log.calories || 0;
      totals[slot].protein += log.protein || 0;
      totals[slot].carbs += log.carbs || 0;
      totals[slot].fats += log.fats || 0;
    });
    return totals;
  }, [dailyLogs, mealSlots]);

  const maxWeeklyCalories = Math.max(
    1,
    ...weeklySummaries.map((day) => day.calories || 0)
  );

  function computeStreak(days) {
    let count = 0;
    const sorted = [...days].sort((a, b) => (a.date > b.date ? -1 : 1));
    for (const day of sorted) {
      const active =
        (day.calories || 0) > 0 ||
        (day.protein || 0) > 0 ||
        (day.carbs || 0) > 0 ||
        (day.fats || 0) > 0;
      if (!active) break;
      count += 1;
    }
    return count;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Daily Overview</Text>
      <Text style={styles.subtitle}>
        {selectedDate.toLocaleDateString()}
      </Text>
      <View style={styles.calendarRow}>
        {calendarDays.map((offset) => {
          const day = buildDate(offset);
          const isSelected =
            formatDateParam(day) === formatDateParam(selectedDate);
          return (
            <Pressable
              key={offset}
              style={[styles.calendarItem, isSelected && styles.calendarItemActive]}
              onPress={() => setSelectedDate(day)}
            >
              <Text style={styles.calendarLabel}>{formatDayLabel(day)}</Text>
              <Text style={styles.calendarNumber}>{formatDayNumber(day)}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text
        style={apiStatus === "connected" ? styles.apiOk : styles.apiError}
        numberOfLines={2}
      >
        {apiMessage}
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ProgressBar
        label="Calories"
        value={summary.calories}
        goal={targets.calories || 0}
        unit="kcal"
      />
      <ProgressBar
        label="Protein"
        value={summary.protein}
        goal={targets.protein || 0}
        unit="g"
      />
      <ProgressBar
        label="Carbs"
        value={summary.carbs}
        goal={targets.carbs || 0}
        unit="g"
      />
      <ProgressBar
        label="Fats"
        value={summary.fats}
        goal={targets.fats || 0}
        unit="g"
      />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Meals</Text>
        <Text style={styles.streakBadge}>Streak: {streak} days</Text>
      </View>
      {mealSlots.map((slot) => (
        <View key={slot} style={styles.mealBlock}>
          <View style={styles.mealHeader}>
            <Text style={styles.mealTitle}>Meal {slot}</Text>
            <Pressable
              style={({ pressed }) => [
                styles.addButton,
                pressed && styles.addButtonPressed,
              ]}
              onPress={() =>
                navigation.navigate("Scanner", { mealSlot: slot, manualOnly: true })
              }
              android_ripple={{ color: colors.softAccent }}
            >
              <Text style={styles.addButtonText}>+ Add</Text>
            </Pressable>
          </View>
          {groupedMeals[slot] && groupedMeals[slot].length > 0 ? (
            <Text style={styles.mealMeta}>
              {mealTotals[slot]?.calories || 0} kcal · P{" "}
              {Math.round(mealTotals[slot]?.protein || 0)}g · C{" "}
              {Math.round(mealTotals[slot]?.carbs || 0)}g · F{" "}
              {Math.round(mealTotals[slot]?.fats || 0)}g
            </Text>
          ) : null}
          {groupedMeals[slot] && groupedMeals[slot].length > 0 ? (
            groupedMeals[slot].map((meal) => (
              <View key={meal.id} style={styles.logItem}>
                <View style={styles.logInfo}>
                  <Text style={styles.recentName}>{meal.food_name}</Text>
                  <Text style={styles.recentMeta}>
                    {meal.calories} kcal · P {meal.protein}g · C {meal.carbs}g · F{" "}
                    {meal.fats}g
                  </Text>
                  <Text style={styles.logSource}>{meal.source}</Text>
                </View>
                <Pressable
                  style={styles.deleteButton}
                  onPress={() => handleDelete(meal.id)}
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </View>
            ))
          ) : (
            <Text style={styles.muted}>No items yet.</Text>
          )}
        </View>
      ))}

      <Text style={styles.sectionTitle}>Weekly Calories</Text>
      <View style={styles.weeklyChart}>
        {weeklySummaries.map((day) => (
          <View key={day.date} style={styles.weeklyItem}>
            <View style={styles.weeklyBarTrack}>
              <View
                style={[
                  styles.weeklyBarFill,
                  { width: `${(day.calories / maxWeeklyCalories) * 100}%` },
                ]}
              />
            </View>
            <View style={styles.weeklyMeta}>
              <Text style={styles.weeklyLabel}>
                {formatShortDate(new Date(day.date))}
              </Text>
              <Text style={styles.weeklyValue}>{day.calories} kcal</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Recent Meals</Text>
      {recents.length === 0 ? (
        <Text style={styles.muted}>No meals logged yet.</Text>
      ) : (
        recents.map((meal) => (
          <View key={meal.food_name} style={styles.recentItem}>
            <Text style={styles.recentName}>{meal.food_name}</Text>
            <Text style={styles.recentMeta}>
              {meal.calories} kcal · P {meal.protein}g · C {meal.carbs}g · F{" "}
              {meal.fats}g
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontFamily: fonts.bold,
    marginBottom: 16,
    color: colors.ink,
  },
  subtitle: {
    color: colors.muted,
    marginBottom: 12,
    fontFamily: fonts.regular,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fonts.medium,
    marginTop: 16,
    marginBottom: 8,
    color: colors.ink,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },
  streakBadge: {
    backgroundColor: colors.softAccent,
    color: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  mealBlock: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 12,
  },
  mealHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  mealTitle: {
    fontFamily: fonts.bold,
    color: colors.ink,
  },
  addButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: colors.accent,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  addButtonPressed: {
    opacity: 0.85,
  },
  addButtonText: {
    color: "#fff",
    fontFamily: fonts.medium,
  },
  calendarRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  calendarItem: {
    width: 56,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  calendarItemActive: {
    backgroundColor: colors.softAccent,
    borderColor: colors.accent,
  },
  calendarLabel: {
    fontSize: 12,
    color: colors.muted,
    fontFamily: fonts.regular,
  },
  calendarNumber: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.ink,
  },
  muted: {
    color: colors.muted,
    fontFamily: fonts.regular,
  },
  recentItem: {
    paddingVertical: 10,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  recentName: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color: colors.ink,
  },
  recentMeta: {
    color: colors.muted,
    marginTop: 4,
    fontFamily: fonts.regular,
  },
  logItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 10,
  },
  logInfo: {
    flex: 1,
  },
  logSource: {
    color: colors.muted,
    marginTop: 4,
    fontSize: 12,
    textTransform: "uppercase",
    fontFamily: fonts.regular,
  },
  mealMeta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    marginBottom: 8,
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.softDanger,
  },
  deleteText: {
    color: colors.danger,
    fontFamily: fonts.medium,
  },
  error: {
    color: colors.danger,
    marginBottom: 10,
    fontFamily: fonts.regular,
  },
  apiOk: {
    color: colors.success,
    marginBottom: 8,
    fontFamily: fonts.regular,
  },
  apiError: {
    color: colors.danger,
    marginBottom: 8,
    fontFamily: fonts.regular,
  },
  weeklyChart: {
    gap: 10,
    marginBottom: 16,
  },
  weeklyItem: {
    gap: 6,
  },
  weeklyBarTrack: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 999,
    overflow: "hidden",
  },
  weeklyBarFill: {
    height: "100%",
    backgroundColor: colors.accent,
  },
  weeklyMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  weeklyLabel: {
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 12,
  },
  weeklyValue: {
    fontFamily: fonts.medium,
    color: colors.ink,
    fontSize: 12,
  },
});
