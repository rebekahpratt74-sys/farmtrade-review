import React from "react";
import {
  SafeAreaView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { theme } from "../../lib/theme";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  padded?: boolean; // default true
  center?: boolean; // ✅ NEW
};

export function Screen({
  children,
  style,
  contentStyle,
  padded = true,
  center = false,
}: Props) {
  return (
    <SafeAreaView style={[styles.safe, style]}>
      <View
        style={[
          styles.content,
          padded && styles.padded,
          center && styles.center,
          contentStyle,
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  content: {
    flex: 1,
  },
  padded: {
    padding: theme.space.lg,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
});