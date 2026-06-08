import { View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText, Button, Field } from "@/src/components/ui";

export default function Login() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#003322" }} contentContainerStyle={{ paddingTop: insets.top + 60, padding: 24 }}>
      <AppText weight="headingExtra" style={{ fontSize: 30 }}>UI COMPONENTS</AppText>
      <AppText style={{ color: "#9ca", marginTop: 8 }}>If you can read this, AppText works.</AppText>
      <View style={{ height: 16 }} />
      <Field label="Email" placeholder="type here" />
      <Button title="A Button" onPress={() => {}} />
    </ScrollView>
  );
}
