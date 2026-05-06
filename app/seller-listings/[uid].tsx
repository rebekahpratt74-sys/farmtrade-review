import { router, useLocalSearchParams } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../../lib/firebase";

type Seller = {
  name: string;
  photoUrl: string | null;
};

type Listing = {
  id: string;
  title: string;
  photoUrl: string;
  price?: number;
  pricingType?: "total" | "per_unit";
  unit?: string;
  city?: string;
  state?: string;
};

function formatPrice(l: Listing) {
  const p = Number(l.price ?? 0);
  if (!p) return "";
  if (l.pricingType === "per_unit" && l.unit) return `$${p} / ${l.unit}`;
  return `$${p}`;
}

export default function SellerListingsScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();

  const [loading, setLoading] = useState(true);
  const [seller, setSeller] = useState<Seller>({ name: "Seller", photoUrl: null });
  const [items, setItems] = useState<Listing[]>([]);

  const title = useMemo(() => {
    return seller?.name?.trim() ? `${seller.name}'s Listings` : "Seller Listings";
  }, [seller?.name]);

  // load seller basic info
  useEffect(() => {
    (async () => {
      try {
        if (!uid) return;
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) {
          const data: any = snap.data();
          setSeller({
            name: (data.name ?? "Seller").toString() || "Seller",
            photoUrl: data.photoUrl ?? null,
          });
        }
      } catch (e) {
        console.log("Seller load error:", e);
      }
    })();
  }, [uid]);

  // load listings
  useEffect(() => {
    if (!uid) return;

    setLoading(true);

    const q = query(
      collection(db, "listings"),
      where("sellerId", "==", uid),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: Listing[] = snap.docs.map((d) => {
          const data: any = d.data();
          const photoUrl =
            data.photoUrl ||
            (Array.isArray(data.photoUrls) ? data.photoUrls[0] : "") ||
            "";

          return {
            id: d.id,
            title: data.title ?? "Listing",
            photoUrl,
            price: Number(data.price ?? 0),
            pricingType: data.pricingType ?? "total",
            unit: data.unit ?? "",
            city: data.city ?? "",
            state: data.state ?? "",
          };
        });

        setItems(rows);
        setLoading(false);
      },
      (err) => {
        console.log("Seller listings error:", err.code, err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [uid]);

  return (
  <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top"]}>
    <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 12,
            backgroundColor: "#F1F5F9",
          }}
        >
          <Text style={{ fontWeight: "900" }}>Back</Text>
        </Pressable>

        <Text style={{ fontSize: 18, fontWeight: "900" }} numberOfLines={1}>
          {title}
        </Text>

        <View style={{ width: 54 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8, color: "#555", fontWeight: "700" }}>
            Loading listings…
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", color: "#64748b", fontWeight: "700" }}>
              No listings yet.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/listing/[id]",
                  params: { id: item.id },
                })
              }
              style={{
                borderWidth: 1,
                borderColor: "#eee",
                borderRadius: 14,
                padding: 12,
                marginBottom: 10,
                flexDirection: "row",
                gap: 12,
                alignItems: "center",
                backgroundColor: "#fff",
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 14,
                  overflow: "hidden",
                  backgroundColor: "#E5E7EB",
                }}
              >
                {!!item.photoUrl && (
                  <Image source={{ uri: item.photoUrl }} style={{ width: "100%", height: "100%" }} />
                )}
              </View>

              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontWeight: "900" }} numberOfLines={1}>
                  {item.title}
                </Text>

                <Text style={{ color: "#64748b", fontWeight: "800" }} numberOfLines={1}>
                  {formatPrice(item)}
                </Text>

                <Text style={{ color: "#94a3b8", fontWeight: "700" }} numberOfLines={1}>
                  {item.city ? item.city : "Unknown city"}
                  {item.state ? `, ${item.state}` : ""}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
        </View>
  </SafeAreaView>
);
}