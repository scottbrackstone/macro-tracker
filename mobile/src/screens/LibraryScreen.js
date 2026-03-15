import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import { fetchJson } from "../api/client";
import { colors, fonts } from "../theme";

export default function LibraryScreen() {
  const [foods, setFoods] = useState([]);
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fats: "",
  });
  const navigation = useNavigation();

  const loadFoods = useCallback(async () => {
    try {
      const data = await fetchJson("/custom-foods");
      setFoods(data);
    } catch (err) {
      setStatus(err.message);
    }
  }, []);

  useEffect(() => {
    loadFoods();
  }, [loadFoods]);

  useFocusEffect(
    useCallback(() => {
      loadFoods();
    }, [loadFoods])
  );

  const saveFood = async () => {
    if (!form.name.trim()) {
      setStatus("Please enter a name.");
      return;
    }
    setStatus("Saving...");
    try {
      const created = await fetchJson("/custom-foods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          calories: Number(form.calories) || 0,
          protein: Number(form.protein) || 0,
          carbs: Number(form.carbs) || 0,
          fats: Number(form.fats) || 0,
        }),
      });
      setFoods((prev) => [created, ...prev]);
      setForm({
        name: "",
        calories: "",
        protein: "",
        carbs: "",
        fats: "",
      });
      setStatus("Saved!");
    } catch (err) {
      setStatus(err.message);
    }
  };

  const deleteFood = async (foodId) => {
    try {
      await fetchJson(`/custom-foods/${foodId}`, { method: "DELETE" });
      setFoods((prev) => prev.filter((food) => food.id !== foodId));
    } catch (err) {
      setStatus(err.message);
    }
  };

  const useFood = (food) => {
    navigation.navigate("Scanner", {
      prefill: {
        food_name: food.name,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fats: food.fats,
      },
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Food Library</Text>
      {status ? <Text style={styles.status}>{status}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add Custom Food</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            value={form.name}
            onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))}
            placeholder="e.g. Chicken & rice"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>
        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>Calories</Text>
            <TextInput
              value={form.calories}
              onChangeText={(value) =>
                setForm((prev) => ({ ...prev, calories: value }))
              }
              placeholder="Calories"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              style={[styles.input, styles.halfInput]}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Protein (g)</Text>
            <TextInput
              value={form.protein}
              onChangeText={(value) =>
                setForm((prev) => ({ ...prev, protein: value }))
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
            <Text style={styles.label}>Carbs (g)</Text>
            <TextInput
              value={form.carbs}
              onChangeText={(value) =>
                setForm((prev) => ({ ...prev, carbs: value }))
              }
              placeholder="Carbs (g)"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              style={[styles.input, styles.halfInput]}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Fats (g)</Text>
            <TextInput
              value={form.fats}
              onChangeText={(value) =>
                setForm((prev) => ({ ...prev, fats: value }))
              }
              placeholder="Fats (g)"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              style={[styles.input, styles.halfInput]}
            />
          </View>
        </View>
        <Pressable style={styles.primaryButton} onPress={saveFood}>
          <Text style={styles.primaryText}>Save Food</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Saved Foods</Text>
        {foods.length === 0 ? (
          <Text style={styles.muted}>No saved foods yet.</Text>
        ) : (
          foods.map((food) => (
            <View key={food.id} style={styles.foodItem}>
              <View style={styles.foodInfo}>
                <Text style={styles.foodName}>{food.name}</Text>
                <Text style={styles.foodMeta}>
                  {food.calories} kcal · P {food.protein}g · C {food.carbs}g · F{" "}
                  {food.fats}g
                </Text>
              </View>
              <View style={styles.foodActions}>
                <Pressable style={styles.useButton} onPress={() => useFood(food)}>
                  <Text style={styles.useText}>Use</Text>
                </Pressable>
                <Pressable
                  style={styles.deleteButton}
                  onPress={() => deleteFood(food.id)}
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
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
  primaryText: {
    color: "#fff",
    fontFamily: fonts.medium,
  },
  muted: {
    color: colors.muted,
    fontFamily: fonts.regular,
  },
  foodItem: {
    paddingVertical: 10,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 8,
  },
  foodInfo: {
    gap: 4,
  },
  foodName: {
    fontFamily: fonts.medium,
    color: colors.ink,
  },
  foodMeta: {
    fontFamily: fonts.regular,
    color: colors.muted,
  },
  foodActions: {
    flexDirection: "row",
    gap: 8,
  },
  useButton: {
    backgroundColor: colors.softSuccess,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  useText: {
    color: colors.success,
    fontFamily: fonts.medium,
  },
  deleteButton: {
    backgroundColor: colors.softDanger,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  deleteText: {
    color: colors.danger,
    fontFamily: fonts.medium,
  },
});
