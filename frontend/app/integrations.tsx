import { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Switch, Platform } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, radius } from "@/src/theme";
import { AppText, Card, ScreenHeader, Button, SectionTitle } from "@/src/components/ui";

const METRIC_LABELS: Record<string, { label: string; icon: string }> = {
  steps: { label: "Steps", icon: "walk" },
  distance: { label: "Distance", icon: "map" },
  active_calories: { label: "Active Calories", icon: "flame" },
  sleep: { label: "Sleep", icon: "moon" },
  weight: { label: "Weight", icon: "barbell" },
  workouts: { label: "Workouts", icon: "fitness" },
};

export default function Integrations() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [config, setConfig] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    const res = await api("/health-sync/status");
    setConfig(res.config); setHistory(res.history);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const update = async (patch: any) => {
    const res = await api("/health-sync/config", { method: "PUT", body: patch });
    setConfig(res);
  };

  const connect = async () => { await update({ connected: true, provider: "Health Connect" }); };

  const sync = async () => {
    setSyncing(true);
    try { await api("/health-sync/sync", { method: "POST" }); await load(); } finally { setSyncing(false); }
  };

  const toggleMetric = (m: string) => {
    const metrics = config.metrics || [];
    update({ metrics: metrics.includes(m) ? metrics.filter((x: string) => x !== m) : [...metrics, m] });
  };

  if (!config) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Health Sync" onBack={() => router.back()} />

        <Card style={{ alignItems: "center", paddingVertical: 24 }} testID="sync-status">
          <View style={[styles.bigIcon, { backgroundColor: (config.connected ? colors.success : colors.textTertiary) + "22" }]}>
            <Ionicons name="git-network" size={32} color={config.connected ? colors.success : colors.textTertiary} />
          </View>
          <AppText weight="heading" style={{ fontSize: 18, marginTop: 14 }}>{config.connected ? "Connected" : "Not Connected"}</AppText>
          <AppText style={{ color: colors.textTertiary, fontSize: 13, marginTop: 4, textAlign: "center" }}>
            {config.connected ? `${config.provider || "Health Connect"} · last sync ${config.last_sync ? new Date(config.last_sync).toLocaleString() : "never"}` : "Connect to sync steps, sleep, weight & workouts."}
          </AppText>
          {config.connected ? (
            <Button title={syncing ? "Syncing..." : "Sync Now"} icon="sync" onPress={sync} loading={syncing} style={{ marginTop: 18, alignSelf: "stretch" }} testID="sync-now-btn" />
          ) : (
            <Button title="Connect Account" icon="link" onPress={connect} style={{ marginTop: 18, alignSelf: "stretch" }} testID="connect-btn" />
          )}
        </Card>

        <View style={styles.noteBox}>
          <Ionicons name="information-circle" size={16} color={colors.warning} />
          <AppText style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 8, flex: 1, lineHeight: 18 }}>
            Direct Samsung Health / Health Connect sync requires a native Android build. This dashboard is future-ready — sync currently generates realistic sample data for the selected metrics.
          </AppText>
        </View>

        {config.connected && (
          <>
            <Card style={styles.rowCard}>
              <View style={{ flex: 1 }}>
                <AppText weight="bold" style={{ fontSize: 15 }}>Auto Sync</AppText>
                <AppText style={{ color: colors.textTertiary, fontSize: 12 }}>Sync automatically in the background</AppText>
              </View>
              <Switch value={!!config.auto_sync} onValueChange={(v) => update({ auto_sync: v })} trackColor={{ true: colors.accent, false: colors.surfaceHover }} thumbColor="#fff" testID="auto-sync-toggle" />
            </Card>

            <SectionTitle title="Synced Metrics" />
            <View style={styles.metricGrid}>
              {Object.keys(METRIC_LABELS).map((m) => {
                const on = (config.metrics || []).includes(m);
                return (
                  <TouchableOpacity key={m} style={[styles.metricChip, on ? { borderColor: colors.accent, backgroundColor: colors.accentSoft } : null]} onPress={() => toggleMetric(m)} testID={`metric-${m}`}>
                    <Ionicons name={METRIC_LABELS[m].icon as any} size={18} color={on ? colors.accent : colors.textTertiary} />
                    <AppText style={{ color: on ? colors.text : colors.textTertiary, fontSize: 12, marginTop: 4 }}>{METRIC_LABELS[m].label}</AppText>
                  </TouchableOpacity>
                );
              })}
            </View>

            <SectionTitle title="Sync History" />
            {history.length === 0 ? (
              <Card><AppText style={{ color: colors.textTertiary, fontSize: 13 }}>No sync history yet.</AppText></Card>
            ) : (
              history.slice(0, 20).map((h, i) => (
                <Card key={i} style={styles.histRow}>
                  <Ionicons name={METRIC_LABELS[h.metric]?.icon as any || "pulse"} size={16} color={colors.accent} />
                  <AppText style={{ flex: 1, marginLeft: 10, fontSize: 13, textTransform: "capitalize" }}>{METRIC_LABELS[h.metric]?.label || h.metric}</AppText>
                  <AppText weight="bold" style={{ fontSize: 13 }}>{h.value}</AppText>
                  <AppText style={{ color: colors.textTertiary, fontSize: 11, marginLeft: 10 }}>{h.date}</AppText>
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bigIcon: { width: 72, height: 72, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  noteBox: { flexDirection: "row", backgroundColor: colors.warningSoft, padding: 12, borderRadius: radius.md, marginTop: 12, marginBottom: 4 },
  rowCard: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metricChip: { width: "31.5%", flexGrow: 1, alignItems: "center", paddingVertical: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  histRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, paddingVertical: 12 },
});
