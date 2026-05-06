import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { getExistingSellerRating, submitSellerRating } from "../../lib/ratings";
import StarPicker from "./StarPicker";

type Props = {
  sellerId: string;
  buyerId: string;
  conversationId: string;
  listingId?: string;
};

export default function RateSellerCard({
  sellerId,
  buyerId,
  conversationId,
  listingId = "",
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const existing = await getExistingSellerRating(sellerId, buyerId, conversationId);
        if (existing?.rating) {
          setRating(existing.rating ?? 0);
          setReviewText(existing.reviewText ?? "");
          setAlreadySubmitted(true);
        }
      } catch (e) {
        console.log("Load existing seller rating error:", e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [sellerId, buyerId, conversationId]);

  const onSave = async () => {
    if (alreadySubmitted) {
      return;
    }

    if (rating < 1) {
      Alert.alert("Choose a rating", "Please tap 1 to 5 stars first.");
      return;
    }

    try {
      setSaving(true);

      await submitSellerRating({
        sellerId,
        buyerId,
        conversationId,
        listingId,
        rating,
        reviewText,
      });

      setAlreadySubmitted(true);
      Alert.alert("Thank you", "Your rating was saved.");
    } catch (e: any) {
      console.log("Save seller rating error:", e);
      Alert.alert("Rating error", e?.message ?? "Could not save rating.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        {alreadySubmitted ? "Thanks for rating" : "Rate this seller"}
      </Text>

      <Text style={styles.subtitle}>
        {alreadySubmitted
          ? "Your rating has already been submitted."
          : "Help other buyers know what to expect."}
      </Text>

      <View
        style={[
          styles.starsWrap,
          alreadySubmitted && styles.disabledBlock,
        ]}
        pointerEvents={alreadySubmitted ? "none" : "auto"}
      >
        <StarPicker value={rating} onChange={setRating} />
      </View>

      <TextInput
        value={reviewText}
        onChangeText={setReviewText}
        placeholder="Optional note about your experience…"
        multiline
        editable={!alreadySubmitted}
        style={[
          styles.input,
          alreadySubmitted && styles.inputDisabled,
        ]}
        textAlignVertical="top"
        maxLength={250}
      />

      <Pressable
        onPress={onSave}
        disabled={saving || alreadySubmitted}
        style={[
          styles.button,
          (saving || alreadySubmitted) && styles.buttonDisabled,
        ]}
      >
        <Text style={styles.buttonText}>
          {alreadySubmitted
            ? "Rating Submitted"
            : saving
              ? "Saving..."
              : rating > 0
                ? "Save Rating"
                : "Choose Stars"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    marginTop: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
  },
  subtitle: {
    marginTop: 4,
    color: "#64748b",
    fontWeight: "700",
  },
  starsWrap: {
    marginTop: 10,
  },
  disabledBlock: {
    opacity: 0.7,
  },
  input: {
    marginTop: 12,
    minHeight: 92,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    color: "#111827",
    backgroundColor: "#F8FAFC",
  },
  inputDisabled: {
    backgroundColor: "#F1F5F9",
    color: "#64748b",
  },
  button: {
    marginTop: 12,
    backgroundColor: "#1f7a3f",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "900",
  },
});