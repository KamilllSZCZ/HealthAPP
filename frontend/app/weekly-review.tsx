import { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors } from "@/src/theme";
import { AppText, Card, ScreenHeader, Button, Field, SectionTitle, EmptyState } from "@/src/components/ui";

const QUESTIONS = [
  { key: "energy", q: "How was your energy?" },
  { key: "focus", q: "How was your focus?" },
  { key: "sleep", q: "How was your sleep?" },
  { key: "motivation", q: "How was your motivation?" },
  { key: "stress", q: "How was your stress?" },
];

export default function WeeklyReview() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [reviews, setReviews] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => { setReviews(await api("/weekly-review")); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    setSaving(true);
    try {
      await api("/weekly-review", { method: "POST", body: { ...values, notes, week_start: new Date().toISOString().slice(0, 10) } });
      setValues({}); setNotes(""); load();
    } finally { setSaving(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Weekly Review" onBack={() => router.back()} />

        <Card>
          <AppText weight="headingSemi" style={{ fontSize: 16, marginBottom: 4 }}>Reflect on your week</AppText>
          <AppText style={{ color: colors.textTertiary, fontSize: 13, marginBottom: 16 }}>Rate each area from 1 to 10.</AppText>
          {QUESTIONS.map((item) => (
            <View key={item.key} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                <AppText style={{ fontSize: 14 }}>{item.q}</AppText>
                <AppText weight="bold" style={{ color: colors.accent }}>{values[item.key] || "—"}</AppText>
              </View>
              <View style={{ flexDirection: "row", gap: 5 }}>
                {Array.from({ length: 10 }).map((_, i) => {
                  const v = i + 1;
                  return <TouchableOpacity key={v} style={[styles.dot, { backgroundColor: (values[item.key] || 0) >= v ? colors.accent : colors.surfaceHover }]} onPress={() => setValues((s) => ({ ...s, [item.key]: v }))} testID={`review-${item.key}-${v}`} />;
                })}
              </View>
            </View>
          ))}
          <Field label="Notes" placeholder="Free-form reflections on your week..." value={notes} onChangeText={setNotes} multiline style={{ minHeight: 100, textAlignVertical: "top" }} testID="review-notes" />
          <Button title="Save Weekly Review" onPress={save} loading={saving} testID="save-review-btn" />
        </Card>

        <SectionTitle title="Past Reviews" />
        {reviews.length === 0 ? (
          <EmptyState icon="calendar-outline" title="No reviews yet" subtitle="Your weekly reflections will appear here." />
        ) : (
          reviews.map((r) => {
            const avg = Math.round(QUESTIONS.reduce((a, q) => a + (r[q.key] || 0), 0) / QUESTIONS.length);
            return (
              <Card key={r.id} style={{ marginBottom: 10 }} testID={`past-review-${r.id}`}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <AppText weight="bold" style={{ fontSize: 14 }}>Week of {r.week_start}</AppText>
                  <View style={styles.avgBadge}><AppText weight="bold" style={{ color: colors.accent, fontSize: 13 }}>{avg}/10</AppText></View>
                </View>
                <View style={{ flexDirection: "row", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                  {QUESTIONS.map((q) => <AppText key={q.key} style={{ color: colors.textTertiary, fontSize: 12 }}>{q.key} {r[q.key] || "—"}</AppText>)}
                </View>
                {r.notes ? <AppText style={{ color: colors.textSecondary, fontSize: 13, marginTop: 8 }}>{r.notes}</AppText> : null}
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { flex: 1, height: 26, borderRadius: 6 },
  avgBadge: { backgroundColor: colors.accentSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
});
