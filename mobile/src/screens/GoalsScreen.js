import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { fetchJson } from "../api/client";
import { colors, fonts } from "../theme";

export default function GoalsScreen() {
  const [macroTarget, setMacroTarget] = useState({
    calories: "",
    protein: "",
    carbs: "",
    fats: "",
    meals_per_day: "3",
  });
  const [caloriesAuto, setCaloriesAuto] = useState(true);
  const [macroMode, setMacroMode] = useState("grams");
  const [autoFillMacro, setAutoFillMacro] = useState("none");
  const [profile, setProfile] = useState({
    age: "",
    height_cm: "",
    weight_kg: "",
    sex: "unspecified",
    activity_level: "moderate",
  });
  const [estimatedCalories, setEstimatedCalories] = useState(null);
  const [weightInput, setWeightInput] = useState("");
  const [weightNotes, setWeightNotes] = useState("");
  const [weightLogs, setWeightLogs] = useState([]);
  const [status, setStatus] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [targetResponse, weightResponse, profileResponse] = await Promise.all([
        fetchJson("/macro-target"),
        fetchJson("/weight-logs"),
        fetchJson("/profile"),
      ]);
      const loadedCalories = targetResponse.calories ?? "";
      setMacroTarget({
        calories: String(loadedCalories),
        protein: String(targetResponse.protein ?? ""),
        carbs: String(targetResponse.carbs ?? ""),
        fats: String(targetResponse.fats ?? ""),
        meals_per_day: String(targetResponse.meals_per_day ?? "3"),
      });
      setCaloriesAuto(!(Number(loadedCalories) > 0));
      setWeightLogs(weightResponse);
      setProfile({
        age: String(profileResponse.age ?? ""),
        height_cm: String(profileResponse.height_cm ?? ""),
        weight_kg: String(profileResponse.weight_kg ?? ""),
        sex: profileResponse.sex || "unspecified",
        activity_level: profileResponse.activity_level || "moderate",
      });
    } catch (err) {
      setStatus(err.message);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const computeEstimate = () => {
    const age = Number(profile.age) || 0;
    const height = Number(profile.height_cm) || 0;
    const weight = Number(profile.weight_kg) || 0;
    if (!age || !height || !weight) return null;
    const isFemale = profile.sex === "female";
    const bmr = isFemale
      ? 10 * weight + 6.25 * height - 5 * age - 161
      : 10 * weight + 6.25 * height - 5 * age + 5;
    const activityMap = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9,
    };
    const multiplier = activityMap[profile.activity_level] || 1.55;
    return Math.round(bmr * multiplier);
  };

  useEffect(() => {
    const estimate = computeEstimate();
    setEstimatedCalories(estimate);
    if (estimate && caloriesAuto) {
      setMacroTarget((prev) => ({ ...prev, calories: String(estimate) }));
    }
  }, [profile, caloriesAuto]);

  const saveTargets = async () => {
    setStatus("Saving targets...");
    try {
      const calories = Number(macroTarget.calories) || 0;
      const proteinInput = Number(macroTarget.protein) || 0;
      const carbsInput = Number(macroTarget.carbs) || 0;
      const fatsInput = Number(macroTarget.fats) || 0;

      let protein = proteinInput;
      let carbs = carbsInput;
      let fats = fatsInput;

      if (macroMode === "percent" && calories > 0) {
        protein = (calories * (proteinInput / 100)) / 4;
        carbs = (calories * (carbsInput / 100)) / 4;
        fats = (calories * (fatsInput / 100)) / 9;
      } else if (macroMode === "grams" && calories > 0) {
        const macroCalories = {
          protein: proteinInput * 4,
          carbs: carbsInput * 4,
          fats: fatsInput * 9,
        };
        if (autoFillMacro !== "none") {
          const remaining =
            calories -
            (macroCalories.protein +
              macroCalories.carbs +
              macroCalories.fats -
              macroCalories[autoFillMacro]);
          const grams =
            autoFillMacro === "fats"
              ? remaining / 9
              : remaining / 4;
          if (autoFillMacro === "protein") protein = Math.max(0, grams);
          if (autoFillMacro === "carbs") carbs = Math.max(0, grams);
          if (autoFillMacro === "fats") fats = Math.max(0, grams);
        }
      }

      await fetchJson("/macro-target", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calories,
          protein,
          carbs,
          fats,
          meals_per_day: Number(macroTarget.meals_per_day) || 3,
        }),
      });
      setStatus("Targets saved.");
    } catch (err) {
      setStatus(err.message);
    }
  };

  const saveProfile = async () => {
    setStatus("Saving profile...");
    try {
      await fetchJson("/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          age: Number(profile.age) || 0,
          height_cm: Number(profile.height_cm) || 0,
          weight_kg: Number(profile.weight_kg) || 0,
          sex: profile.sex,
          activity_level: profile.activity_level,
        }),
      });
      setStatus("Profile saved.");
    } catch (err) {
      setStatus(err.message);
    }
  };

  const applyEstimate = () => {
    const estimate = computeEstimate();
    if (!estimate) {
      setStatus("Enter age, height, and weight to estimate.");
      return;
    }
    setEstimatedCalories(estimate);
    setMacroTarget((prev) => ({ ...prev, calories: String(estimate) }));
    setCaloriesAuto(true);
  };

  const addWeight = async () => {
    if (!weightInput) {
      setStatus("Please enter a weight value.");
      return;
    }
    setStatus("Saving weight...");
    try {
      const newLog = await fetchJson("/weight-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weight: Number(weightInput),
          notes: weightNotes || null,
        }),
      });
      setWeightInput("");
      setWeightNotes("");
      setWeightLogs((prev) => [newLog, ...prev]);
      setStatus("Weight saved.");
    } catch (err) {
      setStatus(err.message);
    }
  };

  const deleteWeight = async (logId) => {
    try {
      await fetchJson(`/weight-logs/${logId}`, { method: "DELETE" });
      setWeightLogs((prev) => prev.filter((log) => log.id !== logId));
    } catch (err) {
      setStatus(err.message);
    }
  };

  const weightChart = weightLogs.slice(0, 7).reverse();
  const maxWeight = Math.max(1, ...weightChart.map((log) => log.weight || 0));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Goals & Weight</Text>
      {status ? <Text style={styles.status}>{status}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Macro Targets</Text>
        <View style={styles.toggleRow}>
          <Pressable
            style={[
              styles.toggleButton,
              macroMode === "grams" && styles.toggleButtonActive,
            ]}
            onPress={() => setMacroMode("grams")}
          >
            <Text style={styles.toggleText}>Grams</Text>
          </Pressable>
          <Pressable
            style={[
              styles.toggleButton,
              macroMode === "percent" && styles.toggleButtonActive,
            ]}
            onPress={() => setMacroMode("percent")}
          >
            <Text style={styles.toggleText}>Percent</Text>
          </Pressable>
        </View>
        {macroMode === "grams" ? (
          <View style={styles.autoFillRow}>
            <Text style={styles.label}>Auto-fill remainder</Text>
            <View style={styles.autoFillOptions}>
              {["none", "protein", "carbs", "fats"].map((option) => (
                <Pressable
                  key={option}
                  style={[
                    styles.chip,
                    autoFillMacro === option && styles.chipActive,
                  ]}
                  onPress={() => setAutoFillMacro(option)}
                >
                  <Text style={styles.chipText}>
                    {option === "none" ? "None" : option}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>Calories</Text>
            <TextInput
              value={macroTarget.calories}
              onChangeText={(value) => {
                setCaloriesAuto(false);
                setMacroTarget((prev) => ({ ...prev, calories: value }));
              }}
              placeholder="Calories"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              style={[styles.input, styles.halfInput]}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>
              {macroMode === "percent" ? "Protein (%)" : "Protein"}
            </Text>
            <TextInput
              value={macroTarget.protein}
              onChangeText={(value) =>
                setMacroTarget((prev) => ({ ...prev, protein: value }))
              }
              placeholder="Protein (g)"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              style={[styles.input, styles.halfInput]}
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>
              {macroMode === "percent" ? "Carbs (%)" : "Carbs"}
            </Text>
            <TextInput
              value={macroTarget.carbs}
              onChangeText={(value) =>
                setMacroTarget((prev) => ({ ...prev, carbs: value }))
              }
              placeholder="Carbs (g)"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              style={[styles.input, styles.halfInput]}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>
              {macroMode === "percent" ? "Fats (%)" : "Fats"}
            </Text>
            <TextInput
              value={macroTarget.fats}
              onChangeText={(value) =>
                setMacroTarget((prev) => ({ ...prev, fats: value }))
              }
              placeholder="Fats (g)"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              style={[styles.input, styles.halfInput]}
            />
          </View>
        </View>
        {macroMode === "percent" && Number(macroTarget.calories) > 0 ? (
          <View style={styles.macroNote}>
            <Text style={styles.muted}>
              Estimated grams: P{" "}
              {Math.round(
                (Number(macroTarget.calories) *
                  (Number(macroTarget.protein) || 0)) /
                  100 /
                  4
              )}{" "}
              g · C{" "}
              {Math.round(
                (Number(macroTarget.calories) *
                  (Number(macroTarget.carbs) || 0)) /
                  100 /
                  4
              )}{" "}
              g · F{" "}
              {Math.round(
                (Number(macroTarget.calories) *
                  (Number(macroTarget.fats) || 0)) /
                  100 /
                  9
              )}{" "}
              g
            </Text>
          </View>
        ) : null}
        <View style={styles.field}>
          <Text style={styles.label}>Meals per day</Text>
          <TextInput
            value={macroTarget.meals_per_day}
            onChangeText={(value) =>
              setMacroTarget((prev) => ({ ...prev, meals_per_day: value }))
            }
            placeholder="e.g. 3"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            style={styles.input}
          />
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
          ]}
          onPress={saveTargets}
          android_ripple={{ color: colors.softAccent }}
        >
          <Text style={styles.primaryText}>Save Targets</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Calorie Estimator</Text>
        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>Age</Text>
            <TextInput
              value={profile.age}
              onChangeText={(value) =>
                setProfile((prev) => ({ ...prev, age: value }))
              }
              placeholder="Age"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              style={[styles.input, styles.halfInput]}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Height (cm)</Text>
            <TextInput
              value={profile.height_cm}
              onChangeText={(value) =>
                setProfile((prev) => ({ ...prev, height_cm: value }))
              }
              placeholder="Height (cm)"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              style={[styles.input, styles.halfInput]}
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>Weight (kg)</Text>
            <TextInput
              value={profile.weight_kg}
              onChangeText={(value) =>
                setProfile((prev) => ({ ...prev, weight_kg: value }))
              }
              placeholder="Weight (kg)"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              style={[styles.input, styles.halfInput]}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Sex</Text>
            <View style={styles.chipRow}>
              {["male", "female", "unspecified"].map((option) => (
                <Pressable
                  key={option}
                  style={[
                    styles.chip,
                    profile.sex === option && styles.chipActive,
                  ]}
                  onPress={() =>
                    setProfile((prev) => ({ ...prev, sex: option }))
                  }
                >
                  <Text style={styles.chipText}>{option}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Activity level</Text>
          <View style={styles.chipRow}>
            {[
              "sedentary",
              "light",
              "moderate",
              "active",
              "very_active",
            ].map((option) => (
              <Pressable
                key={option}
                style={[
                  styles.chip,
                  profile.activity_level === option && styles.chipActive,
                ]}
                onPress={() =>
                  setProfile((prev) => ({ ...prev, activity_level: option }))
                }
              >
                <Text style={styles.chipText}>{option.replace("_", " ")}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {estimatedCalories ? (
          <View style={styles.estimateRow}>
            <Text style={styles.muted}>
              Estimated maintenance: {estimatedCalories} kcal/day
              {caloriesAuto ? " (auto-filled)" : ""}
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.secondaryButtonPressed,
              ]}
              onPress={applyEstimate}
              android_ripple={{ color: colors.softAccent }}
            >
              <Text style={styles.secondaryText}>Use estimate</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.row}>
          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
            ]}
            onPress={saveProfile}
            android_ripple={{ color: colors.softAccent }}
          >
            <Text style={styles.secondaryText}>Save Profile</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weight Tracking</Text>
        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>Weight</Text>
            <TextInput
              value={weightInput}
              onChangeText={setWeightInput}
              placeholder="Weight"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              style={[styles.input, styles.halfInput]}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              value={weightNotes}
              onChangeText={setWeightNotes}
              placeholder="Notes"
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.halfInput]}
            />
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
          ]}
          onPress={addWeight}
          android_ripple={{ color: colors.softAccent }}
        >
          <Text style={styles.primaryText}>Add Weight</Text>
        </Pressable>

        {weightChart.length > 0 ? (
          <View style={styles.weightChart}>
            {weightChart.map((log) => (
              <View key={log.id} style={styles.weightItem}>
                <View style={styles.weightBarTrack}>
                  <View
                    style={[
                      styles.weightBarFill,
                      { width: `${(log.weight / maxWeight) * 100}%` },
                    ]}
                  />
                </View>
                <View style={styles.weightMeta}>
                  <Text style={styles.weightLabel}>{log.log_date}</Text>
                  <Text style={styles.weightValue}>{log.weight}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {weightLogs.length === 0 ? (
          <Text style={styles.muted}>No weight entries yet.</Text>
        ) : (
          weightLogs.map((log) => (
            <View key={log.id} style={styles.logItem}>
              <View style={styles.logInfo}>
                <Text style={styles.logValue}>{log.weight}</Text>
                <Text style={styles.logDate}>{log.log_date}</Text>
                {log.notes ? (
                  <Text style={styles.logNotes}>{log.notes}</Text>
                ) : null}
              </View>
              <Pressable
                style={styles.deleteButton}
                onPress={() => deleteWeight(log.id)}
                android_ripple={{ color: colors.softDanger }}
              >
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
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
  toggleRow: {
    flexDirection: "row",
    gap: 10,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
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
  autoFillRow: {
    gap: 8,
  },
  autoFillOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
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
  macroNote: {
    backgroundColor: colors.softAccent,
    padding: 10,
    borderRadius: 10,
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
  primaryButton: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    shadowColor: colors.accent,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  primaryText: {
    color: "#fff",
    fontFamily: fonts.medium,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    flex: 1,
  },
  secondaryButtonPressed: {
    backgroundColor: colors.softAccent,
  },
  secondaryText: {
    color: colors.ink,
    fontFamily: fonts.medium,
  },
  estimateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  muted: {
    color: colors.muted,
    fontFamily: fonts.regular,
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
    textTransform: "capitalize",
  },
  logItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomColor: "#E6E8EE",
    borderBottomWidth: 1,
    gap: 10,
  },
  logInfo: {
    flex: 1,
  },
  logValue: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.ink,
  },
  logDate: {
    color: colors.muted,
    marginTop: 2,
    fontFamily: fonts.regular,
  },
  logNotes: {
    color: colors.muted,
    marginTop: 2,
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
  weightChart: {
    gap: 10,
  },
  weightItem: {
    gap: 6,
  },
  weightBarTrack: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 999,
    overflow: "hidden",
  },
  weightBarFill: {
    height: "100%",
    backgroundColor: colors.accent,
  },
  weightMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  weightLabel: {
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 12,
  },
  weightValue: {
    fontFamily: fonts.medium,
    color: colors.ink,
    fontSize: 12,
  },
});
