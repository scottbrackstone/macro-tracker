import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";

import { API_BASE_URL, fetchJson } from "../api/client";
import { colors, fonts } from "../theme";

const MODES = {
  AI: "ai",
  BARCODE: "barcode",
  MANUAL: "manual",
};

const GRAM_PRESETS = [50, 100, 150, 200, 250];
const MULTIPLIER_PRESETS = [0.5, 1, 1.5, 2];

export default function ScannerScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [mode, setMode] = useState(MODES.AI);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lastBarcode, setLastBarcode] = useState("");
  const [scanBanner, setScanBanner] = useState("");
  const [recents, setRecents] = useState([]);
  const [mealSlot, setMealSlot] = useState(1);
  const [mealsPerDay, setMealsPerDay] = useState(3);
  const [manualOnly, setManualOnly] = useState(false);
  const [targetDate, setTargetDate] = useState(null);
  const [showMenu, setShowMenu] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [favoriteSaved, setFavoriteSaved] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [manual, setManual] = useState({
    food_name: "",
    calories: "",
    protein: "",
    carbs: "",
    fats: "",
    grams: "",
  });
  const [planDays, setPlanDays] = useState([]);
  const [editLogId, setEditLogId] = useState(null);

  const planOffsets = [1, 2, 3, 4, 5, 6, 7];
  const parseServingGrams = (text) => {
    if (!text) return null;
    const match = text.match(/(\d+(\.\d+)?)\s*g/i);
    if (!match) return null;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
  };
  const formatDateParam = (dateValue) =>
    dateValue.toISOString().slice(0, 10);
  const formatDayLabel = (dateValue) =>
    dateValue.toLocaleDateString(undefined, { weekday: "short" });
  const formatDayNumber = (dateValue) =>
    dateValue.toLocaleDateString(undefined, { day: "numeric" });
  const formatNumber = (value) => Number(value || 0).toFixed(1);
  const buildTargetTimestamp = () => {
    if (!targetDate) return null;
    const date = new Date(targetDate);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(12, 0, 0, 0);
    return date.toISOString();
  };
  const buildDate = (offset) => {
    const base = new Date();
    const next = new Date(base);
    next.setDate(base.getDate() + offset);
    return next;
  };

  const buildDraft = (data) => ({
    food_name: data.food_name ?? "",
    calories:
      data.base_calories != null
        ? String(data.base_calories)
        : data.calories != null
          ? String(data.calories)
          : "",
    protein:
      data.base_protein != null
        ? String(data.base_protein)
        : data.protein != null
          ? String(data.protein)
          : "",
    carbs:
      data.base_carbs != null
        ? String(data.base_carbs)
        : data.carbs != null
          ? String(data.carbs)
          : "",
    fats:
      data.base_fats != null
        ? String(data.base_fats)
        : data.fats != null
          ? String(data.fats)
          : "",
    grams: data.grams != null ? String(data.grams) : "",
    multiplier: "1",
  });

  const applyResult = (data) => {
    setResult({ ...data, meal_slot: mealSlot });
    setDraft(buildDraft(data));
    setFavoriteSaved(false);
  };

  useEffect(() => {
    if (route.params?.mealSlot) {
      setMealSlot(route.params.mealSlot);
    }
    if (route.params?.prefill) {
      applyResult({ ...route.params.prefill, source: "Library" });
      setStatus("Review and confirm.");
    }
    if (route.params?.manualOnly) {
      setManualOnly(true);
      setMode(MODES.MANUAL);
      setShowMenu(false);
    } else {
      setManualOnly(false);
    }
    if (route.params?.targetDate) {
      setTargetDate(route.params.targetDate);
    } else {
      setTargetDate(null);
    }
    if (route.params?.editLog) {
      const log = route.params.editLog;
      setEditLogId(log.id);
      applyResult({
        food_name: log.food_name,
        calories: log.calories,
        protein: log.protein,
        carbs: log.carbs,
        fats: log.fats,
        source: log.source,
        meal_slot: log.meal_slot || 1,
      });
      setStatus("Editing meal. Update and save.");
      setShowMenu(false);
    } else {
      setEditLogId(null);
    }
    if (route.params?.startMode) {
      setMode(route.params.startMode);
      setManualOnly(route.params.startMode === MODES.MANUAL);
      setShowMenu(false);
    } else if (!route.params?.manualOnly && !route.params?.editLog) {
      setShowMenu(true);
    }
  }, [route.params]);

  useEffect(() => {
    setResult((prev) => (prev ? { ...prev, meal_slot: mealSlot } : prev));
  }, [mealSlot]);

  const handleSnap = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    setStatus("Analyzing photo...");
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: false,
      });
      const form = new FormData();
      form.append("file", {
        uri: photo.uri,
        name: "meal.jpg",
        type: "image/jpeg",
      });

      const response = await fetchJson("/analyze-photo", {
        method: "POST",
        body: form,
      });
      applyResult({ ...response, source: "AI" });
      setStatus("Review and confirm.");
      try {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
      } catch (err) {
        // Ignore haptics errors in environments without support.
      }
    } catch (err) {
      const message =
        err.message?.includes("Network request failed")
          ? `API not connected. Check ${API_BASE_URL}`
          : err.message;
      setStatus(message);
    } finally {
      setBusy(false);
    }
  };

  const handleBarcodeScanned = async ({ data }) => {
    if (busy || mode !== MODES.BARCODE) return;
    if (data === lastBarcode) return;
    setLastBarcode(data);
    setBusy(true);
    setStatus("Looking up barcode...");
    setScanBanner("Barcode captured. Looking up item...");
    try {
      const response = await fetchJson(`/scan-barcode/${data}`);
      applyResult({ ...response, source: "Barcode", barcode: data });
      setStatus("Review and confirm.");
      setScanBanner(`Captured: ${response.food_name}`);
      try {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
      } catch (err) {
        // Ignore haptics errors in environments without support.
      }
    } catch (err) {
      const message =
        err.message?.includes("Network request failed")
          ? `API not connected. Check ${API_BASE_URL}`
          : err.message;
      setStatus(message);
      setScanBanner("Barcode not found. Try another item.");
    } finally {
      setBusy(false);
    }
  };

  const logMeal = async () => {
    if (!result || !draft) return;
    setBusy(true);
    setStatus("Saving...");
    try {
      const isEdit = Boolean(editLogId);
      const gramsValue = Number(draft.grams);
      const multiplierValue = Number(draft.multiplier) || 1;
      const gramsUsed = gramsValue > 0 ? gramsValue : 100 * multiplierValue;
      const factor = gramsUsed / 100;
      const baseCalories = Number(draft.calories) || 0;
      const baseProtein = Number(draft.protein) || 0;
      const baseCarbs = Number(draft.carbs) || 0;
      const baseFats = Number(draft.fats) || 0;
      const targetTimestamp = buildTargetTimestamp();
      const endpoint = isEdit ? `/log-meal/${editLogId}` : "/log-meal";
      const method = isEdit ? "PUT" : "POST";
      await fetchJson(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          food_name: draft.food_name || result.food_name,
          source: result.source,
          calories: Math.round(baseCalories * factor),
          protein: baseProtein * factor,
          carbs: baseCarbs * factor,
          fats: baseFats * factor,
          grams: gramsUsed,
          base_calories: Math.round(baseCalories),
          base_protein: baseProtein,
          base_carbs: baseCarbs,
          base_fats: baseFats,
          meal_slot: result.meal_slot || 1,
          timestamp: targetTimestamp,
        }),
      });
      if (!isEdit && planDays.length > 0) {
        const dates = planDays.map((offset) =>
          formatDateParam(buildDate(offset))
        );
        await fetchJson("/log-meals/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meal: {
              food_name: draft.food_name || result.food_name,
              source: "Planned",
              calories: Math.round(baseCalories * factor),
              protein: baseProtein * factor,
              carbs: baseCarbs * factor,
              fats: baseFats * factor,
              grams: gramsUsed,
              base_calories: Math.round(baseCalories),
              base_protein: baseProtein,
              base_carbs: baseCarbs,
              base_fats: baseFats,
              meal_slot: result.meal_slot || 1,
            },
            dates,
          }),
        });
      }
      setResult(null);
      setDraft(null);
      setPlanDays([]);
      setEditLogId(null);
      setStatus(isEdit ? "Updated!" : "Saved!");
      try {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
      } catch (err) {
        // Ignore haptics errors in environments without support.
      }
    } catch (err) {
      const message =
        err.message?.includes("Network request failed")
          ? `API not connected. Check ${API_BASE_URL}`
          : err.message;
      setStatus(message);
    } finally {
      setBusy(false);
    }
  };

  const loadRecents = useCallback(async () => {
    try {
      const [data, target] = await Promise.all([
        fetchJson("/recents"),
        fetchJson("/macro-target"),
      ]);
      setRecents(data);
      setMealsPerDay(Math.max(1, target.meals_per_day || 3));
    } catch (err) {
      // Keep quiet; recents aren't critical for scanning flow.
    }
  }, []);

  useEffect(() => {
    loadRecents();
  }, [loadRecents]);

  useFocusEffect(
    useCallback(() => {
      loadRecents();
    }, [loadRecents])
  );

  const startLogMode = (nextMode) => {
    setShowMenu(false);
    setMode(nextMode);
    setManualOnly(nextMode === MODES.MANUAL);
    setStatus("");
  };

  if (showMenu) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Log Food</Text>
        <Text style={styles.muted}>Choose a logging method</Text>
        <View style={styles.menuCard}>
          <Pressable
            style={styles.menuButton}
            onPress={() => startLogMode(MODES.AI)}
            android_ripple={{ color: colors.softAccent }}
          >
            <Text style={styles.menuTitle}>Meal Scan</Text>
            <Text style={styles.muted}>Snap a photo and review macros</Text>
          </Pressable>
          <Pressable
            style={styles.menuButton}
            onPress={() => startLogMode(MODES.BARCODE)}
            android_ripple={{ color: colors.softAccent }}
          >
            <Text style={styles.menuTitle}>Barcode Scan</Text>
            <Text style={styles.muted}>Scan packaged foods fast</Text>
          </Pressable>
          <Pressable
            style={styles.menuButton}
            onPress={() => startLogMode(MODES.MANUAL)}
            android_ripple={{ color: colors.softAccent }}
          >
            <Text style={styles.menuTitle}>Manual Entry</Text>
            <Text style={styles.muted}>Search or type macros</Text>
          </Pressable>
          <Pressable
            style={styles.menuButton}
            onPress={() => navigation.navigate("Planner")}
            android_ripple={{ color: colors.softAccent }}
          >
            <Text style={styles.menuTitle}>Plan Ahead</Text>
            <Text style={styles.muted}>Schedule meals for future days</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  const handleManualChange = (key, value) => {
    setManual((prev) => ({ ...prev, [key]: value }));
  };

  const applySearchResult = (item) => {
    setManual({
      food_name: item.food_name || "",
      calories: item.calories != null ? String(item.calories) : "",
      protein: item.protein != null ? String(item.protein) : "",
      carbs: item.carbs != null ? String(item.carbs) : "",
      fats: item.fats != null ? String(item.fats) : "",
      grams: "",
    });
    setStatus("Loaded from database. Adjust grams if needed.");
    fetchJson("/food-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        food_name: item.food_name || "Search item",
        calories: Number(item.calories) || 0,
        protein: Number(item.protein) || 0,
        carbs: Number(item.carbs) || 0,
        fats: Number(item.fats) || 0,
        source: "Search",
        brand: item.brand || null,
        serving_size: item.serving_size || null,
      }),
    }).catch(() => {});
  };

  const saveFavorite = async () => {
    if (!result || favoriteBusy || favoriteSaved) return;
    setFavoriteBusy(true);
    try {
      await fetchJson("/food-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          food_name: result.food_name,
          calories: Number(result.calories) || 0,
          protein: Number(result.protein) || 0,
          carbs: Number(result.carbs) || 0,
          fats: Number(result.fats) || 0,
          source: result.source || "Manual",
          barcode: result.barcode || null,
          brand: result.brand || null,
          serving_size: result.serving_size || null,
          is_favorite: true,
        }),
      });
      setFavoriteSaved(true);
      setStatus("Saved to favorites.");
    } catch (err) {
      setStatus(err.message);
    } finally {
      setFavoriteBusy(false);
    }
  };

  const searchFood = async () => {
    const query = searchQuery.trim();
    if (!query) {
      setStatus("Enter a food name to search.");
      return;
    }
    setSearching(true);
    setStatus("Searching food database...");
    try {
      const results = await fetchJson(
        `/search-food?query=${encodeURIComponent(query)}`
      );
      setSearchResults(results);
      setStatus(results.length ? "Select a match to prefill." : "No matches found.");
    } catch (err) {
      setStatus(err.message);
    } finally {
      setSearching(false);
    }
  };

  const quickLogSearchItem = async (item) => {
    if (busy) return;
    setBusy(true);
    setStatus("Logging...");
    try {
      const baseCalories = Number(item.calories) || 0;
      const baseProtein = Number(item.protein) || 0;
      const baseCarbs = Number(item.carbs) || 0;
      const baseFats = Number(item.fats) || 0;
      await fetchJson("/log-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          food_name: item.food_name || "Search item",
          source: "Search",
          calories: Math.round(baseCalories),
          protein: baseProtein,
          carbs: baseCarbs,
          fats: baseFats,
          grams: 100,
          base_calories: Math.round(baseCalories),
          base_protein: baseProtein,
          base_carbs: baseCarbs,
          base_fats: baseFats,
          meal_slot: mealSlot,
        }),
      });
      setStatus("Logged.");
    } catch (err) {
      setStatus(err.message);
    } finally {
      setBusy(false);
    }
  };

  const logManual = async () => {
    if (!manual.food_name.trim()) {
      setStatus("Please enter a food name.");
      return;
    }
    setBusy(true);
    setStatus("Saving...");
    try {
      const gramsValue = Number(manual.grams);
      const gramsUsed = gramsValue > 0 ? gramsValue : 100;
      const factor = gramsUsed / 100;
      const baseCalories = Number(manual.calories) || 0;
      const baseProtein = Number(manual.protein) || 0;
      const baseCarbs = Number(manual.carbs) || 0;
      const baseFats = Number(manual.fats) || 0;
      const targetTimestamp = buildTargetTimestamp();
      await fetchJson("/log-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          food_name: manual.food_name.trim(),
          source: "Manual",
          calories: Math.round(baseCalories * factor),
          protein: baseProtein * factor,
          carbs: baseCarbs * factor,
          fats: baseFats * factor,
          grams: gramsUsed,
          base_calories: Math.round(baseCalories),
          base_protein: baseProtein,
          base_carbs: baseCarbs,
          base_fats: baseFats,
          meal_slot: mealSlot,
          timestamp: targetTimestamp,
        }),
      });
      if (planDays.length > 0) {
        const dates = planDays.map((offset) =>
          formatDateParam(buildDate(offset))
        );
        await fetchJson("/log-meals/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meal: {
              food_name: manual.food_name.trim(),
              source: "Planned",
              calories: Math.round(baseCalories * factor),
              protein: baseProtein * factor,
              carbs: baseCarbs * factor,
              fats: baseFats * factor,
              grams: gramsUsed,
              base_calories: Math.round(baseCalories),
              base_protein: baseProtein,
              base_carbs: baseCarbs,
              base_fats: baseFats,
              meal_slot: mealSlot,
            },
            dates,
          }),
        });
      }
      setStatus("Saved!");
      setManual({
        food_name: "",
        calories: "",
        protein: "",
        carbs: "",
        fats: "",
        grams: "",
      });
      setPlanDays([]);
      loadRecents();
    } catch (err) {
      const message =
        err.message?.includes("Network request failed")
          ? `API not connected. Check ${API_BASE_URL}`
          : err.message;
      setStatus(message);
    } finally {
      setBusy(false);
    }
  };

  const applyRecent = (meal) => {
    applyResult({ ...meal, source: "Recent" });
    setStatus("Review and confirm.");
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text>Requesting camera access...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>
          We need camera permissions to scan food.
        </Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {!manualOnly ? (
        <View style={styles.modeToggle}>
          <Pressable
            style={[
              styles.toggleButton,
              mode === MODES.AI && styles.toggleButtonActive,
            ]}
            onPress={() => setMode(MODES.AI)}
            android_ripple={{ color: colors.softAccent }}
          >
            <Text style={styles.toggleText}>AI Food Snap</Text>
          </Pressable>
          <Pressable
            style={[
              styles.toggleButton,
              mode === MODES.BARCODE && styles.toggleButtonActive,
            ]}
            onPress={() => setMode(MODES.BARCODE)}
            android_ripple={{ color: colors.softAccent }}
          >
            <Text style={styles.toggleText}>Barcode Scan</Text>
          </Pressable>
          <Pressable
            style={[
              styles.toggleButton,
              mode === MODES.MANUAL && styles.toggleButtonActive,
            ]}
            onPress={() => setMode(MODES.MANUAL)}
            android_ripple={{ color: colors.softAccent }}
          >
            <Text style={styles.toggleText}>Manual</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.mealSelector}>
        {Array.from({ length: mealsPerDay }, (_, idx) => idx + 1).map((slot) => (
          <Pressable
            key={slot}
            style={[
              styles.mealChip,
              mealSlot === slot && styles.mealChipActive,
            ]}
            onPress={() => setMealSlot(slot)}
          >
            <Text style={styles.mealChipText}>Meal {slot}</Text>
          </Pressable>
        ))}
      </View>
      {manualOnly ? (
        <Pressable
          style={({ pressed }) => [
            styles.linkButton,
            pressed && styles.linkButtonPressed,
          ]}
          onPress={() => {
            setManualOnly(false);
            navigation.setParams({ manualOnly: false });
            setMode(MODES.AI);
          }}
          android_ripple={{ color: colors.softAccent }}
        >
          <Text style={styles.linkButtonText}>Switch to camera modes</Text>
        </Pressable>
      ) : null}

      {!manualOnly && mode !== MODES.MANUAL ? (
        <View style={styles.cameraWrap}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            barcodeScannerSettings={{
              barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"],
            }}
            onBarcodeScanned={mode === MODES.BARCODE ? handleBarcodeScanned : undefined}
          />
          {mode === MODES.BARCODE ? (
            <View
              style={[
                styles.scanOverlay,
                scanBanner && styles.scanOverlayActive,
              ]}
            />
          ) : null}
        </View>
      ) : null}
      {!manualOnly && mode === MODES.BARCODE && scanBanner ? (
        <View style={styles.scanBanner}>
          <Text style={styles.scanBannerText} numberOfLines={2}>
            {scanBanner}
          </Text>
          <Pressable
            style={styles.scanReset}
            onPress={() => {
              setLastBarcode("");
              setScanBanner("");
              setStatus("");
            }}
          >
            <Text style={styles.scanResetText}>Scan again</Text>
          </Pressable>
        </View>
      ) : null}

      {!manualOnly && mode === MODES.AI && (
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleSnap}
          disabled={busy}
          android_ripple={{ color: colors.softAccent }}
        >
          <Text style={styles.buttonText}>
            {busy ? "Working..." : "Capture Photo"}
          </Text>
        </Pressable>
      )}

      {busy ? <ActivityIndicator style={styles.spinner} /> : null}
      {status ? <Text style={styles.status}>{status}</Text> : null}

      {result ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{result.food_name}</Text>
          <Text style={styles.cardMeta}>Edit before saving</Text>
          {draft ? (
            <View style={styles.manualGroup}>
              <View style={styles.field}>
                <Text style={styles.label}>Food name</Text>
                <TextInput
                  value={draft.food_name}
                  onChangeText={(value) =>
                    setDraft((prev) => ({ ...prev, food_name: value }))
                  }
                  placeholder="Food name"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                />
              </View>
              <View style={styles.row}>
                <View style={styles.field}>
                  <Text style={styles.label}>Calories</Text>
                  <TextInput
                    value={draft.calories}
                    onChangeText={(value) =>
                      setDraft((prev) => ({ ...prev, calories: value }))
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
                    value={draft.protein}
                    onChangeText={(value) =>
                      setDraft((prev) => ({ ...prev, protein: value }))
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
                    value={draft.carbs}
                    onChangeText={(value) =>
                      setDraft((prev) => ({ ...prev, carbs: value }))
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
                    value={draft.fats}
                    onChangeText={(value) =>
                      setDraft((prev) => ({ ...prev, fats: value }))
                    }
                    placeholder="Fats (g)"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                    style={[styles.input, styles.halfInput]}
                  />
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.field}>
                  <Text style={styles.label}>Grams (per 100g)</Text>
                  <TextInput
                    value={draft.grams}
                    onChangeText={(value) =>
                      setDraft((prev) => ({ ...prev, grams: value }))
                    }
                    placeholder="e.g. 180"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                    style={[styles.input, styles.halfInput]}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Multiplier</Text>
                  <TextInput
                    value={draft.multiplier}
                    onChangeText={(value) =>
                      setDraft((prev) => ({ ...prev, multiplier: value }))
                    }
                    placeholder="e.g. 0.5, 1, 1.5"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                    style={[styles.input, styles.halfInput]}
                  />
                </View>
              </View>
              <Text style={styles.sectionTitle}>Quick grams</Text>
              <View style={styles.presetRow}>
                {GRAM_PRESETS.map((amount) => (
                  <Pressable
                    key={amount}
                    style={styles.presetChip}
                    onPress={() =>
                      setDraft((prev) => ({ ...prev, grams: String(amount) }))
                    }
                    android_ripple={{ color: colors.softAccent }}
                  >
                    <Text style={styles.presetText}>{amount}g</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.sectionTitle}>Serving multiplier</Text>
              <View style={styles.presetRow}>
                {MULTIPLIER_PRESETS.map((amount) => (
                  <Pressable
                    key={amount}
                    style={styles.presetChip}
                    onPress={() =>
                      setDraft((prev) => ({
                        ...prev,
                        multiplier: String(amount),
                        grams: "",
                      }))
                    }
                    android_ripple={{ color: colors.softAccent }}
                  >
                    <Text style={styles.presetText}>{amount}x</Text>
                  </Pressable>
                ))}
              </View>
              {(() => {
                const servingGrams = parseServingGrams(result.serving_size);
                if (!servingGrams) return null;
                return (
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() =>
                      setDraft((prev) => ({
                        ...prev,
                        grams: String(servingGrams),
                        multiplier: "1",
                      }))
                    }
                    android_ripple={{ color: colors.softAccent }}
                  >
                    <Text style={styles.secondaryText}>
                      Use serving size ({servingGrams}g)
                    </Text>
                  </Pressable>
                );
              })()}
              {(() => {
                const gramsValue = Number(draft.grams);
                const multiplierValue = Number(draft.multiplier) || 1;
                const gramsUsed = gramsValue > 0 ? gramsValue : 100 * multiplierValue;
                const factor = gramsUsed / 100;
                const baseCalories = Number(draft.calories) || 0;
                const baseProtein = Number(draft.protein) || 0;
                const baseCarbs = Number(draft.carbs) || 0;
                const baseFats = Number(draft.fats) || 0;
                return (
                  <Text style={styles.muted}>
                    Totals: {formatNumber(baseCalories * factor)} kcal · P{" "}
                    {formatNumber(baseProtein * factor)}g · C{" "}
                    {formatNumber(baseCarbs * factor)}g · F{" "}
                    {formatNumber(baseFats * factor)}g
                  </Text>
                );
              })()}
              <Text style={styles.sectionTitle}>Plan next 7 days</Text>
              <View style={styles.planRow}>
                {planOffsets.map((offset) => {
                  const day = buildDate(offset);
                  const isSelected = planDays.includes(offset);
                  return (
                    <Pressable
                      key={offset}
                      style={[
                        styles.planItem,
                        isSelected && styles.planItemActive,
                      ]}
                      onPress={() =>
                        setPlanDays((prev) =>
                          prev.includes(offset)
                            ? prev.filter((value) => value !== offset)
                            : [...prev, offset]
                        )
                      }
                    >
                      <Text style={styles.planLabel}>{formatDayLabel(day)}</Text>
                      <Text style={styles.planNumber}>
                        {formatDayNumber(day)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
          {result.calories == null &&
          result.protein == null &&
          result.carbs == null &&
          result.fats == null ? (
            <Text style={styles.muted}>
              No nutrition data available for this item.
            </Text>
          ) : null}
          {result.questions && result.questions.length > 0 ? (
            <View>
              <Text style={styles.sectionTitle}>Quick questions</Text>
              {result.questions.map((question) => (
                <Text key={question} style={styles.muted}>
                  - {question}
                </Text>
              ))}
            </View>
          ) : null}
          {result.serving_size ? (
            <Text style={styles.muted}>Serving size: {result.serving_size}</Text>
          ) : null}
          {result.notes ? (
            <Text style={styles.muted}>{result.notes}</Text>
          ) : null}
          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
            ]}
            onPress={saveFavorite}
            disabled={favoriteBusy || favoriteSaved}
            android_ripple={{ color: colors.softAccent }}
          >
            <Text style={styles.secondaryText}>
              {favoriteSaved ? "Saved to favorites" : "Save to favorites"}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={logMeal}
            disabled={busy}
            android_ripple={{ color: colors.softAccent }}
          >
            <Text style={styles.buttonText}>Log Meal</Text>
          </Pressable>
        </View>
      ) : null}

      {!manualOnly ? (
        <>
          <Text style={styles.sectionTitle}>Recent Meals</Text>
          {recents.length === 0 ? (
            <Text style={styles.muted}>No recent meals yet.</Text>
          ) : (
            recents.map((meal) => (
              <Pressable
                key={meal.food_name}
                style={styles.recentItem}
                onPress={() => applyRecent(meal)}
                android_ripple={{ color: colors.softAccent }}
              >
            <Text style={styles.recentName}>{meal.food_name}</Text>
            <Text style={styles.recentMeta}>
              {formatNumber(meal.calories)} kcal · P {formatNumber(meal.protein)}g · C{" "}
              {formatNumber(meal.carbs)}g · F {formatNumber(meal.fats)}g
            </Text>
              </Pressable>
            ))
          )}
        </>
      ) : null}

      <Text style={styles.sectionTitle}>Search Food Database</Text>
      <View style={styles.searchRow}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="e.g. chicken breast"
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.searchInput]}
        />
        <Pressable
          style={({ pressed }) => [
            styles.searchButton,
            pressed && styles.searchButtonPressed,
          ]}
          onPress={searchFood}
          android_ripple={{ color: colors.softAccent }}
        >
          <Text style={styles.searchButtonText}>Search</Text>
        </Pressable>
      </View>
      {searching ? <ActivityIndicator /> : null}
      {searchResults.map((item, index) => (
        <View key={`${item.food_name}-${index}`} style={styles.searchResultRow}>
          <Pressable
            style={styles.searchResultInfo}
            onPress={() => applySearchResult(item)}
            android_ripple={{ color: colors.softAccent }}
          >
            <Text style={styles.recentName}>{item.food_name}</Text>
            <Text style={styles.recentMeta}>
              {item.calories != null ? formatNumber(item.calories) : "-"} kcal · P{" "}
              {item.protein != null ? formatNumber(item.protein) : "-"}g · C{" "}
              {item.carbs != null ? formatNumber(item.carbs) : "-"}g · F{" "}
              {item.fats != null ? formatNumber(item.fats) : "-"}g
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.quickAddButton,
              pressed && styles.quickAddButtonPressed,
            ]}
            onPress={() => quickLogSearchItem(item)}
            android_ripple={{ color: colors.softAccent }}
          >
            <Text style={styles.quickAddText}>+</Text>
          </Pressable>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Manual Entry</Text>
      <View style={styles.manualGroup}>
        <View style={styles.field}>
          <Text style={styles.label}>Food name</Text>
          <TextInput
            value={manual.food_name}
            onChangeText={(value) => handleManualChange("food_name", value)}
            placeholder="Food name"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>
        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>Calories</Text>
            <TextInput
              value={manual.calories}
              onChangeText={(value) => handleManualChange("calories", value)}
              placeholder="Calories"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              style={[styles.input, styles.halfInput]}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Protein (g)</Text>
            <TextInput
              value={manual.protein}
              onChangeText={(value) => handleManualChange("protein", value)}
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
              value={manual.carbs}
              onChangeText={(value) => handleManualChange("carbs", value)}
              placeholder="Carbs (g)"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              style={[styles.input, styles.halfInput]}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Fats (g)</Text>
            <TextInput
              value={manual.fats}
              onChangeText={(value) => handleManualChange("fats", value)}
              placeholder="Fats (g)"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              style={[styles.input, styles.halfInput]}
            />
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Grams (per 100g)</Text>
          <TextInput
            value={manual.grams}
            onChangeText={(value) => handleManualChange("grams", value)}
            placeholder="e.g. 180"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            style={styles.input}
          />
        </View>
        <Text style={styles.sectionTitle}>Quick grams</Text>
        <View style={styles.presetRow}>
          {GRAM_PRESETS.map((amount) => (
            <Pressable
              key={amount}
              style={styles.presetChip}
              onPress={() => handleManualChange("grams", String(amount))}
              android_ripple={{ color: colors.softAccent }}
            >
              <Text style={styles.presetText}>{amount}g</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={logManual}
          disabled={busy}
          android_ripple={{ color: colors.softAccent }}
        >
          <Text style={styles.buttonText}>Save Manual Meal</Text>
        </Pressable>
        <Text style={styles.sectionTitle}>Plan next 7 days</Text>
        <View style={styles.planRow}>
          {planOffsets.map((offset) => {
            const day = buildDate(offset);
            const isSelected = planDays.includes(offset);
            return (
              <Pressable
                key={offset}
                style={[
                  styles.planItem,
                  isSelected && styles.planItemActive,
                ]}
                onPress={() =>
                  setPlanDays((prev) =>
                    prev.includes(offset)
                      ? prev.filter((value) => value !== offset)
                      : [...prev, offset]
                  )
                }
              >
                <Text style={styles.planLabel}>{formatDayLabel(day)}</Text>
                <Text style={styles.planNumber}>{formatDayNumber(day)}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: colors.ink,
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
  },
  menuButton: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 4,
  },
  menuTitle: {
    fontFamily: fonts.medium,
    color: colors.ink,
    fontSize: 16,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  camera: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cameraWrap: {
    position: "relative",
  },
  scanOverlay: {
    position: "absolute",
    top: "20%",
    left: "10%",
    right: "10%",
    height: "40%",
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  scanOverlayActive: {
    borderColor: colors.accent,
    backgroundColor: "rgba(122, 103, 255, 0.08)",
  },
  button: {
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
  buttonPressed: {
    opacity: 0.85,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryButtonPressed: {
    backgroundColor: colors.softAccent,
  },
  secondaryText: {
    fontFamily: fonts.medium,
    color: colors.ink,
  },
  buttonText: {
    color: "#fff",
    fontFamily: fonts.medium,
  },
  status: {
    color: colors.muted,
    fontFamily: fonts.regular,
  },
  muted: {
    color: colors.muted,
    fontFamily: fonts.regular,
  },
  spinner: {
    marginTop: 4,
  },
  card: {
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    flexWrap: "wrap",
    width: "100%",
    color: colors.ink,
  },
  cardMeta: {
    color: colors.muted,
    fontFamily: fonts.regular,
  },
  modeToggle: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  mealSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  mealChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  mealChipActive: {
    backgroundColor: colors.softAccent,
    borderColor: colors.accent,
  },
  mealChipText: {
    fontFamily: fonts.medium,
    color: colors.ink,
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  presetText: {
    fontFamily: fonts.medium,
    color: colors.ink,
  },
  linkButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.softAccent,
  },
  linkButtonPressed: {
    opacity: 0.85,
  },
  linkButtonText: {
    fontFamily: fonts.medium,
    color: colors.accent,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderColor: colors.border,
    borderWidth: 1,
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
  sectionTitle: {
    fontSize: 18,
    fontFamily: fonts.medium,
    marginTop: 8,
    color: colors.ink,
  },
  recentItem: {
    paddingVertical: 10,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
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
  searchButtonPressed: {
    backgroundColor: colors.softAccent,
  },
  searchButtonText: {
    fontFamily: fonts.medium,
    color: colors.ink,
  },
  searchResult: {
    paddingVertical: 10,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  searchResultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 10,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  searchResultInfo: {
    flex: 1,
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
  quickAddButtonPressed: {
    opacity: 0.8,
  },
  quickAddText: {
    fontFamily: fonts.bold,
    color: colors.accent,
    fontSize: 18,
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
  manualGroup: {
    gap: 10,
    marginBottom: 24,
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
  planRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  planItem: {
    width: 56,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  planItemActive: {
    backgroundColor: colors.softAccent,
    borderColor: colors.accent,
  },
  planLabel: {
    fontSize: 12,
    color: colors.muted,
    fontFamily: fonts.regular,
  },
  planNumber: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.ink,
  },
  scanBanner: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.ink,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  scanBannerText: {
    color: "#F8FAFC",
    fontFamily: fonts.regular,
    flex: 1,
  },
  scanReset: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.accent,
    borderRadius: 8,
  },
  scanResetText: {
    color: "#fff",
    fontFamily: fonts.medium,
  },
});
