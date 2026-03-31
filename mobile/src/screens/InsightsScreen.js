import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { fetchJson } from "../api/client";
import ProgressBar from "../components/ProgressBar";
import { colors, fonts } from "../theme";

export default function InsightsScreen() {
  const [rangeDays, setRangeDays] = useState(7);
  const [summaries, setSummaries] = useState([]);
  const [weightLogs, setWeightLogs] = useState([]);
  const [analysis, setAnalysis] = useState({ top_calories: [], top_protein: [] });
  const [fastingStart, setFastingStart] = useState(null);
  const [fastingNow, setFastingNow] = useState(Date.now());
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
      const [summaryResponse, targetResponse, weightResponse, analysisResponse] =
        await Promise.all([
          fetchJson(`/daily-summaries?${params}`),
          fetchJson("/macro-target"),
          fetchJson("/weight-logs?limit=30"),
          fetchJson(`/food-analysis?${params}`),
        ]);
      setSummaries(summaryResponse);
      setTargets(targetResponse);
      setWeightLogs(weightResponse);
      setAnalysis(analysisResponse);
    } catch (err) {
      setStatus(err.message);
    }
  }, [rangeDays]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const timer = setInterval(() => {
      setFastingNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  const macroSplit = useMemo(() => {
    const proteinCals = averages.protein * 4;
    const carbCals = averages.carbs * 4;
    const fatCals = averages.fats * 9;
    const total = proteinCals + carbCals + fatCals || 1;
    return {
      protein: proteinCals,
      carbs: carbCals,
      fats: fatCals,
      total,
    };
  }, [averages]);

  const weightTrend = useMemo(() => {
    if (weightLogs.length < 2) {
      return { changePerWeek: 0, projected: null, latest: null };
    }
    const sorted = [...weightLogs].sort(
      (a, b) => new Date(a.log_date) - new Date(b.log_date)
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const days =
      (new Date(last.log_date) - new Date(first.log_date)) / (1000 * 60 * 60 * 24);
    const delta = (last.weight || 0) - (first.weight || 0);
    const perDay = days ? delta / days : 0;
    return {
      changePerWeek: perDay * 7,
      projected: (last.weight || 0) + perDay * 30,
      latest: last.weight || 0,
    };
  }, [weightLogs]);

  const fastingElapsed = useMemo(() => {
    if (!fastingStart) return "00:00";
    const diffMs = Math.max(0, fastingNow - fastingStart);
    const totalMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }, [fastingStart, fastingNow]);

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
        <Text style={styles.cardTitle}>Macro Split</Text>
        <View style={styles.splitBar}>
          <View
            style={[
              styles.splitSegment,
              styles.splitProtein,
              { flex: macroSplit.protein / macroSplit.total },
            ]}
          />
          <View
            style={[
              styles.splitSegment,
              styles.splitCarbs,
              { flex: macroSplit.carbs / macroSplit.total },
            ]}
          />
          <View
            style={[
              styles.splitSegment,
              styles.splitFats,
              { flex: macroSplit.fats / macroSplit.total },
            ]}
          />
        </View>
        <Text style={styles.muted}>
          Protein {formatNumber((macroSplit.protein / macroSplit.total) * 100)}% ·
          Carbs {formatNumber((macroSplit.carbs / macroSplit.total) * 100)}% · Fats{" "}
          {formatNumber((macroSplit.fats / macroSplit.total) * 100)}%
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

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Food Analysis</Text>
        {analysis.top_calories.length === 0 ? (
          <Text style={styles.muted}>Log more meals to see insights.</Text>
        ) : (
          <>
            <Text style={styles.sectionLabel}>Top calories</Text>
            {analysis.top_calories.map((item) => (
              <Text key={`cal-${item.food_name}`} style={styles.muted}>
                {item.food_name} · {formatNumber(item.calories)} kcal
              </Text>
            ))}
            <Text style={styles.sectionLabel}>Top protein</Text>
            {analysis.top_protein.map((item) => (
              <Text key={`pro-${item.food_name}`} style={styles.muted}>
                {item.food_name} · {formatNumber(item.protein)} g
              </Text>
            ))}
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Fasting Timer</Text>
        <Text style={styles.bigValue}>{fastingElapsed}</Text>
        <Pressable
          style={styles.secondaryButton}
          onPress={() =>
            setFastingStart((prev) => (prev ? null : Date.now()))
          }
          android_ripple={{ color: colors.softAccent }}
        >
          <Text style={styles.secondaryText}>
            {fastingStart ? "Stop fast" : "Start fast"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weight Projection</Text>
        {weightLogs.length < 2 ? (
          <Text style={styles.muted}>Log at least 2 weigh-ins to see trends.</Text>
        ) : (
          <>
            <Text style={styles.bigValue}>
              {formatNumber(weightTrend.latest)} kg
            </Text>
            <Text style={styles.muted}>
              {formatNumber(weightTrend.changePerWeek)} kg / week
            </Text>
            <Text style={styles.muted}>
              30-day projection: {formatNumber(weightTrend.projected)} kg
            </Text>
          </>
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
  sectionLabel: {
    fontFamily: fonts.medium,
    color: colors.ink,
    marginTop: 6,
  },
  splitBar: {
    height: 12,
    borderRadius: 999,
    overflow: "hidden",
    flexDirection: "row",
  },
  splitSegment: {
    height: "100%",
  },
  splitProtein: {
    backgroundColor: colors.accent,
  },
  splitCarbs: {
    backgroundColor: "#F5B06D",
  },
  splitFats: {
    backgroundColor: "#7ED0F2",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  secondaryText: {
    fontFamily: fonts.medium,
    color: colors.ink,
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
