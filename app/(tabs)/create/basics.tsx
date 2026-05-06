import { router } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCreate } from "../../../hooks/createContext";
import { theme } from "../../../lib/theme";

function getCategoryLabel(category?: string) {
  if (category === "livestock") return "🐄 Livestock";
  if (category === "produce") return "🌽 Produce";
  if (category === "farm_goods") return "🌾 Farm Goods";
  if (category === "equipment") return "🚜 Equipment";
  return "Category not selected";
}

export default function CreateStepBasics() {
  const { draft, setDraft } = useCreate();

  const [title, setTitle] = useState(draft.title ?? "");

  const insets = useSafeAreaInsets();

  const selectedCategory = draft.category ?? "";

  const onNext = () => {
    setDraft({
      title,
    });

    router.push("/(tabs)/create/details");
  };

  const canContinue = title.trim().length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.backgroundTint }}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom + 24, 40),
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={[
            styles.floatingBackBtn,
            { top: Math.max(insets.top, 12) },
          ]}
        >
          <Text style={styles.floatingBackText}>Back</Text>
        </Pressable>

        <Text style={styles.eyebrow}>Step 1</Text>

        <Text style={styles.title}>Basics</Text>

        <Text style={styles.subtitle}>
          Start with a title for your listing.
        </Text>

        <View style={styles.categoryCard}>
          <Text style={styles.categoryCardLabel}>Selected Category</Text>
          <Text style={styles.categoryCardValue}>
            {getCategoryLabel(selectedCategory)}
          </Text>
          <Text style={styles.categoryCardHelp}>
            Need a different category? Tap Back to change it.
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Title</Text>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder='Example: "Fresh Brown Eggs"'
            placeholderTextColor="#94A3B8"
            style={styles.input}
          />
        </View>

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>Good titles are clear and specific</Text>
          <Text style={styles.tipText}>
            Example: “John Deere 5055E Tractor” or “Fresh Brown Eggs”
          </Text>
        </View>

        <View style={styles.bottomWrap}>
          <Pressable
            disabled={!canContinue}
            onPress={onNext}
            style={[styles.button, !canContinue && styles.buttonDisabled]}
          >
            <Text style={styles.buttonText}>Next</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.backgroundTint,
    paddingHorizontal: 20,
  },

  floatingBackBtn: {
    position: "absolute",
    right: 20,
    zIndex: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },

  floatingBackText: {
    fontWeight: "900",
    color: "#111827",
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#1f7a3f",
    marginBottom: 8,
    marginTop: 44,
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
    marginBottom: 24,
    fontWeight: "600",
  },

  categoryCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 16,
    marginBottom: 22,
  },

  categoryCardLabel: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#1f7a3f",
    marginBottom: 6,
  },

  categoryCardValue: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
  },

  categoryCardHelp: {
    marginTop: 6,
    color: "#64748B",
    fontWeight: "600",
    lineHeight: 20,
  },

  field: {
    marginBottom: 22,
  },

  label: {
    fontWeight: "900",
    marginBottom: 8,
    fontSize: 16,
  },

  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    fontWeight: "700",
    backgroundColor: "#fff",
  },

  tipCard: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 16,
    padding: 14,
  },

  tipTitle: {
    fontWeight: "900",
    color: "#166534",
    marginBottom: 4,
  },

  tipText: {
    color: "#166534",
    fontWeight: "600",
    lineHeight: 20,
  },

  bottomWrap: {
    marginTop: 24,
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