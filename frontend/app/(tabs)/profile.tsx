import { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, Platform, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/auth";
import { api } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";
import { AppText, Card, Sheet, Field, Button, SectionTitle } from "@/src/components/ui";

const HUB = [
  { route: "/checkin", icon: "happy", label: "Daily Check-in", color: "#EC4899", desc: "Energy, focus, mood, stress" },
  { route: "/weight", icon: "barbell", label: "Weight", color: colors.cyan, desc: "Body weight & waist trends" },
  { route: "/sleep", icon: "moon", label: "Sleep", color: "#8B5CF6", desc: "Duration & quality reports" },
  { route: "/habits", icon: "repeat", label: "Habits", color: colors.success, desc: "Streaks & completion" },
  { route: "/goals", icon: "flag", label: "Goals", color: colors.pink, desc: "Milestones & progress" },
  { route: "/projects", icon: "construct", label: "Projects", color: colors.warning, desc: "Tasks & deadlines" },
  { route: "/journal", icon: "book", label: "Journal", color: colors.blue, desc: "Notes & reflections" },
  { route: "/mealprep", icon: "layers", label: "Meal Prep", color: colors.success, desc: "Recipes, batches, shopping" },
  { route: "/water", icon: "water", label: "Hydration", color: colors.blue, desc: "History & streaks" },
  { route: "/weekly-review", icon: "calendar", label: "Weekly Review", color: colors.accent, desc: "Reflect on your week" },
  { route: "/integrations", icon: "git-network", label: "Health Sync", color: colors.warning, desc: "Samsung Health / Connect" },
  { route: "/settings", icon: "settings", label: "Settings", color: colors.textSecondary, desc: "Goals, export, account" },
];

export default function Profile() {
  const { user, logout, refresh } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const openEdit = () => {
    const p = user?.profile || {};
    setForm({
      name: user?.name || "",
      height_cm: p.height_cm != null ? String(p.height_cm) : "",
      target_weight: p.target_weight != null ? String(p.target_weight) : "",
      daily_water_goal: p.daily_water_goal != null ? String(p.daily_water_goal) : "2500",
      sleep_goal_hours: p.sleep_goal_hours != null ? String(p.sleep_goal_hours) : "8",
    });
    setSheet(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api("/profile", { method: "PUT", body: {
        name: form.name,
        height_cm: parseFloat(form.height_cm) || null,
        target_weight: parseFloat(form.target_weight) || null,
        daily_water_goal: parseInt(form.daily_water_goal) || 2500,
        sleep_goal_hours: parseFloat(form.sleep_goal_hours) || 8,
      }});
      await refresh();
      setSheet(false);
    } catch (e: any) { Alert.alert("Error", e.message); } finally { setSaving(false); }
  };

  const doLogout = () => {
    if (Platform.OS === "web") { logout().then(() => router.replace("/login")); }
    else Alert.alert("Log out?", "", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: async () => { await logout(); router.replace("/login"); } },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <AppText weight="headingExtra" style={{ fontSize: 28, marginBottom: 16 }}>Profile</AppText>

        <Card style={styles.userCard} testID="profile-card">
          <View style={styles.avatar}>
            {user?.picture ? (
              <Image source={{ uri: user.picture }} style={{ width: 64, height: 64, borderRadius: 32 }} />
            ) : (
              <AppText weight="headingExtra" style={{ fontSize: 26, color: "#fff" }}>{(user?.name || "U")[0].toUpperCase()}</AppText>
            )}
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <AppText weight="heading" style={{ fontSize: 19 }}>{user?.name}</AppText>
            <AppText style={{ color: colors.textTertiary, fontSize: 13 }}>{user?.email}</AppText>
            <TouchableOpacity onPress={openEdit} style={styles.editBtn} testID="edit-profile-btn">
              <Ionicons name="create-outline" size={14} color={colors.accent} />
              <AppText weight="bold" style={{ color: colors.accent, fontSize: 12, marginLeft: 4 }}>Edit profile</AppText>
            </TouchableOpacity>
          </View>
        </Card>

        <SectionTitle title="Everything" />
        <View style={styles.grid}>
          {HUB.map((h) => (
            <TouchableOpacity key={h.route} style={styles.hubItem} onPress={() => router.push(h.route as any)} testID={`hub-${h.label}`} activeOpacity={0.85}>
              <View style={[styles.hubIcon, { backgroundColor: h.color + "22" }]}>
                <Ionicons name={h.icon as any} size={20} color={h.color} />
              </View>
              <AppText weight="bold" style={{ fontSize: 14, marginTop: 10 }}>{h.label}</AppText>
              <AppText style={{ color: colors.textTertiary, fontSize: 11, marginTop: 2 }}>{h.desc}</AppText>
            </TouchableOpacity>
          ))}
        </View>

        <Button title="Log Out" variant="secondary" icon="log-out-outline" onPress={doLogout} style={{ marginTop: 16 }} testID="logout-btn" />
      </ScrollView>

      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Edit Profile" testID="profile-sheet">
        <Field label="Name" value={form.name} onChangeText={(v: string) => setForm({ ...form, name: v })} testID="profile-name" />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}><Field label="Height (cm)" keyboardType="decimal-pad" value={form.height_cm} onChangeText={(v: string) => setForm({ ...form, height_cm: v })} /></View>
          <View style={{ flex: 1 }}><Field label="Target Weight (kg)" keyboardType="decimal-pad" value={form.target_weight} onChangeText={(v: string) => setForm({ ...form, target_weight: v })} /></View>
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}><Field label="Water Goal (ml)" keyboardType="number-pad" value={form.daily_water_goal} onChangeText={(v: string) => setForm({ ...form, daily_water_goal: v })} /></View>
          <View style={{ flex: 1 }}><Field label="Sleep Goal (h)" keyboardType="decimal-pad" value={form.sleep_goal_hours} onChangeText={(v: string) => setForm({ ...form, sleep_goal_hours: v })} /></View>
        </View>
        <Button title="Save" onPress={save} loading={saving} testID="save-profile-btn" />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  userCard: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  editBtn: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  hubItem: { width: "47.8%", flexGrow: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14, minHeight: 104 },
  hubIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
