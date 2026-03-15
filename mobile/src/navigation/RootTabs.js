import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import DashboardScreen from "../screens/DashboardScreen";
import GoalsScreen from "../screens/GoalsScreen";
import LibraryScreen from "../screens/LibraryScreen";
import ScannerScreen from "../screens/ScannerScreen";
import { colors, fonts } from "../theme";

const Tab = createBottomTabNavigator();

export default function RootTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerTitleAlign: "center",
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          borderTopWidth: 0,
          backgroundColor: colors.surface,
          height: 64 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
          shadowColor: "#0B1B39",
          shadowOpacity: 0.08,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: -6 },
          elevation: 8,
        },
        tabBarItemStyle: {
          borderRadius: 16,
          marginHorizontal: 6,
          marginVertical: 6,
        },
        tabBarActiveBackgroundColor: colors.softAccent,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontFamily: fonts.medium,
          fontSize: 12,
        },
        tabBarIcon: ({ color, focused, size }) => {
          const iconMap = {
            Dashboard: focused ? "home" : "home-outline",
            Scanner: focused ? "scan" : "scan-outline",
            Library: focused ? "book" : "book-outline",
            Goals: focused ? "stats-chart" : "stats-chart-outline",
          };
          return (
            <Ionicons name={iconMap[route.name]} size={size ?? 20} color={color} />
          );
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Scanner" component={ScannerScreen} />
      <Tab.Screen name="Library" component={LibraryScreen} />
      <Tab.Screen name="Goals" component={GoalsScreen} />
    </Tab.Navigator>
  );
}
