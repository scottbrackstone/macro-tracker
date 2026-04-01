import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import { fetchJson, ping } from "../api/client";
import CalorieRing from "../components/CalorieRing";
import MacroPie, { MACRO_COLORS } from "../components/MacroPie";
import ProgressBar from "../components/ProgressBar";
import { colors, fonts } from "../theme";

const MacroChip = ({ label, value, color }) => (
  <View style={{ backgroundColor: color + "22", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
    <Text style={{ fontFamily: fonts.medium, fontSize: 11, color }}>{label} {Math.round(value)}g</Text>
  </View>
);

const mealLabels = ["Breakfast", "Lunch", "Dinner", "Snack"];
const getMealLabel = (slot) =>
  mealLabels[slot - 1] ?? `Meal ${slot}`;
const fmt = (v) => Math.round(Number(v || 0));
const fmtMacro = (v) => Math.round(Number(v || 0));
const formatDateParam = (d) => d.toISOString().slice(0, 10);
const formatDayLabel = (d) => d.toLocaleDateString(undefined, { weekday: "short" });
const formatDayNumber = (d) => d.toLocaleDateString(undefined, { day: "numeric" });
const formatShortDate = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
const formatTime = (v) =>
  new Date(v).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

const buildDate = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
};
const buildTimestamp = (dateValue) => {
  const today = new Date();
  const sameDay = dateValue.toDateString() === today.toDateString();
  if (sameDay) return new Date().toISOString();
  const local = new Date(dateValue);
  local.setHours(12, 0, 0, 0);
  return local.toISOString();
};

function computeStreak(days) {
  let count = 0;
  const sorted = [...days].sort((a, b) => (a.date > b.date ? -1 : 1));
  for (const day of sorted) {
    if ((day.calories || 0) + (day.protein || 0) + (day.carbs || 0) + (day.fats || 0) === 0) break;
    count++;
  }
  return count;
}

const calendarDays = [-1, 0, 1, 2, 3, 4, 5, 6, 7];
const waterGoal = 2000;

export default function DashboardScreen() {
  const navigation = useNavigation();

  const [summary, setSummary] = useState({ calories: 0, protein: 0, carbs: 0, fats: 0 });
  const [targets, setTargets] = useState({ calories: 0, protein: 0, carbs: 0, fats: 0, meals_per_day: 3 });
  const [recents, setRecents] = useState([]);
  const [dailyLogs, setDailyLogs] = useState([]);
  const [weeklySummaries, setWeeklySummaries] = useState([]);
  const [waterLogs, setWaterLogs] = useState([]);
  const [exerciseLogs, setExerciseLogs] = useState([]);
  const [streak, setStreak] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [error, setError] = useState("");

  // collapse state per meal slot
  const [collapsedSlots, setCollapsedSlots] = useState({});

  // quick add
  const [quickAdd, setQuickAdd] = useState({ food_name: "", calories: "", protein: "", carbs: "", fats: "", meal_slot: 1 });
  const [quickAddBusy, setQuickAddBusy] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  // water
  const [waterInput, setWaterInput] = useState("");
  const [waterBusy, setWaterBusy] = useState(false);

  // exercise
  const [exerciseInput, setExerciseInput] = useState({ name: "", calories_burned: "", duration_minutes: "" });
  const [exerciseBusy, setExerciseBusy] = useState(false);
  const [showExercise, setShowExercise] = useState(false);

  // inline edit
  const [editingMeal, setEditingMeal] = useState(null);
  const [editDraft, setEditDraft] = useState({ food_name: "", grams: "100", base_calories: "", base_protein: "", base_carbs: "", base_fats: "" });
  const [editBusy, setEditBusy] = useState(false);

  const loadData = useCallback(async () => {
    try {
      await ping();
    } catch {
      setError("Cannot reach API");
      return;
    }
    try {
      const dateParam = formatDateParam(selectedDate);
      const weeklyStart = new Date();
      weeklyStart.setDate(weeklyStart.getDate() - 6);
      const weeklyParams = `start_date=${formatDateParam(weeklyStart)}&end_date=${formatDateParam(new Date())}`;
      const [sumRes, recentsRes, logsRes, targetsRes, weeklyRes, waterRes, exerciseRes] = await Promise.all([
        fetchJson(`/daily-summary?target_date=${dateParam}`),
        fetchJson("/recents"),
        fetchJson(`/daily-logs?target_date=${dateParam}`),
        fetchJson("/macro-target"),
        fetchJson(`/daily-summaries?${weeklyParams}`),
        fetchJson(`/water-logs?target_date=${dateParam}`),
        fetchJson(`/exercise-logs?target_date=${dateParam}`),
      ]);
      setSummary(sumRes);
      setRecents(recentsRes);
      setDailyLogs(logsRes);
      setTargets(targetsRes);
      setWeeklySummaries(weeklyRes);
      setWaterLogs(waterRes);
      setExerciseLogs(exerciseRes);
      setStreak(computeStreak(weeklyRes));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [selectedDate]);

  useEffect(() => { loadData(); }, [loadData]);
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // --- computed ---
  const exerciseBurned = useMemo(
    () => exerciseLogs.reduce((s, l) => s + (l.calories_burned || 0), 0),
    [exerciseLogs]
  );
  const totalFiber = useMemo(
    () => dailyLogs.reduce((s, l) => s + (l.fiber || 0), 0),
    [dailyLogs]
  );
  const netCarbs = Math.max(0, fmt(summary.carbs) - fmt(totalFiber));
  const waterTotal = useMemo(
    () => waterLogs.reduce((s, l) => s + (l.amount_ml || 0), 0),
    [waterLogs]
  );
  const waterProgress = Math.min(waterTotal / waterGoal, 1);

  const mealsPerDay = Math.max(1, targets.meals_per_day || 3);
  const mealSlots = useMemo(() => Array.from({ length: mealsPerDay }, (_, i) => i + 1), [mealsPerDay]);

  const groupedMeals = useMemo(() => {
    const groups = {};
    mealSlots.forEach((s) => { groups[s] = []; });
    dailyLogs.forEach((log) => {
      const s = log.meal_slot || 1;
      if (!groups[s]) groups[s] = [];
      groups[s].push(log);
    });
    return groups;
  }, [dailyLogs, mealSlots]);

  const mealTotals = useMemo(() => {
    const totals = {};
    mealSlots.forEach((s) => { totals[s] = { calories: 0, protein: 0, carbs: 0, fats: 0 }; });
    dailyLogs.forEach((log) => {
      const s = log.meal_slot || 1;
      if (!totals[s]) totals[s] = { calories: 0, protein: 0, carbs: 0, fats: 0 };
      totals[s].calories += log.calories || 0;
      totals[s].protein += log.protein || 0;
      totals[s].carbs += log.carbs || 0;
      totals[s].fats += log.fats || 0;
    });
    return totals;
  }, [dailyLogs, mealSlots]);

  const maxWeeklyCalories = Math.max(1, ...weeklySummaries.map((d) => d.calories || 0));

  const adherence = useMemo(() => {
    if (!weeklySummaries.length || !targets.calories) return { percent: 0, hits: 0 };
    const lower = targets.calories * 0.9;
    const upper = targets.calories * 1.1;
    const hits = weeklySummaries.filter((d) => (d.calories || 0) >= lower && (d.calories || 0) <= upper).length;
    return { percent: Math.round((hits / weeklySummaries.length) * 100), hits };
  }, [weeklySummaries, targets.calories]);

  // --- handlers ---
  const toggleCollapse = (slot) =>
    setCollapsedSlots((prev) => ({ ...prev, [slot]: !prev[slot] }));

  const handleDelete = async (logId) => {
    try { await fetchJson(`/log-meal/${logId}`, { method: "DELETE" }); loadData(); }
    catch (err) { setError(err.message); }
  };

  const handleCopyMeal = async (meal) => {
    if (!meal) return;
    try {
      await fetchJson("/log-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          food_name: meal.food_name, source: "Copy",
          calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fats: meal.fats,
          grams: meal.grams ?? 100,
          base_calories: meal.base_calories ?? meal.calories ?? 0,
          base_protein: meal.base_protein ?? meal.protein ?? 0,
          base_carbs: meal.base_carbs ?? meal.carbs ?? 0,
          base_fats: meal.base_fats ?? meal.fats ?? 0,
          meal_slot: meal.meal_slot || 1,
          timestamp: buildTimestamp(selectedDate),
        }),
      });
      loadData();
    } catch (err) { setError(err.message); }
  };

  const handleCopyYesterday = async () => {
    try {
      const from = new Date(selectedDate);
      from.setDate(selectedDate.getDate() - 1);
      const logs = await fetchJson(`/daily-logs?target_date=${formatDateParam(from)}`);
      if (!logs.length) { setError("No meals found for yesterday."); return; }
      await Promise.all(logs.map((log) =>
        fetchJson("/log-meal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            food_name: log.food_name, source: "Copy",
            calories: log.calories, protein: log.protein, carbs: log.carbs, fats: log.fats,
            grams: log.grams ?? 100,
            base_calories: log.base_calories ?? log.calories ?? 0,
            base_protein: log.base_protein ?? log.protein ?? 0,
            base_carbs: log.base_carbs ?? log.carbs ?? 0,
            base_fats: log.base_fats ?? log.fats ?? 0,
            meal_slot: log.meal_slot || 1,
            timestamp: buildTimestamp(selectedDate),
          }),
        })
      ));
      loadData();
    } catch (err) { setError(err.message); }
  };

  const handleSaveTemplate = async (meal) => {
    if (!meal) return;
    try {
      await fetchJson("/custom-foods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: meal.food_name, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fats: meal.fats }),
      });
    } catch (err) { setError(err.message); }
  };

  const addWaterLog = async (amount) => {
    if (waterBusy) return;
    const v = Math.round(Number(amount) || 0);
    if (!v) return;
    setWaterBusy(true);
    try {
      await fetchJson("/water-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_ml: v, timestamp: buildTimestamp(selectedDate) }),
      });
      setWaterInput("");
      loadData();
    } catch (err) { setError(err.message); }
    finally { setWaterBusy(false); }
  };

  const deleteWaterLog = async (id) => {
    try { await fetchJson(`/water-logs/${id}`, { method: "DELETE" }); loadData(); }
    catch (err) { setError(err.message); }
  };

  const handleAddExercise = async () => {
    if (exerciseBusy) return;
    const cals = Math.round(Number(exerciseInput.calories_burned) || 0);
    if (!exerciseInput.name.trim() && !cals) return;
    setExerciseBusy(true);
    try {
      await fetchJson("/exercise-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: exerciseInput.name.trim() || "Exercise",
          calories_burned: cals,
          duration_minutes: Number(exerciseInput.duration_minutes) || null,
          timestamp: buildTimestamp(selectedDate),
        }),
      });
      setExerciseInput({ name: "", calories_burned: "", duration_minutes: "" });
      loadData();
    } catch (err) { setError(err.message); }
    finally { setExerciseBusy(false); }
  };

  const deleteExercise = async (id) => {
    try { await fetchJson(`/exercise-logs/${id}`, { method: "DELETE" }); loadData(); }
    catch (err) { setError(err.message); }
  };

  const handleQuickAdd = async () => {
    if (quickAddBusy) return;
    const calories = Math.round(Number(quickAdd.calories) || 0);
    const protein = Number(quickAdd.protein) || 0;
    const carbs = Number(quickAdd.carbs) || 0;
    const fats = Number(quickAdd.fats) || 0;
    if (!quickAdd.food_name.trim() && calories + protein + carbs + fats === 0) {
      setError("Add a name or macros.");
      return;
    }
    setQuickAddBusy(true);
    try {
      await fetchJson("/log-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          food_name: quickAdd.food_name.trim() || "Quick add",
          source: "Quick", calories, protein, carbs, fats,
          grams: 100, base_calories: calories, base_protein: protein, base_carbs: carbs, base_fats: fats,
          meal_slot: quickAdd.meal_slot || 1,
          timestamp: buildTimestamp(selectedDate),
        }),
      });
      setQuickAdd({ food_name: "", calories: "", protein: "", carbs: "", fats: "", meal_slot: quickAdd.meal_slot || 1 });
      setShowQuickAdd(false);
      loadData();
    } catch (err) { setError(err.message); }
    finally { setQuickAddBusy(false); }
  };

  const startEdit = (meal) => {
    if (!meal) return;
    setEditingMeal(meal.id);
    setEditDraft({
      food_name: meal.food_name || "",
      grams: String(meal.grams ?? 100),
      base_calories: String(meal.base_calories ?? meal.calories ?? 0),
      base_protein: String(meal.base_protein ?? meal.protein ?? 0),
      base_carbs: String(meal.base_carbs ?? meal.carbs ?? 0),
      base_fats: String(meal.base_fats ?? meal.fats ?? 0),
    });
  };

  const cancelEdit = () => {
    setEditingMeal(null);
    setEditDraft({ food_name: "", grams: "100", base_calories: "", base_protein: "", base_carbs: "", base_fats: "" });
  };

  const saveEdit = async (meal) => {
    if (editBusy || !meal) return;
    setEditBusy(true);
    try {
      const grams = Number(editDraft.grams) || 100;
      const factor = grams / 100;
      const bc = Number(editDraft.base_calories) || 0;
      const bp = Number(editDraft.base_protein) || 0;
      const bca = Number(editDraft.base_carbs) || 0;
      const bf = Number(editDraft.base_fats) || 0;
      await fetchJson(`/log-meal/${meal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          food_name: editDraft.food_name.trim() || meal.food_name,
          source: meal.source, meal_slot: meal.meal_slot || 1,
          timestamp: meal.timestamp,
          calories: Math.round(bc * factor), protein: bp * factor,
          carbs: bca * factor, fats: bf * factor,
          grams, base_calories: Math.round(bc), base_protein: bp, base_carbs: bca, base_fats: bf,
        }),
      });
      cancelEdit();
      loadData();
    } catch (err) { setError(err.message); }
    finally { setEditBusy(false); }
  };

  // --- sub-renders ---
  const renderEditFields = (meal) => (
    <View style={styles.editCard}>
      <View style={styles.field}>
        <Text style={styles.label}>Food name</Text>
        <TextInput value={editDraft.food_name} onChangeText={(v) => setEditDraft((p) => ({ ...p, food_name: v }))}
          placeholder="Food name" placeholderTextColor={colors.muted} style={styles.input} />
      </View>
      <Text style={styles.muted}>Per 100g: {fmtMacro(editDraft.base_calories)} kcal · P {fmtMacro(editDraft.base_protein)}g · C {fmtMacro(editDraft.base_carbs)}g · F {fmtMacro(editDraft.base_fats)}g</Text>
      <View style={styles.field}>
        <Text style={styles.label}>Grams</Text>
        <TextInput value={editDraft.grams} onChangeText={(v) => setEditDraft((p) => ({ ...p, grams: v }))}
          placeholder="100" placeholderTextColor={colors.muted} keyboardType="numeric" style={styles.input} />
      </View>
      {(() => {
        const f = (Number(editDraft.grams) || 100) / 100;
        return <Text style={styles.muted}>Total: {fmtMacro(Number(editDraft.base_calories) * f)} kcal · P {fmtMacro(Number(editDraft.base_protein) * f)}g · C {fmtMacro(Number(editDraft.base_carbs) * f)}g · F {fmtMacro(Number(editDraft.base_fats) * f)}g</Text>;
      })()}
      <View style={styles.editActions}>
        <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]} onPress={cancelEdit} android_ripple={{ color: colors.softAccent }}>
          <Text style={styles.secondaryText}>Cancel</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]} onPress={() => saveEdit(meal)} disabled={editBusy} android_ripple={{ color: colors.softAccent }}>
          <Text style={styles.addButtonText}>{editBusy ? "Saving..." : "Save"}</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderMealItem = (meal) => (
    <View key={meal.id} style={[styles.logItem, editingMeal === meal.id && styles.logItemEditing]}>
      {editingMeal === meal.id ? renderEditFields(meal) : (
        <>
          <Pressable style={styles.logInfo} onPress={() => startEdit(meal)} android_ripple={{ color: colors.softAccent }}>
            <View style={styles.logTopRow}>
              <Text style={styles.recentName} numberOfLines={1}>{meal.food_name}</Text>
              <Text style={styles.logCalories}>{fmt(meal.calories)} kcal</Text>
            </View>
            <View style={styles.macroChipsRow}>
              <MacroChip label="P" value={meal.protein} color={MACRO_COLORS.protein} />
              <MacroChip label="C" value={meal.carbs} color={MACRO_COLORS.carbs} />
              <MacroChip label="F" value={meal.fats} color={MACRO_COLORS.fats} />
              {meal.fiber > 0 && <MacroChip label="Fiber" value={meal.fiber} color="#6B7280" />}
            </View>
          </Pressable>
          <View style={styles.logActions}>
            <Pressable style={styles.iconBtn} onPress={() => handleCopyMeal(meal)} android_ripple={{ color: colors.softAccent }}>
              <Ionicons name="copy-outline" size={16} color={colors.muted} />
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={() => handleSaveTemplate(meal)} android_ripple={{ color: colors.softAccent }}>
              <Ionicons name="bookmark-outline" size={16} color={colors.muted} />
            </Pressable>
            <Pressable style={styles.iconBtnDanger} onPress={() => handleDelete(meal.id)} android_ripple={{ color: colors.softDanger }}>
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
            </Pressable>
          </View>
        </>
      )}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

      {/* ── Header: date + streak ── */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.greeting}>Today</Text>
          <Text style={styles.dateLabel}>{selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</Text>
        </View>
        {streak > 0 && (
          <View style={styles.streakBadge}>
            <Ionicons name="flame" size={14} color="#F59E0B" />
            <Text style={styles.streakText}>{streak} day streak</Text>
          </View>
        )}
      </View>

      {/* ── Date strip ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.calendarScroll} contentContainerStyle={styles.calendarRow}>
        {calendarDays.map((offset) => {
          const day = buildDate(offset);
          const isSelected = formatDateParam(day) === formatDateParam(selectedDate);
          return (
            <Pressable key={offset} style={[styles.calendarItem, isSelected && styles.calendarItemActive]} onPress={() => setSelectedDate(day)}>
              <Text style={[styles.calendarLabel, isSelected && styles.calendarLabelActive]}>{formatDayLabel(day)}</Text>
              <Text style={[styles.calendarNumber, isSelected && styles.calendarNumberActive]}>{formatDayNumber(day)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* ── Hero: Calorie Ring + Macro Pie ── */}
      <View style={styles.heroCard}>
        <View style={styles.heroContent}>
          <CalorieRing consumed={summary.calories} goal={targets.calories || 0} exerciseBurned={exerciseBurned} />
          <MacroPie protein={summary.protein} carbs={summary.carbs} fats={summary.fats} targets={targets} />
        </View>
        {totalFiber > 0 && (
          <View style={styles.netCarbsBadge}>
            <Text style={styles.netCarbsText}>Net Carbs: {netCarbs}g  ·  Fiber: {fmt(totalFiber)}g</Text>
          </View>
        )}
        <View style={styles.calorieBreakdownRow}>
          <View style={styles.calorieBreakdownItem}>
            <Text style={styles.breakdownValue}>{fmt(summary.calories)}</Text>
            <Text style={styles.breakdownLabel}>Food</Text>
          </View>
          <Text style={styles.breakdownSep}>−</Text>
          <View style={styles.calorieBreakdownItem}>
            <Text style={[styles.breakdownValue, { color: "#10B981" }]}>{fmt(exerciseBurned)}</Text>
            <Text style={styles.breakdownLabel}>Exercise</Text>
          </View>
          <Text style={styles.breakdownSep}>=</Text>
          <View style={styles.calorieBreakdownItem}>
            <Text style={styles.breakdownValue}>{fmt(Math.max(0, targets.calories - summary.calories + exerciseBurned))}</Text>
            <Text style={styles.breakdownLabel}>Remaining</Text>
          </View>
          <Text style={styles.breakdownSep}>·</Text>
          <View style={styles.calorieBreakdownItem}>
            <Text style={styles.breakdownValue}>{fmt(targets.calories)}</Text>
            <Text style={styles.breakdownLabel}>Goal</Text>
          </View>
        </View>
      </View>

      {/* ── Healthy Habits: Water + Exercise ── */}
      <View style={styles.habitsRow}>
        {/* Water */}
        <View style={styles.habitCard}>
          <View style={styles.habitHeader}>
            <Ionicons name="water" size={16} color={colors.accent} />
            <Text style={styles.habitTitle}>Water</Text>
            <Text style={styles.habitValue}>{waterTotal}ml</Text>
          </View>
          <View style={styles.habitBarTrack}>
            <View style={[styles.habitBarFill, { width: `${waterProgress * 100}%` }]} />
          </View>
          <Text style={styles.habitSub}>{waterGoal - waterTotal > 0 ? `${waterGoal - waterTotal}ml remaining` : "Goal reached!"}</Text>
          <View style={styles.habitChips}>
            {[250, 500, 750].map((a) => (
              <Pressable key={a} style={styles.chip} onPress={() => addWaterLog(a)} android_ripple={{ color: colors.softAccent }}>
                <Text style={styles.chipText}>+{a}</Text>
              </Pressable>
            ))}
            <View style={styles.waterCustomRow}>
              <TextInput value={waterInput} onChangeText={setWaterInput} placeholder="ml" placeholderTextColor={colors.muted}
                keyboardType="numeric" style={styles.waterInput} />
              <Pressable style={styles.chip} onPress={() => addWaterLog(waterInput)} disabled={waterBusy} android_ripple={{ color: colors.softAccent }}>
                <Text style={styles.chipText}>+</Text>
              </Pressable>
            </View>
          </View>
          {waterLogs.slice(0, 2).map((log) => (
            <View key={log.id} style={styles.habitLogRow}>
              <Text style={styles.muted}>{formatTime(log.timestamp)} · {log.amount_ml}ml</Text>
              <Pressable onPress={() => deleteWaterLog(log.id)}><Ionicons name="close" size={14} color={colors.muted} /></Pressable>
            </View>
          ))}
        </View>

        {/* Exercise */}
        <View style={styles.habitCard}>
          <View style={styles.habitHeader}>
            <Ionicons name="fitness" size={16} color="#10B981" />
            <Text style={styles.habitTitle}>Exercise</Text>
            <Text style={[styles.habitValue, { color: "#10B981" }]}>+{fmt(exerciseBurned)} kcal</Text>
          </View>
          <Pressable style={styles.habitAddBtn} onPress={() => setShowExercise((v) => !v)} android_ripple={{ color: colors.softAccent }}>
            <Ionicons name={showExercise ? "chevron-up" : "add"} size={14} color={colors.accent} />
            <Text style={styles.habitAddText}>{showExercise ? "Close" : "Log exercise"}</Text>
          </Pressable>
          {showExercise && (
            <View style={styles.exerciseForm}>
              <TextInput value={exerciseInput.name} onChangeText={(v) => setExerciseInput((p) => ({ ...p, name: v }))}
                placeholder="Exercise name" placeholderTextColor={colors.muted} style={styles.input} />
              <View style={styles.row}>
                <TextInput value={exerciseInput.calories_burned} onChangeText={(v) => setExerciseInput((p) => ({ ...p, calories_burned: v }))}
                  placeholder="kcal burned" placeholderTextColor={colors.muted} keyboardType="numeric" style={[styles.input, styles.halfInput]} />
                <TextInput value={exerciseInput.duration_minutes} onChangeText={(v) => setExerciseInput((p) => ({ ...p, duration_minutes: v }))}
                  placeholder="min" placeholderTextColor={colors.muted} keyboardType="numeric" style={[styles.input, styles.halfInput]} />
              </View>
              <Pressable style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]} onPress={handleAddExercise} disabled={exerciseBusy} android_ripple={{ color: colors.softAccent }}>
                <Text style={styles.addButtonText}>{exerciseBusy ? "Saving..." : "Add"}</Text>
              </Pressable>
            </View>
          )}
          {exerciseLogs.map((log) => (
            <View key={log.id} style={styles.habitLogRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.exerciseName}>{log.name}</Text>
                <Text style={styles.muted}>{log.calories_burned} kcal{log.duration_minutes ? ` · ${log.duration_minutes} min` : ""}</Text>
              </View>
              <Pressable onPress={() => deleteExercise(log.id)}><Ionicons name="close" size={14} color={colors.muted} /></Pressable>
            </View>
          ))}
          {exerciseLogs.length === 0 && !showExercise && <Text style={styles.muted}>No exercise logged</Text>}
        </View>
      </View>

      {/* ── Food Diary ── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Food Diary</Text>
        <View style={styles.diaryActions}>
          <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]} onPress={handleCopyYesterday} android_ripple={{ color: colors.softAccent }}>
            <Text style={styles.secondaryText}>Copy yesterday</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]} onPress={() => setShowQuickAdd((v) => !v)} android_ripple={{ color: colors.softAccent }}>
            <Text style={styles.addButtonText}>Quick add</Text>
          </Pressable>
        </View>
      </View>

      {showQuickAdd && (
        <View style={styles.quickAddCard}>
          <TextInput value={quickAdd.food_name} onChangeText={(v) => setQuickAdd((p) => ({ ...p, food_name: v }))}
            placeholder="Food name (optional)" placeholderTextColor={colors.muted} style={styles.input} />
          <View style={styles.row}>
            <TextInput value={quickAdd.calories} onChangeText={(v) => setQuickAdd((p) => ({ ...p, calories: v }))}
              placeholder="kcal" placeholderTextColor={colors.muted} keyboardType="numeric" style={[styles.input, styles.halfInput]} />
            <TextInput value={quickAdd.protein} onChangeText={(v) => setQuickAdd((p) => ({ ...p, protein: v }))}
              placeholder="Protein g" placeholderTextColor={colors.muted} keyboardType="numeric" style={[styles.input, styles.halfInput]} />
          </View>
          <View style={styles.row}>
            <TextInput value={quickAdd.carbs} onChangeText={(v) => setQuickAdd((p) => ({ ...p, carbs: v }))}
              placeholder="Carbs g" placeholderTextColor={colors.muted} keyboardType="numeric" style={[styles.input, styles.halfInput]} />
            <TextInput value={quickAdd.fats} onChangeText={(v) => setQuickAdd((p) => ({ ...p, fats: v }))}
              placeholder="Fats g" placeholderTextColor={colors.muted} keyboardType="numeric" style={[styles.input, styles.halfInput]} />
          </View>
          <View style={styles.chipRow}>
            {mealSlots.map((slot) => (
              <Pressable key={slot} style={[styles.chip, quickAdd.meal_slot === slot && styles.chipActive]} onPress={() => setQuickAdd((p) => ({ ...p, meal_slot: slot }))} android_ripple={{ color: colors.softAccent }}>
                <Text style={styles.chipText}>{getMealLabel(slot)}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]} onPress={handleQuickAdd} disabled={quickAddBusy} android_ripple={{ color: colors.softAccent }}>
            <Text style={styles.addButtonText}>{quickAddBusy ? "Saving..." : "Log"}</Text>
          </Pressable>
        </View>
      )}

      {mealSlots.map((slot) => {
        const collapsed = collapsedSlots[slot];
        const slotTotal = mealTotals[slot] || { calories: 0, protein: 0, carbs: 0, fats: 0 };
        const items = groupedMeals[slot] || [];
        return (
          <View key={slot} style={styles.mealBlock}>
            <Pressable style={styles.mealHeader} onPress={() => toggleCollapse(slot)} android_ripple={{ color: colors.softAccent }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.mealTitle}>{getMealLabel(slot)}</Text>
                <Text style={styles.mealMeta}>{fmt(slotTotal.calories)} kcal · P {fmtMacro(slotTotal.protein)}g · C {fmtMacro(slotTotal.carbs)}g · F {fmtMacro(slotTotal.fats)}g</Text>
              </View>
              <View style={styles.mealHeaderRight}>
                <Pressable style={({ pressed }) => [styles.logBtn, pressed && styles.addButtonPressed]}
                  onPress={() => navigation.navigate("Scanner", { mealSlot: slot, manualOnly: true })}
                  android_ripple={{ color: colors.softAccent }}>
                  <Ionicons name="add" size={14} color="#fff" />
                  <Text style={styles.logBtnText}>Log</Text>
                </Pressable>
                <Ionicons name={collapsed ? "chevron-down" : "chevron-up"} size={16} color={colors.muted} style={{ marginLeft: 6 }} />
              </View>
            </Pressable>
            {!collapsed && (
              items.length === 0
                ? <Text style={[styles.muted, { paddingVertical: 8 }]}>No items yet — tap Log to add food</Text>
                : items.map((meal) => renderMealItem(meal))
            )}
          </View>
        );
      })}

      {/* ── Weekly Digest ── */}
      <Text style={styles.sectionTitle}>Weekly Digest</Text>
      <View style={styles.weeklyCard}>
        <View style={styles.weeklyStats}>
          <View style={styles.weeklyStatItem}>
            <Text style={styles.weeklyStatValue}>{adherence.percent}%</Text>
            <Text style={styles.weeklyStatLabel}>On target</Text>
          </View>
          <View style={styles.weeklyStatItem}>
            <Text style={styles.weeklyStatValue}>{streak}</Text>
            <Text style={styles.weeklyStatLabel}>Day streak</Text>
          </View>
          <View style={styles.weeklyStatItem}>
            <Text style={styles.weeklyStatValue}>{fmt(weeklySummaries.reduce((s, d) => s + (d.calories || 0), 0) / (weeklySummaries.length || 1))}</Text>
            <Text style={styles.weeklyStatLabel}>Avg kcal</Text>
          </View>
        </View>
        <View style={styles.barChart}>
          {weeklySummaries.map((day) => {
            const height = Math.max(4, (day.calories / maxWeeklyCalories) * 100);
            const isOnTarget = targets.calories && day.calories >= targets.calories * 0.9 && day.calories <= targets.calories * 1.1;
            return (
              <View key={day.date} style={styles.barColumn}>
                <Text style={styles.barValue}>{day.calories > 0 ? fmt(day.calories) : ""}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: `${height}%`, backgroundColor: isOnTarget ? "#10B981" : colors.accent }]} />
                </View>
                <Text style={styles.barLabel}>{formatShortDate(new Date(day.date)).split(" ")[0]}</Text>
              </View>
            );
          })}
        </View>
        {targets.calories > 0 && (
          <Text style={styles.muted}>Goal: {fmt(targets.calories)} kcal/day · Green = on target</Text>
        )}
      </View>

      {/* ── Recent Meals ── */}
      <Text style={styles.sectionTitle}>Recent Meals</Text>
      {recents.length === 0 ? (
        <Text style={styles.muted}>No meals logged yet.</Text>
      ) : (
        <View style={styles.recentCard}>
          {recents.map((meal) => (
            <View key={meal.food_name} style={styles.recentItem}>
              <View style={styles.logInfo}>
                <Text style={styles.recentName}>{meal.food_name}</Text>
                <Text style={styles.recentMeta}>{fmt(meal.calories)} kcal · P {fmtMacro(meal.protein)}g · C {fmtMacro(meal.carbs)}g · F {fmtMacro(meal.fats)}g</Text>
              </View>
              <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
                onPress={() => navigation.navigate("Scanner", { manualOnly: true, prefill: { food_name: meal.food_name, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fats: meal.fats } })}
                android_ripple={{ color: colors.softAccent }}>
                <Text style={styles.secondaryText}>Add</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, backgroundColor: colors.background },

  // header
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  greeting: { fontFamily: fonts.bold, fontSize: 26, color: colors.ink },
  dateLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  streakBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FEF3C7", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  streakText: { fontFamily: fonts.medium, fontSize: 12, color: "#92400E" },

  // calendar
  calendarScroll: { marginBottom: 16 },
  calendarRow: { flexDirection: "row", gap: 6, paddingRight: 16 },
  calendarItem: { alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, minWidth: 44, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  calendarItemActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  calendarLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  calendarLabelActive: { color: "#fff" },
  calendarNumber: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  calendarNumberActive: { color: "#fff" },

  errorText: { color: colors.danger, fontFamily: fonts.regular, marginBottom: 8 },

  // hero
  heroCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  heroContent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  netCarbsBadge: { backgroundColor: "#F0FFF4", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, alignSelf: "center", marginTop: 10 },
  netCarbsText: { fontFamily: fonts.medium, fontSize: 12, color: "#065F46" },
  calorieBreakdownRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  calorieBreakdownItem: { alignItems: "center" },
  breakdownLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  breakdownValue: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  breakdownSep: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14 },

  // habits
  habitsRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  habitCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.border, gap: 6 },
  habitHeader: { flexDirection: "row", alignItems: "center", gap: 5 },
  habitTitle: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink, flex: 1 },
  habitValue: { fontFamily: fonts.bold, fontSize: 12, color: colors.accent },
  habitBarTrack: { height: 6, backgroundColor: colors.border, borderRadius: 999, overflow: "hidden" },
  habitBarFill: { height: "100%", backgroundColor: colors.accent, borderRadius: 999 },
  habitSub: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  habitChips: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  habitLogRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  habitAddBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
  habitAddText: { fontFamily: fonts.medium, fontSize: 12, color: colors.accent },
  waterCustomRow: { flexDirection: "row", gap: 4, alignItems: "center" },
  waterInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, width: 50, fontFamily: fonts.regular, color: colors.ink, fontSize: 12 },
  exerciseForm: { gap: 6 },
  exerciseName: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink },

  // section
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink, marginBottom: 8, marginTop: 4 },
  diaryActions: { flexDirection: "row", gap: 8, alignItems: "center" },

  // quick add
  quickAddCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 8, marginBottom: 12 },

  // meal blocks
  mealBlock: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 10, overflow: "hidden" },
  mealHeader: { flexDirection: "row", alignItems: "center", padding: 14 },
  mealHeaderRight: { flexDirection: "row", alignItems: "center" },
  mealTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  mealMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  logBtn: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  logBtnText: { fontFamily: fonts.medium, fontSize: 12, color: "#fff" },
  logItem: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  logItemEditing: { flexDirection: "column", alignItems: "stretch" },
  logInfo: { flex: 1 },
  logTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  logCalories: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  macroChipsRow: { flexDirection: "row", gap: 5, flexWrap: "wrap" },
  logActions: { flexDirection: "row", gap: 4 },
  logSource: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 2 },
  iconBtn: { padding: 6, borderRadius: 8, backgroundColor: colors.background },
  iconBtnDanger: { padding: 6, borderRadius: 8, backgroundColor: colors.softDanger },
  editCard: { gap: 8, padding: 2 },
  editActions: { flexDirection: "row", gap: 8 },

  // weekly digest
  weeklyCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 14, marginBottom: 4 },
  weeklyStats: { flexDirection: "row", justifyContent: "space-around" },
  weeklyStatItem: { alignItems: "center" },
  weeklyStatValue: { fontFamily: fonts.bold, fontSize: 22, color: colors.ink },
  weeklyStatLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 2 },
  barChart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 120 },
  barColumn: { flex: 1, alignItems: "center", gap: 3 },
  barValue: { fontFamily: fonts.regular, fontSize: 9, color: colors.muted },
  barTrack: { width: "70%", height: 80, justifyContent: "flex-end" },
  barFill: { width: "100%", borderRadius: 4 },
  barLabel: { fontFamily: fonts.medium, fontSize: 10, color: colors.muted },

  // recents
  recentCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden", marginBottom: 8 },
  recentItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  recentName: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  recentMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 1 },

  // shared
  row: { flexDirection: "row", gap: 8 },
  field: { flex: 1, gap: 4 },
  label: { fontSize: 12, fontFamily: fonts.medium, color: colors.muted },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.surface, fontFamily: fonts.regular, color: colors.ink },
  halfInput: { flex: 1 },
  muted: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.softAccent, borderColor: colors.accent },
  chipText: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink },
  addButton: { backgroundColor: colors.accent, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, alignItems: "center", shadowColor: colors.accent, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  addButtonPressed: { opacity: 0.85 },
  addButtonText: { color: "#fff", fontFamily: fonts.medium, fontSize: 13 },
  secondaryButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, alignItems: "center" },
  secondaryButtonPressed: { backgroundColor: colors.softAccent },
  secondaryText: { color: colors.ink, fontFamily: fonts.medium, fontSize: 12 },
});
