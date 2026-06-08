import { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Platform, Alert } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, spacing, radius } from "@/src/theme";
import { AppText, Card, Button, Field, Sheet, Pill, EmptyState, IconButton, SectionTitle } from "@/src/components/ui";
import { Ring } from "@/src/components/charts";

const CATS = ["Breakfast", "Lunch", "Dinner", "Snack"];
const CAT_ICON: Record<string, string> = { Breakfast: "cafe", Lunch: "fast-food", Dinner: "restaurant", Snack: "nutrition" };
const emptyMeal = { name: "", category: "Breakfast", calories: "", protein: "", carbs: "", fat: "", fiber: "" };

export default function Nutrition() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<any>({ meals: [], totals: {} });
  const [templates, setTemplates] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [form, setForm] = useState<any>(emptyMeal);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [today, tmpl] = await Promise.all([api("/meals/today"), api("/meal-templates")]);
      setData(today);
      setTemplates(tmpl);
    } catch (e) { console.warn(e); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const openNew = (cat?: string) => { setForm({ ...emptyMeal, category: cat || "Breakfast" }); setSaveAsTemplate(false); setSheet(true); };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name, category: form.category,
      calories: parseFloat(form.calories) || 0, protein: parseFloat(form.protein) || 0,
      carbs: parseFloat(form.carbs) || 0, fat: parseFloat(form.fat) || 0, fiber: parseFloat(form.fiber) || 0,
    };
    try {
      await api("/meals", { method: "POST", body: payload });
      if (saveAsTemplate) await api("/meal-templates", { method: "POST", body: payload });
      setSheet(false);
      load();
    } catch (e: any) { Alert.alert("Error", e.message); } finally { setSaving(false); }
  };

  const addFromTemplate = async (t: any) => {
    await api("/meals", { method: "POST", body: {
      name: t.name, category: t.category || "Snack",
      calories: t.calories, protein: t.protein, carbs: t.carbs, fat: t.fat, fiber: t.fiber,
    }});
    load();
  };

  const removeMeal = async (id: string) => { await api(`/meals/${id}`, { method: "DELETE" }); load(); };

  const t = data.totals || {};
  const calGoal = 2200;
  const grouped: Record<string, any[]> = {};
  (data.meals || []).forEach((m: any) => { (grouped[m.category] = grouped[m.category] || []).push(m); });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <View style={styles.titleRow}>
          <AppText weight="headingExtra" style={{ fontSize: 28 }}>Nutrition</AppText>
          <IconButton icon="add" bg={colors.success} color="#fff" onPress={() => openNew()} testID="add-meal-btn" />
        </View>

        {/* Macro summary */}
        <Card style={styles.summary} testID="nutrition-summary">
          <Ring size={96} stroke={9} progress={(t.calories || 0) / calGoal} color={colors.success}>
            <View style={{ alignItems: "center" }}>
              <AppText weight="headingExtra" style={{ fontSize: 20 }}>{Math.round(t.calories || 0)}</AppText>
              <AppText style={{ color: colors.textTertiary, fontSize: 10 }}>kcal</AppText>
            </View>
          </Ring>
          <View style={{ flex: 1, marginLeft: 18 }}>
            <AppText weight="headingSemi" style={{ fontSize: 15, marginBottom: 12 }}>{"Today's Macros"}</AppText>
            {[
              { k: "protein", label: "Protein", color: colors.accent, unit: "g" },
              { k: "carbs", label: "Carbs", color: colors.warning, unit: "g" },
              { k: "fat", label: "Fat", color: colors.danger, unit: "g" },
              { k: "fiber", label: "Fiber", color: colors.cyan, unit: "g" },
            ].map((m) => (
              <View key={m.k} style={styles.macroRow}>
                <View style={[styles.macroDot, { backgroundColor: m.color }]} />
                <AppText style={{ color: colors.textSecondary, fontSize: 13, flex: 1 }}>{m.label}</AppText>
                <AppText weight="bold" style={{ fontSize: 13 }}>{Math.round(t[m.k] || 0)}{m.unit}</AppText>
              </View>
            ))}
          </View>
        </Card>

        {/* Quick add chips */}
        <View style={styles.quickRow}>
          {CATS.map((c) => (
            <TouchableOpacity key={c} style={styles.quickChip} onPress={() => openNew(c)} testID={`quick-meal-${c}`}>
              <Ionicons name={CAT_ICON[c] as any} size={18} color={colors.success} />
              <AppText style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>{c}</AppText>
            </TouchableOpacity>
          ))}
        </View>

        {/* Saved meals */}
        {templates.length > 0 && (
          <>
            <SectionTitle title="Saved Meals" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: "row", gap: 10, paddingRight: 16 }}>
                {templates.map((tp) => (
                  <TouchableOpacity key={tp.id} style={styles.tmpl} onPress={() => addFromTemplate(tp)} testID={`template-${tp.id}`}>
                    <AppText weight="bold" style={{ fontSize: 13 }} numberOfLines={1}>{tp.name}</AppText>
                    <AppText style={{ color: colors.textTertiary, fontSize: 11, marginTop: 2 }}>{Math.round(tp.calories)} kcal</AppText>
                    <View style={styles.tmplAdd}><Ionicons name="add" size={14} color={colors.success} /></View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </>
        )}

        {/* Today's meals grouped */}
        <SectionTitle title="Today's Log" />
        {(data.meals || []).length === 0 ? (
          <EmptyState icon="restaurant-outline" title="Nothing logged yet" subtitle="Quick-add a meal above to start tracking calories and macros." />
        ) : (
          CATS.filter((c) => grouped[c]?.length).map((c) => (
            <View key={c} style={{ marginBottom: 8 }}>
              <AppText style={styles.groupLabel}>{c.toUpperCase()}</AppText>
              {grouped[c].map((m: any) => (
                <Card key={m.id} style={styles.mealItem} testID={`meal-${m.id}`}>
                  <View style={{ flex: 1 }}>
                    <AppText weight="bold" style={{ fontSize: 14 }}>{m.name}</AppText>
                    <AppText style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>
                      {Math.round(m.calories)} kcal · P{Math.round(m.protein)} C{Math.round(m.carbs)} F{Math.round(m.fat)}
                    </AppText>
                  </View>
                  <TouchableOpacity onPress={() => removeMeal(m.id)} testID={`delete-meal-${m.id}`}>
                    <Ionicons name="trash-outline" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                </Card>
              ))}
            </View>
          ))
        )}

        <Button title="Open Meal Prep" variant="secondary" icon="layers" onPress={() => router.push("/mealprep")} style={{ marginTop: 12 }} testID="open-mealprep-btn" />
      </ScrollView>

      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Add Meal" testID="meal-sheet">
        <Field label="Meal Name *" placeholder="Greek yogurt bowl" value={form.name} onChangeText={(v: string) => setForm({ ...form, name: v })} testID="meal-name" />
        <AppText style={styles.lbl}>Category</AppText>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {CATS.map((c) => <Pill key={c} label={c} active={form.category === c} onPress={() => setForm({ ...form, category: c })} />)}
        </View>
        <View style={styles.two}>
          <View style={{ flex: 1 }}><Field label="Calories" placeholder="350" keyboardType="number-pad" value={form.calories} onChangeText={(v: string) => setForm({ ...form, calories: v })} testID="meal-calories" /></View>
          <View style={{ flex: 1 }}><Field label="Protein (g)" placeholder="25" keyboardType="decimal-pad" value={form.protein} onChangeText={(v: string) => setForm({ ...form, protein: v })} /></View>
        </View>
        <View style={styles.two}>
          <View style={{ flex: 1 }}><Field label="Carbs (g)" placeholder="40" keyboardType="decimal-pad" value={form.carbs} onChangeText={(v: string) => setForm({ ...form, carbs: v })} /></View>
          <View style={{ flex: 1 }}><Field label="Fat (g)" placeholder="12" keyboardType="decimal-pad" value={form.fat} onChangeText={(v: string) => setForm({ ...form, fat: v })} /></View>
        </View>
        <Field label="Fiber (g)" placeholder="6" keyboardType="decimal-pad" value={form.fiber} onChangeText={(v: string) => setForm({ ...form, fiber: v })} />
        <TouchableOpacity style={styles.toggle} onPress={() => setSaveAsTemplate(!saveAsTemplate)} testID="save-template-toggle">
          <Ionicons name={saveAsTemplate ? "checkbox" : "square-outline"} size={20} color={saveAsTemplate ? colors.success : colors.textTertiary} />
          <AppText style={{ color: colors.textSecondary, marginLeft: 10 }}>Also save as a reusable meal</AppText>
        </TouchableOpacity>
        <Button title="Add Meal" onPress={save} loading={saving} testID="save-meal-btn" />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  summary: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  macroRow: { flexDirection: "row", alignItems: "center", marginBottom: 7 },
  macroDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  quickRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  quickChip: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 12, alignItems: "center" },
  tmpl: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, width: 140 },
  tmplAdd: { position: "absolute", top: 10, right: 10, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.successSoft, alignItems: "center", justifyContent: "center" },
  groupLabel: { fontSize: 11, letterSpacing: 1.5, color: colors.textTertiary, marginBottom: 6, marginLeft: 4 },
  mealItem: { flexDirection: "row", alignItems: "center", marginBottom: 8, paddingVertical: 12 },
  lbl: { fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: colors.textTertiary, marginBottom: 8 },
  two: { flexDirection: "row", gap: 12 },
  toggle: { flexDirection: "row", alignItems: "center", marginBottom: 16, marginTop: 4 },
});
