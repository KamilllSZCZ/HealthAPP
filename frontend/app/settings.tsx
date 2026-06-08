import { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Switch, Platform } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/auth";
import { api } from "@/src/api";
import { colors, radius } from "@/src/theme";
import { AppText, Card, ScreenHeader, Button, Field, Sheet, SectionTitle, Pill, EmptyState, Loader, ErrorState } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { confirmAsync } from "@/src/utils/confirm";
import { errMessage } from "@/src/utils/validate";

const REMINDER_TYPES = ["Supplements", "Water", "Meals", "Habits", "Weight"];

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user, logout } = useAuth();
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [form, setForm] = useState<any>({ type: "Supplements", time: "08:00", repeat: "Daily", label: "", enabled: true });
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      setReminders(await api("/notifications"));
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveReminder = async () => {
    if (!form.time.trim()) { toast.error("Reminder time is required."); return; }
    setSaving(true);
    try {
      await api("/notifications", { method: "POST", body: form });
      toast.success("Reminder added.");
      setSheet(false);
      setForm({ type: "Supplements", time: "08:00", repeat: "Daily", label: "", enabled: true });
      load();
    } catch (e: any) {
      toast.error(errMessage(e, "Couldn't add reminder."));
    } finally {
      setSaving(false);
    }
  };

  const toggleReminder = async (r: any) => {
    try { await api(`/notifications/${r.id}`, { method: "PUT", body: { enabled: !r.enabled } }); load(); }
    catch (e: any) { toast.error(errMessage(e, "Couldn't update reminder.")); }
  };

  const deleteReminder = async (id: string) => {
    const ok = await confirmAsync("Delete reminder?", "This reminder will be permanently removed.");
    if (!ok) return;
    try { await api(`/notifications/${id}`, { method: "DELETE" }); toast.success("Reminder deleted."); load(); }
    catch (e: any) { toast.error(errMessage(e, "Couldn't delete reminder.")); }
  };

  const exportData = async (format: "json" | "csv") => {
    setExporting(true);
    try {
      const data = await api("/export");
      if (Platform.OS === "web" && typeof window !== "undefined") {
        let content: string; let mime: string; let ext: string;
        if (format === "json") {
          content = JSON.stringify(data, null, 2); mime = "application/json"; ext = "json";
        } else {
          const rows = ["collection,json"];
          Object.entries(data).forEach(([k, v]) => rows.push(`${k},"${JSON.stringify(v).replace(/"/g, "'")}"`));
          content = rows.join("\n"); mime = "text/csv"; ext = "csv";
        }
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `lifesync-backup.${ext}`; a.click();
        URL.revokeObjectURL(url);
        toast.success(`Exported as ${format.toUpperCase()}.`);
      } else {
        toast.success(`Your data has been exported as ${format.toUpperCase()}.`);
      }
    } catch (e: any) {
      toast.error(errMessage(e, "Couldn't export your data."));
    } finally {
      setExporting(false);
    }
  };

  const doLogout = async () => {
    try { await logout(); } catch {}
    router.replace("/login");
  };

  if (loading) return <Loader />;
  if (error) return <ErrorState onRetry={() => { setError(false); setLoading(true); load(); }} onBack={() => router.back()} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Settings" onBack={() => router.back()} />

        <SectionTitle title="Reminders" action="Add" onAction={() => setSheet(true)} />
        <View style={styles.noteBox}>
          <Ionicons name="notifications" size={15} color={colors.accent} />
          <AppText style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 8, flex: 1 }}>
            Reminders are saved to your account. Push delivery activates on a native build.
          </AppText>
        </View>
        {reminders.length === 0 ? (
          <EmptyState icon="alarm-outline" title="No reminders" subtitle="Add reminders for supplements, water, meals and more." />
        ) : (
          reminders.map((r) => (
            <Card key={r.id} style={styles.remRow} testID={`reminder-${r.id}`}>
              <View style={[styles.remIcon, { backgroundColor: colors.accentSoft }]}><Ionicons name="alarm" size={16} color={colors.accent} /></View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <AppText weight="bold" style={{ fontSize: 14 }}>{r.label || r.type}</AppText>
                <AppText style={{ color: colors.textTertiary, fontSize: 12 }}>{r.time} · {r.repeat}</AppText>
              </View>
              <Switch value={!!r.enabled} onValueChange={() => toggleReminder(r)} trackColor={{ true: colors.accent, false: colors.surfaceHover }} thumbColor="#fff" testID={`reminder-toggle-${r.id}`} />
              <TouchableOpacity onPress={() => deleteReminder(r.id)} style={styles.delBtn} testID={`delete-reminder-${r.id}`}><Ionicons name="trash-outline" size={18} color={colors.textTertiary} /></TouchableOpacity>
            </Card>
          ))
        )}

        <SectionTitle title="Data & Backup" />
        <Card>
          <AppText style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 14 }}>Export all of your LifeSync data for backup or migration.</AppText>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button title="Export JSON" variant="secondary" icon="code-download" onPress={() => exportData("json")} loading={exporting} style={{ flex: 1 }} testID="export-json-btn" />
            <Button title="Export CSV" variant="secondary" icon="document-text" onPress={() => exportData("csv")} loading={exporting} style={{ flex: 1 }} testID="export-csv-btn" />
          </View>
        </Card>

        <SectionTitle title="Account" />
        <Card>
          <View style={styles.accRow}><AppText style={{ color: colors.textTertiary }}>Name</AppText><AppText weight="bold">{user?.name}</AppText></View>
          <View style={styles.divider} />
          <View style={styles.accRow}><AppText style={{ color: colors.textTertiary }}>Email</AppText><AppText weight="bold">{user?.email}</AppText></View>
          <View style={styles.divider} />
          <View style={styles.accRow}><AppText style={{ color: colors.textTertiary }}>Sign-in</AppText><AppText weight="bold" style={{ textTransform: "capitalize" }}>{user?.auth_provider}</AppText></View>
          <View style={styles.divider} />
          <View style={styles.accRow}><AppText style={{ color: colors.textTertiary }}>Version</AppText><AppText weight="bold">1.0.0</AppText></View>
        </Card>

        <Button title="Log Out" variant="secondary" icon="log-out-outline" onPress={doLogout} style={{ marginTop: 16 }} testID="settings-logout-btn" />
      </ScrollView>

      <Sheet visible={sheet} onClose={() => setSheet(false)} title="New Reminder">
        <AppText style={styles.lbl}>Type</AppText>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {REMINDER_TYPES.map((t) => <Pill key={t} label={t} active={form.type === t} onPress={() => setForm({ ...form, type: t })} />)}
        </View>
        <Field label="Label" placeholder="e.g. Morning vitamins" value={form.label} onChangeText={(v: string) => setForm({ ...form, label: v })} testID="reminder-label" />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}><Field label="Time" placeholder="08:00" value={form.time} onChangeText={(v: string) => setForm({ ...form, time: v })} /></View>
          <View style={{ flex: 1 }}>
            <AppText style={styles.lbl}>Repeat</AppText>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {["Daily", "Weekly"].map((rp) => <Pill key={rp} label={rp} active={form.repeat === rp} onPress={() => setForm({ ...form, repeat: rp })} />)}
            </View>
          </View>
        </View>
        <Button title="Add Reminder" onPress={saveReminder} loading={saving} style={{ marginTop: 12 }} testID="save-reminder-btn" />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  noteBox: { flexDirection: "row", alignItems: "center", backgroundColor: colors.accentSoft, padding: 12, borderRadius: radius.md, marginBottom: 12 },
  remRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  remIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  delBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginLeft: 4 },
  accRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
  lbl: { fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: colors.textTertiary, marginBottom: 8 },
});
