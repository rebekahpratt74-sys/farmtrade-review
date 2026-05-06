import { StripeProvider } from "@stripe/stripe-react-native";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "../components/AuthGate";

const STRIPE_PUBLISHABLE_KEY = "pk_test_51TPaJILQMXcVVEGF8ATTW8JrTFcS7Zyv84AFF8HHUHDdymG9Id1HULDsM6VunvKrgvjhgQKin5v2o0vlbYDDxZTl00HjBcCWs8";

export default function RootLayout() {
  useEffect(() => {
  // 🔥 handle tap when app is already open / background
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data: any = response.notification.request.content.data;

    if (data?.type === "promotion_expired" && data?.listingId) {
      router.push({
        pathname: "/(tabs)/listing/[id]",
        params: {
          id: String(data.listingId),
          from: "my-listings",
        },
      });
    }
  });

  // 🔥 handle tap when app is CLOSED
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (!response) return;

    const data: any = response.notification.request.content.data;

    if (data?.type === "promotion_expired" && data?.listingId) {
      router.push({
        pathname: "/(tabs)/listing/[id]",
        params: {
          id: String(data.listingId),
          from: "my-listings",
        },
      });
    }
  });

  return () => sub.remove();
}, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="upgrade-pro" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: "modal" }} />
          </Stack>
        </AuthProvider>
      </StripeProvider>
    </GestureHandlerRootView>
  );
}