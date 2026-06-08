import { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Dimensions, RefreshControl, TouchableOpacity } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, radius } from "@/src/theme";
import { AppText, Card, ScreenHeader, Button, Field, Sheet, IconButton, EmptyState, SectionTitle, Loader, ErrorState } from "@/src/components/ui";
import { LineChart } from "@/src/components/charts";
import { useToast } from "@/src/components/toast";
import { confirmAsync } from "@/src/utils/confirm";
import { errMessage, isPositiveNumber, isNonNegativeNumber } from "@/src/utils/validate";

const { width } = Dimensions.get("window");

export default function Weight() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [data, setData] = useState<any>({ logs: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      setData(await api("/weight"));
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const save = async () => {
    if (!weight.trim()) { toast.error("Weight is required."); return; }
    if (!isPositiveNumber(weight)) { toast.error("Enter a valid weight greater than 0."); return; }
    if (waist.trim() && !isNonNegativeNumber(waist)) { toast.error("Waist must be a valid number."); return; }
    setSaving(true);
    try {
      await api("/weight", { method: "POST", body: { weight: parseFloat(weight), waist: parseFloat(waist) || null } });
      toast.success("Weight logged.");
      setSheet(false); setWeight(""); setWaist(""); load();
    } catch (e: any) {
      toast.error(errMessage(e, "Couldn't save weight."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const ok = await confirmAsync("Delete entry?", "This weight entry will be permanently removed.");
    if (!ok) return;
    try {
      await api(`/weight/${id}`, { method: "DELETE" });
      toast.success("Entry deleted.");
      load();
    } catch (e: any) {
      toast.error(errMessage(e, "Couldn't delete entry."));
    }
  };

  if (loading) return <Loader />;
  if (error) return <ErrorState onRetry={() => { setError(false); setLoading(true); load(); }} onBack={() => router.back()} />;

  const logs = data.logs || [];
  const chartData = logs.map((l: any) => l.weight);
  const trendColor = data.trend === "down" ? colors.success : data.trend === "up" ? colors.danger : colors.textSecondary;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
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
              <TouchableOpacity onPress={() => remove(l.id)} style={styles.delBtn} testID={`delete-weight-${l.id}`}>
                <Ionicons name="trash-outline" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
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
  delBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
