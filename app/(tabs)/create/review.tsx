import * as Location from "expo-location";
import { router } from "expo-router";
import { getIdToken, reload } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCreate } from "../../../hooks/createContext";
import { auth, db, storage } from "../../../lib/firebase";
import { theme } from "../../../lib/theme";

type PricingType = "total" | "per_unit";

type ListingDoc = {
  title: string;
  category: string;
  price: number;
  pricingType: PricingType;
  unit: string;
  quantity: number;
  description: string;
  condition?: string;
  status: "active";
  sellerId: string;
  city: string;
  state: string;
  zip: string;
  lat: number | null;
  lng: number | null;
  photoUrls: string[];
  isPromoted?: boolean;
  promotionExpiresAt?: any;
  createdAt?: any;
  updatedAt?: any;
};

async function uriToBlob(uri: string): Promise<Blob> {
  const res = await fetch(uri);
  return await res.blob();
}

function formatCategory(category?: string) {
  if (category === "livestock") return "Livestock";
  if (category === "produce") return "Produce";
  if (category === "farm_goods") return "Farm Goods";
  if (category === "equipment") return "Equipment";
  return category || "";
}

function normalizeCategory(raw?: string) {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "livestock") return "livestock";
  if (v === "produce") return "produce";
  if (v === "farm_goods") return "farm_goods";
  if (v === "equipment") return "equipment";
  return v || "other";
}

export default function ReviewScreen() {
  const { draft, resetDraft, isEditing, editId } = useCreate();
  const [submitting, setSubmitting] = useState(false);
  const existingPromotionExpiresAt = draft.promotionExpiresAt ?? null;
  const [promoteListing, setPromoteListing] = useState(
    draft.isPromoted === true
  );
  const [showPromotionPlans, setShowPromotionPlans] = useState(false);
  const [promotionDays, setPromotionDays] = useState<number>(7);
  const insets = useSafeAreaInsets();

  const title = (draft.title ?? "").trim();
  const category = normalizeCategory(draft.category);
  const price = Number(draft.price ?? 0);
  const pricingType: PricingType =
    (draft.pricingType as PricingType) || "total";
  const unit = (draft.unit ?? "").trim();
  const quantity = Number(draft.quantity ?? 0);
  const description = (draft.description ?? "").trim();

  const city = (draft.city ?? "").trim();
  const state = (draft.state ?? "").trim();
  const zip = (draft.zip ?? "").trim();
  const lat = typeof draft.lat === "number" ? draft.lat : null;
  const lng = typeof draft.lng === "number" ? draft.lng : null;

  const existingPhotoUrls: string[] = Array.isArray(draft.photoUrls)
    ? draft.photoUrls.filter(
        (u): u is string => typeof u === "string" && u.length > 0
      )
    : [];

  const localPhotoUrls: string[] = Array.isArray(draft.localPhotoUris)
    ? draft.localPhotoUris.filter(
        (u): u is string => typeof u === "string" && u.length > 0
      )
    : [];

  const orderedUris = useMemo(() => {
    const fallback = [...existingPhotoUrls, ...localPhotoUrls];

    const order =
      Array.isArray(draft.photoOrder) && draft.photoOrder.length > 0
        ? draft.photoOrder.filter(
            (u): u is string => typeof u === "string" && u.length > 0
          )
        : fallback;

    const existingSet = new Set(existingPhotoUrls);
    const localSet = new Set(localPhotoUrls);

    return order.filter((u) => existingSet.has(u) || localSet.has(u));
  }, [draft.photoOrder, existingPhotoUrls, localPhotoUrls]);

  const canPublish = useMemo(() => {
    if (!title) return false;
    if (!category || category === "other") return false;
    if (!Number.isFinite(price) || price <= 0) return false;
    if (pricingType === "per_unit" && !unit) return false;
    return true;
  }, [title, category, price, pricingType, unit]);

  const activePromotion = useMemo(() => {
    if (draft.isPromoted !== true) return false;
    if (!existingPromotionExpiresAt) return false;

    const expiresAt =
      typeof existingPromotionExpiresAt?.toDate === "function"
        ? existingPromotionExpiresAt.toDate().getTime()
        : existingPromotionExpiresAt?.seconds
          ? existingPromotionExpiresAt.seconds * 1000
          : new Date(existingPromotionExpiresAt).getTime();

    return expiresAt > Date.now();
  }, [draft.isPromoted, existingPromotionExpiresAt]);

  const promotedUntil = useMemo(() => {
    if (!activePromotion || !existingPromotionExpiresAt) return null;

    const date =
      typeof existingPromotionExpiresAt?.toDate === "function"
        ? existingPromotionExpiresAt.toDate()
        : new Date(existingPromotionExpiresAt);

    return date.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
    });
  }, [activePromotion, existingPromotionExpiresAt]);

  const handlePublish = async () => {
    try {
      const user = auth.currentUser;

      if (!user) {
        Alert.alert(
          "Not signed in",
          "Please sign in to publish a listing."
        );
        return;
      }

      await reload(user);
      await getIdToken(user, true);

      if (!auth.currentUser?.emailVerified) {
        Alert.alert(
          "Verify Your Account",
          "Please verify your account before continuing."
        );
        return;
      }

      if (!canPublish) {
        Alert.alert(
          "Missing info",
          "Please make sure Title, Category, and Price are filled out correctly."
        );
        return;
      }
      if (!isEditing) {
  const userSnap = await getDocs(
    query(collection(db, "users"), where("uid", "==", user.uid))
  );

  const userDoc = userSnap.docs[0];
  const userData: any = userDoc?.data() ?? {};

  const subscriptionStatus =
    userData.subscriptionStatus === "pro" ? "pro" : "free";

  const maxActiveListings =
    typeof userData.maxActiveListings === "number"
      ? userData.maxActiveListings
      : 5;

  if (subscriptionStatus !== "pro") {
    const activeListingsSnap = await getDocs(
      query(
        collection(db, "listings"),
        where("sellerId", "==", user.uid),
        where("status", "==", "active")
      )
    );

    if (activeListingsSnap.size >= maxActiveListings) {
      Alert.alert(
        "Upgrade to FarmTrade Pro",
        `Free accounts can have up to ${maxActiveListings} active listings. Upgrade to Pro for unlimited listings and 1 free promotion each month.`,
        [
          { text: "Maybe Later", style: "cancel" },
          {
            text: "Upgrade to Pro",
            onPress: () => {
              Alert.alert(
                "Coming soon",
                "FarmTrade Pro will be available soon!"
              );
            },
          },
        ]
      );
      return;
    }
  }
}

      setSubmitting(true);

      const listingId =
        isEditing && editId
          ? editId
          : doc(collection(db, "listings")).id;

      const uploadedUrls: string[] = [];

      for (const uri of localPhotoUrls) {
        const blob = await uriToBlob(uri);

        const fileName = `${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}.jpg`;

        const storageRef = ref(
          storage,
          `listings/${user.uid}/${listingId}/${fileName}`
        );

        await uploadBytes(storageRef, blob);
        const url = await getDownloadURL(storageRef);
        uploadedUrls.push(url);
      }

      const localToUploaded = new Map<string, string>();

      for (let i = 0; i < localPhotoUrls.length; i++) {
        localToUploaded.set(localPhotoUrls[i], uploadedUrls[i]);
      }

      const mergedPhotoUrls = orderedUris.map(
        (uri) => localToUploaded.get(uri) ?? uri
      );

      let finalLat = lat;
      let finalLng = lng;

      if (finalLat == null || finalLng == null) {
        try {
          const queryStr =
            zip ||
            (city && state ? `${city}, ${state}` : "") ||
            state;

          if (queryStr) {
            const results = await Location.geocodeAsync(queryStr);

            if (results?.[0]) {
              finalLat = results[0].latitude;
              finalLng = results[0].longitude;
            }
          }
        } catch (e) {
          console.log("Geocode error:", e);
        }
      }

      const payload: ListingDoc = {
        title,
        category,
        price,
        quantity,
        pricingType,
        unit,
        description,
        status: "active",
        sellerId: user.uid,
        city,
        state,
        zip,
        lat: finalLat,
        lng: finalLng,
        photoUrls: mergedPhotoUrls,
        condition: draft.condition ?? "",
        isPromoted: promoteListing,
        promotionExpiresAt: promoteListing
          ? new Date(Date.now() + promotionDays * 24 * 60 * 60 * 1000)
          : null,
        updatedAt: serverTimestamp(),
      };

      if (!isEditing) {
        payload.createdAt = serverTimestamp();
        await setDoc(doc(db, "listings", listingId), payload);
      } else {
        await updateDoc(doc(db, "listings", listingId), payload);
      }

      const removed = Array.isArray(draft.removedRemoteUrls)
        ? draft.removedRemoteUrls
        : [];

      for (const url of removed) {
        try {
          await deleteObject(ref(storage, url));
        } catch (e) {
          console.log("Delete error:", e);
        }
      }

      resetDraft();

      Alert.alert(
        "Success",
        isEditing ? "Listing updated!" : "Listing published!"
      );

      router.replace({
  pathname: "/(tabs)/listing/[id]",
  params: { id: listingId, from: "profile" },
});
    } catch (e: any) {
      console.log(e);
      Alert.alert("Error", e?.message ?? "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const primaryPhoto = orderedUris[0] || null;

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom + 120, 150),
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={[
            styles.floatingBackBtn,
            { top: Math.max(insets.top, 12) },
          ]}
        >
          <Text style={styles.floatingBackText}>Back</Text>
        </Pressable>

        <Text style={styles.eyebrow}>
          {isEditing ? "Review Changes" : "Final Step"}
        </Text>

        <Text style={styles.title}>
          {isEditing ? "Review Changes" : "Publish Listing"}
        </Text>

        <Text style={styles.subtitle}>
          Double-check everything before your listing goes live.
        </Text>

        <View style={styles.card}>
          {primaryPhoto ? (
            <Image source={{ uri: primaryPhoto }} style={styles.hero} />
          ) : (
            <View style={[styles.hero, styles.heroPlaceholder]}>
              <Text>No photo selected</Text>
            </View>
          )}

          {orderedUris.length > 1 && (
            <FlatList
              data={orderedUris}
              horizontal
              renderItem={({ item }) => (
                <Image source={{ uri: item }} style={styles.thumb} />
              )}
            />
          )}

          <Text style={styles.itemTitle}>{title}</Text>

          <Text style={styles.price}>
            {pricingType === "per_unit" ? `$${price} / ${unit}` : `$${price}`}
          </Text>

          <Text style={styles.meta}>
            {formatCategory(category)}
            {city ? ` • ${city}` : ""}
            {state ? `, ${state}` : ""}
          </Text>

          {!!description && <Text style={styles.desc}>{description}</Text>}

          <View
            style={{
              marginTop: 18,
              padding: 16,
              borderRadius: 16,
              backgroundColor: "#F0FDF4",
              borderWidth: 1,
              borderColor: "#BBF7D0",
            }}
          >
            <Text
              style={{
                fontWeight: "900",
                fontSize: 16,
                color: "#166534",
              }}
            >
              Promote your listing 🚀
            </Text>

            <Text
              style={{
                marginTop: 6,
                color: "#166534",
                fontWeight: "600",
              }}
            >
              Get more views and sell faster
            </Text>

            <Text style={{ marginTop: 10, color: "#166534", fontWeight: "600" }}>
              ✓ Appears higher in results
            </Text>

            <Text style={{ marginTop: 4, color: "#166534", fontWeight: "600" }}>
              ✓ More buyer visibility
            </Text>

            <Text style={{ marginTop: 4, color: "#166534", fontWeight: "600" }}>
              ✓ Flexible promotion plans
            </Text>

            {activePromotion && promotedUntil ? (
              <>
                <View
                  style={{
                    alignSelf: "flex-start",
                    marginTop: 12,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: "#ECFCCB",
                    borderWidth: 1,
                    borderColor: "#BEF264",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "900",
                      color: "#3F6212",
                    }}
                  >
                    Already promoted until {promotedUntil}
                  </Text>
                </View>

                <Pressable
                  onPress={() => setShowPromotionPlans((prev) => !prev)}
                  style={{
                    marginTop: 12,
                    paddingVertical: 12,
                    borderRadius: 12,
                    backgroundColor: "#166534",
                  }}
                >
                  <Text
                    style={{
                      textAlign: "center",
                      fontWeight: "900",
                      color: "#fff",
                    }}
                  >
                    {showPromotionPlans
                      ? "Hide Promotion Plans"
                      : "Change Promotion Plan"}
                  </Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={() => {
                  setPromoteListing((prev) => !prev);
                  setShowPromotionPlans(false);
                }}
                style={{
                  marginTop: 12,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: promoteListing ? "#166534" : "#DCFCE7",
                }}
              >
                <Text
                  style={{
                    textAlign: "center",
                    fontWeight: "900",
                    color: promoteListing ? "#fff" : "#166534",
                  }}
                >
                  {promoteListing
                    ? "✓ Promotion Selected"
                    : "Promote this listing"}
                </Text>
              </Pressable>
            )}

            {((promoteListing && !activePromotion) || showPromotionPlans) && (
              <View
                style={{
                  marginTop: 12,
                  gap: 10,
                }}
              >
                <Pressable
                  onPress={() => {
                    setPromoteListing(true);
                    setPromotionDays(7);
                  }}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: promotionDays === 7 ? "#166534" : "#D1D5DB",
                    backgroundColor: promotionDays === 7 ? "#DCFCE7" : "#fff",
                  }}
                >
                  <Text style={{ fontWeight: "900", color: "#111827" }}>
                    7 days
                  </Text>
                  <Text
                    style={{ marginTop: 4, fontWeight: "700", color: "#166534" }}
                  >
                    $4.99
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setPromoteListing(true);
                    setPromotionDays(14);
                  }}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: promotionDays === 14 ? "#166534" : "#D1D5DB",
                    backgroundColor: promotionDays === 14 ? "#DCFCE7" : "#fff",
                  }}
                >
                  <Text style={{ fontWeight: "900", color: "#111827" }}>
                    14 days
                  </Text>
                  <Text
                    style={{ marginTop: 4, fontWeight: "700", color: "#166534" }}
                  >
                    $7.99
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setPromoteListing(true);
                    setPromotionDays(30);
                  }}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: promotionDays === 30 ? "#166534" : "#D1D5DB",
                    backgroundColor: promotionDays === 30 ? "#DCFCE7" : "#fff",
                  }}
                >
                  <Text style={{ fontWeight: "900", color: "#111827" }}>
                    30 days
                  </Text>
                  <Text
                    style={{ marginTop: 4, fontWeight: "700", color: "#166534" }}
                  >
                    $11.99
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <Pressable
          style={[styles.btn, !canPublish && styles.btnDisabled]}
          disabled={!canPublish || submitting}
          onPress={handlePublish}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>
              {isEditing ? "Save Changes" : "Publish Listing"}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.backgroundTint,
  },

  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
  },

  floatingBackBtn: {
    position: "absolute",
    right: 20,
    zIndex: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },

  floatingBackText: {
    fontWeight: "900",
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: "900",
    color: theme.colors.brand,
    marginBottom: 8,
    marginTop: 44,
  },

  title: {
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 6,
  },

  subtitle: {
    color: "#64748B",
    marginBottom: 18,
  },

  card: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  hero: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    marginBottom: 10,
  },

  heroPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
  },

  thumb: {
    width: 70,
    height: 70,
    borderRadius: 10,
    marginRight: 8,
  },

  itemTitle: {
    fontSize: 18,
    fontWeight: "900",
  },

  price: {
    fontWeight: "900",
  },

  meta: {
    marginTop: 6,
    color: "#667",
  },

  desc: {
    marginTop: 12,
  },

  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#fff",
  },

  btn: {
    backgroundColor: theme.colors.brand,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },

  btnDisabled: {
    opacity: 0.5,
  },

  btnText: {
    color: "#fff",
    fontWeight: "900",
  },
});