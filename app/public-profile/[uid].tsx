import { router, useLocalSearchParams } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import RatingStars from "../../components/ui/RatingStars";
import { auth, db } from "../../lib/firebase";

type PublicUser = {
  displayName?: string;
  bio?: string;
  photoUrl?: string | null;
  createdAt?: any;
  ratingAverage?: number | null;
  ratingCount?: number | null;
};

type Listing = {
  id: string;
  title?: string;
  photoUrl?: string;
  price?: number;
  pricingType?: "total" | "per_unit";
  unit?: string;
  status?: string;
};

type Review = {
  id: string;
  sellerId?: string;
  buyerId?: string;
  conversationId?: string;
  listingId?: string;
  rating?: number;
  reviewText?: string;
  sellerResponse?: string;
  sellerResponseAt?: any;
  createdAt?: any;
  updatedAt?: any;
};

function toMillis(ts: any): number {
  if (!ts) return 0;
  if (typeof ts?.toMillis === "function") return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === "number") return ts;
  return 0;
}

function formatMemberSince(createdAt: any) {
  const ms = toMillis(createdAt);
  if (!ms) return null;
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long" });
}

function formatReviewDate(ts: any) {
  const ms = toMillis(ts);
  if (!ms) return "";
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPrice(l: Listing) {
  const p = Number(l.price ?? 0);
  if (!p) return "";
  if (l.pricingType === "per_unit" && l.unit) return `$${p} / ${l.unit}`;
  return `$${p}`;
}

function wasResponseEdited(review: Review) {
  const responseMs = toMillis(review.sellerResponseAt);
  const updatedMs = toMillis(review.updatedAt);
  if (!responseMs || !updatedMs) return false;
  return updatedMs - responseMs > 1000;
}

export default function PublicProfileModal() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const insets = useSafeAreaInsets();

  const currentUid = auth.currentUser?.uid ?? null;
  const isMyProfile = !!currentUid && !!uid && currentUid === uid;

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewerNames, setReviewerNames] = useState<Record<string, string>>({});

  const [respondingToId, setRespondingToId] = useState<string | null>(null);
  const [responseDrafts, setResponseDrafts] = useState<Record<string, string>>({});
  const [savingResponseId, setSavingResponseId] = useState<string | null>(null);
const [expandedReviews, setExpandedReviews] = useState<Record<string, boolean>>({});

  const memberSince = useMemo(() => formatMemberSince(user?.createdAt), [user]);
  const activeCount = listings.length;

  useEffect(() => {
    (async () => {
      try {
        if (!uid) return;
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) {
          const data: any = snap.data();
          setUser({
            displayName: (data.displayName ?? "").toString(),
            bio: (data.bio ?? "").toString(),
            photoUrl: data.photoUrl ?? null,
            createdAt: data.createdAt ?? null,
            ratingAverage:
              typeof data.ratingAverage === "number" ? data.ratingAverage : null,
            ratingCount:
              typeof data.ratingCount === "number" ? data.ratingCount : null,
          });
        } else {
          setUser({
            displayName: "User",
            bio: "",
            photoUrl: null,
            createdAt: null,
            ratingAverage: null,
            ratingCount: null,
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  useEffect(() => {
    if (!uid) return;

    const q = query(
      collection(db, "listings"),
      where("sellerId", "==", uid),
      where("status", "==", "active"),
      limit(50)
    );

    const unsub = onSnapshot(q, (snap) => {
      const rows: Listing[] = snap.docs.map((d) => {
        const data: any = d.data();
        const photoUrl =
          data.photoUrl ||
          (Array.isArray(data.photoUrls) ? data.photoUrls[0] : null) ||
          "";

        return {
          id: d.id,
          title: data.title ?? "Listing",
          photoUrl: photoUrl || "",
          price: Number(data.price ?? 0),
          pricingType: data.pricingType ?? "total",
          unit: data.unit ?? "",
          status: data.status ?? "active",
        };
      });

      setListings(rows);
    });

    return () => unsub();
  }, [uid]);

  useEffect(() => {
    if (!uid) return;

    const q = query(
      collection(db, "users", uid, "reviews"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsub = onSnapshot(q, (snap) => {
      const rows: Review[] = snap.docs.map((d) => {
        const data: any = d.data();
        return {
          id: d.id,
          sellerId: data.sellerId ?? "",
          buyerId: data.buyerId ?? "",
          conversationId: data.conversationId ?? "",
          listingId: data.listingId ?? "",
          rating: Number(data.rating ?? 0),
          reviewText: (data.reviewText ?? "").toString(),
          sellerResponse: (data.sellerResponse ?? "").toString(),
          sellerResponseAt: data.sellerResponseAt ?? null,
          createdAt: data.createdAt ?? null,
          updatedAt: data.updatedAt ?? null,
        };
      });

      setReviews(rows);

      setResponseDrafts((prev) => {
        const next = { ...prev };
        rows.forEach((r) => {
          if (typeof next[r.id] === "undefined") {
            next[r.id] = r.sellerResponse ?? "";
          }
        });
        return next;
      });
    });

    return () => unsub();
  }, [uid]);

  useEffect(() => {
    const loadReviewerNames = async () => {
      const ids = Array.from(
        new Set(
          reviews
            .map((r) => r.buyerId)
            .filter((id): id is string => typeof id === "string" && !!id)
        )
      );

      if (ids.length === 0) return;

      const updates: Record<string, string> = {};

      await Promise.all(
        ids.map(async (buyerId) => {
          if (reviewerNames[buyerId]) return;

          try {
            const snap = await getDoc(doc(db, "users", buyerId));
            const data: any = snap.exists() ? snap.data() : null;
            updates[buyerId] =
              (data?.displayName || data?.name || "").toString().trim() || "Buyer";
          } catch (e) {
            console.log("Load reviewer name error:", e);
            updates[buyerId] = "Buyer";
          }
        })
      );

      if (Object.keys(updates).length > 0) {
        setReviewerNames((prev) => ({ ...prev, ...updates }));
      }
    };

    loadReviewerNames();
  }, [reviews, reviewerNames]);

  const saveSellerResponse = async (review: Review) => {
    if (!uid || !review.id) return;

    const text = (responseDrafts[review.id] ?? "").trim();
    if (!text) return;

    try {
      setSavingResponseId(review.id);

      await updateDoc(doc(db, "users", uid, "reviews", review.id), {
        sellerResponse: text,
        sellerResponseAt: new Date(),
        updatedAt: new Date(),
      });

      setRespondingToId(null);
    } catch (e: any) {
      console.log("Save seller response error:", e?.message ?? e);
    } finally {
      setSavingResponseId(null);
    }
  };

  if (loading || !user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  const displayName = user.displayName?.trim() ? user.displayName : "User";
  const initial = displayName[0]?.toUpperCase() || "U";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={90}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View
            style={{
              flex: 1,
              backgroundColor: "#F9FAFB",
              paddingHorizontal: 16,
              paddingTop: Math.max(insets.top, 8),
            }}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={{ gap: 12 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 22, fontWeight: "900" }}>Public Profile</Text>

                  <Pressable
                    onPress={() => router.back()}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      backgroundColor: "#111827",
                    }}
                  >
                    <Text style={{ color: "white", fontWeight: "900" }}>Done</Text>
                  </Pressable>
                </View>

                <View
                  style={{
                    backgroundColor: "white",
                    borderRadius: 16,
                    padding: 16,
                    gap: 10,
                  }}
                >
                  <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                    <View
                      style={{
                        width: 86,
                        height: 86,
                        borderRadius: 43,
                        overflow: "hidden",
                        backgroundColor: "#E5E7EB",
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 2,
                        borderColor: "#16A34A",
                      }}
                    >
                      {user.photoUrl ? (
                        <Image
                          source={{ uri: user.photoUrl }}
                          style={{ width: "100%", height: "100%" }}
                        />
                      ) : (
                        <Text style={{ fontSize: 26, fontWeight: "900" }}>{initial}</Text>
                      )}
                    </View>

                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontSize: 20, fontWeight: "900" }}>
                        {displayName}
                      </Text>

                      <RatingStars
                        rating={user.ratingAverage}
                        count={user.ratingCount}
                        size={14}
                        showTopRatedBadge
                      />

                      <Text style={{ color: "#64748b", fontWeight: "700" }}>
                        {memberSince ? `Member since ${memberSince}` : "Member since unknown"}
                      </Text>

                      {!!user.bio && (
                        <Text
                          numberOfLines={3}
                          style={{
                            color: "#475569",
                            fontWeight: "600",
                            lineHeight: 20,
                            marginTop: 6,
                          }}
                        >
                          {user.bio}
                        </Text>
                      )}

                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <View
                          style={{
                            paddingVertical: 6,
                            paddingHorizontal: 10,
                            borderRadius: 999,
                            backgroundColor: "#DCFCE7",
                          }}
                        >
                          <Text style={{ color: "#166534", fontWeight: "900" }}>
                            {activeCount} active {activeCount === 1 ? "listing" : "listings"}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>

                <Text style={{ fontSize: 16, fontWeight: "900" }}>Reviews</Text>

                {reviews.length === 0 ? (
                  <View
                    style={{
                      backgroundColor: "white",
                      borderRadius: 14,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: "#E5E7EB",
                    }}
                  >
                    <Text
                      style={{
                        color: "#111827",
                        fontWeight: "900",
                        fontSize: 15,
                        marginBottom: 4,
                      }}
                    >
                      No reviews yet
                    </Text>
                    <Text style={{ color: "#64748b", fontWeight: "600", lineHeight: 20 }}>
                      This seller has not received any reviews yet.
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 12 }}>
                    {reviews.map((item) => {
  const reviewerName = reviewerNames[item.buyerId ?? ""] || "Buyer";
  const isResponding = respondingToId === item.id;
  const hasSellerResponse = !!item.sellerResponse?.trim();
  const responseEdited = wasResponseEdited(item);

  const reviewText = item.reviewText?.trim() ?? "";
  const isExpanded = !!expandedReviews[item.id];
  const isLongReview = reviewText.length > 180;

                      return (
                        <View
                          key={item.id}
                          style={{
                            backgroundColor: "white",
                            borderRadius: 16,
                            padding: 14,
                            borderWidth: 1,
                            borderColor: "#E5E7EB",
                            gap: 10,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              gap: 12,
                            }}
                          >
                            <View style={{ flex: 1, gap: 4 }}>
                              <Text
                                style={{
                                  fontWeight: "900",
                                  color: "#111827",
                                  fontSize: 15,
                                }}
                              >
                                {reviewerName}
                              </Text>

                              <Text
                                style={{
                                  color: "#64748b",
                                  fontWeight: "700",
                                  fontSize: 12,
                                }}
                              >
                                {formatReviewDate(item.updatedAt || item.createdAt)}
                              </Text>
                            </View>

                            <View
                              style={{
                                paddingHorizontal: 10,
                                paddingVertical: 5,
                                borderRadius: 999,
                                backgroundColor: "#DCFCE7",
                                borderWidth: 1,
                                borderColor: "#BBF7D0",
                                alignSelf: "flex-start",
                              }}
                            >
                              <Text
                                style={{
                                  color: "#166534",
                                  fontWeight: "900",
                                  fontSize: 11,
                                }}
                              >
                                Verified Purchase
                              </Text>
                            </View>
                          </View>

                          <View>
                            <RatingStars rating={item.rating} count={null} size={13} />
                          </View>

                          {!!reviewText && (
  <View style={{ gap: 6 }}>
    <Text
      numberOfLines={isLongReview && !isExpanded ? 4 : undefined}
      style={{
        color: "#374151",
        fontWeight: "600",
        lineHeight: 22,
      }}
    >
      {reviewText}
    </Text>

    {isLongReview && (
      <Pressable
        onPress={() =>
          setExpandedReviews((prev) => ({
            ...prev,
            [item.id]: !prev[item.id],
          }))
        }
        hitSlop={8}
      >
        <Text
          style={{
            color: "#166534",
            fontWeight: "900",
            fontSize: 13,
          }}
        >
          {isExpanded ? "Show less" : "Read more"}
        </Text>
      </Pressable>
    )}
  </View>
)}

                          {hasSellerResponse && !isResponding && (
                            <View
                              style={{
                                padding: 12,
                                borderRadius: 12,
                                backgroundColor: "#F0FDF4",
                                borderWidth: 1,
                                borderColor: "#BBF7D0",
                                gap: 6,
                              }}
                            >
                              <View
                                style={{
                                  flexDirection: "row",
                                  flexWrap: "wrap",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                <Text
                                  style={{
                                    fontWeight: "900",
                                    color: "#166534",
                                  }}
                                >
                                  Seller response
                                </Text>

                                {!!item.sellerResponseAt && (
                                  <Text
                                    style={{
                                      color: "#15803D",
                                      fontWeight: "700",
                                      fontSize: 12,
                                    }}
                                  >
                                    {formatReviewDate(item.sellerResponseAt)}
                                  </Text>
                                )}

                                {responseEdited && (
                                  <View
                                    style={{
                                      paddingHorizontal: 8,
                                      paddingVertical: 2,
                                      borderRadius: 999,
                                      backgroundColor: "#DCFCE7",
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color: "#166534",
                                        fontWeight: "900",
                                        fontSize: 11,
                                      }}
                                    >
                                      Edited
                                    </Text>
                                  </View>
                                )}
                              </View>

                              <Text
                                style={{
                                  color: "#166534",
                                  fontWeight: "600",
                                  lineHeight: 21,
                                }}
                              >
                                {item.sellerResponse}
                              </Text>
                            </View>
                          )}

                          {isMyProfile && !hasSellerResponse && !isResponding && (
                            <Pressable onPress={() => setRespondingToId(item.id)}>
                              <Text style={{ color: "#166534", fontWeight: "900" }}>
                                Write Seller Response
                              </Text>
                            </Pressable>
                          )}

                          {isMyProfile && hasSellerResponse && !isResponding && (
                            <Pressable
                              onPress={() => {
                                setResponseDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: item.sellerResponse ?? "",
                                }));
                                setRespondingToId(item.id);
                              }}
                            >
                              <Text style={{ color: "#166534", fontWeight: "900" }}>
                                Edit Seller Response
                              </Text>
                            </Pressable>
                          )}

                          {isMyProfile && isResponding && (
                            <View style={{ gap: 10 }}>
                              <TextInput
                                value={responseDrafts[item.id] ?? ""}
                                onChangeText={(value) =>
                                  setResponseDrafts((prev) => ({
                                    ...prev,
                                    [item.id]: value,
                                  }))
                                }
                                placeholder="Write a response..."
                                multiline
                                textAlignVertical="top"
                                style={{
                                  minHeight: 90,
                                  borderWidth: 1,
                                  borderColor: "#D1D5DB",
                                  borderRadius: 12,
                                  padding: 12,
                                  backgroundColor: "#F9FAFB",
                                  color: "#111827",
                                }}
                              />

                              <View
                                style={{
                                  flexDirection: "row",
                                  gap: 10,
                                }}
                              >
                                <Pressable
                                  onPress={() => setRespondingToId(null)}
                                  style={{
                                    flex: 1,
                                    paddingVertical: 12,
                                    borderRadius: 12,
                                    backgroundColor: "#E5E7EB",
                                    alignItems: "center",
                                  }}
                                >
                                  <Text style={{ fontWeight: "900", color: "#111827" }}>
                                    Cancel
                                  </Text>
                                </Pressable>

                                <Pressable
                                  onPress={() => saveSellerResponse(item)}
                                  disabled={savingResponseId === item.id}
                                  style={{
                                    flex: 1,
                                    paddingVertical: 12,
                                    borderRadius: 12,
                                    backgroundColor: "#166534",
                                    alignItems: "center",
                                    opacity: savingResponseId === item.id ? 0.7 : 1,
                                  }}
                                >
                                  <Text style={{ fontWeight: "900", color: "#fff" }}>
                                    {savingResponseId === item.id ? "Saving..." : "Save Response"}
                                  </Text>
                                </Pressable>
                              </View>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                <Text style={{ fontSize: 16, fontWeight: "900", marginTop: 4 }}>
                  Active Listings
                </Text>

                <FlatList
                  data={listings}
                  keyExtractor={(it) => it.id}
                  scrollEnabled={false}
                  contentContainerStyle={{ paddingBottom: 16 }}
                  ListEmptyComponent={
                    <Text style={{ color: "#64748b", fontWeight: "700" }}>
                      No active listings right now.
                    </Text>
                  }
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: "/(tabs)/listing/[id]",
                          params: { id: item.id },
                        })
                      }
                      style={{
                        backgroundColor: "white",
                        borderRadius: 14,
                        padding: 12,
                        marginBottom: 10,
                        flexDirection: "row",
                        gap: 12,
                        alignItems: "center",
                      }}
                    >
                      <View
                        style={{
                          width: 54,
                          height: 54,
                          borderRadius: 12,
                          overflow: "hidden",
                          backgroundColor: "#E5E7EB",
                        }}
                      >
                        {!!item.photoUrl ? (
                          <Image
                            source={{ uri: item.photoUrl }}
                            style={{ width: "100%", height: "100%" }}
                          />
                        ) : null}
                      </View>

                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={{ fontWeight: "900" }} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={{ color: "#64748b", fontWeight: "800" }}>
                          {formatPrice(item)}
                        </Text>
                      </View>
                    </Pressable>
                  )}
                />
              </View>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}