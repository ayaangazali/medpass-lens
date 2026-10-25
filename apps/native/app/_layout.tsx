import { Stack } from "expo-router";
import {
	DarkTheme,
	DefaultTheme,
	ThemeProvider,
} from "expo-router/react-navigation";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { NAV_THEME } from "@/lib/constants";
// Defines the background location task at startup, as iOS needs when it wakes the app (#302).
import "@/lib/location-watch";

const LIGHT_THEME = {
	...DefaultTheme,
	colors: NAV_THEME.light,
};
const DARK_THEME = {
	...DarkTheme,
	colors: NAV_THEME.dark,
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
});

export default function RootLayout() {
	const theme = useColorScheme() === "dark" ? DARK_THEME : LIGHT_THEME;

	return (
		<ThemeProvider value={theme}>
			{/* Light text on the web app's teal safe-area padding (app/index.tsx). */}
			<StatusBar style="light" />
			<GestureHandlerRootView style={styles.container}>
				{/* No native header: the web app is the whole screen. */}
				<Stack screenOptions={{ headerShown: false }} />
			</GestureHandlerRootView>
		</ThemeProvider>
	);
}
