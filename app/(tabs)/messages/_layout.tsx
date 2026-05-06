import { Stack } from "expo-router";

export default function MessagesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" options={{ headerShown: true, title: "Chat" }} />
      <Stack.Screen name="new" options={{ headerShown: true, title: "New Message" }} />
    </Stack>
  );
}