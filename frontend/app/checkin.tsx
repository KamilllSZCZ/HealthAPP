import { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, radius, metricColors } from "@/src/theme";
import { AppText, Card, ScreenHeader, Button } from "@/src/components/ui";

const METRICS = [
  { key: "energy", label: "Energy", icon: "flash", low: "Drained", high: "Energized" },
  { key: "focus", label: "Focus", icon: "eye", low: "Scattered", high: "Sharp" },
  { key: "mood", label: "Mood", icon: "happy", low: "Low", high: "Great" },
  { key: "stress", label: "Stress", icon: "pulse", low: "Calm", high: "Stressed" },
  { key: "sleep_quality", label: "Sleep Quality", icon: "moon", low: "Poor", high: "Restful" },
  { key: "motivation", label: "Motivation", icon: "rocket", low: "Flat", high: "Driven" },
];

function Scale({ value, color, onChange, testID }: { value: number; color: string; onChange: (v: number) => void; testID?: string }) {
  return (
    <View style={styles.scale} testID={testID}>
      {Array.from({ length: 10 }).map((_, i) => {
        const v = i + 1;
        const active = value >= v;
        return (
          <TouchableOpacity
            key={v}
            style={[styles.scaleDot, { backgroundColor: active ? color : colors.surfaceHover }]}
            onPress={() => onChange(v)}
            testID={`${testID}-${v}`}
          />
        );
      })}
    </View>
  );
}

export default function Checkin() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const t = await api("/metrics/today");
    const v: Record<string, number> = {};
    METRICS.forEach((m) => { if (t[m.key]) v[m.key] = t[m.key]; });
    setValues(v);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const setVal = (k: string, v: number) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setValues((s) => ({ ...s, [k]: v }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api("/metrics", { method: "POST", body: values });
      setSaved(true);
    } finally { setSaving(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Daily Check-in" onBack={() => router.back()} />
        <AppText style={{ color: colors.textSecondary, marginBottom: 16, fontSize: 14 }}>
          Rate how you feel today on a scale of 1–10. This powers your trends and correlations.
        </AppText>

        {METRICS.map((m) => {
          const color = metricColors[m.key];
          const v = values[m.key] || 0;
          return (
            <Card key={m.key} style={{ marginBottom: 12 }} testID={`metric-${m.key}`}>
              <View style={styles.head}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={[styles.icon, { backgroundColor: color + "22" }]}><Ionicons name={m.icon as any} size={16} color={color} /></View>
                  <AppText weight="headingSemi" style={{ marginLeft: 10, fontSize: 15 }}>{m.label}</AppText>
                </View>
                <AppText weight="headingExtra" style={{ fontSize: 20, color: v ? color : colors.textTertiary }}>{v || "—"}</AppText>
              </View>
              <Scale value={v} color={color} onChange={(val) => setVal(m.key, val)} testID={`scale-${m.key}`} />
              <View style={styles.labels}>
                <AppText style={{ color: colors.textTertiary, fontSize: 11 }}>{m.low}</AppText>
                <AppText style={{ color: colors.textTertiary, fontSize: 11 }}>{m.high}</AppText>
              </View>
            </Card>
          );
        })}

        <Button title={saved ? "Saved ✓" : "Save Check-in"} onPress={save} loading={saving} testID="save-checkin-btn" style={{ marginTop: 8 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  icon: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  scale: { flexDirection: "row", gap: 6 },
  scaleDot: { flex: 1, height: 28, borderRadius: 6 },
  labels: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
});
