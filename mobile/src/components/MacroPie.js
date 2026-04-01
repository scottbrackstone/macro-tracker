import { View, Text, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors, fonts } from "../theme";

export const MACRO_COLORS = {
  protein: "#1D4ED8",
  carbs: "#F59E0B",
  fats: "#10B981",
  empty: colors.border,
};

function polar(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arc(cx, cy, r, start, end) {
  if (end - start >= 360) end = start + 359.99;
  const s = polar(cx, cy, r, end);
  const e = polar(cx, cy, r, start);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y} Z`;
}

export default function MacroPie({ protein = 0, carbs = 0, fats = 0, targets = {} }) {
  const proteinCals = protein * 4;
  const carbCals = carbs * 4;
  const fatCals = fats * 9;
  const total = proteinCals + carbCals + fatCals;

  const SIZE = 120;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const r = SIZE / 2 - 6;

  let slices;
  if (total === 0) {
    slices = [{ color: MACRO_COLORS.empty, startAngle: 0, endAngle: 360 }];
  } else {
    const data = [
      { cals: proteinCals, color: MACRO_COLORS.protein },
      { cals: carbCals, color: MACRO_COLORS.carbs },
      { cals: fatCals, color: MACRO_COLORS.fats },
    ];
    let angle = 0;
    slices = data.map((d) => {
      const start = angle;
      const sweep = (d.cals / total) * 360;
      angle += sweep;
      return { color: d.color, startAngle: start, endAngle: angle };
    });
  }

  const macros = [
    { label: "P", color: MACRO_COLORS.protein, value: protein, target: targets.protein },
    { label: "C", color: MACRO_COLORS.carbs, value: carbs, target: targets.carbs },
    { label: "F", color: MACRO_COLORS.fats, value: fats, target: targets.fats },
  ];

  return (
    <View style={styles.wrapper}>
      <Svg width={SIZE} height={SIZE}>
        {slices.map((s, i) => (
          <Path key={i} d={arc(cx, cy, r, s.startAngle, s.endAngle)} fill={s.color} />
        ))}
      </Svg>
      <View style={styles.legend}>
        {macros.map((m) => {
          const rem = Math.max(0, Math.round((m.target || 0) - m.value));
          return (
            <View key={m.label} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: m.color }]} />
              <Text style={styles.legendValue}>{Math.round(m.value)}g</Text>
              <Text style={styles.legendTarget}>{m.label} · {rem}g left</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    gap: 10,
  },
  legend: {
    gap: 5,
    alignSelf: "stretch",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  legendValue: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
    width: 40,
  },
  legendTarget: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
  },
});
