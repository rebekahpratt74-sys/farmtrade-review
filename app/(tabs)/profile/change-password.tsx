import { router } from "expo-router";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
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

export default function ChangePasswordScreen() {
  const insets = useSafeAreaInsets();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    const user = auth.currentUser;
    if (!user || !user.email) return;

    if (!currentPassword.trim()) {
      Alert.alert("Missing password", "Please enter your current password.");
      return;
    }

    if (!newPassword.trim()) {
      Alert.alert("Missing password", "Please enter a new password.");
      return;
    }

    if (newPassword.trim().length < 6) {
      Alert.alert("Password too short", "Your new password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(true);

      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      await updatePassword(user, newPassword.trim());

      setCurrentPassword("");
      setNewPassword("");

      Alert.alert("Success", "Your password was updated.", [
        {
          text: "OK",
          onPress: () => router.replace("/(tabs)/profile"),
        },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not update password.");
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
          Change Password
        </Text>

        <Text
          style={{
            color: "#64748B",
            fontWeight: "600",
            lineHeight: 20,
            marginBottom: 20,
          }}
        >
          Update your password to keep your account secure.
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
              value={currentPassword}
              onChangeText={setCurrentPassword}
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

          <View>
            <Text
              style={{
                fontWeight: "900",
                fontSize: 15,
                color: "#111827",
                marginBottom: 6,
              }}
            >
              New Password
            </Text>

            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="Enter new password"
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
              password. Your new password must be at least 6 characters.
            </Text>
          </View>

          <View style={{ marginTop: 4 }}>
            <FarmButton
              title={loading ? "Updating..." : "Update Password"}
              onPress={handleChangePassword}
              disabled={loading}
            />
          </View>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}