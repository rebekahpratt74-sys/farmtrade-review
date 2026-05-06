import * as Location from "expo-location";
import { router } from "expo-router";
import { collection, doc, getDoc, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CategoryPill from "../../components/ui/CategoryPill";
import { getCategoryEmoji } from "../../lib/categoryIcon";
import { auth, db } from "../../lib/firebase";

type Listing = {
  id: string;
  title: string;
  category: string;
  price: number;
  pricingType?: "total" | "per_unit";
  unit?: string;
  city?: string;
  state?: string;
  status?: string;
  lat?: number | null;
  lng?: number | null;
  isPromoted?: boolean;
  promotionExpiresAt?: any;
};

type MarkerListing = Listing & {
  markerLat: number;
  markerLng: number;
};

const MAP_CATEGORIES = [
  { key: "all", label: "All" },
  { key: "livestock", label: "🐄 Livestock" },
  { key: "produce", label: "🌽 Produce" },
  { key: "farm_goods", label: "🌾 Farm Goods" },
  { key: "equipment", label: "🚜 Equipment" },
] as const;

function formatPrice(l: Listing) {
  if (l.pricingType === "per_unit" && l.unit) return `$${l.price} / ${l.unit}`;
  return `$${l.price}`;
}

function formatMarkerPrice(l: Listing) {
  if (l.pricingType === "per_unit" && l.unit) return `$${l.price} / ${l.unit}`;
  return `$${l.price}`;
}


function milesBetween(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 3958.8;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getAreaKey(listing: Pick<Listing, "city" | "state">) {
  const city = (listing.city ?? "").trim().toLowerCase();
  const state = (listing.state ?? "").trim().toLowerCase();
  return `${city}__${state}`;
}

function getAreaLabel(listing: Pick<Listing, "city" | "state">) {
  const city = (listing.city ?? "").trim();
  const state = (listing.state ?? "").trim();

  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (state) return state;
  return "this area";
}

function spreadOverlappingMarkers(listings: Listing[]): MarkerListing[] {
  const groups = new Map<string, Listing[]>();

  for (const item of listings) {
    if (item.lat == null || item.lng == null) continue;

    const key = `${item.lat.toFixed(3)}_${item.lng.toFixed(3)}`;
    const arr = groups.get(key) ?? [];
    arr.push(item);
    groups.set(key, arr);
  }

  const result: MarkerListing[] = [];

  for (const [, group] of groups) {
    if (group.length === 1) {
      const item = group[0];
      result.push({
        ...item,
        markerLat: item.lat!,
        markerLng: item.lng!,
      });
      continue;
    }

    const radius = 0.006;

    group.forEach((item, index) => {
      const angle = (index / group.length) * Math.PI * 2;
      const latOffset = Math.sin(angle) * radius;
      const lngOffset = Math.cos(angle) * radius;

      result.push({
        ...item,
        markerLat: item.lat! + latOffset,
        markerLng: item.lng! + lngOffset,
      });
    });
  }

  return result;
}

export default function MapScreen() {
  const mapRef = useRef<MapView | null>(null);
const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<Listing[]>([]);

  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);

  const [marketLat, setMarketLat] = useState<number | null>(null);
  const [marketLng, setMarketLng] = useState<number | null>(null);
  const [radiusMiles, setRadiusMiles] = useState(100);

  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<
  "all" | "livestock" | "produce" | "farm_goods" | "equipment"
>("all");

  const uid = auth.currentUser?.uid ?? null;

  const isActivePromotion = (item: Listing) => {
    if (!item.isPromoted) return false;
    if (!item.promotionExpiresAt) return true;

    const expiresAt =
      typeof item.promotionExpiresAt?.toDate === "function"
        ? item.promotionExpiresAt.toDate().getTime()
        : item.promotionExpiresAt?.seconds
          ? item.promotionExpiresAt.seconds * 1000
          : new Date(item.promotionExpiresAt).getTime();

    return expiresAt > Date.now();
  };

  useEffect(() => {
    const loadMarketArea = async () => {
      if (!uid) return;

      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (!snap.exists()) return;

        const data: any = snap.data();
        const area = data?.marketArea ?? {};

        setMarketLat(typeof area.lat === "number" ? area.lat : null);
        setMarketLng(typeof area.lng === "number" ? area.lng : null);

        const r = Number(area.radiusMiles ?? 100);
        setRadiusMiles(Number.isFinite(r) ? r : 100);
      } catch (e) {
        console.log("Load market area for map error:", e);
      }
    };

    loadMarketArea();
  }, [uid]);

  useEffect(() => {
    const q = query(collection(db, "listings"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: Listing[] = snap.docs.map((d) => {
          const data: any = d.data();
                    return {
            id: d.id,
            title: data.title ?? "",
            category: data.category ?? "",
            price: Number(data.price ?? 0),
            pricingType: data.pricingType ?? "total",
            unit: data.unit ?? "",
            city: data.city ?? "",
            state: data.state ?? "",
            status: data.status ?? "active",
            lat: typeof data.lat === "number" ? data.lat : null,
            lng: typeof data.lng === "number" ? data.lng : null,
            isPromoted: data.isPromoted === true,
            promotionExpiresAt: data.promotionExpiresAt ?? null,
          };
        });

        setListings(items.filter((x) => x.status === "active"));
        setLoading(false);
      },
      (err) => {
        console.log("Map listings snapshot error:", err?.code, err?.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        const pos = await Location.getCurrentPositionAsync({});
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
      } catch (e) {
        console.log("Get user location for map error:", e);
      }
    })();
  }, []);

  const centerLat = marketLat ?? userLat;
  const centerLng = marketLng ?? userLng;

    const filteredMapListings = useMemo(() => {
    let data = listings.filter((l) => l.lat != null && l.lng != null);

    if (categoryFilter !== "all") {
      data = data.filter((l) => l.category === categoryFilter);
    }

    if (centerLat != null && centerLng != null) {
      data = data.filter((l) => {
        const distance = milesBetween(centerLat, centerLng, l.lat!, l.lng!);
        return distance <= radiusMiles;
      });
    }

    return data.sort((a, b) => {
      const aPromoted = isActivePromotion(a);
      const bPromoted = isActivePromotion(b);

      if (aPromoted && !bPromoted) return -1;
if (!aPromoted && bPromoted) return 1;

if (aPromoted && bPromoted) {
  const rotationBucket = Math.floor(Date.now() / (1000 * 60 * 60 * 3));

  const aScore = Math.abs(
    `${a.id}-${rotationBucket}`
      .split("")
      .reduce((sum, char) => sum + char.charCodeAt(0), 0)
  );

  const bScore = Math.abs(
    `${b.id}-${rotationBucket}`
      .split("")
      .reduce((sum, char) => sum + char.charCodeAt(0), 0)
  );

  return aScore - bScore;
}

return 0;
    });
  }, [listings, categoryFilter, centerLat, centerLng, radiusMiles]);

  const markerListings = useMemo(
    () => spreadOverlappingMarkers(filteredMapListings),
    [filteredMapListings]
  );

  const selectedListing = useMemo(
    () => markerListings.find((x) => x.id === selectedListingId) ?? null,
    [markerListings, selectedListingId]
  );

  const areaCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const item of filteredMapListings) {
      const key = getAreaKey(item);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return counts;
  }, [filteredMapListings]);

  const selectedAreaCount = selectedListing
    ? areaCounts.get(getAreaKey(selectedListing)) ?? 1
    : 1;

  const selectedAreaLabel = selectedListing
    ? getAreaLabel(selectedListing)
    : "this area";

  const region: Region = useMemo(() => {
    if (marketLat != null && marketLng != null) {
      return {
        latitude: marketLat,
        longitude: marketLng,
        latitudeDelta:
          radiusMiles <= 10 ? 0.2 : radiusMiles <= 25 ? 0.35 : radiusMiles <= 50 ? 0.6 : 1.2,
        longitudeDelta:
          radiusMiles <= 10 ? 0.2 : radiusMiles <= 25 ? 0.35 : radiusMiles <= 50 ? 0.6 : 1.2,
      };
    }

    if (userLat != null && userLng != null) {
      return {
        latitude: userLat,
        longitude: userLng,
        latitudeDelta: 0.35,
        longitudeDelta: 0.35,
      };
    }

    if (markerListings[0]?.markerLat != null && markerListings[0]?.markerLng != null) {
      return {
        latitude: markerListings[0].markerLat,
        longitude: markerListings[0].markerLng,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      };
    }

    return {
      latitude: 39.5,
      longitude: -98.35,
      latitudeDelta: 20,
      longitudeDelta: 20,
    };
  }, [marketLat, marketLng, userLat, userLng, markerListings, radiusMiles]);

  const recenterMap = () => {
    if (!mapRef.current) return;
    mapRef.current.animateToRegion(region, 350);
  };

  const handleMarkerPress = (item: MarkerListing) => {
    setSelectedListingId(item.id);

    if (!mapRef.current) return;

    mapRef.current.animateToRegion(
      {
        latitude: item.markerLat,
        longitude: item.markerLng,
        latitudeDelta: 0.2,
        longitudeDelta: 0.2,
      },
      250
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text>Loading map…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        onPress={() => setSelectedListingId(null)}
      >
        {userLat != null && userLng != null && (
          <Marker
            coordinate={{ latitude: userLat, longitude: userLng }}
            title="You are here"
            pinColor="blue"
          />
        )}

        {markerListings.map((item) => {
          const selected = selectedListingId === item.id;

          return (
            <Marker
              key={item.id}
              coordinate={{ latitude: item.markerLat, longitude: item.markerLng }}
              onSelect={() => handleMarkerPress(item)}
            >
              <View pointerEvents="none" style={styles.priceMarkerWrap}>
                                <View
                  style={[
                    styles.priceMarker,
                                        isActivePromotion(item) && styles.priceMarkerPromoted,
                    selected && styles.priceMarkerSelected,
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[
                      styles.priceMarkerText,
                      selected && styles.priceMarkerTextSelected,
                    ]}
                  >
                    {getCategoryEmoji(item.category)} {formatMarkerPrice(item)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.priceMarkerPointer,
                    selected && styles.priceMarkerPointerSelected,
                  ]}
                />
              </View>
            </Marker>
          );
        })}
      </MapView>

      <View style={[styles.topCard, { top: insets.top + 8 }]}>
        <View style={styles.toggleRow}>
          <Pressable
            onPress={() => router.push("/(tabs)/explore")}
            style={styles.toggleInactive}
          >
            <Text style={styles.toggleInactiveText}>List</Text>
          </Pressable>

          <View style={styles.toggleActive}>
            <Text style={styles.toggleActiveText}>Map</Text>
          </View>
        </View>

        <Text style={styles.topTitle}>Map View</Text>

        <View style={styles.pillsRow}>
          {MAP_CATEGORIES.map((item) => {
            const selected = categoryFilter === item.key;

            return (
              <CategoryPill
                key={item.key}
                label={item.label}
                selected={selected}
                onPress={() => {
                  setCategoryFilter(item.key);
                  setSelectedListingId(null);
                }}
              />
            );
          })}
        </View>

        <Text style={styles.topSub}>
          {markerListings.length} listings in your market area • {radiusMiles} mi
        </Text>
      </View>

      <Pressable
  onPress={recenterMap}
  style={[
    styles.recenterButton,
    {
      bottom: selectedListing
        ? insets.bottom + 140
        : insets.bottom + -10,
    },
  ]}
>
  <Text style={styles.recenterText}>Recenter</Text>
</Pressable>

      {selectedListing && (
        <View style={styles.bottomCard}>
                    <View style={{ flex: 1 }}>
                        {isActivePromotion(selectedListing) && (
              <View style={styles.promotedBadge}>
                <Text style={styles.promotedBadgeText}>Promoted</Text>
              </View>
            )}

            <Text style={styles.bottomCardTitle} numberOfLines={1}>
              {selectedListing.title || "Listing"}
            </Text>

            <Text style={styles.bottomCardPrice}>{formatPrice(selectedListing)}</Text>

            <Text style={styles.bottomCardLocation} numberOfLines={1}>
              {selectedAreaLabel}
            </Text>

            {selectedAreaCount > 1 && (
              <Text style={styles.bottomCardAreaCount}>
                {selectedAreaCount} listings in {selectedAreaLabel}
              </Text>
            )}
          </View>

          <View style={styles.bottomCardButtons}>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/explore",
                  params: {
                    fromMap: "1",
                    city: selectedListing.city ?? "",
                    state: selectedListing.state ?? "",
                    category: categoryFilter !== "all" ? categoryFilter : "",
                  },
                })
              }
              style={[styles.bottomCardAction, styles.bottomCardSecondaryAction]}
            >
              <Text
                style={[
                  styles.bottomCardActionText,
                  styles.bottomCardSecondaryActionText,
                ]}
              >
                View in List
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/listing/[id]",
                  params: { id: selectedListing.id, from: "map" },
                })
              }
              style={styles.bottomCardAction}
            >
              <Text style={styles.bottomCardActionText}>View Listing</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  map: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  topCard: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },

  toggleRow: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    padding: 4,
    marginBottom: 10,
  },
  toggleActive: {
    flex: 1,
    backgroundColor: "#1f7a3f",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  toggleActiveText: {
    color: "#fff",
    fontWeight: "900",
  },
  toggleInactive: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  toggleInactiveText: {
    color: "#0f172a",
    fontWeight: "900",
  },

  topTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
  },
  topSub: {
    marginTop: 8,
    color: "#475569",
    fontWeight: "700",
  },

  pillsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    flexWrap: "wrap",
  },

  recenterButton: {
  position: "absolute",
  right: 20,
  backgroundColor: "#1f7a3f",
  paddingHorizontal: 18,
  paddingVertical: 12,
  borderRadius: 999,
  shadowColor: "#000",
  shadowOpacity: 0.15,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
},

  recenterText: {
    color: "#fff",
    fontWeight: "900",
  },

  priceMarkerWrap: {
    alignItems: "center",
  },
  priceMarker: {
    maxWidth: 140,
    minWidth: 60,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbe4dc",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
    priceMarkerPromoted: {
    borderColor: "#F59E0B",
    borderWidth: 2,
  },
  priceMarkerSelected: {
    backgroundColor: "#1f7a3f",
    borderColor: "#1f7a3f",
    transform: [{ scale: 1.06 }],
  },
  priceMarkerText: {
    fontWeight: "900",
    color: "#111827",
    fontSize: 13,
    textAlign: "center",
  },
  priceMarkerTextSelected: {
    color: "#fff",
  },
  priceMarkerPointer: {
    marginTop: -1,
    width: 10,
    height: 10,
    backgroundColor: "#ffffff",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#dbe4dc",
    transform: [{ rotate: "45deg" }],
  },
  priceMarkerPointerSelected: {
    backgroundColor: "#1f7a3f",
    borderColor: "#1f7a3f",
  },

  bottomCard: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 20,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  bottomCardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
  },
  bottomCardPrice: {
    marginTop: 4,
    fontWeight: "900",
    color: "#166534",
  },
  bottomCardLocation: {
    marginTop: 4,
    color: "#64748b",
    fontWeight: "700",
  },
  bottomCardAreaCount: {
    marginTop: 4,
    color: "#1f7a3f",
    fontWeight: "900",
  },
  bottomCardButtons: {
    gap: 8,
  },
  bottomCardAction: {
    backgroundColor: "#1f7a3f",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bottomCardActionText: {
    color: "#fff",
    fontWeight: "900",
  },
  bottomCardSecondaryAction: {
    backgroundColor: "#F1F5F9",
  },
  bottomCardSecondaryActionText: {
    color: "#0f172a",
  },
    promotedBadge: {
    alignSelf: "flex-start",
    marginBottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FCD34D",
  },

  promotedBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#92400E",
  },
});