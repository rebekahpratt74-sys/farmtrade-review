import { router } from "expo-router";
import { updateProfile } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../../../lib/firebase";

export default function EditProfileScreen() {
  const uid = auth.currentUser?.uid ?? null;
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerName2, setOwnerName2] = useState("");
  const [accountType, setAccountType] = useState<"personal" | "business">("personal");

  useEffect(() => {
    const load = async () => {
      if (!uid) return;

      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) {
          const data: any = snap.data();
          setDisplayName(data.displayName ?? data.name ?? "");
          setBio(data.bio ?? "");
          setWebsite(data.website ?? "");
          setOwnerName(data.ownerName ?? "");
          setOwnerName2(data.ownerName2 ?? "");
          setAccountType(data.accountType === "business" ? "business" : "personal");
        }
      } catch (e) {
        console.log("Load profile error:", e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [uid]);

  const save = async () => {
  if (!uid) return;

  setSaving(true);

  try {
    const cleanDisplayName = displayName.trim();

    await updateDoc(doc(db, "users", uid), {
      displayName: cleanDisplayName,
      name: cleanDisplayName,
      bio: bio.trim(),
      website: website.trim(),
      ownerName: ownerName.trim(),
      ownerName2: ownerName2.trim(),
    });

    if (auth.currentUser) {
      await updateProfile(auth.currentUser, {
        displayName: cleanDisplayName,
      });
    }

    router.replace("/(tabs)/profile");
  } catch (e) {
    console.log("Save profile error:", e);
  } finally {
    setSaving(false);
  }
};

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fff",
        }}
      >
        <ActivityIndicator />
        <Text>Loading…</Text>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: 16,
          paddingBottom: 16,
          paddingTop: Math.max(insets.top, 16),
          backgroundColor: "#fff",
        }}
      >
        <Text style={{ fontSize: 26, fontWeight: "900", marginBottom: 12 }}>
          Edit Profile
        </Text>

        <Text style={{ fontWeight: "900", marginBottom: 6 }}>
          {accountType === "business" ? "Farm or Business Name" : "Display Name"}
        </Text>

        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={accountType === "business" ? "Your farm name" : "Your name"}
          style={{
            borderWidth: 1,
            borderColor: "#E5E7EB",
            borderRadius: 12,
            padding: 12,
            marginBottom: 20,
            fontWeight: "700",
          }}
        />

        {accountType === "business" && (
          <>
            <Text style={{ fontWeight: "900", marginBottom: 6 }}>
              Owner Name (optional)
            </Text>

            <TextInput
              value={ownerName}
              onChangeText={setOwnerName}
              placeholder="First owner name"
              style={{
                borderWidth: 1,
                borderColor: "#E5E7EB",
                borderRadius: 12,
                padding: 12,
                marginBottom: 20,
                fontWeight: "600",
                backgroundColor: "#fff",
              }}
            />

            <Text style={{ fontWeight: "900", marginBottom: 6 }}>
              Second Owner (optional)
            </Text>

            <TextInput
              value={ownerName2}
              onChangeText={setOwnerName2}
              placeholder="Spouse, partner, or family member"
              style={{
                borderWidth: 1,
                borderColor: "#E5E7EB",
                borderRadius: 12,
                padding: 12,
                marginBottom: 20,
                fontWeight: "600",
                backgroundColor: "#fff",
              }}
            />

            <Text style={{ fontWeight: "900", marginBottom: 6 }}>
              Website (optional)
            </Text>

            <TextInput
              value={website}
              onChangeText={setWebsite}
              placeholder="www.yourfarm.com"
              autoCapitalize="none"
              style={{
                borderWidth: 1,
                borderColor: "#E5E7EB",
                borderRadius: 12,
                padding: 12,
                marginBottom: 20,
                fontWeight: "600",
                backgroundColor: "#fff",
              }}
            />
          </>
        )}

        <Text style={{ fontWeight: "900", marginBottom: 6 }}>
          Bio
        </Text>

        <TextInput
          value={bio}
          onChangeText={setBio}
          placeholder="Tell people about you or your farm..."
          multiline
          style={{
            borderWidth: 1,
            borderColor: "#E5E7EB",
            borderRadius: 12,
            padding: 12,
            marginBottom: 20,
            fontWeight: "600",
            minHeight: 100,
            textAlignVertical: "top",
          }}
        />

        <Pressable
          onPress={save}
          disabled={saving}
          style={{
            backgroundColor: "#1f7a3f",
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>
            {saving ? "Saving..." : "Save Changes"}
          </Text>
        </Pressable>
      </View>
    </TouchableWithoutFeedback>
  );
}