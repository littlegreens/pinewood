import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StatusBar, StyleSheet, useWindowDimensions } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import {
  TitilliumWeb_400Regular,
  TitilliumWeb_600SemiBold,
  TitilliumWeb_700Bold,
} from "@expo-google-fonts/titillium-web";
import { ShadowsIntoLightTwo_400Regular } from "@expo-google-fonts/shadows-into-light-two";

import AppNavigator from "./src/navigation/AppNavigator";
import { DrawerProvider } from "./src/components/AppDrawer";
import { PinewoodLogo } from "./src/components/SvgIcons";
import { bootstrapAuth } from "./src/services/api";
import { colors } from "./src/theme";

SplashScreen.preventAutoHideAsync();

function BootSplash() {
  const { width } = useWindowDimensions();
  const logoW = Math.min(width - 48, 300);
  return (
    <View style={styles.splash}>
      <PinewoodLogo width={logoW} color="#fff" />
    </View>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    TitilliumWeb_400Regular,
    TitilliumWeb_600SemiBold,
    TitilliumWeb_700Bold,
    ShadowsIntoLightTwo_400Regular,
  });
  const [appReady, setAppReady] = useState(false);
  const [isAuth, setIsAuth] = useState(false);
  const [currentRoute, setCurrentRoute] = useState("Home");
  const navRef = useRef(null);

  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    if (fontError) {
      console.warn("[fonts] load failed, using system fonts", fontError);
    }
    let active = true;
    (async () => {
      try {
        const authenticated = await bootstrapAuth();
        if (active) setIsAuth(authenticated);
      } catch {
        /* auth bootstrap optional */
      } finally {
        if (active) setAppReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [fontsLoaded, fontError]);

  const onLayoutRootView = useCallback(async () => {
    if (appReady) {
      await SplashScreen.hideAsync();
    }
  }, [appReady]);

  const onNavStateChange = useCallback(() => {
    const route = navRef.current?.getCurrentRoute();
    if (route?.name) setCurrentRoute(route.name);
  }, []);

  const booting = !appReady || (!fontsLoaded && !fontError);

  return (
    <SafeAreaProvider>
      {booting ? (
        fontsLoaded ? <BootSplash /> : <View style={styles.splash} />
      ) : (
        <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
          <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
          <NavigationContainer ref={navRef} onStateChange={onNavStateChange}>
            <DrawerProvider navRef={navRef} currentRoute={currentRoute}>
              <AppNavigator initialRoute={isAuth ? "Home" : "Landing"} />
            </DrawerProvider>
          </NavigationContainer>
        </View>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.pineGreen,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
});
