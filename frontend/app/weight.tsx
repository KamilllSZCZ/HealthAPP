import { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Dimensions, Platform, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, radius } from "@/src/theme";
import { AppText, Card, ScreenHeader, Button, Field, Sheet, IconButton, EmptyState, SectionTitle } from "@/src/components/ui";
import { LineChart } from "@/src/components/charts";

const { width } = Dimensions.get("window");

export default function Weight() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any>({ logs: [] });
  const [sheet, setSheet] = useState(false);
  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => { setData(await api("/weight")); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    if (!weight) return;
    setSaving(true);
    try {
      await api("/weight", { method: "POST", body: { weight: parseFloat(weight), waist: parseFloat(waist) || null } });
      setSheet(false); setWeight(""); setWaist(""); load();
    } catch (e: any) { Alert.alert("Error", e.message); } finally { setSaving(false); }
  };

  const remove = async (id: string) => { await api(`/weight/${id}`, { method: "DELETE" }); load(); };

  const logs = data.logs || [];
  const chartData = logs.map((l: any) => l.weight);
  const trendColor = data.trend === "down" ? colors.success : data.trend === "up" ? colors.danger : colors.textSecondary;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Weight" onBack={() => router.back()} right={<IconButton icon="add" bg={colors.accent} color="#fff" onPress={() => setSheet(true)} testID="add-weight-btn" />} />

        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
            <View>
              <AppText style={{ color: colors.textTertiary, fontSize: 12 }}>CURRENT</AppText>
              <AppText weight="headingExtra" style={{ fontSize: 40 }}>{data.current ?? "—"}<AppText style={{ fontSize: 18, color: colors.textTertiary }}> kg</AppText></AppText>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              {data.change != null && (
                <View style={[styles.trendBadge, { backgroundColor: trendColor + "22" }]}>
                  <Ionicons name={data.trend === "down" ? "arrow-down" : data.trend === "up" ? "arrow-up" : "remove"} size={14} color={trendColor} />
                  <AppText weight="bold" style={{ color: trendColor, fontSize: 13, marginLeft: 4 }}>{Math.abs(data.change)} kg</AppText>
                </View>
              )}
              {data.target_weight && <AppText style={{ color: colors.textTertiary, fontSize: 12, marginTop: 6 }}>Target {data.target_weight} kg</AppText>}
            </View>
          </View>
          <View style={{ marginTop: 18 }}>
            <LineChart data={chartData} width={width - 32 - 32} height={140} color={colors.cyan} showDots />
          </View>
        </Card>

        <SectionTitle title="History" />
        {logs.length === 0 ? (
          <EmptyState icon="barbell-outline" title="No entries yet" subtitle="Log your weight to see trends." />
        ) : (
          [...logs].reverse().map((l: any) => (
            <Card key={l.id} style={styles.row} testID={`weight-${l.id}`}>
              <View style={{ flex: 1 }}>
                <AppText weight="bold" style={{ fontSize: 16 }}>{l.weight} kg{l.waist ? `  ·  ${l.waist}cm waist` : ""}</AppText>
                <AppText style={{ color: colors.textTertiary, fontSize: 12 }}>{l.date}</AppText>
              </View>
              <Ionicons name="trash-outline" size={18} color={colors.textTertiary} onPress={() => remove(l.id)} />
            </Card>
          ))
        )}
      </ScrollView>

      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Log Weight">
        <Field label="Weight (kg)" placeholder="78.5" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} testID="weight-input" />
        <Field label="Waist (cm, optional)" placeholder="84" keyboardType="decimal-pad" value={waist} onChangeText={setWaist} />
        <Button title="Save" onPress={save} loading={saving} testID="save-weight-btn" />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  trendBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  row: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
});
