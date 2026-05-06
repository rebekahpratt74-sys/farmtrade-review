import { Ionicons } from "@expo/vector-icons";
import { useStripe } from "@stripe/stripe-react-native";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  getIdToken,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListingPhotoCarousel } from "../../../components/listing/ListingPhotoCarousel";
import RatingStars from "../../../components/ui/RatingStars";
import { getCategoryEmoji } from "../../../lib/categoryIcon";
import { auth, db, functions } from "../../../lib/firebase";
import { theme } from "../../../lib/theme";

type Listing = {
  id: string;
  title: string;
  category?: string;
  price?: number;
  pricingType?: "total" | "per_unit";
  unit?: string;
  quantity?: number;
  condition?: string;
  description?: string;
  status?: string;
  photoUrls?: string[];
  photoUrl?: string;
  city?: string;
  state?: string;
  zip?: string;
  lat?: number | null;
  lng?: number | null;
  sellerId?: string;
  isPromoted?: boolean;
  promotionExpiresAt?: any;
};

type SellerInfo = {
  name: string;
  photoUrl: string | null;
  ratingAverage: number | null;
  ratingCount: number | null;
  memberSince: string | null;
};

function formatPrice(l: Listing) {
  const price = Number(l.price ?? 0);
  if (l.pricingType === "per_unit" && l.unit) return `$${price} / ${l.unit}`;
  return `$${price}`;
}

function formatCategory(category?: string) {
  if (category === "livestock") return "Livestock";
  if (category === "produce") return "Produce";
  if (category === "farm_goods") return "Farm Goods";
  if (category === "equipment") return "Equipment";
  return category || "Other";
}

function formatMemberSince(createdAt: any) {
  if (!createdAt) return null;

  const date =
    typeof createdAt?.toDate === "function"
      ? createdAt.toDate()
      : new Date(createdAt);

  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function quantityLabel(quantity?: number) {
  if (quantity == null) return null;
  if (quantity <= 0) return "Sold out";
  if (quantity === 1) return "Only 1 available";
  return `${quantity} available`;
}

export default function ListingDetailScreen() {
  const params = useLocalSearchParams<{ id?: string; from?: string }>();
  const listingId = params.id ? String(params.id) : "";
  const from = params.from ? String(params.from) : null;
  const insets = useSafeAreaInsets();

  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState<Listing | null>(null);

  const [isFav, setIsFav] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [showPromoteOptions, setShowPromoteOptions] = useState(false);

  const [seller, setSeller] = useState<SellerInfo | null>(null);
  const [otherSellerListings, setOtherSellerListings] = useState<Listing[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState<"free" | "pro">("free");
const [monthlyPromotionCredits, setMonthlyPromotionCredits] = useState(0);

  const heartScale = useRef(new Animated.Value(1)).current;

  const animateHeart = () => {
    Animated.sequence([
      Animated.timing(heartScale, {
        toValue: 1.3,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(heartScale, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const activePromotion = useMemo(() => {
    if (!listing?.isPromoted) return false;
    if (!listing?.promotionExpiresAt) return true;

    const expiresAt =
      typeof listing.promotionExpiresAt?.toDate === "function"
        ? listing.promotionExpiresAt.toDate().getTime()
        : listing.promotionExpiresAt?.seconds
          ? listing.promotionExpiresAt.seconds * 1000
          : new Date(listing.promotionExpiresAt).getTime();

    return expiresAt > Date.now();
  }, [listing?.isPromoted, listing?.promotionExpiresAt]);

  const expiredPromotion = useMemo(() => {
  if (!listing?.isPromoted || !listing?.promotionExpiresAt) return false;

  const expiresAt =
    typeof listing.promotionExpiresAt?.toDate === "function"
      ? listing.promotionExpiresAt.toDate().getTime()
      : listing.promotionExpiresAt?.seconds
        ? listing.promotionExpiresAt.seconds * 1000
        : new Date(listing.promotionExpiresAt).getTime();

  return expiresAt <= Date.now();
}, [listing?.isPromoted, listing?.promotionExpiresAt]);

  const promotedUntil = useMemo(() => {
    if (!activePromotion || !listing?.promotionExpiresAt) return null;

    const date =
      typeof listing.promotionExpiresAt?.toDate === "function"
        ? listing.promotionExpiresAt.toDate()
        : new Date(listing.promotionExpiresAt);

    if (Number.isNaN(date.getTime())) return null;

    return date.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
    });
  }, [activePromotion, listing?.promotionExpiresAt]);

  const promotionDaysLeft = useMemo(() => {
  if (!activePromotion || !listing?.promotionExpiresAt) return null;

  const expiresAt =
    typeof listing.promotionExpiresAt?.toDate === "function"
      ? listing.promotionExpiresAt.toDate().getTime()
      : listing.promotionExpiresAt?.seconds
        ? listing.promotionExpiresAt.seconds * 1000
        : new Date(listing.promotionExpiresAt).getTime();

  const diff = expiresAt - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days <= 0) return null;

  return days;
}, [activePromotion, listing?.promotionExpiresAt]);

const canUseFreePromotion =
  subscriptionStatus === "pro" && monthlyPromotionCredits > 0;

  useEffect(() => {
    if (!listingId) return;

    const ref = doc(db, "listings", listingId);

    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setListing(null);
        setLoading(false);
        return;
      }

      const d: any = snap.data();

      setListing({
        id: snap.id,
        title: d.title ?? "",
        category: d.category ?? "",
        price: Number(d.price ?? 0),
        pricingType: d.pricingType ?? "total",
        unit: d.unit ?? "",
        quantity: typeof d.quantity === "number" ? d.quantity : undefined,
        condition: d.condition ?? "",
        description: d.description ?? "",
        status: d.status ?? "active",
        photoUrls: Array.isArray(d.photoUrls) ? d.photoUrls : [],
        city: d.city ?? "",
        state: d.state ?? "",
        zip: d.zip ?? "",
        lat: d.lat ?? null,
        lng: d.lng ?? null,
        sellerId: d.sellerId ?? "",
        isPromoted: d.isPromoted === true,
        promotionExpiresAt: d.promotionExpiresAt ?? null,
      });

      setLoading(false);
    });

    return () => unsub();
  }, [listingId]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUserId(u?.uid ?? null);
    });

    return unsub;
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !listingId) {
      setIsFav(false);
      return;
    }

    const favRef = doc(db, "users", user.uid, "favorites", listingId);

    const unsub = onSnapshot(favRef, (snap) => {
      setIsFav(snap.exists());
    });

    return () => unsub();
  }, [listingId, userId]);

  useEffect(() => {
  const user = auth.currentUser;
  if (!user) {
    setSubscriptionStatus("free");
    setMonthlyPromotionCredits(0);
    return;
  }

  const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
    const data: any = snap.data() ?? {};
    setSubscriptionStatus(data.subscriptionStatus === "pro" ? "pro" : "free");
    setMonthlyPromotionCredits(
      typeof data.monthlyPromotionCredits === "number"
        ? data.monthlyPromotionCredits
        : 0
    );
  });

  return () => unsub();
}, [userId]);

  useEffect(() => {
    const loadSeller = async () => {
      if (!listing?.sellerId) {
        setSeller(null);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", listing.sellerId));
        if (!snap.exists()) {
          setSeller(null);
          return;
        }

        const data: any = snap.data();

        setSeller({
          name:
            (data.displayName ?? data.name ?? "Seller").toString().trim() || "Seller",
          photoUrl:
            typeof data.photoUrl === "string" && data.photoUrl.length > 0
              ? data.photoUrl
              : null,
          ratingAverage:
            typeof data.ratingAverage === "number" ? data.ratingAverage : null,
          ratingCount:
            typeof data.ratingCount === "number" ? data.ratingCount : null,
          memberSince: formatMemberSince(data.createdAt),
        });
      } catch (e) {
        console.log("loadSeller error:", e);
        setSeller(null);
      }
    };

    loadSeller();
  }, [listing?.sellerId]);

  useEffect(() => {
    if (!listing?.sellerId) {
      setOtherSellerListings([]);
      return;
    }

    const q = query(
      collection(db, "listings"),
      where("sellerId", "==", listing.sellerId),
      where("status", "==", "active")
    );

    const unsub = onSnapshot(q, (snap) => {
      const rows: Listing[] = snap.docs
        .map((d) => {
          const data: any = d.data();
          return {
            id: d.id,
            title: data.title ?? "",
            category: data.category ?? "",
            price: Number(data.price ?? 0),
            pricingType: data.pricingType ?? "total",
            unit: data.unit ?? "",
            photoUrls: Array.isArray(data.photoUrls) ? data.photoUrls : [],
          };
        })
        .filter((item) => item.id !== listingId)
        .slice(0, 2);

      setOtherSellerListings(rows);
    });

    return () => unsub();
  }, [listing?.sellerId, listingId]);

const useFreePromotion = async () => {
  try {
    const user = auth.currentUser;
    if (!user || !listing?.id) return;

    if (user.uid !== listing?.sellerId) {
      Alert.alert("Not allowed");
      return;
    }

    setPromoting(true);
    setShowPromoteOptions(false);

    const useCredit = httpsCallable(functions, "usePromotionCredit");

    await useCredit({
      listingId: listing.id,
    });

    Alert.alert(
      "Free Promotion Used 🎉",
      "Your free monthly 7-day promotion has been applied."
    );
  } catch (e: any) {
    console.log("useFreePromotion error:", e);

    if (e.message?.includes("No promotion credits")) {
  Alert.alert(
    "No free promotion left",
    "You’ve used your free monthly promotion. Choose a paid promotion below."
  );
} else {
  Alert.alert("Error", "Could not apply free promotion.");
}
  } finally {
    setPromoting(false);
  }
};

  const promoteListing = async (days: number, price: string, amount: number) => {
  Alert.alert(
    "Confirm Promotion",
    `Pay ${price} to promote this listing for ${days} days?`,
    [
      { text: "Cancel", style: "cancel" },
      {
        text: `Pay ${price}`,
        onPress: async () => {
          try {
            if (!listing?.id) return;

            setPromoting(true);

            const user = auth.currentUser;
if (!user) {
  Alert.alert("Login required");
  return;
}

// 🔥 Force fresh auth token
await user.getIdToken(true);

const createPayment = httpsCallable(functions, "createPromotionPayment");

            const res: any = await createPayment({
              listingId: listing.id,
              days,
              amount, // cents
            });

            const clientSecret = res.data.clientSecret;

            const init = await initPaymentSheet({
              paymentIntentClientSecret: clientSecret,
              merchantDisplayName: "FarmTrade",
            });

            if (init.error) {
              Alert.alert("Error", "Could not initialize payment.");
              return;
            }

            const payment = await presentPaymentSheet();

            if (payment.error) {
              Alert.alert("Payment canceled");
              return;
            }

            // ✅ SUCCESS → promote listing
            const applyPaidPromotion = httpsCallable(functions, "applyPaidPromotion");

await user.getIdToken(true);

await applyPaidPromotion({
  listingId: listing.id,
  days,
});

            Alert.alert("Success 🎉", "Your listing is now promoted!");
          } catch (e) {
            console.log("promotion payment error:", e);
            Alert.alert("Error", "Could not complete promotion.");
          } finally {
            setPromoting(false);
            setShowPromoteOptions(false);
          }
        },
      },
    ]
  );
};

  const toggleFavorite = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert("Login required", "Please log in to save listings.");
        return;
      }

      if (!listing) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      animateHeart();

      const favRef = doc(db, "users", user.uid, "favorites", listing.id);

      if (isFav) {
        await deleteDoc(favRef);
        return;
      }

      await setDoc(
        favRef,
        {
          createdAt: serverTimestamp(),
          listingId: listing.id,
          title: listing.title ?? "",
          price: Number(listing.price ?? 0),
          pricingType: listing.pricingType ?? "total",
          unit: listing.unit ?? "",
          category: listing.category ?? "",
          photoUrl: listing.photoUrls?.[0] ?? "",
          city: listing.city ?? "",
          state: listing.state ?? "",
          lat: listing.lat ?? null,
          lng: listing.lng ?? null,
        },
        { merge: true }
      );
    } catch (e) {
      console.log("toggleFavorite error:", e);
      Alert.alert("Error", "Could not update saved listing.");
    }
  };

  const handleBack = () => {
    if (from === "profile") {
      router.replace("/(tabs)/profile");
      return;
    }

    if (from === "my-listings") {
      router.replace("/(tabs)/my-listings");
      return;
    }

    router.back();
  };

  const messageSeller = async () => {
    try {
      const user = auth.currentUser;

      if (!user) {
        Alert.alert("Login required", "Please log in to message sellers.");
        return;
      }

      if (!listing?.sellerId || !listing?.id) return;

      if (user.uid === listing.sellerId) {
        Alert.alert("Not available", "You can’t message your own listing.");
        return;
      }

      await reload(user);
      await getIdToken(user, true);

      if (!auth.currentUser?.emailVerified) {
        try {
          setSendingVerification(true);
          await sendEmailVerification(user);

          Alert.alert(
            "Verify email",
            "Please verify your email, then come back and try again."
          );
        } catch {
          Alert.alert("Could not send email");
        } finally {
          setSendingVerification(false);
        }

        return;
      }

      const buyerId = user.uid;
      const sellerId = listing.sellerId;
      const conversationId = `${listing.id}_${buyerId}_${sellerId}`;

      const convRef = doc(db, "conversations", conversationId);

      await setDoc(
        convRef,
        {
          listingId: listing.id,
          buyerId,
          sellerId,
          participantIds: [buyerId, sellerId],
          listingTitle: listing.title ?? "",
          listingPhotoUrl: listing.photoUrls?.[0] ?? "",
          listingPrice: Number(listing.price ?? 0),
          listingPricingType: listing.pricingType ?? "total",
          listingUnit: listing.unit ?? "",
          lastMessageText: "",
          lastMessageAt: serverTimestamp(),
          lastMessageSenderId: "",
          unreadCount: { [buyerId]: 0, [sellerId]: 0 },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      router.push({
        pathname: "/(tabs)/messages/[id]",
        params: { id: conversationId },
      });
    } catch (e) {
      console.log("messageSeller error:", e);
      Alert.alert("Error", "Could not open conversation.");
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={styles.center}>
        <Text>Listing not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Pressable
  onPress={handleBack}
  style={[
    styles.backButton,
    { top: insets.top + 10 },
  ]}
>
  <Ionicons name="arrow-back" size={18} color={theme.colors.text} />
  <Text style={styles.backButtonText}>Back</Text>
</Pressable>

        <ListingPhotoCarousel photos={listing.photoUrls ?? []} />

        <View style={styles.section}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{listing.title}</Text>
            <Text style={styles.price}>{formatPrice(listing)}</Text>
          </View>

          <Text style={styles.meta}>
            {listing.city}, {listing.state}
          </Text>

          <View style={styles.pillRow}>
            <View style={styles.infoPill}>
              <Text style={styles.infoPillText}>
                {getCategoryEmoji(listing.category)} {formatCategory(listing.category)}
              </Text>
            </View>

            {!!listing.status && (
              <View style={styles.infoPill}>
                <Text style={styles.infoPillText}>
                  {listing.status === "active" ? "Active" : listing.status}
                </Text>
              </View>
            )}

            {!!quantityLabel(listing.quantity) && (
              <View style={styles.infoPill}>
                <Text style={styles.infoPillText}>
                  {quantityLabel(listing.quantity)}
                </Text>
              </View>
            )}

            {activePromotion && (
  <View style={styles.promotedBadge}>
    <Text style={styles.promotedText}>
      Promoted • {promotionDaysLeft ? `${promotionDaysLeft} day${promotionDaysLeft === 1 ? "" : "s"} left` : "Active"}
    </Text>
  </View>
)}
{userId === listing.sellerId && expiredPromotion && (
  <Pressable
    style={styles.expiredPromotionBanner}
    onPress={() => setShowPromoteOptions(true)}
  >
    <Text style={styles.expiredPromotionTitle}>
      🚀 Your promotion has ended
    </Text>
    <Text style={styles.expiredPromotionText}>
      Promote again to move this listing back toward the top.
    </Text>
  </Pressable>
)}
          </View>

          {listing.description ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Description</Text>
              <Text style={styles.description}>{listing.description}</Text>
            </View>
          ) : null}

          {seller && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Seller</Text>

              <Pressable
                style={styles.sellerRow}
                onPress={() =>
                  router.push({
  pathname: "/public-profile/[uid]",
  params: { uid: listing.sellerId ?? "" },
})
                }
              >
                <View style={styles.avatar}>
                  {seller.photoUrl ? (
                    <Image source={{ uri: seller.photoUrl }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarInitial}>
                      {(seller.name.trim()?.[0] || "S").toUpperCase()}
                    </Text>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.sellerName}>{seller.name}</Text>

                  <View style={{ marginTop: 4 }}>
                    <RatingStars
                      rating={seller.ratingAverage}
                      count={seller.ratingCount}
                      size={14}
                      showTopRatedBadge
                    />
                  </View>

               {seller.memberSince ? (
  <Text style={styles.sellerMeta}>Member since {seller.memberSince}</Text>
) : null}
</View>

<Ionicons name="chevron-forward" size={18} color={theme.colors.subtext} />
</Pressable>   
            </View>
          )}

          {otherSellerListings.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>More from this seller</Text>

              <View style={styles.moreRow}>
                {otherSellerListings.map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.moreCard}
                    onPress={() =>
                      router.push({
                        pathname: "/(tabs)/listing/[id]",
                        params: { id: item.id },
                      })
                    }
                  >
                    {item.photoUrls?.[0] ? (
                      <Image source={{ uri: item.photoUrls[0] }} style={styles.moreImage} />
                    ) : (
                      <View style={[styles.moreImage, styles.morePlaceholder]} />
                    )}

                    <Text style={styles.moreTitle} numberOfLines={1}>
                      {item.title}
                    </Text>

                    <Text style={styles.morePrice} numberOfLines={1}>
                      {formatPrice(item)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable style={styles.saveBtn} onPress={toggleFavorite}>
          <Animated.View style={{ transform: [{ scale: heartScale }] }}>
            <Ionicons
              name={isFav ? "heart" : "heart-outline"}
              size={20}
              color={isFav ? "#e11d48" : "#111"}
            />
          </Animated.View>
          <Text>{isFav ? "Saved" : "Save"}</Text>
        </Pressable>

        {userId === listing.sellerId ? (
          <Pressable
            style={[
              styles.promoteBtn,
              activePromotion && { backgroundColor: "#166534" },
            ]}
            onPress={() => setShowPromoteOptions(true)}
            disabled={promoting}
          >
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 14 }}>
              {promoting
  ? "Promoting..."
  : activePromotion
    ? "Upgrade Promotion"
    : listing.isPromoted
      ? "Promote Again"
      : "Promote 🚀"}
            </Text>
          </Pressable>
        ) : (
          <Pressable style={styles.messageBtn} onPress={messageSeller}>
            <Text style={{ color: "#fff", fontWeight: "900" }}>
              Message Seller
            </Text>
          </Pressable>
        )}
      </View>

      {showPromoteOptions && (
        <View style={styles.promoteOverlay}>
          <View style={styles.promoteCard}>
            <Text style={styles.promoteTitle}>Promote your listing 🚀</Text>
            <Text style={styles.promoteSubtitle}>
              Choose how long you want to boost this listing.
            </Text>

            {activePromotion && promotedUntil ? (
              <View style={styles.promoteCurrentBadge}>
                <Text style={styles.promoteCurrentBadgeText}>
                  Currently promoted until {promotedUntil}
                </Text>
              </View>
            ) : null}

            {canUseFreePromotion && (
  <Pressable
  style={styles.promoteFreeOption}
  onPress={() => {
    Alert.alert(
      "Use Free Promotion?",
      "Use your one free promotion for the month to promote this listing for 7 days?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Use Promotion",
          onPress: useFreePromotion,
        },
      ]
    );
  }}
  disabled={promoting}
>
  <Text style={styles.promoteFreeTitle}>Use Free Monthly Promotion</Text>
  <Text style={styles.promoteFreeSubtitle}>
    7 days • {monthlyPromotionCredits} credit
    {monthlyPromotionCredits === 1 ? "" : "s"} remaining
  </Text>
</Pressable>
)}

            <Pressable
              style={styles.promoteOption}
              onPress={() => promoteListing(7, "$4.99", 499)}
              disabled={promoting}
            >
              <Text style={styles.promoteOptionTitle}>7 days</Text>
              <Text style={styles.promoteOptionPrice}>$4.99</Text>
            </Pressable>

            <Pressable
              style={styles.promoteOption}
              onPress={() => promoteListing(14, "$7.99", 799)}
              disabled={promoting}
            >
              <Text style={styles.promoteOptionTitle}>14 days</Text>
              <Text style={styles.promoteOptionPrice}>$7.99</Text>
            </Pressable>

            <Pressable
              style={styles.promoteOption}
              onPress={() => promoteListing(30, "$11.99", 1199)}
              disabled={promoting}
            >
              <Text style={styles.promoteOptionTitle}>30 days</Text>
              <Text style={styles.promoteOptionPrice}>$11.99</Text>
            </Pressable>

            <Pressable
              style={styles.promoteCancel}
              onPress={() => setShowPromoteOptions(false)}
              disabled={promoting}
            >
              <Text style={styles.promoteCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    position: "absolute",
    left: 16,
    zIndex: 20,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  backButtonText: {
    fontWeight: "900",
  },

  section: {
    padding: 16,
  },

  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },

  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: "900",
  },

  price: {
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },

  meta: {
    marginTop: 6,
    color: "#5f6f64",
    fontWeight: "700",
  },

  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },

  infoPill: {
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  infoPillText: {
    fontWeight: "800",
    color: theme.colors.text,
    fontSize: 12,
  },

  card: {
  marginTop: 14,
  backgroundColor: theme.colors.surface,
  borderWidth: 1,
  borderColor: theme.colors.border,
  borderRadius: 18,
  padding: 14,
},

  cardTitle: {
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 10,
    color: theme.colors.text
  },

  description: {
    fontWeight: "600",
    lineHeight: 20,
    color: theme.colors.subtext
  },

  sellerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: theme.colors.avatarBg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  avatarImage: {
    width: "100%",
    height: "100%",
  },

  avatarInitial: {
    fontWeight: "900",
    fontSize: 18,
    color: theme.colors.slate700
  },

  sellerName: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.colors.text
  },

  sellerMeta: {
    marginTop: 4,
    color: theme.colors.subtext,
    fontWeight: "700",
  },

  moreRow: {
    flexDirection: "row",
    gap: 10,
  },

  moreCard: {
    flex: 1,
  },

  moreImage: {
    width: "100%",
    height: 110,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
    marginBottom: 8,
  },

  morePlaceholder: {
    backgroundColor: "#E5E7EB",
  },

  moreTitle: {
    fontWeight: "800",
    color: theme.colors.text,
  },

  morePrice: {
    marginTop: 4,
    fontWeight: "900",
    color: theme.colors.brand,
  },

  promotedBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#FCD34D",
  },

  promotedText: {
    fontWeight: "900",
    color: "#92400E",
    fontSize: 12,
  },

  bottomBar: {
  position: "absolute",
  bottom: 0,
  left: 0,
  right: 0,
  flexDirection: "row",
  paddingHorizontal: 12,
  paddingVertical: 8,
  gap: 8,
  backgroundColor: theme.colors.backgroundTint,
},

  saveBtn: {
  flex: 1,
  backgroundColor: theme.colors.surface,
  paddingVertical: 10,
  borderRadius: theme.radius.pill,
  alignItems: "center",
  justifyContent: "center",
  gap: 2,
  borderWidth: 1,
  borderColor: theme.colors.border,
},

  promoteBtn: {
  flex: 1,
  backgroundColor: theme.colors.brand,
  paddingVertical: 10,
  borderRadius: theme.radius.pill,
  alignItems: "center",
  justifyContent: "center",
},

messageBtn: {
  flex: 1,
  backgroundColor: theme.colors.brand,
  paddingVertical: 10,
  borderRadius: theme.radius.pill,
  alignItems: "center",
  justifyContent: "center",
},

screen: {
  flex: 1,
  backgroundColor: theme.colors.backgroundTint,
},

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  promoteOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  promoteCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    padding: 18,
  },

  promoteTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.colors.text,
  },

  promoteSubtitle: {
    marginTop: 6,
    marginBottom: 14,
    color: "#64748B",
    fontWeight: "600",
    lineHeight: 20,
  },

  promoteOption: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    backgroundColor: theme.colors.surface2,
  },

  promoteOptionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.colors.text,
  },

  promoteOptionPrice: {
    marginTop: 4,
    fontWeight: "800",
    color: "#166534",
  },

  promoteCancel: {
    marginTop: 4,
    paddingVertical: 12,
    alignItems: "center",
  },

  promoteCancelText: {
    fontWeight: "800",
    color: "#64748B",
  },

  promoteCurrentBadge: {
    alignSelf: "flex-start",
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#ECFCCB",
    borderWidth: 1,
    borderColor: "#BEF264",
  },

  promoteCurrentBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#3F6212",
  },

  promoteFreeOption: {
  borderWidth: 1,
  borderColor: "#BBF7D0",
  borderRadius: 14,
  paddingVertical: 14,
  paddingHorizontal: 14,
  marginBottom: 10,
  backgroundColor: "#F0FDF4",
},

promoteFreeTitle: {
  fontSize: 16,
  fontWeight: "900",
  color: theme.colors.brand,
},

promoteFreeSubtitle: {
  marginTop: 4,
  fontWeight: "700",
  color: theme.colors.subtext,
},

expiredPromotionBanner: {
  width: "100%",
  marginTop: 10,
  backgroundColor: "#FFF7ED",
  borderWidth: 1,
  borderColor: "#FDBA74",
  borderRadius: 16,
  padding: 12,
},

expiredPromotionTitle: {
  fontWeight: "900",
  color: "#9A3412",
  fontSize: 14,
},

expiredPromotionText: {
  marginTop: 4,
  fontWeight: "700",
  color: "#92400E",
  lineHeight: 18,
},
});