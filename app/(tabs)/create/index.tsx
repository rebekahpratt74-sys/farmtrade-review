import { router } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCreate } from "../../../hooks/createContext";
import { theme } from "../../../lib/theme";

const CATEGORIES = [
  {
    key: "livestock",
    label: "Livestock",
    emoji: "🐄",
    description: "Cattle, goats, pigs, chickens, etc.",
  },
  {
    key: "produce",
    label: "Produce",
    emoji: "🌽",
    description: "Fruits, vegetables, eggs, meat, honey, homemade goods, etc.",
  },
  {
    key: "farm_goods",
    label: "Farm Goods",
    emoji: "🌾",
    description: "Hay, feed, seed, fencing, supplies, etc.",
  },
  {
    key: "equipment",
    label: "Equipment",
    emoji: "🚜",
    description: "Tractors, trailers, implements, skid steers, balers, etc.",
  },
] as const;

export default function CreateStepCategory() {
  const { setDraft } = useCreate();
  const [selected, setSelected] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const onNext = () => {
    if (!selected) return;

    setDraft({ category: selected });
    router.push("/(tabs)/create/basics");
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: Math.max(insets.bottom + 20, 40),
        },
      ]}
    >
      <View style={styles.headerWrap}>
        <Text style={styles.eyebrow}>New Listing</Text>

        <Text style={styles.title}>Create Listing</Text>

        <Text style={styles.subtitle}>
          Choose the category that best fits what you’re selling.
        </Text>
      </View>

      <View style={styles.cardsWrap}>
        {CATEGORIES.map((c) => {
          const isSelected = selected === c.key;

          return (
            <Pressable
              key={c.key}
              onPress={() => setSelected(c.key)}
              style={[
                styles.card,
                isSelected && styles.cardSelected,
              ]}
            >
              <View style={styles.cardTopRow}>
                <View
                  style={[
                    styles.iconBubble,
                    isSelected && styles.iconBubbleSelected,
                  ]}
                >
                  <Text style={styles.iconEmoji}>{c.emoji}</Text>
                </View>

                {isSelected && (
                  <View style={styles.selectedPill}>
                    <Text style={styles.selectedPillText}>
                      Selected
                    </Text>
                  </View>
                )}
              </View>

              <Text
                style={[
                  styles.cardTitle,
                  isSelected && styles.cardTitleSelected,
                ]}
              >
                {c.label}
              </Text>

              <Text style={styles.cardDescription}>
                {c.description}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.bottomWrap}>
        {!selected ? (
          <Text style={styles.helperText}>
            Pick a category to continue
          </Text>
        ) : (
          <Text style={styles.helperTextSelected}>
            Great choice — let’s add the details next.
          </Text>
        )}

        <Pressable
          onPress={onNext}
          disabled={!selected}
          style={[
            styles.button,
            !selected && styles.buttonDisabled,
          ]}
        >
          <Text style={styles.buttonText}>Next</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
  backgroundColor: theme.colors.backgroundTint,
  paddingHorizontal: 20,
},

  headerWrap: {
    marginBottom: 22,
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#1f7a3f",
    marginBottom: 8,
  },

  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#111827",
  },

  subtitle: {
    fontSize: 16,
    color: "#64748B",
    marginTop: 8,
    lineHeight: 23,
    fontWeight: "600",
  },

  cardsWrap: {
    gap: 14,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 18,
    padding: 16,
  },

  cardSelected: {
    borderColor: "#1f7a3f",
    backgroundColor: "#F0FDF4",
  },

  cardTopRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 6,
},

  iconBubble: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  iconBubbleSelected: {
    backgroundColor: "#DCFCE7",
  },

  iconEmoji: {
    fontSize: 22,
  },

  selectedPill: {
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 999,
  backgroundColor: "#DCFCE7",
  borderWidth: 1,
  borderColor: "#BBF7D0",
  alignSelf: "flex-start",
},

  selectedPillText: {
    color: "#166534",
    fontWeight: "900",
    fontSize: 11,
  },

  cardTitle: {
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 6,
    color: "#111827",
  },

  cardTitleSelected: {
    color: "#166534",
  },

  cardDescription: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "600",
  },

  bottomWrap: {
    marginTop: 24,
  },

  helperText: {
    textAlign: "center",
    color: "#64748B",
    fontWeight: "700",
    marginBottom: 12,
  },

  helperTextSelected: {
    textAlign: "center",
    color: "#166534",
    fontWeight: "800",
    marginBottom: 12,
  },

  button: {
    backgroundColor: "#1f7a3f",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },

  buttonDisabled: {
    backgroundColor: "#9BC3A8",
  },

  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
  },
});