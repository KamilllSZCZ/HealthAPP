import { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, radius } from "@/src/theme";
import { AppText, Card, ScreenHeader, Button, Field, Sheet, IconButton, Pill } from "@/src/components/ui";

const ICONS = ["checkmark-circle", "water", "moon", "barbell", "book", "walk", "leaf", "sunny", "bicycle", "heart"];
const COLORS = ["#6B46FF", "#3B82F6", "#22C55E", "#F59E0B", "#EC4899", "#22D3EE"];

export default function Habits() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [habits, setHabits] = useState<any[]>([]);
  const [sheet, setSheet] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(ICONS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => { setHabits(await api("/habits")); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async (h: any) => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await api(`/habits/${h.id}/toggle`, { method: "POST" });
    load();
  };

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api("/habits", { method: "POST", body: { name, icon, color } });
      setSheet(false); setName(""); setIcon(ICONS[0]); setColor(COLORS[0]); load();
    } finally { setSaving(false); }
  };

  const remove = (h: any) => {
    const doIt = async () => { await api(`/habits/${h.id}`, { method: "DELETE" }); load(); };
    if (Platform.OS === "web") doIt();
    else Alert.alert("Delete habit?", h.name, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: doIt }]);
  };

  const doneCount = habits.filter((h) => h.done_today).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Habits" onBack={() => router.back()} right={<IconButton icon="add" bg={colors.accent} color="#fff" onPress={() => setSheet(true)} testID="add-habit-btn" />} />

        <Card style={{ marginBottom: 16, flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <AppText weight="headingExtra" style={{ fontSize: 30 }}>{doneCount}/{habits.length}</AppText>
            <AppText style={{ color: colors.textTertiary, fontSize: 12 }}>completed today</AppText>
          </View>
          <View style={styles.progBar}>
            <View style={[styles.progFill, { width: `${habits.length ? (doneCount / habits.length) * 100 : 0}%` }]} />
          </View>
        </Card>

        {habits.map((h) => (
          <Card key={h.id} style={styles.item} testID={`habit-${h.id}`}>
            <TouchableOpacity onPress={() => toggle(h)} testID={`toggle-habit-${h.id}`}>
              <View style={[styles.check, { borderColor: h.color }, h.done_today ? { backgroundColor: h.color } : null]}>
                {h.done_today ? <Ionicons name="checkmark" size={18} color="#fff" /> : <Ionicons name={h.icon} size={16} color={h.color} />}
              </View>
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <AppText weight="bold" style={{ fontSize: 15 }}>{h.name}</AppText>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3 }}>
                <Ionicons name="flame" size={13} color={colors.warning} />
                <AppText style={{ color: colors.textTertiary, fontSize: 12, marginLeft: 4 }}>{h.streak} day streak · {h.frequency}</AppText>
              </View>
            </View>
            {!h.system && (
              <TouchableOpacity onPress={() => remove(h)} testID={`delete-habit-${h.id}`}>
                <Ionicons name="ellipsis-horizontal" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </Card>
        ))}
      </ScrollView>

      <Sheet visible={sheet} onClose={() => setSheet(false)} title="New Habit">
        <Field label="Habit Name" placeholder="Morning stretch" value={name} onChangeText={setName} testID="habit-name" />
        <AppText style={styles.lbl}>Icon</AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {ICONS.map((ic) => (
            <TouchableOpacity key={ic} onPress={() => setIcon(ic)} style={[styles.iconPick, icon === ic ? { borderColor: color, backgroundColor: color + "22" } : null]}>
              <Ionicons name={ic as any} size={20} color={icon === ic ? color : colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>
        <AppText style={styles.lbl}>Color</AppText>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 18 }}>
          {COLORS.map((c) => (
            <TouchableOpacity key={c} onPress={() => setColor(c)} style={[styles.colorPick, { backgroundColor: c }, color === c ? { borderWidth: 3, borderColor: "#fff" } : null]} />
          ))}
        </View>
        <Button title="Create Habit" onPress={create} loading={saving} testID="save-habit-btn" />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  progBar: { width: 80, height: 8, borderRadius: 4, backgroundColor: colors.surfaceHover, overflow: "hidden" },
  progFill: { height: 8, borderRadius: 4, backgroundColor: colors.accent },
  item: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  check: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  lbl: { fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: colors.textTertiary, marginBottom: 8 },
  iconPick: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  colorPick: { width: 36, height: 36, borderRadius: 18 },
});
