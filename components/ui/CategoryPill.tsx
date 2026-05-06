import React from "react";
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from "react-native";

type CategoryPillProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export default function CategoryPill({
  label,
  selected,
  onPress,
  style,
}: CategoryPillProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        selected ? styles.selected : styles.unselected,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.text, selected ? styles.selectedText : styles.unselectedText]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  unselected: {
    backgroundColor: "#fff",
    borderColor: "#dbe4dc",
  },
  selected: {
    backgroundColor: "#e6f4ea",
    borderColor: "#1f7a3f",
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  text: {
    fontWeight: "900",
    fontSize: 16,
  },
  unselectedText: {
    color: "#111827",
  },
  selectedText: {
    color: "#166534",
  },
});