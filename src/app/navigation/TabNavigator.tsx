import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Clock, Folder, Cloud, Boxes, Settings } from 'lucide-react-native';
import { RootTabParamList } from '../../types/navigation';
import { useThemeStore } from '../store/useThemeStore';
import { typography } from '../../theme/typography';

// Screens
import { RecentScreen } from '../../features/recent/RecentScreen';
import { FoldersScreen } from '../../features/folders/FoldersScreen';
import { CloudScreen } from '../../features/cloud/CloudScreen';
import { ToolsScreen } from '../../features/tools/ToolsScreen';
import { SettingsScreen } from '../../features/settings/SettingsScreen';

const Tab = createBottomTabNavigator<RootTabParamList>();

export const TabNavigator: React.FC = () => {
  const { colors } = useThemeStore();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          ...typography.labelSmall,
        },
      }}
    >
      <Tab.Screen
        name="RecentTab"
        component={RecentScreen}
        options={{
          tabBarLabel: 'Recent',
          tabBarIcon: ({ color, size }) => <Clock size={size - 2} color={color} />,
        }}
      />
      <Tab.Screen
        name="FoldersTab"
        component={FoldersScreen}
        options={{
          tabBarLabel: 'Folders',
          tabBarIcon: ({ color, size }) => <Folder size={size - 2} color={color} />,
        }}
      />
      <Tab.Screen
        name="CloudTab"
        component={CloudScreen}
        options={{
          tabBarLabel: 'Cloud',
          tabBarIcon: ({ color, size }) => <Cloud size={size - 2} color={color} />,
        }}
      />
      <Tab.Screen
        name="ToolsTab"
        component={ToolsScreen}
        options={{
          tabBarLabel: 'Tools',
          tabBarIcon: ({ color, size }) => <Boxes size={size - 2} color={color} />,
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings size={size - 2} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};

