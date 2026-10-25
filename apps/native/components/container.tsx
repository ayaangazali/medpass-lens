import type React from "react";
import { StyleSheet, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { NAV_THEME } from "@/lib/constants";

export function Container({ children }: { children: React.ReactNode }) {
	const backgroundColor =
		useColorScheme() === "dark"
			? NAV_THEME.dark.background
			: NAV_THEME.light.background;

	return (
		<SafeAreaView
			edges={["left", "right", "bottom"]}
			style={[styles.container, { backgroundColor }]}
		>
			{children}
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
});
