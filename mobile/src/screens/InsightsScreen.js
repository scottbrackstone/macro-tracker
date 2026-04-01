import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { fetchJson } from "../api/client";
import MacroPie, { MACRO_COLORS } from "../components/MacroPie";
import ProgressBar from "../components/ProgressBar";
import { colors, fonts } from "../theme";

const fmt = (v) => Number(v || 0).toFixed(1);
const fmtInt = (v) => Math.round(Number(v || 0));
const formatDateParam = (d) => d.toISOString().slice(0, 10);
const formatShort = (d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const formatDay = (d) => new Date(d).toLocaleDateString(undefined, { weekday: "short" });

export default function InsightsScreen() {
  const [rangeDays, setRangeDays] = useState(7);
  const [summaries, setSummaries] = useState([]);
  const [weightLogs, setWeightLogs] = useState([]);
  const [analysis, setAnalysis] = useState({ top_calories: [], top_protein: [] });
  const [targets, setTargets] = useState({ calories: 0, protein: 0, carbs: 0, fats: 0 });
  const [fastingStart, setFastingStart] = useState(null);
  const [fastingNow, setFastingNow] = useState(Date.now());
  const [status, setStatus] = useState("");

  const loadData = useCallback(async () => {
    setStatus("");
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - (rangeDays - 1));
    const params = `start_date=${formatDateParam(start)}&end_date=${formatDateParam(today)}`;
    try {
      const [summaryRes, targetRes, weightRes, analysisRes] = await Promise.all([
        fetchJson(`/daily-summaries?${params}`),
        fetchJson("/macro-target"),
        fetchJson("/weight-logs?limit=30"),
        fetchJson(`/food-analysis?${params}`),
      ]);
      setSummaries(summaryRes);
      setTargets(targetRes);
      setWeightLogs(weightRes);
      setAnalysis(analysisRes);
    } catch (err) {
      setStatus(err.message);
    }
  }, [rangeDays]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const timer = setInterval(() => setFastingNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const totals = useMemo(() =>
    summaries.reduce((acc, day) => ({
      calories: acc.calories + (day.calories || 0),
      protein: acc.protein + (day.protein || 0),
      carbs: acc.carbs + (day.carbs || 0),
      fats: acc.fats + (day.fats || 0),
    }), { calories: 0, protein: 0, carbs: 0, fats: 0 }),
    [summaries]
  );

  const averages = useMemo(() => {
    const n = summaries.length || 1;
    return { calories: totals.calories / n, protein: totals.protein / n, carbs: totals.carbs / n, fats: totals.fats / n };
  }, [summaries, totals]);

  const adherence = useMemo(() => {
    if (!targets.calories) return { percent: 0, hits: 0 };
    const lower = targets.calories * 0.9;
    const upper = targets.calories * 1.1;
    const hits = summaries.filter((d) => d.calories >= lower && d.calories <= upper).length;
    return { percent: summaries.length ? Math.round((hits / summaries.length) * 100) : 0, hits };
  }, [summaries, targets.calories]);

  const maxCalories = Math.max(1, ...summaries.map((d) => d.calories || 0), targets.calories || 0);

  const weightTrend = useMemo(() => {
    if (weightLogs.length < 2) return { changePerWeek: 0, projected: null, latest: null };
    const sorted = [...weightLogs].sort((a, b) => new Date(a.log_date) - new Date(b.log_date));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const days = (new Date(last.log_date) - new Date(first.log_date)) / (1000 * 60 * 60 * 24);
    const delta = (last.weight || 0) - (first.weight || 0);
    const perDay = days ? delta / days : 0;
    return { changePerWeek: perDay * 7, projected: (last.weight || 0) + perDay * 30, latest: last.weight || 0 };
  }, [weightLogs]);

  const fastingElapsed = useMemo(() => {
    if (!fastingStart) return "00:00:00";
    const diffMs = Math.max(0, fastingNow - fastingStart);
    const h = Math.floor(diffMs / 3600000);
    const m = Math.floor((diffMs % 3600000) / 60000);
    const s = Math.floor((diffMs % 60000) / 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [fastingStart, fastingNow]);

  const maxAnalysisCals = Math.max(1, ...analysis.top_calories.map((i) => i.calories));
  const maxAnalysisProtein = Math.max(1, ...analysis.top_protein.map((i) => i.protein));

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Progress</Text>
      {status ? <Text style={styles.status}>{status}</Text> : null}

      <View style={styles.toggleRow}>
        {[7, 14, 30].map((d) => (
          <Pressable key={d} style={[styles.toggleButton, rangeDays === d && styles.toggleButtonActive]}
            onPress={() => setRangeDays(d)} android_ripple={{ color: colors.softAccent }}>
            <Text style={[styles.toggleText, rangeDays === d && styles.toggleTextActive]}>{d}d</Text>
          </Pressable>
        ))}
      </View>

      {/* ── Summary stats ── */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{adherence.percent}%</Text>
          <Text style={styles.statLabel}>On target</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{fmtInt(averages.calories)}</Text>
          <Text style={styles.statLabel}>Avg kcal</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{adherence.hits}/{summaries.length}</Text>
          <Text style={styles.statLabel}>Days logged</Text>
        </View>
      </View>

      {/* ── Macro split pie ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Macro Split (avg)</Text>
        <View style={styles.pieRow}>
          <MacroPie protein={averages.protein} carbs={averages.carbs} fats={averages.fats} targets={targets} />
          <View style={styles.macroBreakdown}>
            {[
              { label: "Protein", value: averages.protein, target: targets.protein, cal: averages.protein * 4, color: MACRO_COLORS.protein },
              { label: "Carbs", value: averages.carbs, target: targets.carbs, cal: averages.carbs * 4, color: MACRO_COLORS.carbs },
              { label: "Fats", value: averages.fats, target: targets.fats, cal: averages.fats * 9, color: MACRO_COLORS.fats },
            ].map((m) => {
              const pct = targets.calories ? Math.round((m.cal / targets.calories) * 100) : 0;
              return (
                <View key={m.label} style={styles.macroRow}>
                  <View style={[styles.macroDot, { backgroundColor: m.color }]} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.macroLabelRow}>
                      <Text style={styles.macroLabel}>{m.label}</Text>
                      <Text style={styles.macroValue}>{fmtInt(m.value)}g</Text>
                    </View>
                    <View style={styles.macroBarTrack}>
                      <View style={[styles.macroBarFill, { width: `${Math.min((m.value / (m.target || 1)) * 100, 100)}%`, backgroundColor: m.color }]} />
                    </View>
                    <Text style={styles.macroSub}>{pct}% of calories · goal {fmtInt(m.target)}g</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* ── Daily calorie bars ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Daily Calories</Text>
        <View style={styles.vertBarChart}>
          {summaries.map((day) => {
            const h = Math.max(4, (day.calories / maxCalories) * 100);
            const onTarget = targets.calories && day.calories >= targets.calories * 0.9 && day.calories <= targets.calories * 1.1;
            return (
              <View key={day.date} style={styles.vertBarCol}>
                <Text style={styles.vertBarVal}>{day.calories > 0 ? fmtInt(day.calories) : ""}</Text>
                <View style={styles.vertBarTrack}>
                  <View style={[styles.vertBarFill, { height: `${h}%`, backgroundColor: onTarget ? "#10B981" : colors.accent }]} />
                </View>
                <Text style={styles.vertBarLabel}>{formatDay(day.date)}</Text>
              </View>
            );
          })}
        </View>
        {targets.calories > 0 && (
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: "#10B981" }]} /><Text style={styles.muted}>On target  </Text>
            <View style={[styles.legendDot, { backgroundColor: colors.accent }]} /><Text style={styles.muted}>Off target</Text>
          </View>
        )}
      </View>

      {/* ── Average intake progress bars ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Average vs Goal</Text>
        <ProgressBar label="Calories" value={averages.calories} goal={targets.calories || 0} unit="kcal" />
        <ProgressBar label="Protein" value={averages.protein} goal={targets.protein || 0} unit="g" />
        <ProgressBar label="Carbs" value={averages.carbs} goal={targets.carbs || 0} unit="g" />
        <ProgressBar label="Fats" value={averages.fats} goal={targets.fats || 0} unit="g" />
      </View>

      {/* ── Food analysis ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Food Analysis</Text>
        {analysis.top_calories.length === 0 ? (
          <Text style={styles.muted}>Log more meals to see insights.</Text>
        ) : (
          <>
            <Text style={styles.sectionLabel}>Top calorie sources</Text>
            {analysis.top_calories.map((item) => (
              <View key={`cal-${item.food_name}`} style={styles.analysisItem}>
                <View style={styles.analysisLabelRow}>
                  <Text style={styles.analysisName} numberOfLines={1}>{item.food_name}</Text>
                  <Text style={styles.analysisVal}>{fmtInt(item.calories)} kcal</Text>
                </View>
                <View style={styles.analysisBarTrack}>
                  <View style={[styles.analysisBarFill, { width: `${(item.calories / maxAnalysisCals) * 100}%`, backgroundColor: MACRO_COLORS.carbs }]} />
                </View>
                <Text style={styles.analysisSub}>{item.count}× logged · P {fmt(item.protein)}g · C {fmt(item.carbs)}g · F {fmt(item.fats)}g</Text>
              </View>
            ))}
            <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Top protein sources</Text>
            {analysis.top_protein.map((item) => (
              <View key={`pro-${item.food_name}`} style={styles.analysisItem}>
                <View style={styles.analysisLabelRow}>
                  <Text style={styles.analysisName} numberOfLines={1}>{item.food_name}</Text>
                  <Text style={styles.analysisVal}>{fmt(item.protein)}g</Text>
                </View>
                <View style={styles.analysisBarTrack}>
                  <View style={[styles.analysisBarFill, { width: `${(item.protein / maxAnalysisProtein) * 100}%`, backgroundColor: MACRO_COLORS.protein }]} />
                </View>
                <Text style={styles.analysisSub}>{item.count}× logged · {fmtInt(item.calories)} kcal</Text>
              </View>
            ))}
          </>
        )}
      </View>

      {/* ── Fasting timer ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Intermittent Fasting</Text>
        <Text style={styles.fastingClock}>{fastingElapsed}</Text>
        {fastingStart && (
          <Text style={styles.muted}>Started {new Date(fastingStart).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</Text>
        )}
        <Pressable style={[styles.fastBtn, fastingStart && styles.fastBtnStop]}
          onPress={() => setFastingStart((prev) => (prev ? null : Date.now()))}
          android_ripple={{ color: colors.softAccent }}>
          <Ionicons name={fastingStart ? "stop-circle" : "play-circle"} size={18} color={fastingStart ? colors.danger : "#10B981"} />
          <Text style={[styles.fastBtnText, fastingStart && { color: colors.danger }]}>
            {fastingStart ? "End fast" : "Start fast"}
          </Text>
        </Pressable>
      </View>

      {/* ── Weight projection ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weight Trend</Text>
        {weightLogs.length < 2 ? (
          <Text style={styles.muted}>Log at least 2 weigh-ins to see trends.</Text>
        ) : (
          <>
            <Text style={styles.bigValue}>{fmt(weightTrend.latest)} kg</Text>
            <View style={styles.trendRow}>
              <View style={styles.trendItem}>
                <Ionicons name={weightTrend.changePerWeek < 0 ? "trending-down" : "trending-up"} size={18}
                  color={weightTrend.changePerWeek < 0 ? "#10B981" : MACRO_COLORS.carbs} />
                <Text style={styles.trendValue}>{fmt(Math.abs(weightTrend.changePerWeek))} kg/wk</Text>
                <Text style={styles.muted}>{weightTrend.changePerWeek < 0 ? "losing" : "gaining"}</Text>
              </View>
              <View style={styles.trendItem}>
                <Ionicons name="calendar" size={18} color={colors.accent} />
                <Text style={styles.trendValue}>{fmt(weightTrend.projected)} kg</Text>
                <Text style={styles.muted}>30-day proj.</Text>
              </View>
            </View>
            <View style={styles.weightList}>
              {weightLogs.slice(0, 5).map((log) => (
                <View key={log.id} style={styles.weightRow}>
                  <Text style={styles.weightDate}>{formatShort(log.log_date)}</Text>
                  <Text style={styles.weightVal}>{fmt(log.weight)} kg</Text>
                  {log.notes ? <Text style={[styles.muted, { flex: 1 }]} numberOfLines={1}>{log.notes}</Text> : null}
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40, backgroundColor: colors.background, gap: 12 },
  title: { fontSize: 26, fontFamily: fonts.bold, color: colors.ink },
  status: { color: colors.muted, fontFamily: fonts.regular },
  toggleRow: { flexDirection: "row", gap: 6 },
  toggleButton: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  toggleButtonActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  toggleText: { fontFamily: fonts.medium, color: colors.ink, fontSize: 13 },
  toggleTextActive: { color: "#fff" },

  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  statValue: { fontFamily: fonts.bold, fontSize: 22, color: colors.ink },
  statLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 2 },

  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: 17, fontFamily: fonts.bold, color: colors.ink },

  pieRow: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  macroBreakdown: { flex: 1, gap: 10 },
  macroRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  macroDot: { width: 10, height: 10, borderRadius: 999, marginTop: 4 },
  macroLabelRow: { flexDirection: "row", justifyContent: "space-between" },
  macroLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  macroValue: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  macroBarTrack: { height: 5, backgroundColor: colors.border, borderRadius: 999, overflow: "hidden", marginVertical: 3 },
  macroBarFill: { height: "100%", borderRadius: 999 },
  macroSub: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },

  vertBarChart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 130 },
  vertBarCol: { flex: 1, alignItems: "center", gap: 2 },
  vertBarVal: { fontFamily: fonts.regular, fontSize: 9, color: colors.muted },
  vertBarTrack: { width: "80%", height: 90, justifyContent: "flex-end" },
  vertBarFill: { width: "100%", borderRadius: 4 },
  vertBarLabel: { fontFamily: fonts.medium, fontSize: 10, color: colors.muted },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 999 },

  sectionLabel: { fontFamily: fonts.medium, color: colors.ink, fontSize: 13 },
  analysisItem: { gap: 3 },
  analysisLabelRow: { flexDirection: "row", justifyContent: "space-between" },
  analysisName: { fontFamily: fonts.medium, color: colors.ink, fontSize: 13, flex: 1, marginRight: 8 },
  analysisVal: { fontFamily: fonts.bold, color: colors.ink, fontSize: 13 },
  analysisBarTrack: { height: 6, backgroundColor: colors.border, borderRadius: 999, overflow: "hidden" },
  analysisBarFill: { height: "100%", borderRadius: 999 },
  analysisSub: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },

  fastingClock: { fontFamily: fonts.bold, fontSize: 42, color: colors.accent, textAlign: "center" },
  fastBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "#10B981", backgroundColor: "#F0FFF4" },
  fastBtnStop: { borderColor: colors.danger, backgroundColor: colors.softDanger },
  fastBtnText: { fontFamily: fonts.medium, color: "#10B981", fontSize: 14 },

  bigValue: { fontFamily: fonts.bold, fontSize: 32, color: colors.accent },
  trendRow: { flexDirection: "row", gap: 20 },
  trendItem: { alignItems: "center", gap: 2 },
  trendValue: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  weightList: { gap: 6, marginTop: 4 },
  weightRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  weightDate: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, width: 60 },
  weightVal: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  muted: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12 },
});
