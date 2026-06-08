import { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Platform } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, radius } from "@/src/theme";
import { AppText, Card, ScreenHeader, SectionTitle } from "@/src/components/ui";
import { Ring, BarChart } from "@/src/components/charts";

const { width } = Dimensions.get("window");

export default function Water() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [today, setToday] = useState<any>({ total: 0, goal: 2500, percent: 0 });
  const [history, setHistory] = useState<any>({ history: [], streak: 0 });

  const load = useCallback(async () => {
    const [t, h] = await Promise.all([api("/water/today"), api("/water/history?days=14")]);
    setToday(t); setHistory(h);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const add = async (amount: number) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await api("/water", { method: "POST", body: { amount } });
    load();
  };

  const barData = (history.history || []).map((h: any) => h.amount);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Hydration" onBack={() => router.back()} />

        <Card style={{ alignItems: "center", paddingVertical: 28 }} testID="water-ring">
          <Ring size={180} stroke={16} progress={today.percent / 100} color={colors.blue}>
            <View style={{ alignItems: "center" }}>
              <AppText weight="headingExtra" style={{ fontSize: 36 }}>{(today.total / 1000).toFixed(2)}L</AppText>
              <AppText style={{ color: colors.textTertiary, fontSize: 13 }}>of {(today.goal / 1000).toFixed(1)}L</AppText>
            </View>
          </Ring>
          <View style={styles.waterBtns}>
            {[250, 500, 750, 1000].map((amt) => (
              <TouchableOpacity key={amt} style={styles.waterBtn} onPress={() => add(amt)} testID={`water-add-${amt}`}>
                <AppText weight="bold" style={{ color: colors.blue }}>+{amt}</AppText>
                <AppText style={{ color: colors.textTertiary, fontSize: 10 }}>ml</AppText>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Ionicons name="flame" size={20} color={colors.warning} />
            <AppText weight="headingExtra" style={{ fontSize: 24, marginTop: 6 }}>{history.streak}</AppText>
            <AppText style={{ color: colors.textTertiary, fontSize: 12 }}>day streak</AppText>
          </Card>
          <Card style={styles.statCard}>
            <Ionicons name="trophy" size={20} color={colors.success} />
            <AppText weight="headingExtra" style={{ fontSize: 24, marginTop: 6 }}>{today.percent}%</AppText>
            <AppText style={{ color: colors.textTertiary, fontSize: 12 }}>{"of today's goal"}</AppText>
          </Card>
        </View>

        <SectionTitle title="Last 14 Days" />
        <Card style={{ paddingVertical: 18 }}>
          <BarChart data={barData} width={width - 32 - 32} height={150} color={colors.blue} goal={today.goal} />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  waterBtns: { flexDirection: "row", gap: 10, marginTop: 24, width: "100%" },
  waterBtn: { flex: 1, backgroundColor: colors.blue + "1A", borderRadius: radius.md, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: colors.blue + "33" },
  statsRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  statCard: { flex: 1, alignItems: "center", paddingVertical: 18 },
});
