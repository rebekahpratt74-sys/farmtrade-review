import React from "react";
import { Text, View } from "react-native";
import { theme } from "../../lib/theme";

type Props = {
  title?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
};

export function Section({ title, children, right }: Props) {
  return (
    <View style={{ marginBottom: theme.space.xl }}>
      {title ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: theme.space.sm,
          }}
        >
          <Text style={{ ...theme.type.h2, color: theme.colors.text }}>
            {title}
          </Text>

          {right ? <View>{right}</View> : null}
        </View>
      ) : null}

      {children}
    </View>
  );
}