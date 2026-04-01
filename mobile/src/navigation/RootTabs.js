import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import DashboardScreen from "../screens/DashboardScreen";
import GoalsScreen from "../screens/GoalsScreen";
import InsightsScreen from "../screens/InsightsScreen";
import LibraryScreen from "../screens/LibraryScreen";
import ScannerScreen from "../screens/ScannerScreen";
import { colors, fonts } from "../theme";

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Today: { focused: "home", outline: "home-outline" },
  Log: { focused: "add-circle", outline: "add-circle-outline" },
  Library: { focused: "book", outline: "book-outline" },
  Progress: { focused: "bar-chart", outline: "bar-chart-outline" },
  Goals: { focused: "trophy", outline: "trophy-outline" },
};

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
          height: 62 + insets.bottom,
          paddingBottom: 6 + insets.bottom,
          paddingTop: 8,
          shadowColor: "#0B1B39",
          shadowOpacity: 0.08,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: -6 },
          elevation: 8,
        },
        tabBarItemStyle: {
          borderRadius: 14,
          marginHorizontal: 4,
          marginVertical: 4,
        },
        tabBarActiveBackgroundColor: colors.softAccent,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontFamily: fonts.medium,
          fontSize: 11,
        },
        tabBarIcon: ({ color, focused }) => {
          const icons = TAB_ICONS[route.name];
          const name = icons ? (focused ? icons.focused : icons.outline) : "ellipse-outline";
          const size = route.name === "Log" ? 28 : 22;
          const iconColor = route.name === "Log" ? colors.accent : color;
          return <Ionicons name={name} size={size} color={iconColor} />;
        },
      })}
    >
      <Tab.Screen
        name="Today"
        component={DashboardScreen}
        options={{ title: "Today" }}
      />
      <Tab.Screen
        name="Log"
        component={ScannerScreen}
        options={{
          title: "Log",
          tabBarButton: (props) => (
            <Pressable
              {...props}
              style={[props.style, { backgroundColor: colors.softAccent, borderRadius: 14 }]}
              android_ripple={{ color: colors.softAccent }}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Library"
        component={LibraryScreen}
        options={{ title: "Library" }}
      />
      <Tab.Screen
        name="Progress"
        component={InsightsScreen}
        options={{ title: "Progress" }}
      />
      <Tab.Screen
        name="Goals"
        component={GoalsScreen}
        options={{ title: "Goals" }}
      />
    </Tab.Navigator>
  );
}
