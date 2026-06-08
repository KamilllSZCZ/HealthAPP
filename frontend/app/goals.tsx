import { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, radius } from "@/src/theme";
import { AppText, Card, ScreenHeader, Button, Field, Sheet, IconButton, Pill, EmptyState, Loader, ErrorState } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { confirmAsync } from "@/src/utils/confirm";
import { errMessage, clampPercent } from "@/src/utils/validate";

const TYPES = ["Weight", "Health", "Nutrition", "Habit", "Hydration", "Supplement", "Personal"];
const empty = { name: "", description: "", type: "Personal", target_date: "", progress: 0, status: "active" };

export default function Goals() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      setGoals(await api("/goals"));
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const openNew = () => { setForm(empty); setEditing(null); setSheet(true); };
  const openEdit = (g: any) => { setForm({ ...empty, ...g, progress: g.progress || 0 }); setEditing(g.id); setSheet(true); };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Goal name is required."); return; }
    const rawProgress = Number(form.progress);
    if (form.progress !== "" && form.progress != null && isNaN(rawProgress)) { toast.error("Progress must be a number between 0 and 100."); return; }
    setSaving(true);
    const payload = { ...form, progress: clampPercent(rawProgress || 0), start_date: form.start_date || new Date().toISOString().slice(0, 10) };
    try {
      if (editing) await api(`/goals/${editing}`, { method: "PUT", body: payload });
      else await api("/goals", { method: "POST", body: payload });
      toast.success(editing ? "Goal updated." : "Goal created.");
      setSheet(false); load();
    } catch (e: any) {
      toast.error(errMessage(e, "Couldn't save goal."));
    } finally {
      setSaving(false);
    }
  };

  const setProgress = async (g: any, delta: number) => {
    const np = clampPercent((g.progress || 0) + delta);
    try {
      await api(`/goals/${g.id}`, { method: "PUT", body: { progress: np, status: np >= 100 ? "completed" : "active" } });
      load();
    } catch (e: any) {
      toast.error(errMessage(e, "Couldn't update progress."));
    }
  };

  const remove = async (id: string) => {
    const ok = await confirmAsync("Delete goal?", "This goal and its progress will be permanently removed.");
    if (!ok) return;
    try {
      await api(`/goals/${id}`, { method: "DELETE" });
      toast.success("Goal deleted.");
      setSheet(false); load();
    } catch (e: any) {
      toast.error(errMessage(e, "Couldn't delete goal."));
    }
  };

  if (loading) return <Loader />;
  if (error) return <ErrorState onRetry={() => { setError(false); setLoading(true); load(); }} onBack={() => router.back()} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <ScreenHeader title="Goals" onBack={() => router.back()} right={<IconButton icon="add" bg={colors.pink} color="#fff" onPress={openNew} testID="add-goal-btn" />} />

        {goals.length === 0 ? (
          <EmptyState icon="flag-outline" title="No goals yet" subtitle="Set a goal and track your progress with milestones." />
        ) : (
          goals.map((g) => (
            <Card key={g.id} style={{ marginBottom: 12 }} testID={`goal-${g.id}`}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => openEdit(g)}>
                  <View style={[styles.typeTag, { backgroundColor: colors.pink + "22" }]}>
                    <AppText weight="bold" style={{ color: colors.pink, fontSize: 10 }}>{g.type?.toUpperCase()}</AppText>
                  </View>
                  <AppText weight="bold" style={{ fontSize: 16, marginTop: 8 }}>{g.name}</AppText>
                  {g.description ? <AppText style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>{g.description}</AppText> : null}
                  {g.target_date ? <AppText style={{ color: colors.textTertiary, fontSize: 12, marginTop: 4 }}>Target: {g.target_date}</AppText> : null}
                </TouchableOpacity>
                {g.status === "completed" && <Ionicons name="checkmark-circle" size={22} color={colors.success} />}
              </View>
              <View style={styles.progRow}>
                <View style={styles.progBar}><View style={[styles.progFill, { width: `${g.progress || 0}%`, backgroundColor: g.status === "completed" ? colors.success : colors.pink }]} /></View>
                <AppText weight="bold" style={{ fontSize: 13, width: 42, textAlign: "right" }}>{g.progress || 0}%</AppText>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => setProgress(g, -10)} testID={`goal-minus-${g.id}`}><Ionicons name="remove" size={18} color={colors.text} /></TouchableOpacity>
                <TouchableOpacity style={styles.stepBtn} onPress={() => setProgress(g, 10)} testID={`goal-plus-${g.id}`}><Ionicons name="add" size={18} color={colors.text} /></TouchableOpacity>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <Sheet visible={sheet} onClose={() => setSheet(false)} title={editing ? "Edit Goal" : "New Goal"}>
        <Field label="Goal Name" placeholder="Reach 75kg" value={form.name} onChangeText={(v: string) => setForm({ ...form, name: v })} testID="goal-name" />
        <Field label="Description" placeholder="Why does this matter?" value={form.description} onChangeText={(v: string) => setForm({ ...form, description: v })} multiline />
        <AppText style={styles.lbl}>Type</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {TYPES.map((t) => <Pill key={t} label={t} active={form.type === t} onPress={() => setForm({ ...form, type: t })} />)}
          </View>
        </ScrollView>
        <Field label="Target Date" placeholder="YYYY-MM-DD" value={form.target_date} onChangeText={(v: string) => setForm({ ...form, target_date: v })} />
        <Field label="Progress (%)" placeholder="0" keyboardType="number-pad" value={String(form.progress)} onChangeText={(v: string) => setForm({ ...form, progress: v })} />
        <Button title={editing ? "Save Changes" : "Create Goal"} onPress={save} loading={saving} testID="save-goal-btn" />
        {editing && <Button title="Delete" variant="ghost" onPress={() => remove(editing)} style={{ marginTop: 8 }} testID="delete-goal-btn" />}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  typeTag: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  progRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },
  progBar: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceHover, overflow: "hidden" },
  progFill: { height: 8, borderRadius: 4 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12, justifyContent: "flex-end" },
  stepBtn: { width: 38, height: 34, borderRadius: 10, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  lbl: { fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: colors.textTertiary, marginBottom: 8 },
});
