import { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, radius } from "@/src/theme";
import { AppText, Card, ScreenHeader, Button, Field, Sheet, IconButton, SegmentedControl, EmptyState } from "@/src/components/ui";

type Ingredient = { name: string; quantity: string; unit: string };

export default function MealPrep() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState("recipes");
  const [recipes, setRecipes] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [shopping, setShopping] = useState<any[]>([]);

  // recipe form
  const [recipeSheet, setRecipeSheet] = useState(false);
  const [rForm, setRForm] = useState<any>({ name: "", calories: "", protein: "", carbs: "", fat: "", fiber: "", total_cost: "" });
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: "", quantity: "", unit: "g" }]);

  // batch form
  const [batchSheet, setBatchSheet] = useState(false);
  const [bForm, setBForm] = useState<any>({ name: "", total_servings: "4", total_cost: "", calories_per_serving: "", protein_per_serving: "", carbs_per_serving: "", fat_per_serving: "", expiration_date: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [r, b, s] = await Promise.all([api("/recipes"), api("/meal-prep"), api("/shopping-list")]);
    setRecipes(r); setBatches(b); setShopping(s);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveRecipe = async () => {
    if (!rForm.name.trim()) return;
    setSaving(true);
    const payload = {
      name: rForm.name,
      ingredients: ingredients.filter((i) => i.name.trim()).map((i) => ({ name: i.name, quantity: parseFloat(i.quantity) || 0, unit: i.unit })),
      calories: parseFloat(rForm.calories) || 0, protein: parseFloat(rForm.protein) || 0,
      carbs: parseFloat(rForm.carbs) || 0, fat: parseFloat(rForm.fat) || 0, fiber: parseFloat(rForm.fiber) || 0,
      total_cost: parseFloat(rForm.total_cost) || 0,
    };
    try {
      await api("/recipes", { method: "POST", body: payload });
      setRecipeSheet(false);
      setRForm({ name: "", calories: "", protein: "", carbs: "", fat: "", fiber: "", total_cost: "" });
      setIngredients([{ name: "", quantity: "", unit: "g" }]);
      load();
    } finally { setSaving(false); }
  };

  const saveBatch = async () => {
    if (!bForm.name.trim()) return;
    setSaving(true);
    const payload = {
      name: bForm.name, total_servings: parseInt(bForm.total_servings) || 1,
      total_cost: parseFloat(bForm.total_cost) || 0,
      calories_per_serving: parseFloat(bForm.calories_per_serving) || 0,
      protein_per_serving: parseFloat(bForm.protein_per_serving) || 0,
      carbs_per_serving: parseFloat(bForm.carbs_per_serving) || 0,
      fat_per_serving: parseFloat(bForm.fat_per_serving) || 0,
      expiration_date: bForm.expiration_date,
    };
    try {
      await api("/meal-prep", { method: "POST", body: payload });
      setBatchSheet(false);
      setBForm({ name: "", total_servings: "4", total_cost: "", calories_per_serving: "", protein_per_serving: "", carbs_per_serving: "", fat_per_serving: "", expiration_date: "" });
      load();
    } finally { setSaving(false); }
  };

  const consume = async (id: string) => { await api(`/meal-prep/${id}/consume`, { method: "POST" }); load(); };
  const deleteBatch = async (id: string) => { await api(`/meal-prep/${id}`, { method: "DELETE" }); load(); };
  const deleteRecipe = async (id: string) => { await api(`/recipes/${id}`, { method: "DELETE" }); load(); };

  const genShopping = async () => {
    if (recipes.length === 0) { Alert.alert("No recipes", "Create a recipe with ingredients first."); return; }
    await api("/shopping-list/generate", { method: "POST", body: { name: "Weekly Shopping", recipe_ids: recipes.map((r) => r.id) } });
    setTab("shopping");
    load();
  };

  const toggleShopItem = async (list: any, idx: number) => {
    const items = list.items.map((it: any, i: number) => (i === idx ? { ...it, checked: !it.checked } : it));
    await api(`/shopping-list/${list.id}`, { method: "PUT", body: { items } });
    load();
  };
  const deleteList = async (id: string) => { await api(`/shopping-list/${id}`, { method: "DELETE" }); load(); };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Meal Prep" onBack={() => router.back()} />
        <View style={{ marginBottom: 16 }}>
          <SegmentedControl
            options={[{ label: "Recipes", value: "recipes" }, { label: "Batches", value: "batches" }, { label: "Shopping", value: "shopping" }]}
            value={tab} onChange={setTab} testID="mealprep-tabs"
          />
        </View>

        {tab === "recipes" && (
          <>
            <Button title="New Recipe" icon="add" onPress={() => setRecipeSheet(true)} style={{ marginBottom: 12 }} testID="new-recipe-btn" />
            {recipes.length === 0 ? <EmptyState icon="book-outline" title="No recipes" subtitle="Add recipes like Chili Con Carne or Chicken & Rice." /> :
              recipes.map((r) => (
                <Card key={r.id} style={{ marginBottom: 10 }} testID={`recipe-${r.id}`}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <AppText weight="bold" style={{ fontSize: 16, flex: 1 }}>{r.name}</AppText>
                    <TouchableOpacity onPress={() => deleteRecipe(r.id)}><Ionicons name="trash-outline" size={18} color={colors.textTertiary} /></TouchableOpacity>
                  </View>
                  <AppText style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                    {Math.round(r.calories)} kcal · P{Math.round(r.protein)} C{Math.round(r.carbs)} F{Math.round(r.fat)} · ${r.total_cost}
                  </AppText>
                  <AppText style={{ color: colors.textTertiary, fontSize: 12, marginTop: 6 }}>
                    {(r.ingredients || []).map((i: any) => i.name).join(", ") || "No ingredients"}
                  </AppText>
                </Card>
              ))}
            <Button title="Generate Shopping List" icon="cart" variant="secondary" onPress={genShopping} style={{ marginTop: 8 }} testID="gen-shopping-btn" />
          </>
        )}

        {tab === "batches" && (
          <>
            <Button title="New Batch" icon="add" onPress={() => setBatchSheet(true)} style={{ marginBottom: 12 }} testID="new-batch-btn" />
            {batches.length === 0 ? <EmptyState icon="layers-outline" title="No batches" subtitle="Cook a batch and track remaining portions." /> :
              batches.map((b) => (
                <Card key={b.id} style={{ marginBottom: 10 }} testID={`batch-${b.id}`}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <AppText weight="bold" style={{ fontSize: 16 }}>{b.name}</AppText>
                      <AppText style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                        {b.calories_per_serving} kcal/serv · ${b.cost_per_serving}/serv
                      </AppText>
                      {b.expiration_date ? <AppText style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>Expires {b.expiration_date}</AppText> : null}
                    </View>
                    <View style={styles.servBadge}>
                      <AppText weight="headingExtra" style={{ fontSize: 22, color: colors.success }}>{b.remaining_servings}</AppText>
                      <AppText style={{ color: colors.textTertiary, fontSize: 10 }}>of {b.total_servings} left</AppText>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                    <Button title="Eat a portion" variant="secondary" onPress={() => consume(b.id)} style={{ flex: 1 }} testID={`consume-${b.id}`} />
                    <TouchableOpacity onPress={() => deleteBatch(b.id)} style={styles.delBtn}><Ionicons name="trash-outline" size={18} color={colors.danger} /></TouchableOpacity>
                  </View>
                </Card>
              ))}
          </>
        )}

        {tab === "shopping" && (
          shopping.length === 0 ? <EmptyState icon="cart-outline" title="No shopping lists" subtitle="Generate one from your recipes." /> :
            shopping.map((list) => (
              <Card key={list.id} style={{ marginBottom: 12 }} testID={`shopping-${list.id}`}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <AppText weight="bold" style={{ fontSize: 16 }}>{list.name}</AppText>
                  <TouchableOpacity onPress={() => deleteList(list.id)}><Ionicons name="trash-outline" size={18} color={colors.textTertiary} /></TouchableOpacity>
                </View>
                {(list.items || []).map((it: any, i: number) => (
                  <TouchableOpacity key={i} style={styles.shopRow} onPress={() => toggleShopItem(list, i)} testID={`shop-item-${list.id}-${i}`}>
                    <Ionicons name={it.checked ? "checkbox" : "square-outline"} size={20} color={it.checked ? colors.success : colors.textTertiary} />
                    <AppText style={{ marginLeft: 10, flex: 1, color: it.checked ? colors.textTertiary : colors.text, textDecorationLine: it.checked ? "line-through" : "none" }}>
                      {it.name}{it.quantity ? ` — ${it.quantity}${it.unit}` : ""}
                    </AppText>
                  </TouchableOpacity>
                ))}
              </Card>
            ))
        )}
      </ScrollView>

      {/* Recipe sheet */}
      <Sheet visible={recipeSheet} onClose={() => setRecipeSheet(false)} title="New Recipe">
        <Field label="Recipe Name" placeholder="Chili Con Carne" value={rForm.name} onChangeText={(v: string) => setRForm({ ...rForm, name: v })} testID="recipe-name" />
        <AppText style={styles.lbl}>Ingredients</AppText>
        {ingredients.map((ing, idx) => (
          <View key={idx} style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
            <View style={{ flex: 2 }}><Field placeholder="Ingredient" value={ing.name} onChangeText={(v: string) => setIngredients(ingredients.map((x, i) => i === idx ? { ...x, name: v } : x))} /></View>
            <View style={{ flex: 1 }}><Field placeholder="Qty" keyboardType="decimal-pad" value={ing.quantity} onChangeText={(v: string) => setIngredients(ingredients.map((x, i) => i === idx ? { ...x, quantity: v } : x))} /></View>
            <View style={{ width: 60 }}><Field placeholder="g" value={ing.unit} onChangeText={(v: string) => setIngredients(ingredients.map((x, i) => i === idx ? { ...x, unit: v } : x))} /></View>
          </View>
        ))}
        <TouchableOpacity onPress={() => setIngredients([...ingredients, { name: "", quantity: "", unit: "g" }])} style={styles.addIng} testID="add-ingredient-btn">
          <Ionicons name="add" size={16} color={colors.accent} />
          <AppText weight="bold" style={{ color: colors.accent, fontSize: 13, marginLeft: 4 }}>Add ingredient</AppText>
        </TouchableOpacity>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Calories" keyboardType="number-pad" value={rForm.calories} onChangeText={(v: string) => setRForm({ ...rForm, calories: v })} /></View>
          <View style={{ flex: 1 }}><Field label="Protein" keyboardType="decimal-pad" value={rForm.protein} onChangeText={(v: string) => setRForm({ ...rForm, protein: v })} /></View>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Carbs" keyboardType="decimal-pad" value={rForm.carbs} onChangeText={(v: string) => setRForm({ ...rForm, carbs: v })} /></View>
          <View style={{ flex: 1 }}><Field label="Fat" keyboardType="decimal-pad" value={rForm.fat} onChangeText={(v: string) => setRForm({ ...rForm, fat: v })} /></View>
        </View>
        <Field label="Total Cost ($)" keyboardType="decimal-pad" value={rForm.total_cost} onChangeText={(v: string) => setRForm({ ...rForm, total_cost: v })} />
        <Button title="Save Recipe" onPress={saveRecipe} loading={saving} testID="save-recipe-btn" />
      </Sheet>

      {/* Batch sheet */}
      <Sheet visible={batchSheet} onClose={() => setBatchSheet(false)} title="New Batch">
        <Field label="Batch Name" placeholder="Chicken & Rice" value={bForm.name} onChangeText={(v: string) => setBForm({ ...bForm, name: v })} testID="batch-name" />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Total Servings" keyboardType="number-pad" value={bForm.total_servings} onChangeText={(v: string) => setBForm({ ...bForm, total_servings: v })} /></View>
          <View style={{ flex: 1 }}><Field label="Total Cost ($)" keyboardType="decimal-pad" value={bForm.total_cost} onChangeText={(v: string) => setBForm({ ...bForm, total_cost: v })} /></View>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Cal/serving" keyboardType="number-pad" value={bForm.calories_per_serving} onChangeText={(v: string) => setBForm({ ...bForm, calories_per_serving: v })} /></View>
          <View style={{ flex: 1 }}><Field label="Protein/serv" keyboardType="decimal-pad" value={bForm.protein_per_serving} onChangeText={(v: string) => setBForm({ ...bForm, protein_per_serving: v })} /></View>
        </View>
        <Field label="Expiration Date" placeholder="YYYY-MM-DD" value={bForm.expiration_date} onChangeText={(v: string) => setBForm({ ...bForm, expiration_date: v })} />
        <Button title="Save Batch" onPress={saveBatch} loading={saving} testID="save-batch-btn" />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  servBadge: { alignItems: "center", marginLeft: 12 },
  delBtn: { width: 50, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.danger + "44", alignItems: "center", justifyContent: "center" },
  shopRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  lbl: { fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: colors.textTertiary, marginBottom: 8 },
  addIng: { flexDirection: "row", alignItems: "center", marginBottom: 14, marginTop: 2 },
});
