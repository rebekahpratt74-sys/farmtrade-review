import { router } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { auth } from "../../lib/firebase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onLogin() {
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      Alert.alert("Login failed", e?.message ?? "Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log In</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable style={styles.primaryBtn} onPress={onLogin} disabled={loading}>
        <Text style={styles.primaryText}>{loading ? "Logging in..." : "Log In"}</Text>
      </Pressable>

      <Pressable onPress={() => router.replace("/signup")} style={styles.linkBtn}>
        <Text style={styles.linkText}>Need an account? Create one</Text>
      </Pressable>

      <Pressable onPress={() => router.back()} style={styles.linkBtn}>
        <Text style={styles.linkText}>Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAF7F2", padding: 24, justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "800", color: "#111827", marginBottom: 16 },
  input: { backgroundColor: "#fff", padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 12 },
  primaryBtn: { backgroundColor: "#1F6B45", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  linkBtn: { marginTop: 12, alignItems: "center" },
  linkText: { color: "#1F6B45", fontWeight: "700" },
});
