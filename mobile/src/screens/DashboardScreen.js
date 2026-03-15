import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

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
  const [error, setError] = useState("");
  const [apiStatus, setApiStatus] = useState("checking");
  const [apiMessage, setApiMessage] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());

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
      const [summaryResponse, recentsResponse, logsResponse, targetsResponse] =
        await Promise.all([
        fetchJson(`/daily-summary?target_date=${dateParam}`),
        fetchJson("/recents"),
        fetchJson(`/daily-logs?target_date=${dateParam}`),
        fetchJson("/macro-target"),
      ]);
      setSummary(summaryResponse);
      setRecents(recentsResponse);
      setDailyLogs(logsResponse);
      setTargets(targetsResponse);
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

      <Text style={styles.sectionTitle}>Selected Day Meals</Text>
      {dailyLogs.length === 0 ? (
        <Text style={styles.muted}>No meals logged today.</Text>
      ) : (
        dailyLogs.map((meal) => (
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
      )}

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
});
