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
import { useFocusEffect } from "@react-navigation/native";

import { API_BASE_URL, fetchJson } from "../api/client";
import { colors, fonts } from "../theme";

const MODES = {
  AI: "ai",
  BARCODE: "barcode",
};

export default function ScannerScreen() {
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
  const [manual, setManual] = useState({
    food_name: "",
    calories: "",
    protein: "",
    carbs: "",
    fats: "",
  });
  const [planDays, setPlanDays] = useState([]);

  const planOffsets = [1, 2, 3, 4, 5, 6, 7];
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

  const buildDraft = (data) => ({
    food_name: data.food_name ?? "",
    calories: data.calories != null ? String(data.calories) : "",
    protein: data.protein != null ? String(data.protein) : "",
    carbs: data.carbs != null ? String(data.carbs) : "",
    fats: data.fats != null ? String(data.fats) : "",
    multiplier: "1",
  });

  const applyResult = (data) => {
    setResult(data);
    setDraft(buildDraft(data));
  };

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
      applyResult({ ...response, source: "Barcode" });
      setStatus("Review and confirm.");
      setScanBanner(`Captured: ${response.food_name}`);
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
      const factor = Number(draft.multiplier) || 1;
      await fetchJson("/log-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          food_name: draft.food_name || result.food_name,
          source: result.source,
          calories: Math.round((Number(draft.calories) || 0) * factor),
          protein: Number(draft.protein) * factor || 0,
          carbs: Number(draft.carbs) * factor || 0,
          fats: Number(draft.fats) * factor || 0,
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
              food_name: draft.food_name || result.food_name,
              source: "Planned",
              calories: Math.round((Number(draft.calories) || 0) * factor),
              protein: Number(draft.protein) * factor || 0,
              carbs: Number(draft.carbs) * factor || 0,
              fats: Number(draft.fats) * factor || 0,
            },
            dates,
          }),
        });
      }
      setResult(null);
      setDraft(null);
      setPlanDays([]);
      setStatus("Saved!");
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
      const data = await fetchJson("/recents");
      setRecents(data);
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

  const handleManualChange = (key, value) => {
    setManual((prev) => ({ ...prev, [key]: value }));
  };

  const logManual = async () => {
    if (!manual.food_name.trim()) {
      setStatus("Please enter a food name.");
      return;
    }
    setBusy(true);
    setStatus("Saving...");
    try {
      await fetchJson("/log-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          food_name: manual.food_name.trim(),
          source: "Manual",
          calories: Number(manual.calories) || 0,
          protein: Number(manual.protein) || 0,
          carbs: Number(manual.carbs) || 0,
          fats: Number(manual.fats) || 0,
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
              calories: Number(manual.calories) || 0,
              protein: Number(manual.protein) || 0,
              carbs: Number(manual.carbs) || 0,
              fats: Number(manual.fats) || 0,
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
      <View style={styles.modeToggle}>
        <Pressable
          style={[
            styles.toggleButton,
            mode === MODES.AI && styles.toggleButtonActive,
          ]}
          onPress={() => setMode(MODES.AI)}
        >
          <Text style={styles.toggleText}>AI Food Snap</Text>
        </Pressable>
        <Pressable
          style={[
            styles.toggleButton,
            mode === MODES.BARCODE && styles.toggleButtonActive,
          ]}
          onPress={() => setMode(MODES.BARCODE)}
        >
          <Text style={styles.toggleText}>Barcode Scan</Text>
        </Pressable>
      </View>

      <CameraView
        ref={cameraRef}
        style={styles.camera}
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"],
        }}
        onBarcodeScanned={mode === MODES.BARCODE ? handleBarcodeScanned : undefined}
      />
      {mode === MODES.BARCODE && scanBanner ? (
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

      {mode === MODES.AI && (
        <Pressable style={styles.button} onPress={handleSnap} disabled={busy}>
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
              <TextInput
                value={draft.food_name}
                onChangeText={(value) =>
                  setDraft((prev) => ({ ...prev, food_name: value }))
                }
                placeholder="Food name"
                style={styles.input}
              />
              <View style={styles.row}>
                <TextInput
                  value={draft.calories}
                  onChangeText={(value) =>
                    setDraft((prev) => ({ ...prev, calories: value }))
                  }
                  placeholder="Calories"
                  keyboardType="numeric"
                  style={[styles.input, styles.halfInput]}
                />
                <TextInput
                  value={draft.protein}
                  onChangeText={(value) =>
                    setDraft((prev) => ({ ...prev, protein: value }))
                  }
                  placeholder="Protein (g)"
                  keyboardType="numeric"
                  style={[styles.input, styles.halfInput]}
                />
              </View>
              <View style={styles.row}>
                <TextInput
                  value={draft.carbs}
                  onChangeText={(value) =>
                    setDraft((prev) => ({ ...prev, carbs: value }))
                  }
                  placeholder="Carbs (g)"
                  keyboardType="numeric"
                  style={[styles.input, styles.halfInput]}
                />
                <TextInput
                  value={draft.fats}
                  onChangeText={(value) =>
                    setDraft((prev) => ({ ...prev, fats: value }))
                  }
                  placeholder="Fats (g)"
                  keyboardType="numeric"
                  style={[styles.input, styles.halfInput]}
                />
              </View>
              <TextInput
                value={draft.multiplier}
                onChangeText={(value) =>
                  setDraft((prev) => ({ ...prev, multiplier: value }))
                }
                placeholder="Portion multiplier (e.g. 0.5, 1, 1.5)"
                keyboardType="numeric"
                style={styles.input}
              />
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
          <Pressable style={styles.button} onPress={logMeal} disabled={busy}>
            <Text style={styles.buttonText}>Log Meal</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Recent Meals</Text>
      {recents.length === 0 ? (
        <Text style={styles.muted}>No recent meals yet.</Text>
      ) : (
        recents.map((meal) => (
          <Pressable
            key={meal.food_name}
            style={styles.recentItem}
            onPress={() => applyRecent(meal)}
          >
            <Text style={styles.recentName}>{meal.food_name}</Text>
            <Text style={styles.recentMeta}>
              {meal.calories} kcal · P {meal.protein}g · C {meal.carbs}g · F{" "}
              {meal.fats}g
            </Text>
          </Pressable>
        ))
      )}

      <Text style={styles.sectionTitle}>Manual Entry</Text>
      <View style={styles.manualGroup}>
        <TextInput
          value={manual.food_name}
          onChangeText={(value) => handleManualChange("food_name", value)}
          placeholder="Food name"
          style={styles.input}
        />
        <View style={styles.row}>
          <TextInput
            value={manual.calories}
            onChangeText={(value) => handleManualChange("calories", value)}
            placeholder="Calories"
            keyboardType="numeric"
            style={[styles.input, styles.halfInput]}
          />
          <TextInput
            value={manual.protein}
            onChangeText={(value) => handleManualChange("protein", value)}
            placeholder="Protein (g)"
            keyboardType="numeric"
            style={[styles.input, styles.halfInput]}
          />
        </View>
        <View style={styles.row}>
          <TextInput
            value={manual.carbs}
            onChangeText={(value) => handleManualChange("carbs", value)}
            placeholder="Carbs (g)"
            keyboardType="numeric"
            style={[styles.input, styles.halfInput]}
          />
          <TextInput
            value={manual.fats}
            onChangeText={(value) => handleManualChange("fats", value)}
            placeholder="Fats (g)"
            keyboardType="numeric"
            style={[styles.input, styles.halfInput]}
          />
        </View>
        <Pressable style={styles.button} onPress={logManual} disabled={busy}>
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
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
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
