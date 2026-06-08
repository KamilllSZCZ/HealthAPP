import { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, radius } from "@/src/theme";
import { AppText, Card, ScreenHeader, Button } from "@/src/components/ui";

const LABELS: Record<string, string> = {
  supplements: "Today's Supplements", water: "Water Intake", meals: "Meals", weight: "Weight",
  steps: "Steps", sleep: "Sleep", energy: "Energy", focus: "Focus", mood: "Mood",
  habits: "Habits", goals: "Weekly Goals", projects: "Active Projects", streaks: "Streaks", review: "Weekly Review",
};

export default function DashboardCustomize() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [widgets, setWidgets] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const cfg = await api("/dashboard/config");
    const list = (cfg.widgets || []).filter((w: any) => w.key !== "completion").sort((a: any, b: any) => a.order - b.order);
    setWidgets(list);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const update = (key: string, patch: any) => setWidgets((ws) => ws.map((w) => (w.key === key ? { ...w, ...patch } : w)));

  const move = (idx: number, dir: number) => {
    const ni = idx + dir;
    if (ni < 0 || ni >= widgets.length) return;
    const copy = [...widgets];
    [copy[idx], copy[ni]] = [copy[ni], copy[idx]];
    setWidgets(copy);
  };

  const save = async () => {
    setSaving(true);
    const ordered = widgets.map((w, i) => ({ ...w, order: i + 1 }));
    const payload = [{ key: "completion", visible: true, favorite: true, size: "full", order: 0 }, ...ordered];
    try {
      await api("/dashboard/config", { method: "PUT", body: { widgets: payload } });
      router.back();
    } finally { setSaving(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Customize Dashboard" onBack={() => router.back()} />
        <AppText style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 16 }}>
          Reorder, resize, hide and favorite widgets. Tap the star to favorite, the size icon to toggle width.
        </AppText>

        {widgets.map((w, idx) => (
          <Card key={w.key} style={[styles.row, !w.visible ? { opacity: 0.5 } : null]} testID={`customize-${w.key}`}>
            <View style={{ marginRight: 10 }}>
              <TouchableOpacity onPress={() => move(idx, -1)} testID={`move-up-${w.key}`}><Ionicons name="chevron-up" size={20} color={idx === 0 ? colors.surfaceHover : colors.textSecondary} /></TouchableOpacity>
              <TouchableOpacity onPress={() => move(idx, 1)} testID={`move-down-${w.key}`}><Ionicons name="chevron-down" size={20} color={idx === widgets.length - 1 ? colors.surfaceHover : colors.textSecondary} /></TouchableOpacity>
            </View>
            <AppText weight="bold" style={{ flex: 1, fontSize: 14 }}>{LABELS[w.key] || w.key}</AppText>

            <TouchableOpacity onPress={() => update(w.key, { favorite: !w.favorite })} style={styles.iconBtn} testID={`fav-${w.key}`}>
              <Ionicons name={w.favorite ? "star" : "star-outline"} size={18} color={w.favorite ? colors.warning : colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => update(w.key, { size: w.size === "full" ? "half" : "full" })} style={styles.iconBtn} testID={`size-${w.key}`}>
              <Ionicons name={w.size === "full" ? "tablet-landscape" : "tablet-portrait"} size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => update(w.key, { visible: !w.visible })} style={styles.iconBtn} testID={`visible-${w.key}`}>
              <Ionicons name={w.visible ? "eye" : "eye-off"} size={18} color={w.visible ? colors.accent : colors.textTertiary} />
            </TouchableOpacity>
          </Card>
        ))}

        <Button title="Save Layout" onPress={save} loading={saving} style={{ marginTop: 16 }} testID="save-layout-btn" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", marginBottom: 8, paddingVertical: 12 },
  iconBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
});
