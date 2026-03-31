import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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
  const [waterLogs, setWaterLogs] = useState([]);
  const [waterInput, setWaterInput] = useState("");
  const [waterBusy, setWaterBusy] = useState(false);
  const [viewMode, setViewMode] = useState("meal");
  const [quickAdd, setQuickAdd] = useState({
    food_name: "",
    calories: "",
    protein: "",
    carbs: "",
    fats: "",
    meal_slot: 1,
  });
  const [quickAddBusy, setQuickAddBusy] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);
  const [editDraft, setEditDraft] = useState({
    food_name: "",
    grams: "100",
    base_calories: "",
    base_protein: "",
    base_carbs: "",
    base_fats: "",
  });
  const [editBusy, setEditBusy] = useState(false);
  const navigation = useNavigation();

  const calendarDays = [-1, 0, 1, 2, 3, 4, 5, 6, 7];
  const mealLabels = ["Breakfast", "Lunch", "Dinner", "Snack"];
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
  const formatNumber = (value) => Number(value || 0).toFixed(1);
  const formatTime = (value) =>
    new Date(value).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  const getMealLabel = (slot) =>
    mealLabels[slot - 1] ? mealLabels[slot - 1] : `Meal ${slot}`;
  const buildTimestamp = (dateValue) => {
    const today = new Date();
    const sameDay =
      dateValue.toDateString() === today.toDateString();
    if (sameDay) return new Date().toISOString();
    const local = new Date(dateValue);
    local.setHours(12, 0, 0, 0);
    return local.toISOString();
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
      const today = new Date();
      const weeklyStart = new Date(today);
      weeklyStart.setDate(today.getDate() - 6);
      const weeklyParams = `start_date=${formatDateParam(
        weeklyStart
      )}&end_date=${formatDateParam(today)}`;
      const [summaryResponse, recentsResponse, logsResponse, targetsResponse, weeklyResponse, waterResponse] =
        await Promise.all([
        fetchJson(`/daily-summary?target_date=${dateParam}`),
        fetchJson("/recents"),
        fetchJson(`/daily-logs?target_date=${dateParam}`),
        fetchJson("/macro-target"),
        fetchJson(`/daily-summaries?${weeklyParams}`),
        fetchJson(`/water-logs?target_date=${dateParam}`),
      ]);
      setSummary(summaryResponse);
      setRecents(recentsResponse);
      setDailyLogs(logsResponse);
      setTargets(targetsResponse);
      setWeeklySummaries(weeklyResponse);
      setWaterLogs(waterResponse);
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

  const handleCopyMeal = async (meal) => {
    if (!meal) return;
    try {
      const baseCalories = meal.base_calories ?? meal.calories ?? 0;
      const baseProtein = meal.base_protein ?? meal.protein ?? 0;
      const baseCarbs = meal.base_carbs ?? meal.carbs ?? 0;
      const baseFats = meal.base_fats ?? meal.fats ?? 0;
      const gramsValue = meal.grams ?? 100;
      await fetchJson("/log-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          food_name: meal.food_name,
          source: "Copy",
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fats: meal.fats,
          grams: gramsValue,
          base_calories: baseCalories,
          base_protein: baseProtein,
          base_carbs: baseCarbs,
          base_fats: baseFats,
          meal_slot: meal.meal_slot || 1,
          timestamp: buildTimestamp(selectedDate),
        }),
      });
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCopyYesterday = async () => {
    try {
      const fromDate = new Date(selectedDate);
      fromDate.setDate(selectedDate.getDate() - 1);
      const dateParam = formatDateParam(fromDate);
      const logs = await fetchJson(`/daily-logs?target_date=${dateParam}`);
      if (!logs.length) {
        setError("No meals found for yesterday.");
        return;
      }
      await Promise.all(
        logs.map((log) =>
          fetchJson("/log-meal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              food_name: log.food_name,
              source: "Copy",
              calories: log.calories,
              protein: log.protein,
              carbs: log.carbs,
              fats: log.fats,
              grams: log.grams ?? 100,
              base_calories: log.base_calories ?? log.calories ?? 0,
              base_protein: log.base_protein ?? log.protein ?? 0,
              base_carbs: log.base_carbs ?? log.carbs ?? 0,
              base_fats: log.base_fats ?? log.fats ?? 0,
              meal_slot: log.meal_slot || 1,
              timestamp: buildTimestamp(selectedDate),
            }),
          })
        )
      );
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSaveTemplate = async (meal) => {
    if (!meal) return;
    try {
      await fetchJson("/custom-foods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: meal.food_name,
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fats: meal.fats,
        }),
      });
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };

  const waterTotal = useMemo(
    () =>
      waterLogs.reduce((total, log) => total + (log.amount_ml || 0), 0),
    [waterLogs]
  );
  const waterGoal = 2000;
  const waterProgress = Math.min(waterTotal / waterGoal, 1);

  const addWaterLog = async (amount) => {
    if (waterBusy) return;
    const amountValue = Math.round(Number(amount) || 0);
    if (!amountValue) return;
    setWaterBusy(true);
    try {
      await fetchJson("/water-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_ml: amountValue,
          timestamp: buildTimestamp(selectedDate),
        }),
      });
      setWaterInput("");
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setWaterBusy(false);
    }
  };

  const deleteWaterLog = async (logId) => {
    try {
      await fetchJson(`/water-logs/${logId}`, { method: "DELETE" });
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const startEdit = (meal) => {
    if (!meal) return;
    const baseCalories = meal.base_calories ?? meal.calories ?? 0;
    const baseProtein = meal.base_protein ?? meal.protein ?? 0;
    const baseCarbs = meal.base_carbs ?? meal.carbs ?? 0;
    const baseFats = meal.base_fats ?? meal.fats ?? 0;
    const gramsValue = meal.grams ?? 100;
    setEditingMeal(meal.id);
    setEditDraft({
      food_name: meal.food_name || "",
      grams: String(gramsValue),
      base_calories: String(baseCalories),
      base_protein: String(baseProtein),
      base_carbs: String(baseCarbs),
      base_fats: String(baseFats),
    });
  };

  const cancelEdit = () => {
    setEditingMeal(null);
    setEditDraft({
      food_name: "",
      grams: "100",
      base_calories: "",
      base_protein: "",
      base_carbs: "",
      base_fats: "",
    });
  };

  const saveEdit = async (meal) => {
    if (editBusy || !meal) return;
    setEditBusy(true);
    try {
      const gramsValue = Number(editDraft.grams) || 100;
      const factor = gramsValue / 100;
      const baseCalories = Number(editDraft.base_calories) || 0;
      const baseProtein = Number(editDraft.base_protein) || 0;
      const baseCarbs = Number(editDraft.base_carbs) || 0;
      const baseFats = Number(editDraft.base_fats) || 0;
      await fetchJson(`/log-meal/${meal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          food_name: editDraft.food_name.trim() || meal.food_name,
          source: meal.source,
          meal_slot: meal.meal_slot || 1,
          timestamp: meal.timestamp,
          calories: Math.round(baseCalories * factor),
          protein: baseProtein * factor,
          carbs: baseCarbs * factor,
          fats: baseFats * factor,
          grams: gramsValue,
          base_calories: Math.round(baseCalories),
          base_protein: baseProtein,
          base_carbs: baseCarbs,
          base_fats: baseFats,
        }),
      });
      cancelEdit();
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setEditBusy(false);
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

  const timelineLogs = useMemo(
    () =>
      [...dailyLogs].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      ),
    [dailyLogs]
  );

  useEffect(() => {
    if (!mealSlots.includes(quickAdd.meal_slot)) {
      setQuickAdd((prev) => ({ ...prev, meal_slot: mealSlots[0] || 1 }));
    }
  }, [mealSlots, quickAdd.meal_slot]);

  const handleQuickAdd = async () => {
    if (quickAddBusy) return;
    const calories = Math.round(Number(quickAdd.calories) || 0);
    const protein = Number(quickAdd.protein) || 0;
    const carbs = Number(quickAdd.carbs) || 0;
    const fats = Number(quickAdd.fats) || 0;
    if (!quickAdd.food_name.trim() && calories + protein + carbs + fats === 0) {
      setError("Add a name or some macros to log.");
      return;
    }
    setQuickAddBusy(true);
    try {
      await fetchJson("/log-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          food_name: quickAdd.food_name.trim() || "Quick add",
          source: "Quick",
          calories,
          protein,
          carbs,
          fats,
          grams: 100,
          base_calories: calories,
          base_protein: protein,
          base_carbs: carbs,
          base_fats: fats,
          meal_slot: quickAdd.meal_slot || 1,
          timestamp: buildTimestamp(selectedDate),
        }),
      });
      setQuickAdd({
        food_name: "",
        calories: "",
        protein: "",
        carbs: "",
        fats: "",
        meal_slot: quickAdd.meal_slot || 1,
      });
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setQuickAddBusy(false);
    }
  };

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

  const mealCaloriesTarget =
    targets.calories && mealsPerDay ? targets.calories / mealsPerDay : 0;

  const macroSplit = useMemo(() => {
    const proteinCals = (summary.protein || 0) * 4;
    const carbCals = (summary.carbs || 0) * 4;
    const fatCals = (summary.fats || 0) * 9;
    const total = proteinCals + carbCals + fatCals;
    return {
      protein: proteinCals,
      carbs: carbCals,
      fats: fatCals,
      total: total || 1,
    };
  }, [summary]);

  const adherence = useMemo(() => {
    if (!weeklySummaries.length || !targets.calories) {
      return { percent: 0, hits: 0 };
    }
    const lower = targets.calories * 0.9;
    const upper = targets.calories * 1.1;
    const hits = weeklySummaries.filter(
      (day) => (day.calories || 0) >= lower && (day.calories || 0) <= upper
    ).length;
    return {
      percent: Math.round((hits / weeklySummaries.length) * 100),
      hits,
    };
  }, [weeklySummaries, targets.calories]);

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

  const renderEditFields = (meal) => (
    <View style={styles.editCard}>
      <View style={styles.field}>
        <Text style={styles.label}>Food name</Text>
        <TextInput
          value={editDraft.food_name}
          onChangeText={(value) =>
            setEditDraft((prev) => ({ ...prev, food_name: value }))
          }
          placeholder="Food name"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
      </View>
      <Text style={styles.muted}>
        Per 100g: {formatNumber(editDraft.base_calories)} kcal · P{" "}
        {formatNumber(editDraft.base_protein)}g · C{" "}
        {formatNumber(editDraft.base_carbs)}g · F{" "}
        {formatNumber(editDraft.base_fats)}g
      </Text>
      <View style={styles.field}>
        <Text style={styles.label}>Grams</Text>
        <TextInput
          value={editDraft.grams}
          onChangeText={(value) =>
            setEditDraft((prev) => ({ ...prev, grams: value }))
          }
          placeholder="100"
          placeholderTextColor={colors.muted}
          keyboardType="numeric"
          style={styles.input}
        />
      </View>
      {(() => {
        const gramsValue = Number(editDraft.grams) || 100;
        const factor = gramsValue / 100;
        const baseCalories = Number(editDraft.base_calories) || 0;
        const baseProtein = Number(editDraft.base_protein) || 0;
        const baseCarbs = Number(editDraft.base_carbs) || 0;
        const baseFats = Number(editDraft.base_fats) || 0;
        return (
          <Text style={styles.muted}>
            Totals: {formatNumber(baseCalories * factor)} kcal · P{" "}
            {formatNumber(baseProtein * factor)}g · C{" "}
            {formatNumber(baseCarbs * factor)}g · F{" "}
            {formatNumber(baseFats * factor)}g
          </Text>
        );
      })()}
      <View style={styles.editActions}>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.secondaryButtonPressed,
          ]}
          onPress={cancelEdit}
          android_ripple={{ color: colors.softAccent }}
        >
          <Text style={styles.secondaryText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.addButtonPressed,
          ]}
          onPress={() => saveEdit(meal)}
          disabled={editBusy}
          android_ripple={{ color: colors.softAccent }}
        >
          <Text style={styles.addButtonText}>
            {editBusy ? "Saving..." : "Save"}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Today</Text>
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

      <View style={styles.cardRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Streak</Text>
          <Text style={styles.statValue}>{streak} days</Text>
          <Text style={styles.muted}>Keep logging daily</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Adherence</Text>
          <Text style={styles.statValue}>{adherence.percent}%</Text>
          <Text style={styles.muted}>
            {adherence.hits}/{weeklySummaries.length} days
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Healthy Habits</Text>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Water</Text>
        <Text style={styles.streakBadge}>
          {waterTotal} / {waterGoal} ml
        </Text>
      </View>
      <View style={styles.waterCard}>
        <View style={styles.waterTrack}>
          <View style={[styles.waterFill, { width: `${waterProgress * 100}%` }]} />
        </View>
        <View style={styles.chipRow}>
          {[250, 500, 750].map((amount) => (
            <Pressable
              key={amount}
              style={styles.chip}
              onPress={() => addWaterLog(amount)}
              android_ripple={{ color: colors.softAccent }}
            >
              <Text style={styles.chipText}>+{amount} ml</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.row}>
          <TextInput
            value={waterInput}
            onChangeText={setWaterInput}
            placeholder="Custom ml"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            style={[styles.input, styles.halfInput]}
          />
          <Pressable
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.addButtonPressed,
            ]}
            onPress={() => addWaterLog(waterInput)}
            disabled={waterBusy}
            android_ripple={{ color: colors.softAccent }}
          >
            <Text style={styles.addButtonText}>
              {waterBusy ? "Adding..." : "Add"}
            </Text>
          </Pressable>
        </View>
        {waterLogs.length > 0 ? (
          waterLogs.slice(0, 3).map((log) => (
            <View key={log.id} style={styles.waterLogRow}>
              <Text style={styles.muted}>
                {formatTime(log.timestamp)} · {log.amount_ml} ml
              </Text>
              <Pressable
                style={styles.deleteButton}
                onPress={() => deleteWaterLog(log.id)}
                android_ripple={{ color: colors.softDanger }}
              >
                <Text style={styles.deleteText}>Remove</Text>
              </Pressable>
            </View>
          ))
        ) : (
          <Text style={styles.muted}>No water logged yet.</Text>
        )}
      </View>

      <View style={styles.habitRow}>
        <View style={styles.habitCard}>
          <Text style={styles.statLabel}>Steps</Text>
          <Text style={styles.statValue}>--</Text>
          <Text style={styles.muted}>Connect soon</Text>
        </View>
        <View style={styles.habitCard}>
          <Text style={styles.statLabel}>Exercise</Text>
          <Text style={styles.statValue}>0 min</Text>
          <Text style={styles.muted}>Log workouts</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Quick Add</Text>
        <Text style={styles.streakBadge}>Streak: {streak} days</Text>
      </View>
      <View style={styles.quickAddCard}>
        <View style={styles.field}>
          <Text style={styles.label}>Food name (optional)</Text>
          <TextInput
            value={quickAdd.food_name}
            onChangeText={(value) =>
              setQuickAdd((prev) => ({ ...prev, food_name: value }))
            }
            placeholder="Quick add"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>
        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>Calories</Text>
            <TextInput
              value={quickAdd.calories}
              onChangeText={(value) =>
                setQuickAdd((prev) => ({ ...prev, calories: value }))
              }
              placeholder="kcal"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              style={[styles.input, styles.halfInput]}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Protein (g)</Text>
            <TextInput
              value={quickAdd.protein}
              onChangeText={(value) =>
                setQuickAdd((prev) => ({ ...prev, protein: value }))
              }
              placeholder="g"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              style={[styles.input, styles.halfInput]}
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>Carbs (g)</Text>
            <TextInput
              value={quickAdd.carbs}
              onChangeText={(value) =>
                setQuickAdd((prev) => ({ ...prev, carbs: value }))
              }
              placeholder="g"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              style={[styles.input, styles.halfInput]}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Fats (g)</Text>
            <TextInput
              value={quickAdd.fats}
              onChangeText={(value) =>
                setQuickAdd((prev) => ({ ...prev, fats: value }))
              }
              placeholder="g"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              style={[styles.input, styles.halfInput]}
            />
          </View>
        </View>
        <Text style={styles.label}>Meal slot</Text>
        <View style={styles.chipRow}>
          {mealSlots.map((slot) => (
            <Pressable
              key={slot}
              style={[
                styles.chip,
                quickAdd.meal_slot === slot && styles.chipActive,
              ]}
              onPress={() =>
                setQuickAdd((prev) => ({ ...prev, meal_slot: slot }))
              }
              android_ripple={{ color: colors.softAccent }}
            >
              <Text style={styles.chipText}>{getMealLabel(slot)}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.addButtonPressed,
          ]}
          onPress={handleQuickAdd}
          android_ripple={{ color: colors.softAccent }}
        >
          <Text style={styles.addButtonText}>
            {quickAddBusy ? "Saving..." : "Log Quick Add"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Food Diary</Text>
        <View style={styles.diaryActions}>
          <View style={styles.toggleRow}>
            <Pressable
              style={[
                styles.toggleButton,
                viewMode === "meal" && styles.toggleButtonActive,
              ]}
              onPress={() => setViewMode("meal")}
              android_ripple={{ color: colors.softAccent }}
            >
              <Text style={styles.toggleText}>By meal</Text>
            </Pressable>
            <Pressable
              style={[
                styles.toggleButton,
                viewMode === "timeline" && styles.toggleButtonActive,
              ]}
              onPress={() => setViewMode("timeline")}
              android_ripple={{ color: colors.softAccent }}
            >
              <Text style={styles.toggleText}>Timeline</Text>
            </Pressable>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
            ]}
            onPress={handleCopyYesterday}
            android_ripple={{ color: colors.softAccent }}
          >
            <Text style={styles.secondaryText}>Copy yesterday</Text>
          </Pressable>
        </View>
      </View>

      {viewMode === "timeline" ? (
        <View style={styles.mealBlock}>
          {timelineLogs.length === 0 ? (
            <Text style={styles.muted}>No items yet.</Text>
          ) : (
            timelineLogs.map((meal) => (
              <View key={meal.id} style={styles.timelineItem}>
                <View style={styles.timelineMeta}>
                  <Text style={styles.timelineTime}>
                    {formatTime(meal.timestamp)}
                  </Text>
                  <Text style={styles.timelineSlot}>
                    {getMealLabel(meal.meal_slot || 1)}
                  </Text>
                </View>
                {editingMeal === meal.id ? (
                  renderEditFields(meal)
                ) : (
                  <>
                    <Pressable
                      style={styles.logInfo}
                      onPress={() => startEdit(meal)}
                      android_ripple={{ color: colors.softAccent }}
                    >
                      <Text style={styles.recentName}>{meal.food_name}</Text>
                      <Text style={styles.recentMeta}>
                        {formatNumber(meal.calories)} kcal · P{" "}
                        {formatNumber(meal.protein)}g · C{" "}
                        {formatNumber(meal.carbs)}g · F {formatNumber(meal.fats)}g
                      </Text>
                    </Pressable>
                    <View style={styles.logActions}>
                      <Pressable
                        style={styles.secondaryButton}
                        onPress={() => handleCopyMeal(meal)}
                        android_ripple={{ color: colors.softAccent }}
                      >
                        <Text style={styles.secondaryText}>Copy</Text>
                      </Pressable>
                      <Pressable
                        style={styles.secondaryButton}
                        onPress={() => handleSaveTemplate(meal)}
                        android_ripple={{ color: colors.softAccent }}
                      >
                        <Text style={styles.secondaryText}>Save</Text>
                      </Pressable>
                      <Pressable
                        style={styles.deleteButton}
                        onPress={() => handleDelete(meal.id)}
                        android_ripple={{ color: colors.softDanger }}
                      >
                        <Text style={styles.deleteText}>Delete</Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            ))
          )}
        </View>
      ) : (
        mealSlots.map((slot) => (
            <View key={slot} style={styles.mealBlock}>
            <View style={styles.mealHeader}>
              <Text style={styles.mealTitle}>{getMealLabel(slot)}</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.addButton,
                  pressed && styles.addButtonPressed,
                ]}
                onPress={() =>
                  navigation.navigate("Scanner", {
                    mealSlot: slot,
                    manualOnly: true,
                  })
                }
                android_ripple={{ color: colors.softAccent }}
              >
                <Text style={styles.addButtonText}>Log</Text>
              </Pressable>
            </View>
            <Text style={styles.mealMeta}>
              Target {formatNumber(mealCaloriesTarget)} kcal · Remaining{" "}
              {formatNumber(
                Math.max(0, mealCaloriesTarget - (mealTotals[slot]?.calories || 0))
              )}{" "}
              kcal
            </Text>
            {groupedMeals[slot] && groupedMeals[slot].length > 0 ? (
              <Text style={styles.mealMeta}>
                {formatNumber(mealTotals[slot]?.calories)} kcal · P{" "}
                {formatNumber(mealTotals[slot]?.protein)}g · C{" "}
                {formatNumber(mealTotals[slot]?.carbs)}g · F{" "}
                {formatNumber(mealTotals[slot]?.fats)}g
              </Text>
            ) : null}
            {groupedMeals[slot] && groupedMeals[slot].length > 0 ? (
              groupedMeals[slot].map((meal) => (
                <View
                  key={meal.id}
                  style={[
                    styles.logItem,
                    editingMeal === meal.id && styles.logItemEditing,
                  ]}
                >
                  {editingMeal === meal.id ? (
                    renderEditFields(meal)
                  ) : (
                    <>
                      <Pressable
                        style={styles.logInfo}
                        onPress={() => startEdit(meal)}
                        android_ripple={{ color: colors.softAccent }}
                      >
                        <Text style={styles.recentName}>{meal.food_name}</Text>
                        <Text style={styles.recentMeta}>
                          {formatNumber(meal.calories)} kcal · P{" "}
                          {formatNumber(meal.protein)}g · C{" "}
                          {formatNumber(meal.carbs)}g · F {formatNumber(meal.fats)}g
                        </Text>
                        <Text style={styles.logSource}>{meal.source}</Text>
                      </Pressable>
                      <View style={styles.logActions}>
                        <Pressable
                          style={styles.secondaryButton}
                          onPress={() => handleCopyMeal(meal)}
                          android_ripple={{ color: colors.softAccent }}
                        >
                          <Text style={styles.secondaryText}>Copy</Text>
                        </Pressable>
                        <Pressable
                          style={styles.secondaryButton}
                          onPress={() => handleSaveTemplate(meal)}
                          android_ripple={{ color: colors.softAccent }}
                        >
                          <Text style={styles.secondaryText}>Save</Text>
                        </Pressable>
                        <Pressable
                          style={styles.deleteButton}
                          onPress={() => handleDelete(meal.id)}
                          android_ripple={{ color: colors.softDanger }}
                        >
                          <Text style={styles.deleteText}>Delete</Text>
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              ))
            ) : (
              <Text style={styles.muted}>No items yet.</Text>
            )}
          </View>
        ))
      )}

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
              <Text style={styles.weeklyValue}>
                {formatNumber(day.calories)} kcal
              </Text>
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
            <View style={styles.logInfo}>
              <Text style={styles.recentName}>{meal.food_name}</Text>
              <Text style={styles.recentMeta}>
                {formatNumber(meal.calories)} kcal · P{" "}
                {formatNumber(meal.protein)}g · C {formatNumber(meal.carbs)}g · F{" "}
                {formatNumber(meal.fats)}g
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.secondaryButtonPressed,
              ]}
              onPress={() =>
                navigation.navigate("Scanner", {
                  manualOnly: true,
                  prefill: {
                    food_name: meal.food_name,
                    calories: meal.calories,
                    protein: meal.protein,
                    carbs: meal.carbs,
                    fats: meal.fats,
                  },
                })
              }
              android_ripple={{ color: colors.softAccent }}
            >
              <Text style={styles.secondaryText}>Add</Text>
            </Pressable>
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
    gap: 12,
  },
  cardRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  statLabel: {
    fontFamily: fonts.medium,
    color: colors.muted,
    fontSize: 12,
  },
  statValue: {
    fontFamily: fonts.bold,
    color: colors.ink,
    fontSize: 18,
  },
  diaryActions: {
    gap: 8,
    alignItems: "flex-end",
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
  quickAddCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
  },
  waterCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
  },
  waterTrack: {
    height: 10,
    backgroundColor: colors.border,
    borderRadius: 999,
    overflow: "hidden",
  },
  waterFill: {
    height: "100%",
    backgroundColor: colors.accent,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.softAccent,
    borderColor: colors.accent,
  },
  chipText: {
    fontFamily: fonts.medium,
    color: colors.ink,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
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
  logItemEditing: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  logInfo: {
    flex: 1,
  },
  logActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
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
  waterLogRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  habitRow: {
    flexDirection: "row",
    gap: 12,
  },
  habitCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
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
  row: {
    flexDirection: "row",
    gap: 10,
  },
  field: {
    flex: 1,
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.muted,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    fontFamily: fonts.regular,
    color: colors.ink,
  },
  halfInput: {
    flex: 1,
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  secondaryButtonPressed: {
    backgroundColor: colors.softAccent,
  },
  secondaryText: {
    fontFamily: fonts.medium,
    color: colors.ink,
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
  editCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 10,
    backgroundColor: colors.background,
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  timelineItem: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  timelineMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  timelineTime: {
    fontFamily: fonts.medium,
    color: colors.ink,
  },
  timelineSlot: {
    fontFamily: fonts.medium,
    color: colors.muted,
  },
});
