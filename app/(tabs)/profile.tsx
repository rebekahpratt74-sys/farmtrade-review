import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import {
  EmailAuthProvider,
  deleteUser,
  getIdToken,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reload,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "../../components/ui/Card";
import { FarmButton } from "../../components/ui/FarmButton";
import { auth, db, functions, storage } from "../../lib/firebase";
import { theme } from "../../lib/theme";

function DashboardRow({
  title,
  subtitle,
  icon,
  badge,
  onPress,
  disabled,
}: {
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: number | null;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const showBadge = typeof badge === "number";

  return (
    <Pressable onPress={disabled ? undefined : onPress} style={{ opacity: disabled ? 0.55 : 1 }}>
      <Card
        style={{
          padding: theme.space.md,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                backgroundColor: theme.colors.mutedBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name={icon} size={18} color={theme.colors.brand} />
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  fontWeight: "900",
                  fontSize: 16,
                  color: theme.colors.text,
                }}
              >
                {title}
              </Text>

              {!!subtitle && (
                <Text
                  style={{
                    color: theme.colors.subtext,
                    fontWeight: "700",
                  }}
                >
                  {subtitle}
                </Text>
              )}
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {showBadge && (
              <View
                style={{
                  minWidth: 30,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: theme.radius.pill,
                  backgroundColor: theme.colors.chipBg,
                  borderWidth: 1,
                  borderColor: theme.colors.chipBorder,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontWeight: "900", color: theme.colors.chipText }}>{badge}</Text>
              </View>
            )}

            <Ionicons name="chevron-forward" size={18} color={theme.colors.subtext} />
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();

  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const user = currentUser;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerName2, setOwnerName2] = useState("");
  const [accountType, setAccountType] = useState<"personal" | "business">("personal");
  const [subscriptionStatus, setSubscriptionStatus] = useState<"free" | "pro">("free");
  const [maxActiveListings, setMaxActiveListings] = useState(5);
  const [monthlyPromotionCredits, setMonthlyPromotionCredits] = useState(0);
  const [subscriptionUpdatedAt, setSubscriptionUpdatedAt] = useState<any>(null);

  const [myListingsCount, setMyListingsCount] = useState<number | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);

  const memberSince = useMemo(() => {
    const created = user?.metadata?.creationTime;
    if (!created) return null;
    const d = new Date(created);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long" });
  }, [user]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setCurrentUser(nextUser);
      setUid(nextUser?.uid ?? null);
      setEmailVerified(!!nextUser?.emailVerified);
      setLoading(false);
    });

    return unsub;
  }, []);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    const unsubUser = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        if (snap.exists()) {
          const data: any = snap.data();
          setName((data.displayName || data.name || "").toString());
          setBio((data.bio || "").toString());
          setPhotoUrl(data.photoUrl || null);
          setWebsite((data.website || "").toString());
          setOwnerName((data.ownerName || "").toString());
          setOwnerName2((data.ownerName2 || "").toString());
          setAccountType(data.accountType === "business" ? "business" : "personal");
          setSubscriptionStatus(
  data.subscriptionStatus === "pro" ? "pro" : "free"
);

setMaxActiveListings(
  typeof data.maxActiveListings === "number"
    ? data.maxActiveListings
    : 5
);
setMonthlyPromotionCredits(
  typeof data.monthlyPromotionCredits === "number"
    ? data.monthlyPromotionCredits
    : 0
);

setSubscriptionUpdatedAt(data.subscriptionUpdatedAt || null);
        }
        setLoading(false);
      },
      (e) => {
        console.log("Profile load error:", e);
        setLoading(false);
      }
    );

    return () => unsubUser();
  }, [uid]);

  useEffect(() => {
    if (!uid) return;

    const myListingsQ = query(
      collection(db, "listings"),
      where("sellerId", "==", uid),
      where("status", "==", "active")
);
    const unsubListings = onSnapshot(myListingsQ, (snap) => setMyListingsCount(snap.size));

    const favCol = collection(db, "users", uid, "favorites");
    const unsubFavs = onSnapshot(favCol, (snap) => setSavedCount(snap.size));

    return () => {
      unsubListings();
      unsubFavs();
    };
  }, [uid]);

  const pickAndUploadPhoto = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled) return;

    try {
      setSaving(true);

      const uri = result.assets[0].uri;
      const blob = await (await fetch(uri)).blob();

      const fileRef = ref(storage, `profilePhotos/${currentUser.uid}.jpg`);
      await uploadBytes(fileRef, blob);
      const downloadUrl = await getDownloadURL(fileRef);

      await updateDoc(doc(db, "users", currentUser.uid), {
        photoUrl: downloadUrl,
      });

      setPhotoUrl(downloadUrl);
    } finally {
      setSaving(false);
    }
  };

  const removePhoto = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    await updateDoc(doc(db, "users", currentUser.uid), {
      photoUrl: null,
    });

    setPhotoUrl(null);
  };

  const logout = () => {
    Alert.alert("Log out", "Are you sure you would like to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await signOut(auth);
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const deleteFavoritesForUser = async (userId: string) => {
    const favSnap = await getDocs(collection(db, "users", userId, "favorites"));
    await Promise.all(favSnap.docs.map((d) => deleteDoc(d.ref)));
  };

  const deleteListingsForUser = async (userId: string) => {
    const listingsQ = query(collection(db, "listings"), where("sellerId", "==", userId));
    const listingsSnap = await getDocs(listingsQ);
    await Promise.all(listingsSnap.docs.map((d) => deleteDoc(d.ref)));
  };

  const reauthenticateForDelete = async (password: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      throw new Error("missing-user");
    }

    const credential = EmailAuthProvider.credential(currentUser.email, password);
    await reauthenticateWithCredential(currentUser, credential);
  };

  const performDeleteAccount = async (password: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    if (!password.trim()) {
      Alert.alert("Delete Account", "Please enter your password to continue.");
      return;
    }

    try {
      setDeletingAccount(true);

      const userId = currentUser.uid;

      await reauthenticateForDelete(password);

      await deleteFavoritesForUser(userId);
      await deleteListingsForUser(userId);

      try {
        await deleteObject(ref(storage, `profilePhotos/${userId}.jpg`));
      } catch (e) {
        console.log("Profile photo delete skipped:", e);
      }

      try {
        await deleteDoc(doc(db, "users", userId));
      } catch (e) {
        console.log("User doc delete error:", e);
      }

      await deleteUser(currentUser);

      setShowDeleteConfirm(false);
      setDeletePassword("");

      Alert.alert("Account Deleted", "Your FarmTrade account has been permanently deleted.");

      router.replace("/(auth)/login");
    } catch (e: any) {
      console.log("Delete account error:", e);

      const message =
        e?.code === "auth/wrong-password" || e?.code === "auth/invalid-credential"
          ? "That password was incorrect. Please try again."
          : e?.code === "auth/requires-recent-login"
            ? "Please log in again and then try deleting your account."
            : "We couldn’t delete your account right now. Please try again.";

      Alert.alert("Delete Account", message);
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleVerifyEmail = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      setSendingVerification(true);

      await reload(currentUser);
      await getIdToken(currentUser, true);

      if (auth.currentUser?.emailVerified) {
        setEmailVerified(true);
        Alert.alert("Email Verified", "Your email is already verified.");
        return;
      }

      await sendEmailVerification(currentUser);

      Alert.alert(
        "Verify Email",
        "We sent a verification link to your email. Please check your inbox, then come back to the app."
      );
    } catch (e) {
      console.log("Send verification email error:", e);
      Alert.alert(
        "Verify Email",
        "We couldn’t send a verification email right now. Please try again."
      );
    } finally {
      setSendingVerification(false);
    }
  };

  const handleDeleteAccountPress = () => {
    if (deletingAccount) return;

    setShowDeleteConfirm((prev) => !prev);
    setDeletePassword("");
  };

  const handleCreateListingPress = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      await reload(currentUser);
      await getIdToken(currentUser, true);

      const verified = !!auth.currentUser?.emailVerified;
      setEmailVerified(verified);

      if (verified) {
  const activeCount = myListingsCount ?? 0;
  const isFreePlan = subscriptionStatus !== "pro";

  if (isFreePlan && activeCount >= maxActiveListings) {
    Alert.alert(
      "Upgrade to FarmTrade Pro",
      `Free accounts can have up to ${maxActiveListings} active listings. Upgrade to Pro for unlimited listings and 1 free promotion each month.`,
      [
        { text: "Maybe Later", style: "cancel" },
        {
          text: "Upgrade to Pro",
          onPress: () => {
            router.push("/upgrade-pro");
          },
        },
      ]
    );
    return;
  }

  router.push("/(tabs)/create");
  return;
}

      Alert.alert(
        "Verify Your Account",
        "Please verify your account before continuing.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Verify",
            onPress: async () => {
              try {
                setSendingVerification(true);

                await reload(currentUser);
                await getIdToken(currentUser, true);

                if (auth.currentUser?.emailVerified) {
                  setEmailVerified(true);
                  Alert.alert("Email Verified", "Your email is already verified.");
                  return;
                }

                await sendEmailVerification(currentUser);

                Alert.alert(
                  "Verify Email",
                  "We sent a verification link to your email. Please verify your account, then come back to continue."
                );
              } catch (e) {
                console.log("Send verification email error:", e);
                Alert.alert(
                  "Verify Email",
                  "We couldn’t send a verification email right now. Please try again."
                );
              } finally {
                setSendingVerification(false);
              }
            },
          },
        ]
      );
    } catch (e) {
      console.log("Create listing verification check error:", e);
      Alert.alert(
        "Verify Your Account",
        "We couldn’t check your verification status right now. Please try again."
      );
    }
  };

  if (!user || loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme.colors.backgroundTint,
        }}
      >
        <ActivityIndicator color={theme.colors.brand} />
      </View>
    );
  }

  const initial = (name?.trim()?.[0] || "U").toUpperCase();
  const subscriptionUpdatedLabel = subscriptionUpdatedAt?.toDate
  ? subscriptionUpdatedAt.toDate().toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  : null;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView style={{ flex: 1, backgroundColor: theme.colors.backgroundTint }}>
        <View
          style={{
            paddingHorizontal: theme.space.lg,
            paddingBottom: theme.space.lg,
            paddingTop: insets.top + 8,
          }}
        >
          <Text style={{ fontSize: 28, fontWeight: "900", color: theme.colors.text }}>
            Profile
          </Text>

          <Text
            style={{
              color: theme.colors.subtext,
              fontWeight: "700",
              marginBottom: 14,
              marginTop: 4,
            }}
          >
            Manage your account and seller tools
          </Text>

          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.xl,
              padding: theme.space.lg,
              gap: 12,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <View style={{ flexDirection: "row", gap: 14 }}>
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  overflow: "hidden",
                  backgroundColor: theme.colors.avatarBg,
                  justifyContent: "center",
                  alignItems: "center",
                  borderWidth: 3,
                  borderColor: theme.colors.chipBorder,
                }}
              >
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={{ width: "100%", height: "100%" }} />
                ) : (
                  <Text style={{ fontSize: 30, fontWeight: "900", color: theme.colors.text }}>
                    {initial}
                  </Text>
                )}
              </View>

              <View style={{ flex: 1 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 22, fontWeight: "900", color: theme.colors.text }}>
                      {name || "User"}
                    </Text>

                    {accountType === "business" && (ownerName || ownerName2) ? (
                      <Text
                        style={{
                          marginTop: 4,
                          color: theme.colors.subtext,
                          fontWeight: "700",
                          fontSize: 13,
                        }}
                      >
                        owned by {ownerName}
                        {ownerName && ownerName2 ? " & " : ""}
                        {ownerName2}
                      </Text>
                    ) : null}
                  </View>

                  {emailVerified ? (
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: theme.radius.pill,
                        backgroundColor: theme.colors.surface,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "800",
                          color: theme.colors.brand,
                        }}
                      >
                        Verified
                      </Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={handleVerifyEmail}
                      disabled={sendingVerification}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: theme.radius.pill,
                        backgroundColor: theme.colors.surface,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        opacity: sendingVerification ? 0.6 : 1,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "800",
                          color: theme.colors.brand,
                        }}
                      >
                        {sendingVerification ? "Sending..." : "Verify Email"}
                      </Text>
                    </Pressable>
                  )}
                </View>

                {accountType === "business" && (
                  <View
                    style={{
                      alignSelf: "flex-start",
                      marginTop: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: theme.radius.pill,
                      backgroundColor: "#DCFCE7",
                      borderWidth: 1,
                      borderColor: "#BBF7D0",
                    }}
                  >
                    <Text
                      style={{
                        color: "#166534",
                        fontWeight: "900",
                        fontSize: 12,
                      }}
                    >
                      Business Account
                    </Text>
                  </View>
                )}

                {!!bio && (
                  <Text
                    numberOfLines={3}
                    style={{
                      color: theme.colors.slate700,
                      marginTop: 6,
                      fontWeight: "600",
                      lineHeight: 20,
                    }}
                  >
                    {bio}
                  </Text>
                )}

                {accountType === "business" && website ? (
                  <Text
                    style={{
                      marginTop: 6,
                      fontWeight: "700",
                      color: "#1f7a3f",
                    }}
                  >
                    🌐 {website}
                  </Text>
                ) : null}

                <Text
                  style={{
                    color: theme.colors.subtext,
                    marginTop: 8,
                    fontWeight: "700",
                  }}
                >
                  {user.email}
                </Text>

                {memberSince && (
                  <Text style={{ color: theme.colors.subtext, marginTop: 2, fontWeight: "700" }}>
                    Member since {memberSince}
                  </Text>
                )}

                <Pressable onPress={pickAndUploadPhoto} style={{ marginTop: 10 }}>
                  <Text style={{ fontWeight: "900", color: theme.colors.brand }}>
                    {saving ? "Updating photo..." : "Change Photo"}
                  </Text>
                </Pressable>

                {photoUrl && (
                  <Pressable onPress={removePhoto} style={{ marginTop: 6 }}>
                    <Text style={{ fontWeight: "900", color: theme.colors.danger }}>
                      Remove Photo
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>

<View
  style={{
    marginTop: 18,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.space.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  }}
>
  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    }}
  >
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 18, fontWeight: "900", color: theme.colors.text }}>
        FarmTrade {subscriptionStatus === "pro" ? "Pro" : "Free"}
      </Text>

      <Text
        style={{
          color: theme.colors.subtext,
          fontWeight: "700",
          marginTop: 4,
        }}
      >
        {subscriptionStatus === "pro"
          ? "Unlimited listings + monthly promotion credit"
          : "Up to 5 active listings"}
      </Text>
    </View>

    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: theme.radius.pill,
        backgroundColor: subscriptionStatus === "pro" ? "#DCFCE7" : theme.colors.mutedBg,
        borderWidth: 1,
        borderColor: subscriptionStatus === "pro" ? "#BBF7D0" : theme.colors.border,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: "900",
          color: subscriptionStatus === "pro" ? "#166534" : theme.colors.subtext,
        }}
      >
        {subscriptionStatus === "pro" ? "ACTIVE" : "FREE"}
      </Text>
    </View>
  </View>

  <View style={{ marginTop: 14, gap: 10 }}>
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ color: theme.colors.subtext, fontWeight: "800" }}>
        Active listings
      </Text>
      <Text style={{ color: theme.colors.text, fontWeight: "900" }}>
        {subscriptionStatus === "pro"
          ? "Unlimited"
          : `${myListingsCount ?? 0} / ${maxActiveListings}`}
      </Text>
    </View>

    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ color: theme.colors.subtext, fontWeight: "800" }}>
        Promo credits
      </Text>
      <Text style={{ color: theme.colors.text, fontWeight: "900" }}>
        {monthlyPromotionCredits}
      </Text>
    </View>

    {subscriptionStatus === "pro" && subscriptionUpdatedLabel && (
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: theme.colors.subtext, fontWeight: "800" }}>
          Last updated
        </Text>
        <Text style={{ color: theme.colors.text, fontWeight: "900" }}>
          {subscriptionUpdatedLabel}
        </Text>
      </View>
    )}
  </View>

{subscriptionStatus === "pro" && (
  <Pressable
    style={{
      marginTop: 14,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 12,
      borderRadius: theme.radius.lg,
      alignItems: "center",
    }}
    onPress={async () => {
      try {
        const createPortalSession = httpsCallable(functions, "createPortalSession");
        const res: any = await createPortalSession();

        if (res.data?.url) {
          Linking.openURL(res.data.url);
        }
      } catch (e) {
        console.log("Portal error:", e);
        Alert.alert("Error", "Could not open subscription settings.");
      }
    }}
  >
    <Text style={{ fontWeight: "900", color: theme.colors.text }}>
      Manage Subscription
    </Text>
  </Pressable>
)}

  {subscriptionStatus === "free" && (
    <Pressable
      style={{
        marginTop: 14,
        backgroundColor: theme.colors.brand,
        paddingVertical: 12,
        borderRadius: theme.radius.lg,
        alignItems: "center",
      }}
      onPress={() => router.push("/upgrade-pro")}
    >
      <Text style={{ color: "#fff", fontWeight: "900" }}>
        Upgrade to Pro
      </Text>
    </Pressable>
  )}
</View>
          <View style={{ marginTop: 18, gap: 10 }}>
  <DashboardRow
    title="Edit Profile"
    subtitle="Update your name and profile details"
    icon="create-outline"
    onPress={() => router.push("/profile/edit")}
  />

  <DashboardRow
    title="Create Listing"
    subtitle="Post something new"
    icon="add-circle"
    onPress={handleCreateListingPress}
  />

  <DashboardRow
    title="My Listings"
    subtitle={
  subscriptionStatus === "pro"
    ? "Unlimited active listings"
    : `${myListingsCount ?? 0} / ${maxActiveListings} active listings used`
}
    icon="storefront"
    badge={myListingsCount}
    onPress={() => router.push("/(tabs)/my-listings")}
  />

            <DashboardRow
              title="Saved"
              subtitle="Listings you’ve favorited"
              icon="heart"
              badge={savedCount}
              onPress={() => router.push("/(tabs)/saved")}
            />

            <DashboardRow
              title="Your Reviews"
              subtitle="View and manage reviews you’ve left"
              icon="star"
              onPress={() => router.push("/profile/reviews")}
            />

            <DashboardRow
              title="Map"
              subtitle="Browse listings on the map"
              icon="map"
              onPress={() => router.push("/(tabs)/map")}
            />

            <DashboardRow
              title="Change Market Area"
              subtitle="Update your city/state for browsing"
              icon="location"
              onPress={() => router.push("/(tabs)/market-area")}
            />

            <DashboardRow
              icon="mail-outline"
              title="Change Email"
              subtitle="Update the email on your account"
              onPress={() => router.push("/profile/change-email")}
            />

            <DashboardRow
              icon="lock-closed-outline"
              title="Change Password"
              subtitle="Keep your account secure"
              onPress={() => router.push("/profile/change-password")}
            />
          </View>

          <View style={{ marginTop: 18 }}>
            <FarmButton title="Log out" onPress={logout} />
          </View>

          <View style={{ marginTop: 22, marginBottom: 10, alignItems: "center" }}>
            <Pressable
              onPress={handleDeleteAccountPress}
              disabled={deletingAccount}
              style={{
                paddingVertical: 8,
                opacity: deletingAccount ? 0.5 : 1,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "800",
                  color: theme.colors.danger,
                }}
              >
                {deletingAccount
                  ? "Deleting Account..."
                  : showDeleteConfirm
                    ? "Cancel Delete"
                    : "Delete Account"}
              </Text>
            </Pressable>

            {showDeleteConfirm && (
              <View
                style={{
                  width: "100%",
                  marginTop: 14,
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radius.xl,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  padding: theme.space.md,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "900",
                    color: theme.colors.text,
                    marginBottom: 6,
                  }}
                >
                  Confirm Account Deletion
                </Text>

                <Text
                  style={{
                    color: theme.colors.subtext,
                    fontWeight: "700",
                    lineHeight: 20,
                    marginBottom: 12,
                  }}
                >
                  This action cannot be undone. Enter your password to permanently delete
                  your FarmTrade account.
                </Text>

                <TextInput
                  value={deletePassword}
                  onChangeText={setDeletePassword}
                  placeholder="Enter your password"
                  placeholderTextColor={theme.colors.subtext}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!deletingAccount}
                  style={{
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.lg,
                    backgroundColor: theme.colors.surface,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: theme.colors.text,
                    fontWeight: "700",
                  }}
                />

                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <Pressable
                    onPress={() => {
                      setShowDeleteConfirm(false);
                      setDeletePassword("");
                    }}
                    disabled={deletingAccount}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: theme.radius.lg,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: theme.colors.surface,
                      opacity: deletingAccount ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ fontWeight: "800", color: theme.colors.text }}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => performDeleteAccount(deletePassword)}
                    disabled={deletingAccount}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: theme.radius.lg,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: theme.colors.danger,
                      opacity: deletingAccount ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ fontWeight: "900", color: "#fff" }}>
                      {deletingAccount ? "Deleting..." : "Delete Forever"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </TouchableWithoutFeedback>
  );
}