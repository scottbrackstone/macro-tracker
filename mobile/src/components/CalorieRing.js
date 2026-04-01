import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors, fonts } from "../theme";

const SIZE = 200;
const STROKE = 18;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function CalorieRing({ consumed = 0, goal = 0, exerciseBurned = 0 }) {
  const net = consumed - exerciseBurned;
  const remaining = Math.max(0, goal - net);
  const over = net > goal && goal > 0;
  const progress = goal > 0 ? Math.min(net / goal, 1) : 0;
  const offset = CIRCUMFERENCE * (1 - progress);
  const ringColor = over ? colors.danger : colors.accent;

  return (
    <View style={styles.wrapper}>
      <Svg width={SIZE} height={SIZE}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={colors.border}
          strokeWidth={STROKE}
          fill="none"
        />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={ringColor}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${SIZE / 2}, ${SIZE / 2}`}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.remaining, over && styles.remainingOver]}>
          {Math.round(remaining)}
        </Text>
        <Text style={styles.label}>{over ? "over budget" : "remaining"}</Text>
        <Text style={styles.sub}>{Math.round(net)} / {Math.round(goal)} kcal</Text>
        {exerciseBurned > 0 && (
          <Text style={styles.exercise}>+{Math.round(exerciseBurned)} exercise</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    width: SIZE,
    height: SIZE,
  },
  remaining: {
    fontFamily: fonts.bold,
    fontSize: 40,
    color: colors.ink,
    lineHeight: 44,
  },
  remainingOver: {
    color: colors.danger,
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
  },
  sub: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  exercise: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#10B981",
    marginTop: 2,
  },
});
