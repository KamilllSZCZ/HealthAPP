import { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, radius } from "@/src/theme";
import { AppText, Card, ScreenHeader, Button, Field, Sheet, IconButton, EmptyState, SectionTitle } from "@/src/components/ui";
import { LineChart } from "@/src/components/charts";

const { width } = Dimensions.get("window");

export default function Sleep() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any>({ logs: [], avg_duration: 0, goal: 8 });
  const [sheet, setSheet] = useState(false);
  const [duration, setDuration] = useState("");
  const [bed, setBed] = useState("");
  const [wake, setWake] = useState("");
  const [quality, setQuality] = useState(3);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => { setData(await api("/sleep?days=30")); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    if (!duration) return;
    setSaving(true);
    try {
      await api("/sleep", { method: "POST", body: { duration: parseFloat(duration), bed_time: bed, wake_time: wake, quality } });
      setSheet(false); setDuration(""); setBed(""); setWake(""); load();
    } catch (e: any) { Alert.alert("Error", e.message); } finally { setSaving(false); }
  };

  const logs = data.logs || [];
  const chartData = logs.map((l: any) => l.duration || 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Sleep" onBack={() => router.back()} right={<IconButton icon="add" bg="#8B5CF6" color="#fff" onPress={() => setSheet(true)} testID="add-sleep-btn" />} />

        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <AppText style={{ color: colors.textTertiary, fontSize: 12 }}>30-DAY AVERAGE</AppText>
              <AppText weight="headingExtra" style={{ fontSize: 40 }}>{data.avg_duration}<AppText style={{ fontSize: 18, color: colors.textTertiary }}>h</AppText></AppText>
            </View>
            <View style={styles.moonBadge}><Ionicons name="moon" size={26} color="#8B5CF6" /></View>
          </View>
          <View style={{ marginTop: 18 }}>
            <LineChart data={chartData} width={width - 32 - 32} height={140} color="#8B5CF6" maxOverride={12} />
          </View>
          <AppText style={{ color: colors.textTertiary, fontSize: 11, marginTop: 6 }}>Goal: {data.goal}h per night</AppText>
        </Card>

        <SectionTitle title="History" />
        {logs.length === 0 ? (
          <EmptyState icon="moon-outline" title="No sleep logged" subtitle="Track your sleep duration and quality." />
        ) : (
          [...logs].reverse().map((l: any) => (
            <Card key={l.date} style={styles.row} testID={`sleep-${l.date}`}>
              <View style={[styles.qBadge, { backgroundColor: ["#EF4444", "#F59E0B", "#F59E0B", "#22C55E", "#22C55E"][(l.quality || 3) - 1] + "22" }]}>
                <AppText weight="bold" style={{ color: ["#EF4444", "#F59E0B", "#F59E0B", "#22C55E", "#22C55E"][(l.quality || 3) - 1] }}>{l.duration}h</AppText>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <AppText weight="bold" style={{ fontSize: 14 }}>{l.date}</AppText>
                <AppText style={{ color: colors.textTertiary, fontSize: 12 }}>{l.bed_time || "—"} → {l.wake_time || "—"} · quality {l.quality || "—"}/5</AppText>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Log Sleep">
        <Field label="Duration (hours)" placeholder="7.5" keyboardType="decimal-pad" value={duration} onChangeText={setDuration} testID="sleep-duration" />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}><Field label="Bed Time" placeholder="23:00" value={bed} onChangeText={setBed} /></View>
          <View style={{ flex: 1 }}><Field label="Wake Time" placeholder="06:30" value={wake} onChangeText={setWake} /></View>
        </View>
        <AppText style={styles.lbl}>Quality</AppText>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 18 }}>
          {[1, 2, 3, 4, 5].map((q) => (
            <TouchableOpacity key={q} onPress={() => setQuality(q)} style={[styles.qBtn, quality >= q ? { backgroundColor: "#8B5CF6", borderColor: "#8B5CF6" } : null]} testID={`sleep-quality-${q}`}>
              <Ionicons name="star" size={18} color={quality >= q ? "#fff" : colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>
        <Button title="Save" onPress={save} loading={saving} testID="save-sleep-btn" />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  moonBadge: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#8B5CF622", alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  qBadge: { width: 56, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  qBtn: { flex: 1, height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  lbl: { fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: colors.textTertiary, marginBottom: 8 },
});
