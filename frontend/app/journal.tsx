import { useCallback, useState, useMemo } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, radius } from "@/src/theme";
import { AppText, Card, ScreenHeader, Button, Field, Sheet, IconButton, EmptyState, Loader, ErrorState } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { confirmAsync } from "@/src/utils/confirm";
import { errMessage } from "@/src/utils/validate";

const TAGS = ["Daily", "Reflection", "Health", "Work", "Personal"];

export default function Journal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [form, setForm] = useState<any>({ title: "", content: "", tags: [] as string[] });
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      setEntries(await api("/journal"));
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const openNew = () => { setForm({ title: "", content: "", tags: [] }); setEditing(null); setSheet(true); };
  const openEdit = (e: any) => { setForm({ title: e.title, content: e.content, tags: e.tags || [] }); setEditing(e.id); setSheet(true); };

  const toggleTag = (t: string) => {
    setForm((f: any) => ({ ...f, tags: f.tags.includes(t) ? f.tags.filter((x: string) => x !== t) : [...f.tags, t] }));
  };

  const save = async () => {
    if (!form.title.trim() && !form.content.trim()) { toast.error("Add a title or some content first."); return; }
    setSaving(true);
    const payload = { ...form, date: new Date().toISOString().slice(0, 10) };
    try {
      if (editing) await api(`/journal/${editing}`, { method: "PUT", body: payload });
      else await api("/journal", { method: "POST", body: payload });
      toast.success(editing ? "Entry updated." : "Entry saved.");
      setSheet(false); load();
    } catch (e: any) {
      toast.error(errMessage(e, "Couldn't save entry."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const ok = await confirmAsync("Delete entry?", "This journal entry will be permanently removed.");
    if (!ok) return;
    try {
      await api(`/journal/${id}`, { method: "DELETE" });
      toast.success("Entry deleted.");
      setSheet(false); load();
    } catch (e: any) {
      toast.error(errMessage(e, "Couldn't delete entry."));
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter((e) =>
      !q || e.title?.toLowerCase().includes(q) || e.content?.toLowerCase().includes(q) || (e.tags || []).some((t: string) => t.toLowerCase().includes(q))
    );
  }, [entries, search]);

  if (loading) return <Loader />;
  if (error) return <ErrorState onRetry={() => { setError(false); setLoading(true); load(); }} onBack={() => router.back()} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <ScreenHeader title="Journal" onBack={() => router.back()} right={<IconButton icon="add" bg={colors.blue} color="#fff" onPress={openNew} testID="add-journal-btn" />} />

        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <Field placeholder="Search entries & tags..." value={search} onChangeText={setSearch} testID="journal-search" style={{ borderWidth: 0, backgroundColor: "transparent", flex: 1, paddingVertical: 8 }} />
        </View>

        {filtered.length === 0 ? (
          <EmptyState icon="book-outline" title="No entries" subtitle="Capture daily notes, reflections and thoughts." />
        ) : (
          filtered.map((e) => (
            <TouchableOpacity key={e.id} onPress={() => openEdit(e)} activeOpacity={0.8} testID={`journal-${e.id}`}>
              <Card style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <AppText weight="bold" style={{ fontSize: 16, flex: 1 }}>{e.title || "Untitled"}</AppText>
                  <AppText style={{ color: colors.textTertiary, fontSize: 12 }}>{e.date}</AppText>
                </View>
                <AppText style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }} numberOfLines={2}>{e.content}</AppText>
                {(e.tags || []).length > 0 && (
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    {e.tags.map((t: string) => <View key={t} style={styles.tag}><AppText style={{ color: colors.blue, fontSize: 11 }}>#{t}</AppText></View>)}
                  </View>
                )}
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Sheet visible={sheet} onClose={() => setSheet(false)} title={editing ? "Edit Entry" : "New Entry"}>
        <Field label="Title" placeholder="Entry title" value={form.title} onChangeText={(v: string) => setForm({ ...form, title: v })} testID="journal-title" />
        <Field label="Content" placeholder="Write your thoughts..." value={form.content} onChangeText={(v: string) => setForm({ ...form, content: v })} multiline style={{ minHeight: 140, textAlignVertical: "top" }} testID="journal-content" />
        <AppText style={styles.lbl}>Tags</AppText>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          {TAGS.map((t) => (
            <TouchableOpacity key={t} onPress={() => toggleTag(t)} style={[styles.tagPick, form.tags.includes(t) ? { backgroundColor: colors.blue, borderColor: colors.blue } : null]}>
              <AppText style={{ color: form.tags.includes(t) ? "#fff" : colors.textSecondary, fontSize: 13 }}>#{t}</AppText>
            </TouchableOpacity>
          ))}
        </View>
        <Button title={editing ? "Save" : "Add Entry"} onPress={save} loading={saving} testID="save-journal-btn" />
        {editing && <Button title="Delete" variant="ghost" onPress={() => remove(editing)} style={{ marginTop: 8 }} testID="delete-journal-btn" />}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, marginBottom: 16 },
  tag: { backgroundColor: colors.blue + "22", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagPick: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  lbl: { fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: colors.textTertiary, marginBottom: 8 },
});
