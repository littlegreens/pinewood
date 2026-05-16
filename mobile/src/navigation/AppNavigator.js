import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LandingScreen from "../screens/LandingScreen";
import HomeScreen from "../screens/HomeScreen";
import TrailsScreen from "../screens/TrailsScreen";
import TrailDetailScreen from "../screens/TrailDetailScreen";
import MapDiscoverScreen from "../screens/MapDiscoverScreen";
import MyTrailsScreen from "../screens/MyTrailsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import NavigationScreen from "../screens/NavigationScreen";
import TrailEditScreen from "../screens/TrailEditScreen";

const Stack = createNativeStackNavigator();

export default function AppNavigator({ initialRoute = "Landing" }) {
  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        animation: "fade",
      }}
    >
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Trails" component={TrailsScreen} />
      <Stack.Screen name="MapDiscover" component={MapDiscoverScreen} />
      <Stack.Screen name="MyTrails" component={MyTrailsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="TrailDetail" component={TrailDetailScreen} />
      <Stack.Screen name="Navigation" component={NavigationScreen} />
      <Stack.Screen name="TrailEdit" component={TrailEditScreen} />
    </Stack.Navigator>
  );
}
