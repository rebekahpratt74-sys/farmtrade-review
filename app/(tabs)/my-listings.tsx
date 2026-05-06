import { router } from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCreate } from "../../hooks/createContext";
import { auth, db } from "../../lib/firebase";

/* -------------------- Types -------------------- */
type Listing = {
  id: string;
  title: string;
  category?: string;
  price?: number;
  pricingType?: "total" | "per_unit";
  unit?: string;
  quantity?: number;
  description?: string;
  status?: string;
  photoUrls?: string[];
  city?: string;
  state?: string;
  zip?: string;
  lat?: number | null;
  lng?: number | null;
  createdAt?: any;
  sellerId?: string;
  isPromoted?: boolean;
  promotionExpiresAt?: any;
};

type FilterKey = "active" | "inactive" | "all";

/* -------------------- Helpers -------------------- */
function formatCategory(category?: string) {
  if (category === "livestock") return "Livestock";
  if (category === "produce") return "Produce";
  if (category === "farm_goods") return "Farm Goods";
  if (category === "equipment") return "Equipment";
  return category || "Other";
}

function formatPrice(l: Listing) {
  const price = Number(l.price ?? 0);
  if (l.pricingType === "per_unit" && l.unit) return `$${price} / ${l.unit}`;
  return `$${price}`;
}

function isPromotionActive(listing: Listing) {
  if (!listing.isPromoted) return false;
  if (!listing.promotionExpiresAt) return true;

  const expiresAt =
    typeof listing.promotionExpiresAt?.toDate === "function"
      ? listing.promotionExpiresAt.toDate().getTime()
      : listing.promotionExpiresAt?.seconds
        ? listing.promotionExpiresAt.seconds * 1000
        : new Date(listing.promotionExpiresAt).getTime();

  return expiresAt > Date.now();
}

function getPromotionCountdownText(listing: Listing) {
  if (!listing.isPromoted || !listing.promotionExpiresAt) return "";

  const expiresAt =
    typeof listing.promotionExpiresAt?.toDate === "function"
      ? listing.promotionExpiresAt.toDate().getTime()
      : listing.promotionExpiresAt?.seconds
        ? listing.promotionExpiresAt.seconds * 1000
        : new Date(listing.promotionExpiresAt).getTime();

  const diffMs = expiresAt - Date.now();

  if (diffMs <= 0) return "Promotion expired";

  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysLeft <= 1) return "Promoted • Expires today";
  return `Promoted • ${daysLeft} days left`;
}

/* -------------------- Screen -------------------- */
export default function MyListingsScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Listing[]>([]);
  const [filter, setFilter] = useState<FilterKey>("active");

  const { startEditing } = useCreate();
  const insets = useSafeAreaInsets();

  const user = auth.currentUser;

  const filteredItems = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((item) => (item.status ?? "active") === filter);
  }, [items, filter]);

  const emptyText = useMemo(() => {
    if (!user) return "Please log in to see your listings.";

    if (filter === "active") {
      return "You don’t have any active listings right now.";
    }

    if (filter === "inactive") {
      return "You don’t have any inactive listings right now.";
    }

    return "You haven’t posted any listings yet.";
  }, [user, filter]);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "listings"),
      where("sellerId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: Listing[] = snap.docs.map((d) => {
          const data: any = d.data();
          return {
            id: d.id,
            title: data.title ?? "",
            category: data.category ?? "",
            price: Number(data.price ?? 0),
            pricingType: data.pricingType ?? "total",
            unit: data.unit ?? "",
            quantity: typeof data.quantity === "number" ? data.quantity : undefined,
            description: data.description ?? "",
            status: data.status ?? "active",
            photoUrls: Array.isArray(data.photoUrls) ? data.photoUrls : [],
            city: data.city ?? "",
            state: data.state ?? "",
            zip: data.zip ?? "",
            lat: typeof data.lat === "number" ? data.lat : null,
            lng: typeof data.lng === "number" ? data.lng : null,
            createdAt: data.createdAt ?? null,
            sellerId: data.sellerId ?? "",
            isPromoted: data.isPromoted === true,
            promotionExpiresAt: data.promotionExpiresAt ?? null,
          };
        });

        setItems(rows);
        setLoading(false);
      },
      (err) => {
        console.log("My listings listener error:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  const goToEdit = (listing: Listing) => {
    startEditing({
      id: listing.id,
      title: listing.title ?? "",
      category: listing.category ?? "",
      price: listing.price ?? undefined,
      pricingType: listing.pricingType ?? "total",
      unit: listing.unit ?? "",
      quantity: listing.quantity ?? undefined,
      description: listing.description ?? "",
      city: listing.city ?? "",
      state: listing.state ?? "",
      zip: listing.zip ?? "",
      lat: listing.lat ?? null,
      lng: listing.lng ?? null,
      photoUrls: listing.photoUrls ?? [],
      isPromoted: listing.isPromoted ?? false,
      promotionExpiresAt: listing.promotionExpiresAt ?? null,
    });

    router.push("/(tabs)/create/basics");
  };

  const goToCreate = () => {
    router.push("/(tabs)/create");
  };

  const promoteListing = (listing: Listing) => {
  router.push({
    pathname: "/(tabs)/listing/[id]",
    params: { id: listing.id, from: "my-listings" },
  });
};

  const manageListing = (listing: Listing) => {
    const isInactive = (listing.status ?? "active") === "inactive";

    Alert.alert(
      "Manage listing",
      `"${listing.title || "Untitled"}"`,
      [
        { text: "Cancel", style: "cancel" },

        isInactive
          ? {
              text: "Activate",
              onPress: async () => {
                await updateDoc(doc(db, "listings", listing.id), {
                  status: "active",
                });
              },
            }
          : {
              text: "Archive",
              onPress: async () => {
                await updateDoc(doc(db, "listings", listing.id), {
                  status: "inactive",
                });
              },
            },

        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteDoc(doc(db, "listings", listing.id));
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Loading your listings…</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: Math.max(insets.top, 16) },
      ]}
    >
      <Text style={styles.header}>My Listings</Text>
      <Text style={styles.subheader}>Listings you’ve posted</Text>

      <View style={styles.filterRow}>
        <Pressable
          onPress={() => setFilter("active")}
          style={[
            styles.filterPill,
            filter === "active" && styles.filterPillActive,
          ]}
        >
          <Text
            style={[
              styles.filterPillText,
              filter === "active" && styles.filterPillTextActive,
            ]}
          >
            Active
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilter("inactive")}
          style={[
            styles.filterPill,
            filter === "inactive" && styles.filterPillActive,
          ]}
        >
          <Text
            style={[
              styles.filterPillText,
              filter === "inactive" && styles.filterPillTextActive,
            ]}
          >
            Inactive
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilter("all")}
          style={[
            styles.filterPill,
            filter === "all" && styles.filterPillActive,
          ]}
        >
          <Text
            style={[
              styles.filterPillText,
              filter === "all" && styles.filterPillTextActive,
            ]}
          >
            All
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          filteredItems.length === 0 && { flex: 1, justifyContent: "center" },
        ]}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.empty}>{emptyText}</Text>

            {!!user && (
              <Pressable style={styles.createBtn} onPress={goToCreate}>
                <Text style={styles.createBtnText}>Create New Listing</Text>
              </Pressable>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/listing/[id]",
                  params: { id: item.id, from: "my-listings" },
                })
              }
            >
              {item.photoUrls?.[0] ? (
                <Image source={{ uri: item.photoUrls[0] }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]}>
                  <Text style={styles.thumbPlaceholderText}>No Photo</Text>
                </View>
              )}

              <View style={styles.row}>
                <View style={styles.titleWrap}>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.title || "(Untitled)"}
                  </Text>

                  {item.isPromoted && (
                    <View style={styles.promotedBadge}>
                      <Text style={styles.promotedBadgeText}>PROMOTED</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.price}>{formatPrice(item)}</Text>
              </View>

              <Text style={styles.meta} numberOfLines={1}>
                {formatCategory(item.category)}
                {item.city ? ` • ${item.city}` : ""}
                {item.state ? `, ${item.state}` : ""}
              </Text>

              <Text style={styles.status} numberOfLines={1}>
                Status: {item.status || "active"}
              </Text>

              {!!getPromotionCountdownText(item) && (
  <Text style={styles.promotionCountdown}>
    {getPromotionCountdownText(item)}
  </Text>
)}
            </Pressable>

            <View style={styles.actionsRow}>
              <Pressable style={styles.editBtn} onPress={() => goToEdit(item)}>
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>

              <Pressable style={styles.manageBtn} onPress={() => manageListing(item)}>
                <Text style={styles.manageBtnText}>Manage</Text>
              </Pressable>

              <Pressable style={styles.promoteBtn} onPress={() => promoteListing(item)}>
  <Text style={styles.promoteBtnText}>
    {isPromotionActive(item)
      ? "Upgrade"
      : item.isPromoted
        ? "Promote Again"
        : "Promote"}
  </Text>
</Pressable>
            </View>
          </View>
        )}
      />
    </View>
  );
}

/* -------------------- Styles -------------------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  header: {
    fontSize: 28,
    fontWeight: "800",
  },

  subheader: {
    color: "#555",
    marginBottom: 12,
  },

  filterRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },

  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  filterPillActive: {
    backgroundColor: "#DCFCE7",
    borderColor: "#BBF7D0",
  },

  filterPillText: {
    fontWeight: "800",
    color: "#334155",
  },

  filterPillTextActive: {
    color: "#166534",
  },

  listContent: {
    paddingBottom: 16,
  },

  card: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#fff",
  },

  thumb: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: "#eee",
  },

  thumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },

  thumbPlaceholderText: {
    color: "#667",
    fontWeight: "700",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  titleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  title: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },

  promotedBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },

  promotedBadgeText: {
    color: "#166534",
    fontWeight: "900",
    fontSize: 11,
  },

  price: {
    fontWeight: "800",
  },

  meta: {
    marginTop: 6,
    color: "#667",
    fontWeight: "600",
  },

  status: {
    marginTop: 6,
    color: "#444",
    fontWeight: "700",
  },

  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  editBtn: {
    flex: 1,
    backgroundColor: "#eaf6ee",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },

  editBtnText: {
    fontWeight: "800",
    color: "#1f7a3f",
  },

  manageBtn: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },

  manageBtnText: {
    fontWeight: "800",
    color: "#0f172a",
  },

  promoteBtn: {
    flex: 1,
    backgroundColor: "#166534",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },

  promoteBtnText: {
    fontWeight: "900",
    color: "#fff",
  },

  emptyWrap: {
    alignItems: "center",
    paddingHorizontal: 24,
  },

  empty: {
    textAlign: "center",
    color: "#667",
    fontWeight: "700",
    lineHeight: 20,
  },

  createBtn: {
    marginTop: 16,
    backgroundColor: "#1f7a3f",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },

  createBtnText: {
    color: "#fff",
    fontWeight: "900",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    marginTop: 8,
    fontWeight: "700",
    color: "#444",
  },

  promotionCountdown: {
  marginTop: 6,
  color: "#92400E",
  fontWeight: "900",
},
});