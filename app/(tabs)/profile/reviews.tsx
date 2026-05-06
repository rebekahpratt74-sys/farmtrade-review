import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Screen } from "../../../components/ui/Screen";
import { auth, db } from "../../../lib/firebase";
import { theme } from "../../../lib/theme";

type ReviewItem = {
  id: string;
  sellerId: string;
  buyerId: string;
  conversationId: string;
  listingId?: string;
  rating: number;
  reviewText: string;
  createdAt?: any;
  updatedAt?: any;
};

type SellerInfo = {
  name: string;
};

function toMillis(ts: any): number {
  if (!ts) return 0;
  if (typeof ts?.toMillis === "function") return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === "number") return ts;
  return 0;
}

function relativeDate(ts: any) {
  const ms = toMillis(ts);
  if (!ms) return "";
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StarPicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((star) => {
        const selected = star <= value;

        return (
          <Pressable
            key={star}
            onPress={() => {
              if (disabled) return;
              onChange(star);
            }}
            hitSlop={8}
            style={({ pressed }) => [
              styles.starWrap,
              pressed && !disabled ? { transform: [{ scale: 0.94 }] } : null,
              disabled ? { opacity: 0.7 } : null,
            ]}
          >
            <Text
              style={{
                fontSize: 24,
                fontWeight: "900",
                color: selected ? "#9FD3A8" : "#DCE7DF",
              }}
            >
              ★
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function YourReviewsScreen() {
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);

  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [sellerNames, setSellerNames] = useState<Record<string, SellerInfo>>({});
  const [listingTitles, setListingTitles] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [draftRatings, setDraftRatings] = useState<Record<string, number>>({});
  const [draftTexts, setDraftTexts] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
    });

    return unsub;
  }, []);

  useEffect(() => {
    if (!uid) {
      setReviews([]);
      setDraftRatings({});
      setDraftTexts({});
      setLoading(false);
      return;
    }

    setLoading(true);

    const hydrateRows = (docs: any[]) => {
      const rows: ReviewItem[] = docs.map((d) => {
        const data: any = d.data();
        return {
          id: d.id,
          sellerId: data.sellerId ?? "",
          buyerId: data.buyerId ?? "",
          conversationId: data.conversationId ?? "",
          listingId: data.listingId ?? "",
          rating: Number(data.rating ?? 0),
          reviewText: (data.reviewText ?? "").toString(),
          createdAt: data.createdAt ?? null,
          updatedAt: data.updatedAt ?? null,
        };
      });

      rows.sort((a, b) => {
        const ta = Math.max(toMillis(a.updatedAt), toMillis(a.createdAt));
        const tb = Math.max(toMillis(b.updatedAt), toMillis(b.createdAt));
        return tb - ta;
      });

      setReviews(rows);

      const nextRatings: Record<string, number> = {};
      const nextTexts: Record<string, string> = {};

      rows.forEach((r) => {
        nextRatings[r.id] = r.rating;
        nextTexts[r.id] = r.reviewText;
      });

      setDraftRatings(nextRatings);
      setDraftTexts(nextTexts);
      setLoading(false);
    };

    const q = query(collection(db, "users", uid, "myReviews"));

    const unsub = onSnapshot(
      q,
      async (snap) => {
        if (!snap.empty) {
          hydrateRows(snap.docs);
          return;
        }

        try {
          const fallbackQ = query(
            collectionGroup(db, "reviews"),
            where("buyerId", "==", uid)
          );

          const fallbackSnap = await getDocs(fallbackQ);

          if (!fallbackSnap.empty) {
            hydrateRows(fallbackSnap.docs);

            await Promise.all(
              fallbackSnap.docs.map(async (reviewDoc) => {
                try {
                  const data: any = reviewDoc.data();
                  const reviewId =
                    reviewDoc.id ||
                    `${data.conversationId ?? ""}_${data.buyerId ?? uid}`;

                  const buyerReviewRef = doc(db, "users", uid, "myReviews", reviewId);

                  await setDoc(
                    buyerReviewRef,
                    {
                      sellerId: data.sellerId ?? "",
                      buyerId: data.buyerId ?? uid,
                      conversationId: data.conversationId ?? "",
                      listingId: data.listingId ?? "",
                      rating: Number(data.rating ?? 0),
                      reviewText: (data.reviewText ?? "").toString(),
                      sellerResponse:
                        typeof data.sellerResponse === "string"
                          ? data.sellerResponse
                          : "",
                      sellerResponseAt: data.sellerResponseAt ?? null,
                      createdAt: data.createdAt ?? null,
                      updatedAt: data.updatedAt ?? null,
                    },
                    { merge: true }
                  );
                } catch (writeErr: any) {
                  console.log(
                    "Repair myReviews doc error:",
                    writeErr?.code,
                    writeErr?.message ?? writeErr
                  );
                }
              })
            );

            return;
          }

          setReviews([]);
          setDraftRatings({});
          setDraftTexts({});
          setLoading(false);
        } catch (err: any) {
          console.log("Fallback reviews load error:", err?.code, err?.message ?? err);
          setReviews([]);
          setDraftRatings({});
          setDraftTexts({});
          setLoading(false);
        }
      },
      (err) => {
        console.log("Load your reviews error:", err?.code, err?.message ?? err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [uid]);

  useEffect(() => {
    const loadSellerNames = async () => {
      const sellerIds = Array.from(new Set(reviews.map((r) => r.sellerId).filter(Boolean)));

      if (sellerIds.length === 0) return;

      const updates: Record<string, SellerInfo> = {};

      await Promise.all(
        sellerIds.map(async (sellerId) => {
          if (sellerNames[sellerId]) return;

          try {
            const snap = await getDoc(doc(db, "users", sellerId));
            const data: any = snap.exists() ? snap.data() : null;

            updates[sellerId] = {
              name:
                (data?.displayName || data?.name || "").toString().trim() || "Seller",
            };
          } catch (e) {
            console.log("Load seller name error:", e);
            updates[sellerId] = { name: "Seller" };
          }
        })
      );

      if (Object.keys(updates).length > 0) {
        setSellerNames((prev) => ({ ...prev, ...updates }));
      }
    };

    loadSellerNames();
  }, [reviews, sellerNames]);

  useEffect(() => {
    const loadListingTitles = async () => {
      const ids = Array.from(new Set(reviews.map((r) => r.listingId).filter(Boolean)));

      if (ids.length === 0) return;

      const updates: Record<string, string> = {};

      await Promise.all(
        ids.map(async (listingId) => {
          if (!listingId || listingTitles[listingId]) return;

          try {
            const snap = await getDoc(doc(db, "listings", listingId));
            const data: any = snap.exists() ? snap.data() : null;

            updates[listingId] = (data?.title || "").toString().trim() || "Item";
          } catch (e) {
            console.log("Load listing title error:", e);
            updates[listingId] = "Item";
          }
        })
      );

      if (Object.keys(updates).length > 0) {
        setListingTitles((prev) => ({ ...prev, ...updates }));
      }
    };

    loadListingTitles();
  }, [reviews, listingTitles]);

  const reviewCount = useMemo(() => reviews.length, [reviews]);

  const saveReview = async (item: ReviewItem) => {
    const nextRating = draftRatings[item.id] ?? 0;
    const nextText = (draftTexts[item.id] ?? "").trim();

    if (nextRating < 1 || nextRating > 5) {
      Alert.alert("Choose a rating", "Please choose between 1 and 5 stars.");
      return;
    }

    try {
      setSavingId(item.id);

      const sellerRef = doc(db, "users", item.sellerId);
      const sellerReviewRef = doc(
        db,
        "users",
        item.sellerId,
        "reviews",
        `${item.conversationId}_${item.buyerId}`
      );
      const buyerReviewRef = doc(
        db,
        "users",
        item.buyerId,
        "myReviews",
        `${item.conversationId}_${item.buyerId}`
      );

      await runTransaction(db, async (tx) => {
        const sellerSnap = await tx.get(sellerRef);
        const reviewSnap = await tx.get(sellerReviewRef);

        if (!reviewSnap.exists()) {
          throw new Error("Review not found.");
        }

        const currentAverage =
          sellerSnap.exists() && typeof sellerSnap.data()?.ratingAverage === "number"
            ? sellerSnap.data()!.ratingAverage
            : 0;

        const currentCount =
          sellerSnap.exists() && typeof sellerSnap.data()?.ratingCount === "number"
            ? sellerSnap.data()!.ratingCount
            : 0;

        const oldRating =
          typeof reviewSnap.data()?.rating === "number" ? reviewSnap.data()!.rating : 0;

        const totalBefore = currentAverage * currentCount;
        const totalAfter = totalBefore - oldRating + nextRating;
        const nextAverage = currentCount > 0 ? totalAfter / currentCount : nextRating;

        tx.update(sellerRef, {
          ratingAverage: Number(nextAverage.toFixed(2)),
          updatedAt: serverTimestamp(),
        });

        tx.update(sellerReviewRef, {
          rating: nextRating,
          reviewText: nextText,
          updatedAt: serverTimestamp(),
        });

        tx.update(buyerReviewRef, {
          rating: nextRating,
          reviewText: nextText,
          updatedAt: serverTimestamp(),
        });
      });

      Alert.alert("Saved", "Your review has been updated.");
      setExpandedId(null);
    } catch (e: any) {
      console.log("Update review error:", e?.message ?? e);
      Alert.alert("Review error", e?.message ?? "Could not update review.");
    } finally {
      setSavingId(null);
    }
  };

  const deleteReview = async (item: ReviewItem) => {
    Alert.alert(
      "Delete review",
      "Are you sure you want to remove this review?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setDeletingId(item.id);

              const sellerRef = doc(db, "users", item.sellerId);
              const sellerReviewRef = doc(
                db,
                "users",
                item.sellerId,
                "reviews",
                `${item.conversationId}_${item.buyerId}`
              );
              const buyerReviewRef = doc(
                db,
                "users",
                item.buyerId,
                "myReviews",
                `${item.conversationId}_${item.buyerId}`
              );

              await runTransaction(db, async (tx) => {
                const sellerSnap = await tx.get(sellerRef);
                const reviewSnap = await tx.get(sellerReviewRef);

                if (!reviewSnap.exists()) {
                  throw new Error("Review not found.");
                }

                const currentAverage =
                  sellerSnap.exists() && typeof sellerSnap.data()?.ratingAverage === "number"
                    ? sellerSnap.data()!.ratingAverage
                    : 0;

                const currentCount =
                  sellerSnap.exists() && typeof sellerSnap.data()?.ratingCount === "number"
                    ? sellerSnap.data()!.ratingCount
                    : 0;

                const oldRating =
                  typeof reviewSnap.data()?.rating === "number"
                    ? reviewSnap.data()!.rating
                    : 0;

                const totalBefore = currentAverage * currentCount;
                const nextCount = Math.max(0, currentCount - 1);
                const totalAfter = Math.max(0, totalBefore - oldRating);
                const nextAverage = nextCount > 0 ? totalAfter / nextCount : 0;

                tx.delete(sellerReviewRef);
                tx.delete(buyerReviewRef);

                tx.set(
                  sellerRef,
                  {
                    ratingAverage: Number(nextAverage.toFixed(2)),
                    ratingCount: nextCount,
                    updatedAt: serverTimestamp(),
                  },
                  { merge: true }
                );
              });

              Alert.alert("Deleted", "Your review was removed.");
              if (expandedId === item.id) setExpandedId(null);
            } catch (e: any) {
              console.log("Delete review error:", e?.message ?? e);
              Alert.alert("Review error", e?.message ?? "Could not delete review.");
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <Screen style={{ backgroundColor: theme.colors.backgroundTint }}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.brand} />
          <Text style={styles.muted}>Loading your reviews…</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={{ backgroundColor: theme.colors.backgroundTint }}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.header}>Your Reviews</Text>
          <Text style={styles.subheader}>
            View, edit, or delete reviews you’ve left for other sellers
          </Text>

          <View style={styles.countPill}>
            <Text style={styles.countPillText}>
              {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
            </Text>
          </View>
        </View>

        {reviews.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>⭐</Text>
            <Text style={styles.emptyTitle}>No reviews yet</Text>
            <Text style={styles.emptyText}>
              Once you complete a sale and rate a seller, your reviews will show up here.
            </Text>
          </View>
        ) : (
          reviews.map((item) => {
            const expanded = expandedId === item.id;
            const sellerName = sellerNames[item.sellerId]?.name || "Seller";
            const listingTitle = listingTitles[item.listingId || ""] || "Item";
            const currentRating = draftRatings[item.id] ?? item.rating;
            const currentText = draftTexts[item.id] ?? item.reviewText;

            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sellerName}>Review for {listingTitle}</Text>

                    <Text style={styles.soldByText}>Sold by {sellerName}</Text>

                    <Text style={styles.dateText}>
                      {relativeDate(item.updatedAt || item.createdAt)}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => setExpandedId(expanded ? null : item.id)}
                    style={styles.actionPill}
                  >
                    <Text style={styles.actionPillText}>
                      {expanded ? "Close" : "Manage"}
                    </Text>
                  </Pressable>
                </View>

                <View style={{ marginTop: 8 }}>
                  <StarPicker
                    value={currentRating}
                    onChange={(value) =>
                      setDraftRatings((prev) => ({ ...prev, [item.id]: value }))
                    }
                    disabled={!expanded}
                  />
                </View>

                {!!currentText && !expanded ? (
                  <Text style={styles.reviewPreview} numberOfLines={3}>
                    {currentText}
                  </Text>
                ) : null}

                {expanded ? (
                  <>
                    <TextInput
                      value={currentText}
                      onChangeText={(value) =>
                        setDraftTexts((prev) => ({ ...prev, [item.id]: value }))
                      }
                      placeholder="Optional note about your experience…"
                      multiline
                      style={styles.input}
                      textAlignVertical="top"
                      maxLength={250}
                    />

                    <View style={styles.buttonRow}>
                      <Pressable
                        onPress={() => deleteReview(item)}
                        disabled={deletingId === item.id || savingId === item.id}
                        style={[styles.deleteBtn, deletingId === item.id && styles.btnDisabled]}
                      >
                        <Ionicons name="trash-outline" size={16} color="#fff" />
                        <Text style={styles.deleteBtnText}>
                          {deletingId === item.id ? "Deleting..." : "Delete"}
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => saveReview(item)}
                        disabled={savingId === item.id || deletingId === item.id}
                        style={[styles.saveBtn, savingId === item.id && styles.btnDisabled]}
                      >
                        <Ionicons name="save-outline" size={16} color="#fff" />
                        <Text style={styles.saveBtnText}>
                          {savingId === item.id ? "Saving..." : "Save Changes"}
                        </Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}
              </View>
            );
          })
        )}

        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Back to Profile</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: theme.space.lg,
    paddingBottom: theme.space.xl,
    gap: theme.space.md,
  },

  headerCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.space.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  header: {
    ...theme.type.h1,
    color: theme.colors.text,
  },

  subheader: {
    marginTop: 4,
    color: theme.colors.subtext,
    fontWeight: "700",
  },

  countPill: {
    marginTop: 12,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.chipBg,
    borderWidth: 1,
    borderColor: theme.colors.chipBorder,
  },

  countPillText: {
    color: theme.colors.chipText,
    fontWeight: "900",
  },

  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.space.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.space.md,
  },

  sellerName: {
    fontSize: 17,
    fontWeight: "900",
    color: theme.colors.text,
  },

  soldByText: {
    marginTop: 4,
    color: theme.colors.subtext,
    fontWeight: "700",
    fontSize: 12,
  },

  dateText: {
    marginTop: 4,
    color: theme.colors.subtext,
    fontWeight: "700",
  },

  actionPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  actionPillText: {
    color: theme.colors.text,
    fontWeight: "900",
  },

  starRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  starWrap: {
    alignItems: "center",
    justifyContent: "center",
  },

  reviewPreview: {
    marginTop: 12,
    color: theme.colors.slate700,
    fontWeight: "600",
    lineHeight: 20,
  },

  input: {
    marginTop: 12,
    minHeight: 100,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: 12,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface2,
  },

  buttonRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },

  saveBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.brand,
    borderRadius: theme.radius.lg,
    paddingVertical: 12,
  },

  saveBtnText: {
    color: "#fff",
    fontWeight: "900",
  },

  deleteBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.danger,
    borderRadius: theme.radius.lg,
    paddingVertical: 12,
  },

  deleteBtnText: {
    color: "#fff",
    fontWeight: "900",
  },

  btnDisabled: {
    opacity: 0.7,
  },

  emptyWrap: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.space.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },

  emptyIcon: {
    fontSize: 34,
    marginBottom: 8,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.colors.text,
  },

  emptyText: {
    marginTop: 6,
    textAlign: "center",
    color: theme.colors.subtext,
    fontWeight: "700",
    lineHeight: 20,
  },

  backBtn: {
    marginTop: 4,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  backBtnText: {
    color: theme.colors.text,
    fontWeight: "900",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  muted: {
    marginTop: 8,
    color: theme.colors.subtext,
    fontWeight: "800",
  },
});