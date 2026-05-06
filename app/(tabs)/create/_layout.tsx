import { Stack } from "expo-router";

export default function CreateLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        headerTitleStyle: { fontWeight: "900" },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="basics"
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="details"
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="photos"
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="review"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}