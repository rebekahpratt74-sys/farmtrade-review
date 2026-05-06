import { router } from "expo-router";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { auth, db } from "../../lib/firebase";

type AccountType = "personal" | "business";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("personal");
  const [loading, setLoading] = useState(false);

  async function onSignup() {
    try {
      if (!name.trim()) {
        return Alert.alert("Missing name", "Please enter your name.");
      }

      if (!email.trim()) {
        return Alert.alert("Missing email", "Please enter your email.");
      }

      if (password.length < 6) {
        return Alert.alert(
          "Weak password",
          "Password must be at least 6 characters."
        );
      }

            const cleanEmail = email.trim().toLowerCase();

      setLoading(true);

      const cred = await createUserWithEmailAndPassword(
        auth,
               cleanEmail,
        password
      );

      await updateProfile(cred.user, {
        displayName: name.trim(),
      });

            await setDoc(doc(db, "users", cred.user.uid), {
  uid: cred.user.uid,
  name: name.trim(),
  displayName: name.trim(),
  email: cleanEmail,
  accountType,

  // 🟢 Subscription (NEW)
  subscriptionStatus: "free",
  subscriptionPlan: "none",
  subscriptionRenewsAt: null,

  // 🟢 Promotion credits
  monthlyPromotionCredits: 0,
  monthlyPromotionCreditsResetAt: null,

  // 🟢 Free tier limits
  maxActiveListings: 5,

  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

      await sendEmailVerification(cred.user);

      Alert.alert(
        "Verify your email",
        "We sent a verification link to your email. You can browse FarmTrade now, but you’ll need to verify your account before creating listings, messaging, or using payments.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/(tabs)"),
          },
        ]
      );
    } catch (e: any) {
      console.log("SIGNUP ERROR:", e);
      Alert.alert(
        "Signup failed",
        `${e?.code ?? ""}\n${e?.message ?? "Try again."}`.trim()
      );
    } finally {
      setLoading(false);
    }
  }

  return (
  <KeyboardAvoidingView
    style={{ flex: 1 }}
    behavior={Platform.OS === "ios" ? "padding" : "height"}
  >
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
      <Text style={styles.title}>Create your FarmTrade account</Text>

      <Text style={styles.sectionTitle}>Choose your account type</Text>

      <View style={styles.accountTypeWrap}>
        <Pressable
          onPress={() => setAccountType("personal")}
          style={[
            styles.accountCard,
            accountType === "personal" && styles.accountCardSelected,
          ]}
        >
          <View style={styles.accountCardTopRow}>
            <Text style={styles.accountEmoji}>🧑‍🌾</Text>

            {accountType === "personal" ? (
              <View style={styles.selectedPill}>
                <Text style={styles.selectedPillText}>Selected</Text>
              </View>
            ) : null}
          </View>

          <Text
            style={[
              styles.accountTitle,
              accountType === "personal" && styles.accountTitleSelected,
            ]}
          >
            Personal
          </Text>

          <Text style={styles.accountDescription}>
            Best for individuals, hobby farmers, and occasional sellers
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setAccountType("business")}
          style={[
            styles.accountCard,
            accountType === "business" && styles.accountCardSelected,
          ]}
        >
          <View style={styles.accountCardTopRow}>
            <Text style={styles.accountEmoji}>🚜</Text>

            {accountType === "business" ? (
              <View style={styles.selectedPill}>
                <Text style={styles.selectedPillText}>Selected</Text>
              </View>
            ) : null}
          </View>

          <Text
  style={[
    styles.accountTitle,
    accountType === "business" && styles.accountTitleSelected,
  ]}
>
  Farm Account
</Text>

          <Text style={styles.accountDescription}>
            Best for farms, breeders, equipment sellers, and farm stores
          </Text>
        </Pressable>
      </View>

      <TextInput
  placeholder={accountType === "business" ? "Farm Name" : "Name"}
  value={name}
  onChangeText={setName}
  style={styles.input}
  placeholderTextColor="#94A3B8"
/>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
        placeholderTextColor="#94A3B8"
      />

      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
        placeholderTextColor="#94A3B8"
      />

      <Pressable
        style={[styles.button, loading && { opacity: 0.6 }]}
        onPress={onSignup}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Creating account..." : "Sign Up"}
        </Text>
      </Pressable>

      <Pressable onPress={() => router.replace("/(auth)/login")}>
        <Text style={styles.link}>Already have an account? Log in</Text>
      </Pressable>
              </ScrollView>
    </TouchableWithoutFeedback>
  </KeyboardAvoidingView>
);
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
  },

  title: {
    fontSize: 30,
    fontWeight: "900",
    marginBottom: 24,
    color: "#111827",
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 12,
    color: "#111827",
  },

  accountTypeWrap: {
    gap: 12,
    marginBottom: 20,
  },

  accountCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 18,
    padding: 16,
  },

  accountCardSelected: {
    borderColor: "#1f7a3f",
    backgroundColor: "#F0FDF4",
  },

  accountCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  accountEmoji: {
    fontSize: 24,
  },

  selectedPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },

  selectedPillText: {
    color: "#166534",
    fontWeight: "900",
    fontSize: 11,
  },

  accountTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 6,
  },

  accountTitleSelected: {
    color: "#166534",
  },

  accountDescription: {
    color: "#64748B",
    fontWeight: "600",
    lineHeight: 20,
  },

  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
    color: "#111827",
    fontWeight: "600",
  },

  button: {
    backgroundColor: "#1f7a3f",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },

  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },

  link: {
    marginTop: 16,
    color: "#1f7a3f",
    textAlign: "center",
    fontWeight: "700",
  },
});