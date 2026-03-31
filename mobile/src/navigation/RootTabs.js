import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import DashboardScreen from "../screens/DashboardScreen";
import GoalsScreen from "../screens/GoalsScreen";
import InsightsScreen from "../screens/InsightsScreen";
import LibraryScreen from "../screens/LibraryScreen";
import PlannerScreen from "../screens/PlannerScreen";
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
            Scanner: focused ? "add-circle" : "add-circle-outline",
            Library: focused ? "book" : "book-outline",
            Insights: focused ? "analytics" : "analytics-outline",
            Planner: focused ? "calendar" : "calendar-outline",
            Goals: focused ? "stats-chart" : "stats-chart-outline",
          };
          return (
            <Ionicons
              name={iconMap[route.name]}
              size={route.name === "Scanner" ? 30 : size ?? 20}
              color={route.name === "Scanner" ? colors.accent : color}
            />
          );
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: "Today", tabBarLabel: "Today" }}
      />
      <Tab.Screen
        name="Scanner"
        component={ScannerScreen}
        options={{
          title: "Log",
          tabBarLabel: "Log",
          tabBarButton: (props) => (
            <Pressable
              {...props}
              style={[
                props.style,
                { backgroundColor: colors.softAccent, borderRadius: 18 },
              ]}
              android_ripple={{ color: colors.softAccent }}
            />
          ),
        }}
      />
      <Tab.Screen name="Library" component={LibraryScreen} />
      <Tab.Screen name="Planner" component={PlannerScreen} />
      <Tab.Screen name="Insights" component={InsightsScreen} />
      <Tab.Screen name="Goals" component={GoalsScreen} />
    </Tab.Navigator>
  );
}
