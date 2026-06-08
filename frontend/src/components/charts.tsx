import React from "react";
import { View } from "react-native";
import Svg, { Circle, Path, Defs, LinearGradient, Stop, Line, Rect } from "react-native-svg";
import { AppText } from "./ui";
import { colors } from "../theme";

/** Circular progress ring with optional center label. */
export function Ring({
  size = 120,
  stroke = 10,
  progress = 0,
  color = colors.accent,
  track = colors.border,
  children,
}: {
  size?: number;
  stroke?: number;
  progress: number; // 0..1
  color?: string;
  track?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  const dash = c * p;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${c - dash}`}
          strokeLinecap="round"
        />
      </Svg>
      {children}
    </View>
  );
}

/** Smooth line chart (catmull-rom-ish) with gradient fill. */
export function LineChart({
  data,
  width = 320,
  height = 140,
  color = colors.accent,
  showDots = false,
  maxOverride,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showDots?: boolean;
  maxOverride?: number;
}) {
  const pad = 8;
  const pts = data.filter((d) => typeof d === "number");
  if (pts.length < 2) {
    return (
      <View style={{ width, height, alignItems: "center", justifyContent: "center" }}>
        <AppText style={{ color: colors.textTertiary, fontSize: 13 }}>Not enough data yet</AppText>
      </View>
    );
  }
  const max = maxOverride ?? Math.max(...pts, 1);
  const min = Math.min(...pts, 0);
  const range = max - min || 1;
  const stepX = (width - pad * 2) / (data.length - 1);
  const coords = data.map((v, i) => {
    const val = typeof v === "number" ? v : min;
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (val - min) / range);
    return [x, y];
  });
  let d = `M ${coords[0][0]} ${coords[0][1]}`;
  for (let i = 1; i < coords.length; i++) {
    const [x0, y0] = coords[i - 1];
    const [x1, y1] = coords[i];
    const cx = (x0 + x1) / 2;
    d += ` C ${cx} ${y0} ${cx} ${y1} ${x1} ${y1}`;
  }
  const area = `${d} L ${coords[coords.length - 1][0]} ${height - pad} L ${coords[0][0]} ${height - pad} Z`;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="lc" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.35} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#lc)" />
      <Path d={d} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {showDots &&
        coords.map(([x, y], i) => <Circle key={i} cx={x} cy={y} r={3} fill={color} />)}
    </Svg>
  );
}

/** Vertical bar chart. */
export function BarChart({
  data,
  width = 320,
  height = 140,
  color = colors.accent,
  goal,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  goal?: number;
}) {
  const pad = 8;
  const max = Math.max(...data, goal || 0, 1);
  const n = data.length;
  const gap = 4;
  const barW = (width - pad * 2 - gap * (n - 1)) / n;
  const h = height - pad * 2;
  return (
    <Svg width={width} height={height}>
      {goal ? (
        <Line
          x1={pad}
          y1={pad + h * (1 - goal / max)}
          x2={width - pad}
          y2={pad + h * (1 - goal / max)}
          stroke={colors.textTertiary}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      ) : null}
      {data.map((v, i) => {
        const bh = Math.max((v / max) * h, 2);
        const x = pad + i * (barW + gap);
        const y = pad + (h - bh);
        const reached = goal ? v >= goal : true;
        return (
          <Rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={bh}
            rx={Math.min(barW / 2, 5)}
            fill={reached ? color : colors.surfaceHover}
          />
        );
      })}
    </Svg>
  );
}
