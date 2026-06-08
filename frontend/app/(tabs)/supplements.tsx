import { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Platform } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, spacing, radius } from "@/src/theme";
import { AppText, Card, Button, Field, Sheet, Pill, EmptyState, IconButton, Loader, ErrorState } from "@/src/components/ui";
import { Ring } from "@/src/components/charts";
import { useToast } from "@/src/components/toast";
import { confirmAsync } from "@/src/utils/confirm";
import { errMessage } from "@/src/utils/validate";

const FORMS = ["Capsule", "Tablet", "Powder", "Liquid", "Softgel", "Custom"];
const CATEGORIES = ["Vitamins", "Minerals", "Adaptogens", "Nootropics", "Performance", "Recovery", "General Health", "Custom"];

const empty = {
  name: "", brand: "", category: "Vitamins", form: "Capsule", description: "",
  serving_size: "", daily_servings: "1", intake_times: "Morning",
  purchase_price: "", purchase_date: "", expiration_date: "",
  package_size: "", current_stock: "", refill_threshold: "10", notes: "",
};

export default function Supplements() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [adherence, setAdherence] = useState<any>(null);
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
      const [list, adh] = await Promise.all([api("/supplements"), api("/supplements/adherence?days=30")]);
      setItems(list);
      setAdherence(adh);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const openNew = () => { setForm(empty); setEditing(null); setSheet(true); };
  const openEdit = (s: any) => {
    setForm({
      ...empty, ...s,
      daily_servings: String(s.daily_servings ?? 1),
      purchase_price: s.purchase_price != null ? String(s.purchase_price) : "",
      package_size: s.package_size != null ? String(s.package_size) : "",
      current_stock: s.current_stock != null ? String(s.current_stock) : "",
      refill_threshold: s.refill_threshold != null ? String(s.refill_threshold) : "",
    });
    setEditing(s.id);
    setSheet(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Supplement name is required."); return; }
    if (form.daily_servings && (isNaN(parseInt(form.daily_servings)) || parseInt(form.daily_servings) < 1)) {
      toast.error("Daily servings must be a number of 1 or more."); return;
    }
    for (const [k, label] of [["current_stock", "Current stock"], ["refill_threshold", "Refill threshold"], ["purchase_price", "Price"], ["package_size", "Package size"]] as const) {
      if (form[k] !== "" && form[k] != null && (isNaN(parseFloat(form[k])) || parseFloat(form[k]) < 0)) {
        toast.error(`${label} must be a valid non-negative number.`); return;
      }
    }
    setSaving(true);
    const payload = {
      ...form,
      daily_servings: parseInt(form.daily_servings) || 1,
      purchase_price: parseFloat(form.purchase_price) || 0,
      package_size: parseFloat(form.package_size) || 0,
      current_stock: parseFloat(form.current_stock) || 0,
      refill_threshold: parseFloat(form.refill_threshold) || 0,
    };
    try {
      if (editing) await api(`/supplements/${editing}`, { method: "PUT", body: payload });
      else await api("/supplements", { method: "POST", body: payload });
      toast.success(editing ? "Supplement updated." : "Supplement added.");
      setSheet(false);
      load();
    } catch (e: any) {
      toast.error(errMessage(e, "Couldn't save supplement."));
    } finally {
      setSaving(false);
    }
  };

  const take = async (s: any) => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const done = s.taken_today >= s.taken_count_needed;
    try {
      if (done) await api(`/supplements/${s.id}/untake`, { method: "POST" });
      else await api(`/supplements/${s.id}/take`, { method: "POST" });
      load();
    } catch (e: any) {
      toast.error(errMessage(e, "Couldn't update intake."));
    }
  };

  const remove = async (id: string) => {
    const ok = await confirmAsync("Delete supplement?", "This removes the supplement and its intake history. This can't be undone.");
    if (!ok) return;
    try {
      await api(`/supplements/${id}`, { method: "DELETE" });
      toast.success("Supplement deleted.");
      setSheet(false);
      load();
    } catch (e: any) {
      toast.error(errMessage(e, "Couldn't delete supplement."));
    }
  };

  if (loading) return <Loader />;
  if (error) return <ErrorState onRetry={() => { setError(false); setLoading(true); load(); }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <View style={styles.titleRow}>
          <AppText weight="headingExtra" style={{ fontSize: 28 }}>Supplements</AppText>
          <IconButton icon="add" bg={colors.accent} color="#fff" onPress={openNew} testID="add-supplement-btn" />
        </View>

        <Card style={styles.summary} testID="supplement-adherence">
          <Ring size={92} stroke={9} progress={(adherence?.overall_percent ?? 0) / 100} color={colors.accent}>
            <AppText weight="headingExtra" style={{ fontSize: 22 }}>{adherence?.overall_percent ?? 0}%</AppText>
          </Ring>
          <View style={{ flex: 1, marginLeft: 18 }}>
            <AppText weight="headingSemi" style={{ fontSize: 15 }}>30-day Adherence</AppText>
            <View style={styles.statsRow}>
              <View>
                <AppText weight="bold" style={{ color: colors.warning, fontSize: 20 }}>{adherence?.streak ?? 0}</AppText>
                <AppText style={{ color: colors.textTertiary, fontSize: 11 }}>day streak</AppText>
              </View>
              <View>
                <AppText weight="bold" style={{ color: colors.danger, fontSize: 20 }}>{adherence?.missed ?? 0}</AppText>
                <AppText style={{ color: colors.textTertiary, fontSize: 11 }}>missed</AppText>
              </View>
              <View>
                <AppText weight="bold" style={{ fontSize: 20 }}>{items.length}</AppText>
                <AppText style={{ color: colors.textTertiary, fontSize: 11 }}>tracked</AppText>
              </View>
            </View>
          </View>
        </Card>

        {items.length === 0 ? (
          <EmptyState icon="medical-outline" title="No supplements yet" subtitle="Add your first supplement to start tracking adherence, stock and cost." />
        ) : (
          items.map((s) => {
            const done = s.taken_today >= s.taken_count_needed;
            const c = s.computed || {};
            return (
              <Card key={s.id} style={styles.item} testID={`supplement-${s.id}`}>
                <TouchableOpacity style={styles.checkWrap} onPress={() => take(s)} testID={`take-${s.id}`}>
                  <View style={[styles.check, done ? { backgroundColor: colors.success, borderColor: colors.success } : null]}>
                    {done ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => openEdit(s)} activeOpacity={0.7}>
                  <AppText weight="bold" style={{ fontSize: 15 }}>{s.name}</AppText>
                  <AppText style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                    {s.brand ? `${s.brand} · ` : ""}{s.daily_servings}× {s.form} · {s.intake_times}
                  </AppText>
                  <View style={styles.metaRow}>
                    <View style={[styles.tag, c.low_stock ? { backgroundColor: colors.dangerSoft } : null]}>
                      <Ionicons name="cube-outline" size={11} color={c.low_stock ? colors.danger : colors.textTertiary} />
                      <AppText style={{ color: c.low_stock ? colors.danger : colors.textTertiary, fontSize: 11, marginLeft: 4 }}>
                        {s.current_stock ?? 0} left{c.days_left != null ? ` · ${c.days_left}d` : ""}
                      </AppText>
                    </View>
                    {c.cost_per_serving != null && (
                      <View style={styles.tag}>
                        <AppText style={{ color: colors.textTertiary, fontSize: 11 }}>${c.cost_per_serving}/serv</AppText>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
                <AppText weight="bold" style={{ color: done ? colors.success : colors.textTertiary, fontSize: 12 }}>
                  {s.taken_today}/{s.taken_count_needed}
                </AppText>
              </Card>
            );
          })
        )}
      </ScrollView>

      <Sheet visible={sheet} onClose={() => setSheet(false)} title={editing ? "Edit Supplement" : "New Supplement"} testID="supplement-sheet">
        <Field label="Name *" placeholder="Vitamin D3" value={form.name} onChangeText={(v: string) => setForm({ ...form, name: v })} testID="sup-name" />
        <Field label="Brand" placeholder="Brand name" value={form.brand} onChangeText={(v: string) => setForm({ ...form, brand: v })} />
        <AppText style={styles.lbl}>Category</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {CATEGORIES.map((c) => <Pill key={c} label={c} active={form.category === c} onPress={() => setForm({ ...form, category: c })} />)}
          </View>
        </ScrollView>
        <AppText style={styles.lbl}>Form</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {FORMS.map((c) => <Pill key={c} label={c} active={form.form === c} onPress={() => setForm({ ...form, form: c })} />)}
          </View>
        </ScrollView>
        <View style={styles.two}>
          <View style={{ flex: 1 }}><Field label="Serving Size" placeholder="1000 IU" value={form.serving_size} onChangeText={(v: string) => setForm({ ...form, serving_size: v })} /></View>
          <View style={{ flex: 1 }}><Field label="Daily Servings" placeholder="1" keyboardType="number-pad" value={form.daily_servings} onChangeText={(v: string) => setForm({ ...form, daily_servings: v })} /></View>
        </View>
        <Field label="Intake Times" placeholder="Morning, Evening" value={form.intake_times} onChangeText={(v: string) => setForm({ ...form, intake_times: v })} />
        <View style={styles.two}>
          <View style={{ flex: 1 }}><Field label="Price ($)" placeholder="24.99" keyboardType="decimal-pad" value={form.purchase_price} onChangeText={(v: string) => setForm({ ...form, purchase_price: v })} /></View>
          <View style={{ flex: 1 }}><Field label="Package Size" placeholder="120" keyboardType="number-pad" value={form.package_size} onChangeText={(v: string) => setForm({ ...form, package_size: v })} /></View>
        </View>
        <View style={styles.two}>
          <View style={{ flex: 1 }}><Field label="Current Stock" placeholder="120" keyboardType="number-pad" value={form.current_stock} onChangeText={(v: string) => setForm({ ...form, current_stock: v })} /></View>
          <View style={{ flex: 1 }}><Field label="Refill At" placeholder="10" keyboardType="number-pad" value={form.refill_threshold} onChangeText={(v: string) => setForm({ ...form, refill_threshold: v })} /></View>
        </View>
        <View style={styles.two}>
          <View style={{ flex: 1 }}><Field label="Purchase Date" placeholder="YYYY-MM-DD" value={form.purchase_date} onChangeText={(v: string) => setForm({ ...form, purchase_date: v })} /></View>
          <View style={{ flex: 1 }}><Field label="Expires" placeholder="YYYY-MM-DD" value={form.expiration_date} onChangeText={(v: string) => setForm({ ...form, expiration_date: v })} /></View>
        </View>
        <Field label="Notes" placeholder="Optional notes" value={form.notes} onChangeText={(v: string) => setForm({ ...form, notes: v })} multiline />
        <Button title={editing ? "Save Changes" : "Add Supplement"} onPress={save} loading={saving} testID="save-supplement-btn" />
        {editing && <Button title="Delete" variant="ghost" onPress={() => remove(editing)} style={{ marginTop: 8 }} testID="delete-supplement-btn" />}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  summary: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  statsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, paddingRight: 8 },
  item: { flexDirection: "row", alignItems: "center", marginBottom: 10, paddingVertical: 14 },
  checkWrap: { marginRight: 12 },
  check: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: colors.surfaceHover, alignItems: "center", justifyContent: "center" },
  metaRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  tag: { flexDirection: "row", alignItems: "center", backgroundColor: colors.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm },
  lbl: { fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: colors.textTertiary, marginBottom: 8 },
  two: { flexDirection: "row", gap: 12 },
});
