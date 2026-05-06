import { Ionicons } from "@expo/vector-icons";
import { useStripe } from "@stripe/stripe-react-native";
import { router } from "expo-router";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { app, auth } from "../lib/firebase";
import { theme } from "../lib/theme";

export default function UpgradeProScreen() {
  const insets = useSafeAreaInsets();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [checkingOut, setCheckingOut] = useState(false);

  const handleCheckout = async () => {
    try {
      setCheckingOut(true);

      const functions = getFunctions(app, "us-central1");
      const createProSubscription = httpsCallable(functions, "createProSubscription");

      const result: any = await createProSubscription({
  email: auth.currentUser?.email,
});

const { clientSecret } = result.data;

const initResult = await initPaymentSheet({
  merchantDisplayName: "FarmTrade",
  paymentIntentClientSecret: clientSecret,
  allowsDelayedPaymentMethods: false,
});

      if (initResult.error) {
        Alert.alert("Checkout Error", initResult.error.message);
        return;
      }

      const paymentResult = await presentPaymentSheet();

      if (paymentResult.error) {
  Alert.alert("Payment Canceled", paymentResult.error.message);
  return;
}

Alert.alert(
  "Welcome to FarmTrade Pro!",
  "Your upgrade is active 🎉"
);

router.replace("/(tabs)/profile");
    } catch (e: any) {
  console.log("Pro checkout error:", e);

  Alert.alert(
    "Checkout Error",
    e?.message || "We couldn’t start checkout."
  );
} finally {
      setCheckingOut(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.backgroundTint }}>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: theme.space.lg,
          paddingBottom: theme.space.xl,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </Pressable>

        <View
          style={{
            backgroundColor: theme.colors.brand,
            borderRadius: theme.radius.xl,
            padding: theme.space.lg,
            marginBottom: 18,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 30, fontWeight: "900" }}>
            FarmTrade Pro
          </Text>

          <Text
            style={{
              color: "#fff",
              opacity: 0.9,
              fontWeight: "700",
              fontSize: 16,
              marginTop: 8,
              lineHeight: 22,
            }}
          >
            Grow your farm business with unlimited listings and monthly promotion power.
          </Text>
        </View>

        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.xl,
            padding: theme.space.lg,
            borderWidth: 1,
            borderColor: theme.colors.border,
            gap: 14,
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: "900", color: theme.colors.text }}>
            What’s included
          </Text>

          <FeatureRow icon="infinite" text="Unlimited active listings" />
          <FeatureRow icon="megaphone" text="1 free 7-day promotion every month" />
          <FeatureRow icon="trending-up" text="Help your listings stand out" />
          <FeatureRow icon="leaf" text="Built for serious farm sellers" />
        </View>

        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.xl,
            padding: theme.space.lg,
            borderWidth: 1,
            borderColor: theme.colors.border,
            marginTop: 18,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "800", color: theme.colors.subtext }}>
            Monthly Plan
          </Text>

          <Text
            style={{
              fontSize: 34,
              fontWeight: "900",
              color: theme.colors.text,
              marginTop: 4,
            }}
          >
            $9.99/month
          </Text>

          <Text
            style={{
              color: theme.colors.subtext,
              fontWeight: "700",
              marginTop: 6,
              lineHeight: 20,
            }}
          >
            Unlimited active listings plus 1 free 7-day promotion every month.
          </Text>

          <Pressable
            onPress={handleCheckout}
            disabled={checkingOut}
            style={{
              marginTop: 16,
              backgroundColor: theme.colors.brand,
              paddingVertical: 14,
              borderRadius: theme.radius.lg,
              alignItems: "center",
              opacity: checkingOut ? 0.6 : 1,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>
              {checkingOut ? "Starting Checkout..." : "Continue to Checkout"}
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function FeatureRow({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 14,
          backgroundColor: theme.colors.mutedBg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={18} color={theme.colors.brand} />
      </View>

      <Text style={{ flex: 1, fontWeight: "800", color: theme.colors.text, fontSize: 15 }}>
        {text}
      </Text>
    </View>
  );
}