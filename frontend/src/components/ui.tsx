import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TextInputProps,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius, fonts } from "../theme";

/** Keyboard-aware scroll using only core RN primitives (web + native safe). */
export function KAScroll(props: any) {
  const { bottomOffset, children, contentContainerStyle, ...rest } = props;
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={contentContainerStyle} {...rest}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const WEIGHT_TO_CSS: Record<string, any> = {
  body: "400",
  medium: "500",
  bold: "700",
  heading: "700",
  headingSemi: "600",
  headingExtra: "800",
};

export function AppText(props: any) {
  const { style, weight = "body", ...rest } = props;
  // Use the platform system font with a weight. Custom brand fonts are avoided
  // because the web font-loading hook stalls render; system fonts are crisp,
  // always-visible and performant.
  return (
    <Text
      {...rest}
      style={[{ color: colors.text, fontWeight: WEIGHT_TO_CSS[weight] || "400" }, style]}
    />
  );
}

export function Card({ children, style, testID }: { children: React.ReactNode; style?: ViewStyle; testID?: string }) {
  return (
    <View testID={testID} style={[styles.card, style]}>
      {children}
    </View>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <AppText style={styles.label}>{children}</AppText>;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  icon,
  loading,
  disabled,
  testID,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: any;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: ViewStyle;
}) {
  const bg =
    variant === "primary" ? colors.accent : variant === "danger" ? colors.danger : variant === "ghost" ? "transparent" : colors.surface;
  const border = variant === "secondary" ? colors.border : "transparent";
  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.85}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.btn,
        { backgroundColor: bg, borderColor: border, borderWidth: variant === "secondary" ? 1 : 0, opacity: disabled ? 0.5 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" || variant === "danger" ? "#fff" : colors.accent} />
      ) : (
        <View style={styles.btnInner}>
          {icon && <Ionicons name={icon} size={18} color={variant === "primary" || variant === "danger" ? "#fff" : colors.text} />}
          <AppText weight="bold" style={{ color: variant === "primary" || variant === "danger" ? "#fff" : colors.text, fontSize: 15 }}>
            {title}
          </AppText>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function Field(props: TextInputProps & { label?: string; testID?: string }) {
  const { label, style, testID, ...rest } = props;
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? <Label>{label}</Label> : null}
      <TextInput
        testID={testID}
        placeholderTextColor={colors.textTertiary}
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

export function IconButton({ icon, onPress, color, size = 22, testID, bg }: any) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.iconBtn, bg ? { backgroundColor: bg } : null]}
    >
      <Ionicons name={icon} size={size} color={color || colors.text} />
    </TouchableOpacity>
  );
}

export function Pill({ label, active, onPress, testID }: { label: string; active?: boolean; onPress?: () => void; testID?: string }) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.pill, active ? { backgroundColor: colors.accent, borderColor: colors.accent } : null]}
    >
      <AppText weight="medium" style={{ color: active ? "#fff" : colors.textSecondary, fontSize: 13 }}>
        {label}
      </AppText>
    </TouchableOpacity>
  );
}

export function SegmentedControl({ options, value, onChange, testID }: { options: { label: string; value: string }[]; value: string; onChange: (v: string) => void; testID?: string }) {
  return (
    <View style={styles.segment} testID={testID}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <TouchableOpacity key={o.value} onPress={() => onChange(o.value)} style={[styles.segmentItem, active ? styles.segmentActive : null]} activeOpacity={0.8}>
            <AppText weight={active ? "bold" : "medium"} style={{ color: active ? "#fff" : colors.textSecondary, fontSize: 13 }}>
              {o.label}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function EmptyState({ icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={colors.textTertiary} />
      </View>
      <AppText weight="headingSemi" style={{ fontSize: 16, marginTop: spacing.md }}>{title}</AppText>
      {subtitle ? <AppText style={{ color: colors.textTertiary, marginTop: 4, textAlign: "center" }}>{subtitle}</AppText> : null}
    </View>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionTitle}>
      <AppText weight="headingSemi" style={{ fontSize: 18 }}>{title}</AppText>
      {action ? (
        <TouchableOpacity onPress={onAction}>
          <AppText weight="bold" style={{ color: colors.accent, fontSize: 13 }}>{action}</AppText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Bottom sheet modal with keyboard-aware scrolling for forms. */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12, maxHeight: "90%" }]} testID={testID}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <AppText weight="heading" style={{ fontSize: 20 }}>{title}</AppText>
            <IconButton icon="close" onPress={onClose} color={colors.textSecondary} testID="sheet-close" />
          </View>
          <KAScroll
            bottomOffset={20}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {children}
          </KAScroll>
        </View>
      </View>
    </Modal>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: "row", alignItems: "center" }, style]}>{children}</View>;
}

export function ScreenHeader({ title, onBack, right, testID }: { title: string; onBack: () => void; right?: React.ReactNode; testID?: string }) {
  return (
    <View style={styles.screenHeader} testID={testID}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} testID="screen-back-btn">
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </TouchableOpacity>
      <AppText weight="heading" style={{ fontSize: 20, flex: 1 }}>{title}</AppText>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  label: {
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.textTertiary,
    fontFamily: fonts.bodyBold,
    marginBottom: 8,
  },
  btn: {
    borderRadius: radius.pill,
    paddingVertical: 15,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  btnInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 15 : 12,
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.body,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentItem: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: radius.pill },
  segmentActive: { backgroundColor: colors.accent },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 48 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceHover,
    alignSelf: "center",
    marginVertical: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  screenHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 6 },
  backBtn: { width: 36, height: 36, marginLeft: -6, alignItems: "center", justifyContent: "center" },
});
