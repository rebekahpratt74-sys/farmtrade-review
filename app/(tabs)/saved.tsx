// app/(tabs)/saved.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { ListingCard } from "../../components/listing/ListingCard";
import { Screen } from "../../components/ui/Screen";
import { auth, db } from "../../lib/firebase";
import { theme } from "../../lib/theme";

/* -------------------- Types -------------------- */
type FavoriteDoc = {
  id: string; // doc id (same as listingId)
  listingId: string;

  title?: string;
  category?: string;
  price?: number;
  pricingType?: "total" | "per_unit";
  unit?: string;
  photoUrl?: string;

  city?: string;
  state?: string;

  createdAt?: Timestamp | null;
};

/* -------------------- Helpers -------------------- */
function formatCategory(category?: string) {
  if (category === "livestock") return "Livestock";
  if (category === "produce") return "Produce";
  if (category === "farm_goods") return "Farm Goods";
  return category || "Other";
}

function formatPrice(f: FavoriteDoc) {
  const price = Number(f.price ?? 0);
  if (!price) return "";
  if (f.pricingType === "per_unit" && f.unit) return `$${price} / ${f.unit}`;
  return `$${price}`;
}

function formatLocation(city?: string, state?: string) {
  const c = (city ?? "").trim();
  const s = (state ?? "").trim();
  if (c && s) return `${c}, ${s}`;
  if (c) return c;
  if (s) return s;
  return "";
}

/* -------------------- Screen -------------------- */
export default function SavedScreen() {
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<FavoriteDoc[]>([]);

  const emptyText = useMemo(() => {
    if (loading) return "";
    return "No saved listings yet.\nTap the heart on a listing to save it.";
  }, [loading]);

  const removeFavorite = async (listingId: string) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await deleteDoc(doc(db, "users", user.uid, "favorites", listingId));
    } catch (e: any) {
      console.log("Remove favorite error:", e?.message ?? e);
    }
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    const favCol = collection(db, "users", user.uid, "favorites");
    const q = query(favCol, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: FavoriteDoc[] = snap.docs.map((d) => {
          const data: any = d.data();
          return {
            id: d.id,
            listingId: d.id,
            title: data.title ?? "",
            category: data.category ?? "",
            price:
              typeof data.price === "number" ? data.price : Number(data.price ?? 0),
            pricingType: data.pricingType ?? "total",
            unit: data.unit ?? "",
            photoUrl: data.photoUrl ?? "",
            city: data.city ?? "",
            state: data.state ?? "",
            createdAt: data.createdAt ?? null,
          };
        });

        setFavorites(items);
        setLoading(false);
      },
      (err) => {
        console.log("Saved listener error:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  if (loading) {
    return (
      <Screen center padded>
        <ActivityIndicator />
        <Text style={{ marginTop: 8, fontWeight: "800", color: theme.colors.subtext }}>
          Loading saved…
        </Text>
      </Screen>
    );
  }

  return (
    <Screen>
      {/* Header */}
      <View style={{ marginBottom: theme.space.md }}>
        <Text style={{ fontSize: 30, fontWeight: "900", color: theme.colors.text }}>
          Saved
        </Text>
        <Text style={{ marginTop: 2, fontWeight: "800", color: theme.colors.subtext }}>
          Your favorite listings
        </Text>
      </View>

      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          { paddingBottom: theme.space.xl },
          favorites.length === 0 && { flex: 1, justifyContent: "center" },
        ]}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingHorizontal: theme.space.lg }}>
            <Text
              style={{
                textAlign: "center",
                fontWeight: "800",
                color: theme.colors.subtext,
                lineHeight: 20,
              }}
            >
              {emptyText}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const location = formatLocation(item.city, item.state);
          const subtitle = `${formatCategory(item.category)}${
            location ? ` • ${location}` : ""
          }`;

          return (
            <ListingCard
              title={item.title || "(Untitled)"}
              price={formatPrice(item)}
              subtitle={subtitle}
              images={item.photoUrl ? [item.photoUrl] : []}
              rightElement={
                // ✅ Clean heart (no grey box), but keeps the “click” feel
                <Pressable
                  onPress={() => removeFavorite(item.listingId)}
                  hitSlop={10}
                  style={({ pressed }) => ({
                    padding: 6,
                    transform: [{ scale: pressed ? 0.9 : 1 }],
                  })}
                >
                  <Ionicons name="heart" size={22} color="#e11d48" />
                </Pressable>
              }
              onPress={() =>
                router.push({
                  pathname: "/listing/[id]",
                  params: { id: item.listingId },
                })
              }
            />
          );
        }}
      />
    </Screen>
  );
}