import { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Dimensions } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, radius, metricColors } from "@/src/theme";
import { AppText, Card, Button, SegmentedControl, SectionTitle, EmptyState } from "@/src/components/ui";
import { LineChart } from "@/src/components/charts";

const { width } = Dimensions.get("window");
const chartW = width - 32 - 32;

const TREND_META: Record<string, { label: string; color: string; max?: number }> = {
  energy: { label: "Energy", color: metricColors.energy, max: 10 },
  focus: { label: "Focus", color: metricColors.focus, max: 10 },
  mood: { label: "Mood", color: metricColors.mood, max: 10 },
  sleep: { label: "Sleep (h)", color: "#8B5CF6" },
  water: { label: "Water (ml)", color: colors.blue },
};

export default function Analytics() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any>(null);
  const [score, setScore] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [period, setPeriod] = useState("weekly");
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTrend, setActiveTrend] = useState("energy");

  const load = useCallback(async () => {
    try {
      const [a, s, r] = await Promise.all([api("/analytics?days=30"), api("/health-score"), api("/ai/reports")]);
      setData(a);
      setScore(s);
      setReports(r);
    } catch (e) { console.warn(e); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const generate = async () => {
    setGenerating(true);
    try {
      await api("/ai/report", { method: "POST", body: { period } });
      await load();
    } catch (e) { console.warn(e); } finally { setGenerating(false); }
  };

  const trend = data?.trends?.[activeTrend] || [];
  const trendValues = trend.map((p: any) => (typeof p.value === "number" ? p.value : 0));
  const tm = TREND_META[activeTrend];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <AppText weight="headingExtra" style={{ fontSize: 28, marginBottom: 16 }}>Analytics</AppText>

        {/* Health score */}
        <Card testID="health-score-card">
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <AppText style={{ color: colors.textTertiary, fontSize: 12 }}>{"TODAY'S HEALTH SCORE"}</AppText>
              <AppText weight="headingExtra" style={{ fontSize: 44, color: scoreColor(score?.overall) }}>{score?.overall ?? 0}</AppText>
            </View>
            <View style={[styles.scoreBadge, { backgroundColor: scoreColor(score?.overall) + "22" }]}>
              <Ionicons name="pulse" size={26} color={scoreColor(score?.overall)} />
            </View>
          </View>
          <View style={styles.catGrid}>
            {Object.entries(score?.categories || {}).map(([k, v]: any) => (
              <View key={k} style={styles.catItem}>
                <AppText style={{ color: colors.textTertiary, fontSize: 11, textTransform: "capitalize" }}>{k}</AppText>
                <AppText weight="bold" style={{ fontSize: 15, color: scoreColor(v) }}>{v}</AppText>
              </View>
            ))}
          </View>
          {(score?.suggestions || []).length > 0 && (
            <View style={styles.suggestion}>
              <Ionicons name="bulb" size={15} color={colors.warning} />
              <AppText style={{ color: colors.textSecondary, fontSize: 13, marginLeft: 8, flex: 1 }}>{score.suggestions[0]}</AppText>
            </View>
          )}
        </Card>

        {/* Trends */}
        <SectionTitle title="Trends" />
        <View style={styles.trendTabs}>
          {Object.keys(TREND_META).map((k) => (
            <TouchableOpacity key={k} onPress={() => setActiveTrend(k)} style={[styles.trendTab, activeTrend === k ? { backgroundColor: TREND_META[k].color + "22", borderColor: TREND_META[k].color } : null]} testID={`trend-${k}`}>
              <AppText weight={activeTrend === k ? "bold" : "medium"} style={{ color: activeTrend === k ? TREND_META[k].color : colors.textTertiary, fontSize: 12 }}>{TREND_META[k].label}</AppText>
            </TouchableOpacity>
          ))}
        </View>
        <Card style={{ paddingVertical: 18 }}>
          <LineChart data={trendValues} width={chartW} height={150} color={tm.color} maxOverride={tm.max} />
          <AppText style={{ color: colors.textTertiary, fontSize: 11, marginTop: 8 }}>Last 30 days</AppText>
        </Card>

        {/* Correlations */}
        <SectionTitle title="Correlations & Insights" />
        {(data?.insights || []).length === 0 ? (
          <Card><AppText style={{ color: colors.textTertiary, fontSize: 13 }}>Log a few more days of metrics, sleep and water to unlock correlation insights.</AppText></Card>
        ) : (
          data.insights.map((ins: any, i: number) => (
            <Card key={i} style={styles.insight} testID={`insight-${i}`}>
              <View style={[styles.corrBadge, { backgroundColor: corrColor(ins.value) + "22" }]}>
                <AppText weight="bold" style={{ color: corrColor(ins.value), fontSize: 13 }}>{ins.value > 0 ? "+" : ""}{ins.value}</AppText>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <AppText weight="bold" style={{ fontSize: 14 }}>{ins.title}</AppText>
                <AppText style={{ color: colors.textSecondary, fontSize: 12, marginTop: 3 }}>{ins.text}</AppText>
              </View>
            </Card>
          ))
        )}

        {/* AI Analyst */}
        <SectionTitle title="AI Personal Analyst" />
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <View style={styles.aiBadge}><Ionicons name="sparkles" size={18} color={colors.accent} /></View>
            <AppText style={{ color: colors.textSecondary, fontSize: 13, flex: 1, marginLeft: 12 }}>
              Generate an AI-written report analyzing your trends and behavior patterns.
            </AppText>
          </View>
          <View style={{ marginBottom: 12 }}>
            <SegmentedControl
              options={[{ label: "Weekly", value: "weekly" }, { label: "Monthly", value: "monthly" }]}
              value={period}
              onChange={setPeriod}
              testID="ai-period"
            />
          </View>
          <Button title={generating ? "Analyzing..." : "Generate Report"} icon="sparkles" onPress={generate} loading={generating} testID="generate-ai-btn" />
        </Card>

        {reports.map((r) => (
          <Card key={r.id} style={{ marginTop: 10 }} testID={`ai-report-${r.id}`}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <AppText weight="bold" style={{ color: colors.accent, fontSize: 12, textTransform: "uppercase" }}>{r.period} report</AppText>
              <AppText style={{ color: colors.textTertiary, fontSize: 11 }}>{new Date(r.created_at).toLocaleDateString()}</AppText>
            </View>
            <AppText style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 21 }}>{r.content}</AppText>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

function scoreColor(v?: number) {
  if (v == null) return colors.textTertiary;
  if (v >= 75) return colors.success;
  if (v >= 50) return colors.warning;
  return colors.danger;
}
function corrColor(v: number) {
  if (v > 0.3) return colors.success;
  if (v < -0.3) return colors.danger;
  return colors.textTertiary;
}

const styles = StyleSheet.create({
  scoreBadge: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  catGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 16, gap: 12 },
  catItem: { width: (width - 32 - 32 - 24) / 3 },
  suggestion: { flexDirection: "row", alignItems: "center", marginTop: 16, backgroundColor: colors.warningSoft, padding: 12, borderRadius: radius.md },
  trendTabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  trendTab: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  insight: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  corrBadge: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  aiBadge: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
});
