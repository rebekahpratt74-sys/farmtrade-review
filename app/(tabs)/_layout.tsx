import { Ionicons } from "@expo/vector-icons";
import { router, Tabs } from "expo-router";
import {
  getIdToken,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
} from "firebase/auth";
import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CreateProvider } from "../../hooks/createContext";
import { auth, db } from "../../lib/firebase";
import { theme } from "../../lib/theme";

export default function TabLayout() {
  const [uid, setUid] = useState<string | null>(null);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [emailVerified, setEmailVerified] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const insets = useSafeAreaInsets();
  const expiredPromotionAlertShownRef = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid ?? null);
      setEmailVerified(!!u?.emailVerified);
    });
    return unsub;
  }, []);

useEffect(() => {
  if (!uid) {
    expiredPromotionAlertShownRef.current = false;
    return;
  }

  const qRef = query(
    collection(db, "listings"),
    where("sellerId", "==", uid),
    where("promotionExpiredAlert", "==", true)
  );

  const unsub = onSnapshot(
    qRef,
    (snap) => {
      if (expiredPromotionAlertShownRef.current) return;
      if (snap.empty) return;

      const firstExpired = snap.docs[0];
      const data: any = firstExpired.data();
      const listingId = firstExpired.id;
      const title = data.title || "Your listing";

      expiredPromotionAlertShownRef.current = true;

      Alert.alert(
        "🚀 Your promotion ended",
        `"${title}" is no longer boosted. Promote it again to move it back toward the top.`,
        [
          {
            
  text: "Not now",
  style: "cancel",
  onPress: async () => {
    try {
      await updateDoc(doc(db, "listings", listingId), {
        promotionExpiredAlert: false,
      });
    } catch (e) {
      console.log("Could not clear promotion alert yet:", e);
    }
  },
},
          {
            
  text: "Promote Again",
  onPress: async () => {
    try {
      await updateDoc(doc(db, "listings", listingId), {
        promotionExpiredAlert: false,
      });
    } catch (e) {
      console.log("Could not clear promotion alert yet:", e);
    }

    router.push({
      pathname: "/(tabs)/listing/[id]",
      params: { id: listingId, from: "my-listings" },
    });
  },
},
        ]
      );
    },
    (err) => {
      console.log("Expired promotion alert snapshot error:", err?.code, err?.message);
    }
  );

  return unsub;
}, [uid]);

  useEffect(() => {
    if (!uid) {
      setUnreadTotal(0);
      return;
    }

    const qRef = query(
      collection(db, "conversations"),
      where("participantIds", "array-contains", uid)
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        let total = 0;

        snap.docs.forEach((d) => {
          const data: any = d.data();
          if (data?.hiddenFor?.[uid]) return;
          total += data?.unreadCount?.[uid] || 0;
        });

        setUnreadTotal(total);
      },
      (err) => {
        console.log("Conversations snapshot error:", err?.code, err?.message);
        setUnreadTotal(0);
      }
    );

    return unsub;
  }, [uid]);

  const handleCreateTabPress = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      await reload(currentUser);
      await getIdToken(currentUser, true);

      const verified = !!auth.currentUser?.emailVerified;
      setEmailVerified(verified);

      if (verified) {
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
      console.log("Create tab verification check error:", e);
      Alert.alert(
        "Verify Your Account",
        "We couldn’t check your verification status right now. Please try again."
      );
    }
  };

  return (
    <CreateProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.colors.brand,
          tabBarInactiveTintColor: theme.colors.subtext,
          tabBarHideOnKeyboard: true,

          tabBarStyle: {
            backgroundColor: theme.colors.surface,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            height: 72 + insets.bottom,
            paddingTop: 10,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
          },

          tabBarItemStyle: {
            paddingTop: 2,
          },

          tabBarLabelStyle: {
            fontWeight: "800",
            fontSize: 12,
            marginTop: 2,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Marketplace",
            headerTitle: "Marketplace",
            tabBarLabel: "Market",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "home" : "home-outline"}
                size={30}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="explore"
          options={{
            title: "Search",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "search" : "search-outline"}
                size={30}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="create"
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              handleCreateTabPress();
            },
          }}
          options={{
            title: "Create",
            tabBarIcon: ({ focused }) => (
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: focused
                    ? theme.colors.brand
                    : theme.colors.brandBright,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: -28,
                  shadowColor: "#000",
                  shadowOpacity: 0.18,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 5 },
                  elevation: 10,
                  borderWidth: 2,
                  borderColor: "#fff",
                }}
              >
                <Ionicons name="add" size={32} color="#fff" />
              </View>
            ),
          }}
        />

        <Tabs.Screen
          name="messages"
          options={{
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "chatbubble" : "chatbubble-outline"}
                size={30}
                color={color}
              />
            ),
            tabBarBadge:
              unreadTotal > 0 ? (unreadTotal > 99 ? "99+" : unreadTotal) : undefined,
            tabBarBadgeStyle: {
              backgroundColor: theme.colors.danger,
              color: theme.colors.surface,
              fontWeight: "900",
            },
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "person" : "person-outline"}
                size={30}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen name="saved" options={{ href: null }} />
        <Tabs.Screen name="map" options={{ href: null }} />
        <Tabs.Screen name="my-listings" options={{ href: null }} />
        <Tabs.Screen name="market-area" options={{ href: null }} />
        <Tabs.Screen name="profile/edit" options={{ href: null }} />
        <Tabs.Screen name="profile/change-email" options={{ href: null }} />
        <Tabs.Screen name="profile/change-password" options={{ href: null }} />
        <Tabs.Screen name="profile/reviews" options={{ href: null }} />
        <Tabs.Screen name="listing/[id]" options={{ href: null }} />
      </Tabs>
    </CreateProvider>
  );
}