import Ionicons from '@expo/vector-icons/Ionicons';
import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';

import { useTheme } from '@/design/theme';

type IconName = keyof typeof Ionicons.glyphMap;

function icon(active: IconName, inactive: IconName) {
  function TabIcon({
    focused,
    color,
    size,
  }: {
    focused: boolean;
    color: ColorValue;
    size: number;
  }) {
    return (
      <Ionicons
        name={focused ? active : inactive}
        color={typeof color === 'string' ? color : undefined}
        size={size}
      />
    );
  }
  return TabIcon;
}

/** Ana gezinme (brief §9). Voice ve Planlar sekmeleri ilgili fazlarda eklenecek. */
export default function TabsLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Tabs.Screen
        name="discover"
        options={{ title: 'Keşfet', tabBarIcon: icon('flame', 'flame-outline') }}
      />
      <Tabs.Screen
        name="matches"
        options={{ title: 'Eşleşmeler', tabBarIcon: icon('heart', 'heart-outline') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profil', tabBarIcon: icon('person', 'person-outline') }}
      />
    </Tabs>
  );
}
