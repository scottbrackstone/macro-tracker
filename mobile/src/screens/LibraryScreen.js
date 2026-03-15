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

import { fetchJson } from "../api/client";
import { colors, fonts } from "../theme";

export default function LibraryScreen() {
  const [foods, setFoods] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [status, setStatus] = useState("");
  const [libraryView, setLibraryView] = useState("favorites");
  const [form, setForm] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fats: "",
  });
  const [ingredientForm, setIngredientForm] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fats: "",
    grams: "100",
  });
  const [recipeForm, setRecipeForm] = useState({
    name: "",
    servings: "1",
  });
  const [recipeIngredients, setRecipeIngredients] = useState([]);
  const [recipeSearchQuery, setRecipeSearchQuery] = useState("");
  const [recipeSearchResults, setRecipeSearchResults] = useState([]);
  const [recipeSearching, setRecipeSearching] = useState(false);
  const navigation = useNavigation();

  const formatNumber = (value) => Number(value || 0).toFixed(1);

  const loadFoods = useCallback(async () => {
    try {
      const [foodsData, favoritesData, historyData, recipesData] =
        await Promise.all([
          fetchJson("/custom-foods"),
          fetchJson("/food-items?favorites=true&limit=30"),
          fetchJson("/food-items?limit=30"),
          fetchJson("/recipes"),
        ]);
      setFoods(foodsData);
      setFavorites(favoritesData);
      setHistory(historyData);
      setRecipes(recipesData);
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
      manualOnly: true,
      prefill: {
        food_name: food.name,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fats: food.fats,
      },
    });
  };

  const toggleFavorite = async (item) => {
    try {
      const updated = await fetchJson(`/food-items/${item.id}/favorite`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_favorite: !item.is_favorite }),
      });
      setFavorites((prev) => {
        if (updated.is_favorite) {
          return [updated, ...prev.filter((fav) => fav.id !== updated.id)];
        }
        return prev.filter((fav) => fav.id !== updated.id);
      });
      setHistory((prev) =>
        prev.map((entry) => (entry.id === updated.id ? updated : entry))
      );
    } catch (err) {
      setStatus(err.message);
    }
  };

  const useFoodItem = (item) => {
    navigation.navigate("Scanner", {
      manualOnly: true,
      prefill: {
        food_name: item.food_name,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fats: item.fats,
      },
    });
  };

  const addIngredientManual = () => {
    if (!ingredientForm.name.trim()) {
      setStatus("Please enter an ingredient name.");
      return;
    }
    const gramsValue = ingredientForm.grams?.toString().trim() || "100";
    const ingredient = {
      name: ingredientForm.name.trim(),
      calories: Number(ingredientForm.calories) || 0,
      protein: Number(ingredientForm.protein) || 0,
      carbs: Number(ingredientForm.carbs) || 0,
      fats: Number(ingredientForm.fats) || 0,
      grams: gramsValue,
    };
    setRecipeIngredients((prev) => [...prev, ingredient]);
    setIngredientForm({
      name: "",
      calories: "",
      protein: "",
      carbs: "",
      fats: "",
      grams: "100",
    });
  };

  const removeIngredient = (index) => {
    setRecipeIngredients((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateIngredient = (index, updates) => {
    setRecipeIngredients((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...updates } : item))
    );
  };

  const recipeTotals = useMemo(() => {
    return recipeIngredients.reduce(
      (acc, item) => {
        const gramsValue = Number(item.grams);
        const factor = gramsValue > 0 ? gramsValue / 100 : 1;
        return {
          calories: acc.calories + (Number(item.calories) || 0) * factor,
          protein: acc.protein + (Number(item.protein) || 0) * factor,
          carbs: acc.carbs + (Number(item.carbs) || 0) * factor,
          fats: acc.fats + (Number(item.fats) || 0) * factor,
        };
      },
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
  }, [recipeIngredients]);

  const servings = Math.max(1, Number(recipeForm.servings) || 1);
  const perServing = {
    calories: recipeTotals.calories / servings,
    protein: recipeTotals.protein / servings,
    carbs: recipeTotals.carbs / servings,
    fats: recipeTotals.fats / servings,
  };

  const saveRecipe = async () => {
    if (!recipeForm.name.trim()) {
      setStatus("Please enter a recipe name.");
      return;
    }
    setStatus("Saving recipe...");
    try {
      const created = await fetchJson("/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: recipeForm.name.trim(),
          servings,
          ingredients: recipeIngredients,
        }),
      });
      setRecipes((prev) => [created, ...prev]);
      setRecipeForm({ name: "", servings: "1" });
      setRecipeIngredients([]);
      setRecipeSearchResults([]);
      setRecipeSearchQuery("");
      setStatus("Recipe saved.");
    } catch (err) {
      setStatus(err.message);
    }
  };

  const deleteRecipe = async (recipeId) => {
    try {
      await fetchJson(`/recipes/${recipeId}`, { method: "DELETE" });
      setRecipes((prev) => prev.filter((recipe) => recipe.id !== recipeId));
    } catch (err) {
      setStatus(err.message);
    }
  };

  const useRecipe = (recipe) => {
    const servingCount = Math.max(1, Number(recipe.servings) || 1);
    navigation.navigate("Scanner", {
      manualOnly: true,
      prefill: {
        food_name: recipe.name,
        calories: recipe.calories / servingCount,
        protein: recipe.protein / servingCount,
        carbs: recipe.carbs / servingCount,
        fats: recipe.fats / servingCount,
      },
    });
  };

  const searchRecipeFoods = async () => {
    const query = recipeSearchQuery.trim();
    if (!query) {
      setStatus("Enter a food to search.");
      return;
    }
    setRecipeSearching(true);
    try {
      const results = await fetchJson(
        `/search-food?query=${encodeURIComponent(query)}`
      );
      setRecipeSearchResults(results);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setRecipeSearching(false);
    }
  };

  const addIngredientFromSearch = (item) => {
    setRecipeIngredients((prev) => [
      ...prev,
      {
        name: item.food_name || "Ingredient",
        calories: Number(item.calories) || 0,
        protein: Number(item.protein) || 0,
        carbs: Number(item.carbs) || 0,
        fats: Number(item.fats) || 0,
        grams: "100",
      },
    ]);
  };

  const listItems = libraryView === "favorites" ? favorites : history;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Food Library</Text>
      {status ? <Text style={styles.status}>{status}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Favorites & History</Text>
        <View style={styles.toggleRow}>
          {["favorites", "history"].map((option) => (
            <Pressable
              key={option}
              style={[
                styles.toggleButton,
                libraryView === option && styles.toggleButtonActive,
              ]}
              onPress={() => setLibraryView(option)}
              android_ripple={{ color: colors.softAccent }}
            >
              <Text style={styles.toggleText}>{option}</Text>
            </Pressable>
          ))}
        </View>
        {listItems.length === 0 ? (
          <Text style={styles.muted}>No items yet.</Text>
        ) : (
          listItems.map((item) => (
            <View key={item.id} style={styles.listItem}>
              <View style={styles.listInfo}>
                <Text style={styles.foodName}>{item.food_name}</Text>
                <Text style={styles.foodMeta}>
                  {formatNumber(item.calories)} kcal · P {formatNumber(item.protein)}g
                  · C {formatNumber(item.carbs)}g · F {formatNumber(item.fats)}g
                </Text>
                {item.brand ? (
                  <Text style={styles.muted}>{item.brand}</Text>
                ) : null}
              </View>
              <View style={styles.listActions}>
                <Pressable
                  style={styles.useButton}
                  onPress={() => useFoodItem(item)}
                  android_ripple={{ color: colors.softSuccess }}
                >
                  <Text style={styles.useText}>Use</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.favoriteButton,
                    item.is_favorite && styles.favoriteButtonActive,
                  ]}
                  onPress={() => toggleFavorite(item)}
                  android_ripple={{ color: colors.softAccent }}
                >
                  <Text style={styles.favoriteText}>
                    {item.is_favorite ? "★" : "☆"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Build a Recipe</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Recipe name</Text>
          <TextInput
            value={recipeForm.name}
            onChangeText={(value) =>
              setRecipeForm((prev) => ({ ...prev, name: value }))
            }
            placeholder="e.g. Chicken stir fry"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Servings</Text>
          <TextInput
            value={recipeForm.servings}
            onChangeText={(value) =>
              setRecipeForm((prev) => ({ ...prev, servings: value }))
            }
            placeholder="1"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            style={styles.input}
          />
        </View>

        <Text style={styles.sectionTitle}>Search ingredients</Text>
        <View style={styles.searchRow}>
          <TextInput
            value={recipeSearchQuery}
            onChangeText={setRecipeSearchQuery}
            placeholder="e.g. banana"
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.searchInput]}
          />
          <Pressable
            style={styles.searchButton}
            onPress={searchRecipeFoods}
            android_ripple={{ color: colors.softAccent }}
          >
            <Text style={styles.searchButtonText}>Search</Text>
          </Pressable>
        </View>
        {recipeSearching ? <Text style={styles.muted}>Searching…</Text> : null}
        {recipeSearchResults.map((item, index) => (
          <View key={`${item.food_name}-${index}`} style={styles.searchRowItem}>
            <View style={styles.listInfo}>
              <Text style={styles.foodName}>{item.food_name}</Text>
              <Text style={styles.foodMeta}>
                {formatNumber(item.calories)} kcal · P {formatNumber(item.protein)}g
                · C {formatNumber(item.carbs)}g · F {formatNumber(item.fats)}g
              </Text>
            </View>
            <Pressable
              style={styles.quickAddButton}
              onPress={() => addIngredientFromSearch(item)}
              android_ripple={{ color: colors.softAccent }}
            >
              <Text style={styles.quickAddText}>+</Text>
            </Pressable>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Add ingredient</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            value={ingredientForm.name}
            onChangeText={(value) =>
              setIngredientForm((prev) => ({ ...prev, name: value }))
            }
            placeholder="Ingredient name"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>
        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>Calories</Text>
            <TextInput
              value={ingredientForm.calories}
              onChangeText={(value) =>
                setIngredientForm((prev) => ({ ...prev, calories: value }))
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
              value={ingredientForm.protein}
              onChangeText={(value) =>
                setIngredientForm((prev) => ({ ...prev, protein: value }))
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
              value={ingredientForm.carbs}
              onChangeText={(value) =>
                setIngredientForm((prev) => ({ ...prev, carbs: value }))
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
              value={ingredientForm.fats}
              onChangeText={(value) =>
                setIngredientForm((prev) => ({ ...prev, fats: value }))
              }
              placeholder="g"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              style={[styles.input, styles.halfInput]}
            />
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Grams used (per 100g)</Text>
          <TextInput
            value={ingredientForm.grams}
            onChangeText={(value) =>
              setIngredientForm((prev) => ({ ...prev, grams: value }))
            }
            placeholder="100"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            style={styles.input}
          />
        </View>
        <Pressable style={styles.secondaryButton} onPress={addIngredientManual}>
          <Text style={styles.secondaryText}>Add ingredient</Text>
        </Pressable>

        {recipeIngredients.length === 0 ? (
          <Text style={styles.muted}>No ingredients yet.</Text>
        ) : (
          recipeIngredients.map((ingredient, index) => (
            <View key={`${ingredient.name}-${index}`} style={styles.listItem}>
              {(() => {
                const gramsValue = Number(ingredient.grams);
                const factor = gramsValue > 0 ? gramsValue / 100 : 1;
                const displayCalories = (Number(ingredient.calories) || 0) * factor;
                const displayProtein = (Number(ingredient.protein) || 0) * factor;
                const displayCarbs = (Number(ingredient.carbs) || 0) * factor;
                const displayFats = (Number(ingredient.fats) || 0) * factor;
                return (
                  <View style={styles.listInfo}>
                    <Text style={styles.foodName}>{ingredient.name}</Text>
                    <Text style={styles.foodMeta}>
                      {formatNumber(displayCalories)} kcal · P{" "}
                      {formatNumber(displayProtein)}g · C{" "}
                      {formatNumber(displayCarbs)}g · F{" "}
                      {formatNumber(displayFats)}g
                    </Text>
                    <View style={styles.ingredientControls}>
                      <Text style={styles.label}>Grams</Text>
                      <TextInput
                        value={String(ingredient.grams ?? "")}
                        onChangeText={(value) =>
                          updateIngredient(index, { grams: value })
                        }
                        placeholder="100"
                        placeholderTextColor={colors.muted}
                        keyboardType="numeric"
                        style={[styles.input, styles.gramsInput]}
                      />
                    </View>
                  </View>
                );
              })()}
              <Pressable
                style={styles.deleteButton}
                onPress={() => removeIngredient(index)}
                android_ripple={{ color: colors.softDanger }}
              >
                <Text style={styles.deleteText}>Remove</Text>
              </Pressable>
            </View>
          ))
        )}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Recipe totals</Text>
          <Text style={styles.foodMeta}>
            {formatNumber(recipeTotals.calories)} kcal · P{" "}
            {formatNumber(recipeTotals.protein)}g · C{" "}
            {formatNumber(recipeTotals.carbs)}g · F{" "}
            {formatNumber(recipeTotals.fats)}g
          </Text>
          <Text style={styles.muted}>
            Per serving ({servings}): {formatNumber(perServing.calories)} kcal · P{" "}
            {formatNumber(perServing.protein)}g · C {formatNumber(perServing.carbs)}g · F{" "}
            {formatNumber(perServing.fats)}g
          </Text>
        </View>

        <Pressable style={styles.primaryButton} onPress={saveRecipe}>
          <Text style={styles.primaryText}>Save Recipe</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Saved Recipes</Text>
        {recipes.length === 0 ? (
          <Text style={styles.muted}>No recipes yet.</Text>
        ) : (
          recipes.map((recipe) => (
            <View key={recipe.id} style={styles.listItem}>
              <View style={styles.listInfo}>
                <Text style={styles.foodName}>{recipe.name}</Text>
                <Text style={styles.foodMeta}>
                  {formatNumber(recipe.calories)} kcal · P{" "}
                  {formatNumber(recipe.protein)}g · C {formatNumber(recipe.carbs)}g · F{" "}
                  {formatNumber(recipe.fats)}g
                </Text>
                <Text style={styles.muted}>Servings: {recipe.servings}</Text>
              </View>
              <View style={styles.listActions}>
                <Pressable
                  style={styles.useButton}
                  onPress={() => useRecipe(recipe)}
                  android_ripple={{ color: colors.softSuccess }}
                >
                  <Text style={styles.useText}>Use</Text>
                </Pressable>
                <Pressable
                  style={styles.deleteButton}
                  onPress={() => deleteRecipe(recipe.id)}
                  android_ripple={{ color: colors.softDanger }}
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>

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
            <View key={food.id} style={styles.listItem}>
              <View style={styles.listInfo}>
                <Text style={styles.foodName}>{food.name}</Text>
                <Text style={styles.foodMeta}>
                  {formatNumber(food.calories)} kcal · P {formatNumber(food.protein)}g · C{" "}
                  {formatNumber(food.carbs)}g · F {formatNumber(food.fats)}g
                </Text>
              </View>
              <View style={styles.listActions}>
                <Pressable
                  style={styles.useButton}
                  onPress={() => useFood(food)}
                  android_ripple={{ color: colors.softSuccess }}
                >
                  <Text style={styles.useText}>Use</Text>
                </Pressable>
                <Pressable
                  style={styles.deleteButton}
                  onPress={() => deleteFood(food.id)}
                  android_ripple={{ color: colors.softDanger }}
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
  sectionTitle: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.ink,
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
    textTransform: "capitalize",
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
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryText: {
    color: colors.ink,
    fontFamily: fonts.medium,
  },
  muted: {
    color: colors.muted,
    fontFamily: fonts.regular,
  },
  listItem: {
    paddingVertical: 10,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 8,
  },
  listInfo: {
    gap: 4,
    flex: 1,
  },
  listActions: {
    flexDirection: "row",
    gap: 8,
  },
  ingredientControls: {
    marginTop: 8,
    gap: 6,
  },
  gramsInput: {
    maxWidth: 120,
  },
  foodName: {
    fontFamily: fonts.medium,
    color: colors.ink,
  },
  foodMeta: {
    fontFamily: fonts.regular,
    color: colors.muted,
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
  favoriteButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  favoriteButtonActive: {
    backgroundColor: colors.softAccent,
    borderColor: colors.accent,
  },
  favoriteText: {
    fontFamily: fonts.medium,
    color: colors.accent,
  },
  summaryCard: {
    backgroundColor: colors.softAccent,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  summaryTitle: {
    fontFamily: fonts.medium,
    color: colors.ink,
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
  },
  searchButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  searchButtonText: {
    fontFamily: fonts.medium,
    color: colors.ink,
  },
  searchRowItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 10,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  quickAddButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softAccent,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  quickAddText: {
    fontFamily: fonts.bold,
    color: colors.accent,
    fontSize: 18,
  },
});
