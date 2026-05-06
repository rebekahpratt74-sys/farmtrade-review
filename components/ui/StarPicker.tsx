import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  value: number;
  onChange: (value: number) => void;
  size?: number;
};

export default function StarPicker({
  value,
  onChange,
  size = 28,
}: Props) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => {
        const selected = star <= value;

        return (
          <Pressable
            key={star}
            onPress={() => onChange(star)}
            hitSlop={8}
            style={({ pressed }) => [
              styles.starWrap,
              pressed && { transform: [{ scale: 0.94 }] },
            ]}
          >
            <Text
              style={{
                fontSize: size,
                color: selected ? "#9FD3A8" : "#DCE7DF",
                fontWeight: "900",
              }}
            >
              ★
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  starWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
});