import { useCallback, useState, useMemo } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, radius } from "@/src/theme";
import { AppText, Card, ScreenHeader, Button, Field, Sheet, IconButton, EmptyState } from "@/src/components/ui";

const TAGS = ["Daily", "Reflection", "Health", "Work", "Personal"];

export default function Journal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<any[]>([]);
  const [sheet, setSheet] = useState(false);
  const [form, setForm] = useState<any>({ title: "", content: "", tags: [] as string[] });
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => { setEntries(await api("/journal")); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openNew = () => { setForm({ title: "", content: "", tags: [] }); setEditing(null); setSheet(true); };
  const openEdit = (e: any) => { setForm({ title: e.title, content: e.content, tags: e.tags || [] }); setEditing(e.id); setSheet(true); };

  const toggleTag = (t: string) => {
    setForm((f: any) => ({ ...f, tags: f.tags.includes(t) ? f.tags.filter((x: string) => x !== t) : [...f.tags, t] }));
  };

  const save = async () => {
    if (!form.title.trim() && !form.content.trim()) return;
    setSaving(true);
    const payload = { ...form, date: new Date().toISOString().slice(0, 10) };
    try {
      if (editing) await api(`/journal/${editing}`, { method: "PUT", body: payload });
      else await api("/journal", { method: "POST", body: payload });
      setSheet(false); load();
    } finally { setSaving(false); }
  };

  const remove = (id: string) => {
    const doIt = async () => { await api(`/journal/${id}`, { method: "DELETE" }); setSheet(false); load(); };
    if (Platform.OS === "web") doIt();
    else Alert.alert("Delete entry?", "", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: doIt }]);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter((e) =>
      !q || e.title?.toLowerCase().includes(q) || e.content?.toLowerCase().includes(q) || (e.tags || []).some((t: string) => t.toLowerCase().includes(q))
    );
  }, [entries, search]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
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
        {editing && <Button title="Delete" variant="ghost" onPress={() => remove(editing)} style={{ marginTop: 8 }} />}
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
