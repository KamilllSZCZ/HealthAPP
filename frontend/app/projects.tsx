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
import { errMessage } from "@/src/utils/validate";

const TYPES = ["Garage", "Vehicle", "Business", "Personal"];

export default function Projects() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [form, setForm] = useState<any>({ name: "", description: "", type: "Personal", deadline: "", status: "active" });
  const [taskText, setTaskText] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      setProjects(await api("/projects"));
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const progress = (p: any) => {
    const tasks = p.tasks || [];
    if (!tasks.length) return 0;
    return Math.round((tasks.filter((t: any) => t.done).length / tasks.length) * 100);
  };

  const create = async () => {
    if (!form.name.trim()) { toast.error("Project name is required."); return; }
    setSaving(true);
    try {
      await api("/projects", { method: "POST", body: { ...form, tasks: [], notes: "" } });
      toast.success("Project created.");
      setSheet(false); setForm({ name: "", description: "", type: "Personal", deadline: "", status: "active" }); load();
    } catch (e: any) {
      toast.error(errMessage(e, "Couldn't create project."));
    } finally {
      setSaving(false);
    }
  };

  const saveDetail = async (updated: any) => {
    try {
      await api(`/projects/${updated.id}`, { method: "PUT", body: { tasks: updated.tasks, notes: updated.notes, status: updated.status } });
      setDetail(updated);
      load();
    } catch (e: any) {
      toast.error(errMessage(e, "Couldn't update project."));
    }
  };

  const addTask = () => {
    if (!taskText.trim() || !detail) { toast.error("Enter a task first."); return; }
    const updated = { ...detail, tasks: [...(detail.tasks || []), { id: Date.now().toString(), title: taskText, done: false }] };
    setTaskText("");
    saveDetail(updated);
  };

  const toggleTask = (tid: string) => {
    const updated = { ...detail, tasks: detail.tasks.map((t: any) => (t.id === tid ? { ...t, done: !t.done } : t)) };
    saveDetail(updated);
  };

  const removeProject = async (id: string) => {
    const ok = await confirmAsync("Delete project?", "This project and all its tasks will be permanently removed.");
    if (!ok) return;
    try {
      await api(`/projects/${id}`, { method: "DELETE" });
      toast.success("Project deleted.");
      setDetail(null); load();
    } catch (e: any) {
      toast.error(errMessage(e, "Couldn't delete project."));
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
        <ScreenHeader title="Projects" onBack={() => router.back()} right={<IconButton icon="add" bg={colors.warning} color="#fff" onPress={() => setSheet(true)} testID="add-project-btn" />} />

        {projects.length === 0 ? (
          <EmptyState icon="construct-outline" title="No projects yet" subtitle="Track garage, vehicle, business and personal projects with tasks." />
        ) : (
          projects.map((p) => {
            const prog = progress(p);
            return (
              <Card key={p.id} style={{ marginBottom: 12 }} testID={`project-${p.id}`}>
                <TouchableOpacity onPress={() => setDetail(p)} activeOpacity={0.8}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={[styles.typeTag, { backgroundColor: colors.warning + "22" }]}>
                      <AppText weight="bold" style={{ color: colors.warning, fontSize: 10 }}>{p.type?.toUpperCase()}</AppText>
                    </View>
                    <AppText style={{ color: colors.textTertiary, fontSize: 12 }}>{(p.tasks || []).filter((t: any) => t.done).length}/{(p.tasks || []).length} tasks</AppText>
                  </View>
                  <AppText weight="bold" style={{ fontSize: 16, marginTop: 8 }}>{p.name}</AppText>
                  {p.description ? <AppText style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>{p.description}</AppText> : null}
                  {p.deadline ? <AppText style={{ color: colors.textTertiary, fontSize: 12, marginTop: 4 }}>Due: {p.deadline}</AppText> : null}
                  <View style={styles.progRow}>
                    <View style={styles.progBar}><View style={[styles.progFill, { width: `${prog}%` }]} /></View>
                    <AppText weight="bold" style={{ fontSize: 13, width: 42, textAlign: "right" }}>{prog}%</AppText>
                  </View>
                </TouchableOpacity>
              </Card>
            );
          })
        )}
      </ScrollView>

      <Sheet visible={sheet} onClose={() => setSheet(false)} title="New Project">
        <Field label="Project Name" placeholder="Restore the motorbike" value={form.name} onChangeText={(v: string) => setForm({ ...form, name: v })} testID="project-name" />
        <Field label="Description" placeholder="Short description" value={form.description} onChangeText={(v: string) => setForm({ ...form, description: v })} multiline />
        <AppText style={styles.lbl}>Type</AppText>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {TYPES.map((t) => <Pill key={t} label={t} active={form.type === t} onPress={() => setForm({ ...form, type: t })} />)}
        </View>
        <Field label="Deadline" placeholder="YYYY-MM-DD" value={form.deadline} onChangeText={(v: string) => setForm({ ...form, deadline: v })} />
        <Button title="Create Project" onPress={create} loading={saving} testID="save-project-btn" />
      </Sheet>

      <Sheet visible={!!detail} onClose={() => setDetail(null)} title={detail?.name || "Project"}>
        {detail && (
          <>
            <AppText style={{ color: colors.textSecondary, marginBottom: 16 }}>{detail.description}</AppText>
            <AppText style={styles.lbl}>Tasks</AppText>
            {(detail.tasks || []).map((t: any) => (
              <TouchableOpacity key={t.id} style={styles.taskRow} onPress={() => toggleTask(t.id)} testID={`task-${t.id}`}>
                <Ionicons name={t.done ? "checkbox" : "square-outline"} size={22} color={t.done ? colors.success : colors.textTertiary} />
                <AppText style={{ marginLeft: 10, flex: 1, color: t.done ? colors.textTertiary : colors.text, textDecorationLine: t.done ? "line-through" : "none" }}>{t.title}</AppText>
              </TouchableOpacity>
            ))}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8, alignItems: "center" }}>
              <View style={{ flex: 1 }}><Field placeholder="Add a task..." value={taskText} onChangeText={setTaskText} testID="task-input" /></View>
              <TouchableOpacity onPress={addTask} style={styles.addTaskBtn} testID="add-task-btn"><Ionicons name="add" size={22} color="#fff" /></TouchableOpacity>
            </View>
            <Button title="Delete Project" variant="ghost" onPress={() => removeProject(detail.id)} style={{ marginTop: 8 }} testID="delete-project-btn" />
          </>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  typeTag: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  progRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },
  progBar: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceHover, overflow: "hidden" },
  progFill: { height: 8, borderRadius: 4, backgroundColor: colors.warning },
  lbl: { fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: colors.textTertiary, marginBottom: 8 },
  taskRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  addTaskBtn: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.warning, alignItems: "center", justifyContent: "center", marginBottom: 12 },
});
