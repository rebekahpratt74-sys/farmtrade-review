import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../components/AuthGate";

export default function Index() {
  const { user, initializing } = useAuth();

  // ✅ Wait until Firebase finishes restoring the session
  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  // ✅ Not logged in → go to login
  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  // ✅ Logged in → go to tabs
  return <Redirect href="/(tabs)" />;
}
