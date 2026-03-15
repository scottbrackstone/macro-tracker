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
  });
  const [weightInput, setWeightInput] = useState("");
  const [weightNotes, setWeightNotes] = useState("");
  const [weightLogs, setWeightLogs] = useState([]);
  const [status, setStatus] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [targetResponse, weightResponse] = await Promise.all([
        fetchJson("/macro-target"),
        fetchJson("/weight-logs"),
      ]);
      setMacroTarget({
        calories: String(targetResponse.calories ?? ""),
        protein: String(targetResponse.protein ?? ""),
        carbs: String(targetResponse.carbs ?? ""),
        fats: String(targetResponse.fats ?? ""),
      });
      setWeightLogs(weightResponse);
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

  const saveTargets = async () => {
    setStatus("Saving targets...");
    try {
      await fetchJson("/macro-target", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calories: Number(macroTarget.calories) || 0,
          protein: Number(macroTarget.protein) || 0,
          carbs: Number(macroTarget.carbs) || 0,
          fats: Number(macroTarget.fats) || 0,
        }),
      });
      setStatus("Targets saved.");
    } catch (err) {
      setStatus(err.message);
    }
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Goals & Weight</Text>
      {status ? <Text style={styles.status}>{status}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Macro Targets</Text>
        <View style={styles.row}>
          <TextInput
            value={macroTarget.calories}
            onChangeText={(value) =>
              setMacroTarget((prev) => ({ ...prev, calories: value }))
            }
            placeholder="Calories"
            keyboardType="numeric"
            style={[styles.input, styles.halfInput]}
          />
          <TextInput
            value={macroTarget.protein}
            onChangeText={(value) =>
              setMacroTarget((prev) => ({ ...prev, protein: value }))
            }
            placeholder="Protein (g)"
            keyboardType="numeric"
            style={[styles.input, styles.halfInput]}
          />
        </View>
        <View style={styles.row}>
          <TextInput
            value={macroTarget.carbs}
            onChangeText={(value) =>
              setMacroTarget((prev) => ({ ...prev, carbs: value }))
            }
            placeholder="Carbs (g)"
            keyboardType="numeric"
            style={[styles.input, styles.halfInput]}
          />
          <TextInput
            value={macroTarget.fats}
            onChangeText={(value) =>
              setMacroTarget((prev) => ({ ...prev, fats: value }))
            }
            placeholder="Fats (g)"
            keyboardType="numeric"
            style={[styles.input, styles.halfInput]}
          />
        </View>
        <Pressable style={styles.primaryButton} onPress={saveTargets}>
          <Text style={styles.primaryText}>Save Targets</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weight Tracking</Text>
        <View style={styles.row}>
          <TextInput
            value={weightInput}
            onChangeText={setWeightInput}
            placeholder="Weight"
            keyboardType="numeric"
            style={[styles.input, styles.halfInput]}
          />
          <TextInput
            value={weightNotes}
            onChangeText={setWeightNotes}
            placeholder="Notes"
            style={[styles.input, styles.halfInput]}
          />
        </View>
        <Pressable style={styles.primaryButton} onPress={addWeight}>
          <Text style={styles.primaryText}>Add Weight</Text>
        </Pressable>

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
  row: {
    flexDirection: "row",
    gap: 10,
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
  },
  primaryText: {
    color: "#fff",
    fontFamily: fonts.medium,
  },
  muted: {
    color: colors.muted,
    fontFamily: fonts.regular,
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
});
