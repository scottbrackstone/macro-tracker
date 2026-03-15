import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { fetchJson } from "../api/client";
import ProgressBar from "../components/ProgressBar";
import { colors, fonts } from "../theme";

export default function InsightsScreen() {
  const [rangeDays, setRangeDays] = useState(7);
  const [summaries, setSummaries] = useState([]);
  const [targets, setTargets] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
  });
  const [status, setStatus] = useState("");

  const formatDateParam = (dateValue) =>
    dateValue.toISOString().slice(0, 10);
  const formatNumber = (value) => Number(value || 0).toFixed(1);

  const loadData = useCallback(async () => {
    setStatus("");
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - (rangeDays - 1));
    const params = `start_date=${formatDateParam(start)}&end_date=${formatDateParam(
      today
    )}`;
    try {
      const [summaryResponse, targetResponse] = await Promise.all([
        fetchJson(`/daily-summaries?${params}`),
        fetchJson("/macro-target"),
      ]);
      setSummaries(summaryResponse);
      setTargets(targetResponse);
    } catch (err) {
      setStatus(err.message);
    }
  }, [rangeDays]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totals = useMemo(() => {
    return summaries.reduce(
      (acc, day) => ({
        calories: acc.calories + (day.calories || 0),
        protein: acc.protein + (day.protein || 0),
        carbs: acc.carbs + (day.carbs || 0),
        fats: acc.fats + (day.fats || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
  }, [summaries]);

  const averages = useMemo(() => {
    if (summaries.length === 0) {
      return { calories: 0, protein: 0, carbs: 0, fats: 0 };
    }
    return {
      calories: totals.calories / summaries.length,
      protein: totals.protein / summaries.length,
      carbs: totals.carbs / summaries.length,
      fats: totals.fats / summaries.length,
    };
  }, [summaries, totals]);

  const adherence = useMemo(() => {
    if (!targets.calories) return { percent: 0, hits: 0 };
    const lower = targets.calories * 0.9;
    const upper = targets.calories * 1.1;
    const hits = summaries.filter(
      (day) => day.calories >= lower && day.calories <= upper
    ).length;
    return {
      percent: summaries.length ? (hits / summaries.length) * 100 : 0,
      hits,
    };
  }, [summaries, targets.calories]);

  const maxCalories = Math.max(
    1,
    ...summaries.map((day) => day.calories || 0)
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Weekly Insights</Text>
      {status ? <Text style={styles.status}>{status}</Text> : null}

      <View style={styles.toggleRow}>
        {[7, 14, 30].map((days) => (
          <Pressable
            key={days}
            style={[
              styles.toggleButton,
              rangeDays === days && styles.toggleButtonActive,
            ]}
            onPress={() => setRangeDays(days)}
            android_ripple={{ color: colors.softAccent }}
          >
            <Text style={styles.toggleText}>{days} days</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Adherence</Text>
        <Text style={styles.bigValue}>
          {formatNumber(adherence.percent)}%
        </Text>
        <Text style={styles.muted}>
          {adherence.hits} of {summaries.length} days within 10% of calorie target
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Average Intake</Text>
        <ProgressBar
          label="Calories"
          value={averages.calories}
          goal={targets.calories || 0}
          unit="kcal"
        />
        <ProgressBar
          label="Protein"
          value={averages.protein}
          goal={targets.protein || 0}
          unit="g"
        />
        <ProgressBar
          label="Carbs"
          value={averages.carbs}
          goal={targets.carbs || 0}
          unit="g"
        />
        <ProgressBar
          label="Fats"
          value={averages.fats}
          goal={targets.fats || 0}
          unit="g"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Calories Trend</Text>
        {summaries.length === 0 ? (
          <Text style={styles.muted}>No data yet.</Text>
        ) : (
          summaries.map((day) => (
            <View key={day.date} style={styles.trendItem}>
              <View style={styles.trendBarTrack}>
                <View
                  style={[
                    styles.trendBarFill,
                    { width: `${(day.calories / maxCalories) * 100}%` },
                  ]}
                />
              </View>
              <View style={styles.trendMeta}>
                <Text style={styles.trendLabel}>{day.date}</Text>
                <Text style={styles.trendValue}>
                  {formatNumber(day.calories)} kcal
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: colors.ink,
  },
  status: {
    color: colors.muted,
    fontFamily: fonts.regular,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 8,
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  toggleButtonActive: {
    backgroundColor: colors.softAccent,
    borderColor: colors.accent,
  },
  toggleText: {
    fontFamily: fonts.medium,
    color: colors.ink,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.ink,
  },
  bigValue: {
    fontSize: 32,
    fontFamily: fonts.bold,
    color: colors.accent,
  },
  muted: {
    color: colors.muted,
    fontFamily: fonts.regular,
  },
  trendItem: {
    gap: 6,
    marginBottom: 8,
  },
  trendBarTrack: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 999,
    overflow: "hidden",
  },
  trendBarFill: {
    height: "100%",
    backgroundColor: colors.accent,
  },
  trendMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  trendLabel: {
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 12,
  },
  trendValue: {
    fontFamily: fonts.medium,
    color: colors.ink,
    fontSize: 12,
  },
});
