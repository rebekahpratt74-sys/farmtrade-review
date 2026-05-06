import { router } from "expo-router";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateEmail,
} from "firebase/auth";
import { useState } from "react";
import {
  Alert,
  Keyboard,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FarmButton } from "../../../components/ui/FarmButton";
import { auth } from "../../../lib/firebase";

export default function ChangeEmailScreen() {
  const insets = useSafeAreaInsets();

  const user = auth.currentUser;
  const currentEmail = user?.email ?? "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangeEmail = async () => {
    const liveUser = auth.currentUser;

    if (!liveUser || !liveUser.email) return;

    if (!email.trim()) {
      Alert.alert("Missing email", "Please enter your new email address.");
      return;
    }

    if (!password.trim()) {
      Alert.alert("Missing password", "Please enter your current password.");
      return;
    }

    try {
      setLoading(true);

      const credential = EmailAuthProvider.credential(
        liveUser.email,
        password
      );

      await reauthenticateWithCredential(liveUser, credential);
      await updateEmail(liveUser, email.trim());

      setEmail("");
      setPassword("");

      Alert.alert("Success", "Your email was updated.", [
        {
          text: "OK",
          onPress: () => router.replace("/(tabs)/profile"),
        },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not update email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View
        style={{
          flex: 1,
          backgroundColor: "#F9FAFB",
          paddingHorizontal: 16,
          paddingBottom: 16,
          paddingTop: Math.max(insets.top, 16),
        }}
      >
        <Text
          style={{
            fontSize: 28,
            fontWeight: "900",
            color: "#111827",
            marginBottom: 8,
          }}
        >
          Change Email
        </Text>

        <Text
          style={{
            color: "#64748B",
            fontWeight: "600",
            lineHeight: 20,
            marginBottom: 20,
          }}
        >
          Update the email address associated with your account.
        </Text>

        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 18,
            padding: 16,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            gap: 14,
          }}
        >
          <View
            style={{
              backgroundColor: "#F0FDF4",
              borderRadius: 14,
              padding: 12,
              borderWidth: 1,
              borderColor: "#BBF7D0",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "800",
                color: "#166534",
                marginBottom: 4,
                textTransform: "uppercase",
              }}
            >
              Current Email
            </Text>

            <Text
              style={{
                fontSize: 15,
                fontWeight: "800",
                color: "#111827",
              }}
            >
              {currentEmail || "No email found"}
            </Text>
          </View>

          <View>
            <Text
              style={{
                fontWeight: "900",
                fontSize: 15,
                color: "#111827",
                marginBottom: 6,
              }}
            >
              New Email
            </Text>

            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="Enter new email address"
              placeholderTextColor="#94A3B8"
              style={{
                borderWidth: 1,
                borderColor: "#E5E7EB",
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                backgroundColor: "#FFFFFF",
                color: "#111827",
                fontWeight: "600",
              }}
            />
          </View>

          <View>
            <Text
              style={{
                fontWeight: "900",
                fontSize: 15,
                color: "#111827",
                marginBottom: 6,
              }}
            >
              Current Password
            </Text>

            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Enter current password"
              placeholderTextColor="#94A3B8"
              style={{
                borderWidth: 1,
                borderColor: "#E5E7EB",
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                backgroundColor: "#FFFFFF",
                color: "#111827",
                fontWeight: "600",
              }}
            />
          </View>

          <View
            style={{
              backgroundColor: "#F8FAFC",
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: "#E5E7EB",
            }}
          >
            <Text
              style={{
                color: "#64748B",
                fontSize: 13,
                fontWeight: "600",
                lineHeight: 18,
              }}
            >
              For security, you’ll need your current password before changing your
              email address.
            </Text>
          </View>

          <View style={{ marginTop: 4 }}>
            <FarmButton
              title={loading ? "Updating..." : "Update Email"}
              onPress={handleChangeEmail}
              disabled={loading}
            />
          </View>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}