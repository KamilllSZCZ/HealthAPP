import { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/auth";
import { api } from "@/src/api";
import { colors, spacing, radius, fonts, metricColors } from "@/src/theme";
import { AppText, Card } from "@/src/components/ui";
import { Ring } from "@/src/components/charts";

const { width } = Dimensions.get("window");

const WIDGET_META: Record<string, { title: string; icon: string; route?: string; color: string }> = {
  supplements: { title: "Supplements", icon: "medical", route: "/(tabs)/supplements", color: colors.accent },
  water: { title: "Water", icon: "water", route: "/water", color: colors.blue },
  meals: { title: "Nutrition", icon: "restaurant", route: "/(tabs)/nutrition", color: colors.success },
  weight: { title: "Weight", icon: "barbell", route: "/weight", color: colors.cyan },
  steps: { title: "Steps", icon: "walk", route: "/integrations", color: colors.warning },
  sleep: { title: "Sleep", icon: "moon", route: "/sleep", color: "#8B5CF6" },
  energy: { title: "Energy", icon: "flash", route: "/checkin", color: metricColors.energy },
  focus: { title: "Focus", icon: "eye", route: "/checkin", color: metricColors.focus },
  mood: { title: "Mood", icon: "happy", route: "/checkin", color: metricColors.mood },
  habits: { title: "Habits", icon: "repeat", route: "/habits", color: colors.success },
  goals: { title: "Goals", icon: "flag", route: "/goals", color: colors.pink },
  projects: { title: "Projects", icon: "construct", route: "/projects", color: colors.warning },
  streaks: { title: "Streaks", icon: "flame", route: "/habits", color: "#FB923C" },
  review: { title: "Weekly Review", icon: "calendar", route: "/weekly-review", color: colors.accent },
};

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [summary, setSummary] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([api("/dashboard/summary"), api("/dashboard/config")]);
      setSummary(s);
      setConfig(c);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const addWater = async (amount: number) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await api("/water", { method: "POST", body: { amount } });
    load();
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  const w = summary?.widgets || {};
  const visibleWidgets = (config?.widgets || [])
    .filter((x: any) => x.visible && x.key !== "completion")
    .sort((a: any, b: any) => a.order - b.order);

  const completion = summary?.completion_percent ?? 0;
  const score = summary?.health_score ?? 0;

  const renderWidgetValue = (key: string) => {
    switch (key) {
      case "supplements":
        return { main: `${w.supplements?.taken ?? 0}/${w.supplements?.needed ?? 0}`, sub: "taken today" };
      case "water":
        return { main: `${((w.water?.total ?? 0) / 1000).toFixed(1)}L`, sub: `${w.water?.percent ?? 0}% of goal` };
      case "meals":
        return { main: `${w.meals?.calories ?? 0}`, sub: `kcal · ${w.meals?.protein ?? 0}g protein` };
      case "weight":
        return { main: w.weight?.current ? `${w.weight.current}kg` : "—", sub: w.weight?.target ? `target ${w.weight.target}kg` : "no target" };
      case "steps":
        return { main: `${w.steps?.value ?? 0}`, sub: `of ${w.steps?.goal ?? 10000}` };
      case "sleep":
        return { main: w.sleep?.duration ? `${w.sleep.duration}h` : "—", sub: `goal ${w.sleep?.goal ?? 8}h` };
      case "energy":
        return { main: w.energy?.value ? `${w.energy.value}/10` : "—", sub: "energy" };
      case "focus":
        return { main: w.focus?.value ? `${w.focus.value}/10` : "—", sub: "focus" };
      case "mood":
        return { main: w.mood?.value ? `${w.mood.value}/10` : "—", sub: "mood" };
      case "habits":
        return { main: `${w.habits?.done ?? 0}/${w.habits?.total ?? 0}`, sub: "done today" };
      case "goals":
        return { main: `${w.goals?.active ?? 0}`, sub: "active goals" };
      case "projects":
        return { main: `${w.projects?.active ?? 0}`, sub: "active projects" };
      case "streaks":
        return { main: "🔥", sub: "view streaks" };
      case "review":
        return { main: "Reflect", sub: "weekly review" };
      default:
        return { main: "—", sub: "" };
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <AppText style={{ color: colors.textSecondary, fontSize: 14 }}>{greeting()},</AppText>
            <AppText weight="headingExtra" style={{ fontSize: 26 }}>{user?.name || "there"}</AppText>
          </View>
          <TouchableOpacity onPress={() => router.push("/dashboard-customize")} style={styles.headerBtn} testID="dashboard-customize-btn">
            <Ionicons name="options" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Completion hero */}
        <Card style={styles.hero} testID="dashboard-completion">
          <Ring size={120} stroke={11} progress={completion / 100} color={colors.accent}>
            <View style={{ alignItems: "center" }}>
              <AppText weight="headingExtra" style={{ fontSize: 30 }}>{completion}%</AppText>
              <AppText style={{ color: colors.textTertiary, fontSize: 11 }}>complete</AppText>
            </View>
          </Ring>
          <View style={{ flex: 1, marginLeft: 20 }}>
            <View style={styles.scoreRow}>
              <Ionicons name="pulse" size={16} color={colors.success} />
              <AppText weight="bold" style={{ color: colors.success }}> Health Score {score}</AppText>
            </View>
            <AppText style={{ color: colors.textSecondary, fontSize: 13, marginTop: 8, lineHeight: 19 }}>
              {completion >= 100 ? "All done for today. Incredible work!" : "Here's what still needs your attention today."}
            </AppText>
            <View style={{ marginTop: 12, gap: 7 }}>
              {(summary?.tasks || []).filter((t: any) => !t.done).slice(0, 3).map((t: any) => (
                <View key={t.key} style={styles.taskRow}>
                  <View style={styles.taskDot} />
                  <AppText style={{ color: colors.textSecondary, fontSize: 13 }}>{t.label}</AppText>
                </View>
              ))}
              {(summary?.tasks || []).every((t: any) => t.done) && (summary?.tasks || []).length > 0 && (
                <View style={styles.taskRow}>
                  <Ionicons name="checkmark-circle" size={15} color={colors.success} />
                  <AppText style={{ color: colors.success, fontSize: 13, marginLeft: 6 }}>Everything complete</AppText>
                </View>
              )}
            </View>
          </View>
        </Card>

        {/* Quick water */}
        <Card style={{ marginTop: 12 }} testID="dashboard-quick-water">
          <View style={styles.quickHeader}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="water" size={18} color={colors.blue} />
              <AppText weight="headingSemi" style={{ marginLeft: 8, fontSize: 15 }}>Quick Hydrate</AppText>
            </View>
            <AppText style={{ color: colors.textSecondary, fontSize: 13 }}>
              {((w.water?.total ?? 0) / 1000).toFixed(2)}L / {((w.water?.goal ?? 2500) / 1000).toFixed(1)}L
            </AppText>
          </View>
          <View style={styles.waterBtns}>
            {[250, 500, 750, 1000].map((amt) => (
              <TouchableOpacity key={amt} style={styles.waterBtn} onPress={() => addWater(amt)} testID={`quick-water-${amt}`}>
                <AppText weight="bold" style={{ color: colors.blue, fontSize: 13 }}>+{amt}</AppText>
                <AppText style={{ color: colors.textTertiary, fontSize: 10 }}>ml</AppText>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Widget grid */}
        <View style={styles.grid}>
          {visibleWidgets.map((wd: any) => {
            const meta = WIDGET_META[wd.key];
            if (!meta) return null;
            const val = renderWidgetValue(wd.key);
            const full = wd.size === "full";
            return (
              <TouchableOpacity
                key={wd.key}
                activeOpacity={0.85}
                onPress={() => meta.route && router.push(meta.route as any)}
                style={[styles.widget, { width: full ? "100%" : (width - 16 * 2 - 10) / 2 }]}
                testID={`widget-${wd.key}`}
              >
                <View style={styles.widgetHead}>
                  <View style={[styles.widgetIcon, { backgroundColor: meta.color + "22" }]}>
                    <Ionicons name={meta.icon as any} size={16} color={meta.color} />
                  </View>
                  {wd.favorite && <Ionicons name="star" size={13} color={colors.warning} />}
                </View>
                <AppText weight="headingExtra" style={{ fontSize: full ? 26 : 22, marginTop: 10 }}>{val.main}</AppText>
                <AppText style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>{meta.title}</AppText>
                <AppText style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>{val.sub}</AppText>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  headerBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center",
  },
  hero: { flexDirection: "row", alignItems: "center" },
  scoreRow: { flexDirection: "row", alignItems: "center" },
  taskRow: { flexDirection: "row", alignItems: "center" },
  taskDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent, marginRight: 8 },
  quickHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  waterBtns: { flexDirection: "row", gap: 8 },
  waterBtn: {
    flex: 1, backgroundColor: colors.blue + "1A", borderRadius: radius.md, paddingVertical: 12,
    alignItems: "center", borderWidth: 1, borderColor: colors.blue + "33",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  widget: {
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: 14, minHeight: 110,
  },
  widgetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  widgetIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
