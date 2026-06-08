import { useState } from "react";
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/auth";
import { colors, radius, spacing } from "@/src/theme";
import { AppText, Field, Button, SegmentedControl } from "@/src/components/ui";

export default function Login() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    if (mode === "register" && !name.trim()) {
      setError("Please enter your name.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register(email.trim(), password, name.trim());
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 64, paddingHorizontal: 28, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <View style={styles.logoWrap}>
          <View style={styles.logo}>
            <Ionicons name="pulse" size={28} color={colors.accent} />
          </View>
        </View>
        <AppText weight="headingExtra" style={styles.brand}>LifeSync</AppText>
        <AppText style={styles.tagline}>
          Your complete health, supplement and habit command center.
        </AppText>

        {/* Mode toggle */}
        <View style={{ marginTop: 36, marginBottom: 24 }}>
          <SegmentedControl
            options={[{ label: "Sign In", value: "login" }, { label: "Create Account", value: "register" }]}
            value={mode}
            onChange={(v) => { setMode(v as any); setError(null); }}
            testID="auth-mode-toggle"
          />
        </View>

        {mode === "register" && (
          <Field
            label="Name"
            placeholder="Your name"
            autoCapitalize="words"
            value={name}
            onChangeText={setName}
            testID="auth-name"
          />
        )}
        <Field
          label="Email"
          placeholder="you@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          testID="auth-email"
        />
        <Field
          label="Password"
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={submit}
          returnKeyType="go"
          testID="auth-password"
        />

        {error ? (
          <View style={styles.errorBox} testID="auth-error">
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <AppText style={{ color: colors.danger, fontSize: 13, marginLeft: 8, flex: 1 }}>{error}</AppText>
          </View>
        ) : null}

        <View style={{ marginTop: 8 }}>
          <Button
            title={mode === "login" ? "Sign In" : "Create Account"}
            onPress={submit}
            loading={loading}
            testID="auth-submit"
          />
        </View>

        <AppText style={styles.footer}>
          {mode === "login" ? "New to LifeSync? Tap Create Account above." : "Already have an account? Tap Sign In above."}
        </AppText>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  logoWrap: { alignItems: "flex-start" },
  logo: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: colors.accentSoft,
    borderWidth: 1, borderColor: colors.accent + "55",
    alignItems: "center", justifyContent: "center",
  },
  brand: { fontSize: 40, marginTop: 20, letterSpacing: -0.5 },
  tagline: { color: colors.textSecondary, fontSize: 15, marginTop: 8, lineHeight: 22, maxWidth: 320 },
  errorBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.dangerSoft, borderRadius: radius.md,
    padding: 12, marginBottom: spacing.md,
  },
  footer: { color: colors.textTertiary, fontSize: 13, textAlign: "center", marginTop: 24 },
});
