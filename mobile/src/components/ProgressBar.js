import { StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "../theme";

export default function ProgressBar({ label, value, goal, unit }) {
  const safeGoal = goal > 0 ? goal : 1;
  const progress = Math.min(value / safeGoal, 1);
  const goalLabel = goal > 0 ? Math.round(goal) : "--";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>
          {Math.round(value)} / {goalLabel} {unit}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: fonts.medium,
    color: colors.ink,
  },
  value: {
    fontSize: 14,
    color: colors.muted,
    fontFamily: fonts.regular,
  },
  track: {
    height: 10,
    backgroundColor: colors.border,
    borderRadius: 999,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: colors.accent,
  },
});
