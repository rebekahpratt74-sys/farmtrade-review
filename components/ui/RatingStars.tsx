import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../../lib/theme";

type Props = {
  rating?: number | null;
  count?: number | null;
  size?: number;
  showText?: boolean;
  showTopRatedBadge?: boolean;
};

export default function RatingStars({
  rating,
  count,
  size = 12,
  showText = true,
  showTopRatedBadge = false,
}: Props) {
  const safeRating = typeof rating === "number" ? rating : 0;
  const safeCount = typeof count === "number" ? count : 0;

  const isTopRated = safeRating >= 4.5 && safeCount >= 3;

  if (!safeRating || safeRating <= 0) {
    return (
      <View style={styles.row}>
        <Text style={styles.noRatings}>No ratings yet</Text>

        {showTopRatedBadge && isTopRated ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Top Rated</Text>
          </View>
        ) : null}
      </View>
    );
  }

  const rounded = Math.round(safeRating);
  const stars = [1, 2, 3, 4, 5];

  return (
    <View style={styles.row}>
      <View style={styles.starsRow}>
        {stars.map((star) => {
          const filled = star <= rounded;
          return (
            <Text
              key={star}
              style={[
                styles.star,
                {
                  fontSize: size,
                  color: filled ? "#9FD3A8" : "#DCE7DF",
                },
              ]}
            >
              ★
            </Text>
          );
        })}
      </View>

      {showText ? (
        <Text style={styles.text}>
          {safeRating.toFixed(1)}
          {safeCount > 0 ? ` (${safeCount})` : ""}
        </Text>
      ) : null}

      {showTopRatedBadge && isTopRated ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Top Rated</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },

  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },

  star: {
    fontWeight: "900",
  },

  text: {
    color: theme.colors.subtext,
    fontWeight: "700",
    fontSize: 12,
  },

  noRatings: {
    color: theme.colors.subtext,
    fontWeight: "700",
    fontSize: 12,
  },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },

  badgeText: {
    color: "#166534",
    fontWeight: "900",
    fontSize: 11,
  },
});