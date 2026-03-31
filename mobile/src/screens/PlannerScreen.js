import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import { fetchJson } from "../api/client";
import { colors, fonts } from "../theme";

export default function PlannerScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date());
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
    meals_per_day: 3,
  });
  const [dailyLogs, setDailyLogs] = useState([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const navigation = useNavigation();

  const mealLabels = ["Breakfast", "Lunch", "Dinner", "Snack"];
  const calendarOffsets = useMemo(
    () => Array.from({ length: 15 }, (_, idx) => idx - 7),
    []
  );

  const formatDateParam = (dateValue) =>
    dateValue.toISOString().slice(0, 10);
  const formatDayLabel = (dateValue) =>
    dateValue.toLocaleDateString(undefined, { weekday: "short" });
  const formatDayNumber = (dateValue) =>
    dateValue.toLocaleDateString(undefined, { day: "numeric" });
  const formatShortDate = (dateValue) =>
    dateValue.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const formatCalories = (value) => Math.round(Number(value || 0));
  const formatMacro = (value) => Number(value || 0).toFixed(1);
  const buildTimestamp = (dateValue) => {
    const today = new Date();
    const sameDay = dateValue.toDateString() === today.toDateString();
    if (sameDay) return new Date().toISOString();
    const local = new Date(dateValue);
    local.setHours(12, 0, 0, 0);
    return local.toISOString();
  };

  const mealsPerDay = Math.max(1, Number(targets.meals_per_day) || 3);
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
      if (!groups[slot]) groups[slot] = [];
      groups[slot].push(log);
    });
    return groups;
  }, [dailyLogs, mealSlots]);

  const loadData = useCallback(async () => {
    try {
      const dateParam = formatDateParam(selectedDate);
      const [summaryResponse, logsResponse, targetResponse] =
        await Promise.all([
          fetchJson(`/daily-summary?target_date=${dateParam}`),
          fetchJson(`/daily-logs?target_date=${dateParam}`),
          fetchJson("/macro-target"),
        ]);
      setSummary(summaryResponse);
      setDailyLogs(logsResponse);
      setTargets(targetResponse);
      setStatus("");
    } catch (err) {
      setStatus(err.message);
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

  const handleAddMeal = (slot) => {
    navigation.navigate("Scanner", {
      targetDate: formatDateParam(selectedDate),
      mealSlot: slot,
      startMode: "manual",
    });
  };

  const handleEditMeal = (meal) => {
    navigation.navigate("Scanner", {
      editLog: meal,
      targetDate: formatDateParam(selectedDate),
    });
  };

  const handleCopyToday = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const todayParam = formatDateParam(new Date());
      const logs = await fetchJson(`/daily-logs?target_date=${todayParam}`);
      if (!logs.length) {
        setStatus("No meals logged today.");
        return;
      }
      await Promise.all(
        logs.map((log) =>
          fetchJson("/log-meal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              food_name: log.food_name,
              source: "Plan",
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
      setStatus("Copied today to selected date.");
    } catch (err) {
      setStatus(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Plan Ahead</Text>
      {status ? <Text style={styles.status}>{status}</Text> : null}

      <View style={styles.calendarCard}>
        <Text style={styles.sectionLabel}>Pick a day</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.calendarRow}>
            {calendarOffsets.map((offset) => {
              const date = new Date();
              date.setDate(date.getDate() + offset);
              const isSelected =
                date.toDateString() === selectedDate.toDateString();
              return (
                <Pressable
                  key={offset}
                  style={[
                    styles.dayChip,
                    isSelected && styles.dayChipActive,
                  ]}
                  onPress={() => setSelectedDate(date)}
                >
                  <Text
                    style={[
                      styles.dayLabel,
                      isSelected && styles.dayLabelActive,
                    ]}
                  >
                    {formatDayLabel(date)}
                  </Text>
                  <Text
                    style={[
                      styles.dayNumber,
                      isSelected && styles.dayLabelActive,
                    ]}
                  >
                    {formatDayNumber(date)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        <View style={styles.calendarFooter}>
          <Text style={styles.muted}>
            Selected: {formatShortDate(selectedDate)}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
            ]}
            onPress={handleCopyToday}
            android_ripple={{ color: colors.softAccent }}
          >
            <Text style={styles.secondaryText}>
              {busy ? "Copying..." : "Copy today"}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.sectionLabel}>Daily totals</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryValue}>
              {formatCalories(summary.calories)}
            </Text>
            <Text style={styles.summaryLabel}>kcal</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryValue}>
              {formatMacro(summary.protein)}
            </Text>
            <Text style={styles.summaryLabel}>Protein</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryValue}>
              {formatMacro(summary.carbs)}
            </Text>
            <Text style={styles.summaryLabel}>Carbs</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryValue}>
              {formatMacro(summary.fats)}
            </Text>
            <Text style={styles.summaryLabel}>Fats</Text>
          </View>
        </View>
      </View>

      {mealSlots.map((slot) => {
        const meals = groupedMeals[slot] || [];
        const label = mealLabels[slot - 1] || `Meal ${slot}`;
        return (
          <View key={slot} style={styles.mealCard}>
            <View style={styles.mealHeader}>
              <Text style={styles.mealTitle}>{label}</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.addButton,
                  pressed && styles.addButtonPressed,
                ]}
                onPress={() => handleAddMeal(slot)}
                android_ripple={{ color: colors.softAccent }}
              >
                <Text style={styles.addButtonText}>+</Text>
              </Pressable>
            </View>
            {meals.length === 0 ? (
              <Text style={styles.muted}>Nothing planned yet.</Text>
            ) : (
              meals.map((meal) => (
                <Pressable
                  key={meal.id}
                  style={({ pressed }) => [
                    styles.mealRow,
                    pressed && styles.mealRowPressed,
                  ]}
                  onPress={() => handleEditMeal(meal)}
                >
                  <View style={styles.mealInfo}>
                    <Text style={styles.mealName}>{meal.food_name}</Text>
                    <Text style={styles.mealMeta}>
                      {formatCalories(meal.calories)} kcal · P{" "}
                      {formatMacro(meal.protein)} · C {formatMacro(meal.carbs)} ·
                      F {formatMacro(meal.fats)}
                    </Text>
                  </View>
                  <Text style={styles.mealEdit}>Edit</Text>
                </Pressable>
              ))
            )}
          </View>
        );
      })}
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
  calendarCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  sectionLabel: {
    fontFamily: fonts.medium,
    color: colors.ink,
  },
  calendarRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 6,
  },
  dayChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    width: 72,
  },
  dayChipActive: {
    backgroundColor: colors.softAccent,
    borderColor: colors.accent,
  },
  dayLabel: {
    fontFamily: fonts.medium,
    color: colors.muted,
    textTransform: "uppercase",
    fontSize: 12,
  },
  dayLabelActive: {
    color: colors.ink,
  },
  dayNumber: {
    fontFamily: fonts.bold,
    color: colors.ink,
    fontSize: 18,
  },
  calendarFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  summaryTile: {
    flexGrow: 1,
    minWidth: 120,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
  },
  summaryValue: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.ink,
  },
  summaryLabel: {
    fontFamily: fonts.regular,
    color: colors.muted,
  },
  mealCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  mealHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mealTitle: {
    fontFamily: fonts.bold,
    color: colors.ink,
    fontSize: 16,
  },
  addButton: {
    backgroundColor: colors.softAccent,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  addButtonPressed: {
    backgroundColor: colors.accent,
  },
  addButtonText: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  mealRow: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mealRowPressed: {
    borderColor: colors.accent,
    borderWidth: 1,
  },
  mealInfo: {
    flex: 1,
    gap: 4,
    paddingRight: 8,
  },
  mealName: {
    fontFamily: fonts.medium,
    color: colors.ink,
  },
  mealMeta: {
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 12,
  },
  mealEdit: {
    fontFamily: fonts.medium,
    color: colors.accent,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryButtonPressed: {
    backgroundColor: colors.softAccent,
  },
  secondaryText: {
    color: colors.ink,
    fontFamily: fonts.medium,
  },
  muted: {
    color: colors.muted,
    fontFamily: fonts.regular,
  },
});
