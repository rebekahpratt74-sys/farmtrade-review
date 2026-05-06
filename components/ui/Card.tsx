import React from "react";
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { theme } from "../../lib/theme";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean; // default true
  variant?: "default" | "muted" | "unread";
  onPress?: () => void;
};

export function Card({
  children,
  style,
  padded = true,
  variant = "default",
  onPress,
}: Props) {
  const base = [
    styles.base,
    padded && styles.padded,
    variant === "muted" && styles.muted,
    variant === "unread" && styles.unread,
    style,
  ];

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && styles.pressed]}>
        {children}
      </Pressable>
    );
  }

  return <View style={base}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  padded: {
    padding: theme.space.md,
  },
  muted: {
    backgroundColor: theme.colors.surface2,
  },
  unread: {
    backgroundColor: theme.colors.surface2,
    borderColor: theme.colors.borderStrong,
  },
  pressed: {
    opacity: 0.92,
  },
});