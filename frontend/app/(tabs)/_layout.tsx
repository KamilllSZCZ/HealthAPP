import { Tabs } from "expo-router";
import { Platform, View } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "@/src/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          position: "absolute",
          borderTopColor: colors.border,
          borderTopWidth: 1,
          backgroundColor: Platform.OS === "web" ? colors.bg : "transparent",
          elevation: 0,
          height: Platform.OS === "ios" ? 86 : 64,
          paddingTop: 6,
          paddingBottom: Platform.OS === "ios" ? 28 : 8,
        },
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11 },
        tabBarBackground: () =>
          Platform.OS === "web" ? (
            <View style={{ flex: 1, backgroundColor: colors.bg }} />
          ) : (
            <BlurView intensity={40} tint="dark" style={{ flex: 1, backgroundColor: "rgba(17,17,17,0.7)" }} />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="supplements"
        options={{
          title: "Supplements",
          tabBarIcon: ({ color, size }) => <Ionicons name="medical" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: "Nutrition",
          tabBarIcon: ({ color, size }) => <Ionicons name="restaurant" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analytics",
          tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
