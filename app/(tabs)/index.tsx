import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useNavigation } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View
} from "react-native";
import { ListingCard } from "../../components/listing/ListingCard";
import { Screen } from "../../components/ui/Screen";
import { auth, db } from "../../lib/firebase";
import { theme } from "../../lib/theme";

/* -------------------- Types -------------------- */

type Listing = {
  id: string;
  title: string;
  category: string;
  price: number;
  sellerId?: string;
  sellerName?: string;
  quantity?: number;
  pricingType?: "total" | "per_unit";
  unit?: string;
  photoUrls?: string[];
  city?: string;
  state?: string;
  zip?: string;
  lat?: number | null;
  lng?: number | null;
  isPromoted?: boolean;
  promotionExpiresAt?: any;
};

/* -------------------- Helpers -------------------- */

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

/* -------------------- Reusable Heart Button -------------------- */

function FavoriteHeartButton({
  isFav,
  onPress,
}: {
  isFav: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.3,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();

    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={10}
      style={({ pressed }) => ({
        padding: 6,
        transform: [{ scale: pressed ? 0.92 : 1 }],
      })}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={isFav ? "heart" : "heart-outline"}
          size={22}
          color={theme.colors.danger}
        />
      </Animated.View>
    </Pressable>
  );
}

/* -------------------- Screen -------------------- */

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<Listing[]>([]);

  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);

  const [stateFilter, setStateFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [zipFilter, setZipFilter] = useState("");

  const [radiusMiles, setRadiusMiles] = useState(100);
  const [marketLat, setMarketLat] = useState<number | null>(null);
  const [marketLng, setMarketLng] = useState<number | null>(null);

  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
const [sellerNames, setSellerNames] = useState<Record<string, string>>({});
const [sellerPhotos, setSellerPhotos] = useState<Record<string, string | null>>({});
const [sellerRatings, setSellerRatings] = useState<Record<string, number | null>>({});
const [sellerRatingCounts, setSellerRatingCounts] = useState<Record<string, number | null>>({});

const navigation = useNavigation<any>();
const listRef = useRef<Animated.FlatList<Listing> | null>(null);
const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<
  "all" | "livestock" | "produce" | "farm_goods" | "equipment"
>("all");

  /* -------------------- Animation -------------------- */

  const scrollY = useRef(new Animated.Value(0)).current;

  const FILTERS_EXPANDED_HEIGHT = 185;
const FILTERS_COLLAPSED_HEIGHT = 32;
const FILTERS_COLLAPSE_DISTANCE = 220;

const filtersHeight = scrollY.interpolate({
  inputRange: [0, FILTERS_COLLAPSE_DISTANCE],
  outputRange: [FILTERS_EXPANDED_HEIGHT, FILTERS_COLLAPSED_HEIGHT],
  extrapolate: "clamp",
});

const filtersOpacity = scrollY.interpolate({
  inputRange: [0, 120, FILTERS_COLLAPSE_DISTANCE],
  outputRange: [1, 0.75, 0.15],
  extrapolate: "clamp",
});

const filtersTranslateY = scrollY.interpolate({
  inputRange: [0, FILTERS_COLLAPSE_DISTANCE],
  outputRange: [0, -8],
  extrapolate: "clamp",
});

const miniBarOpacity = scrollY.interpolate({
  inputRange: [140, 220],
  outputRange: [0, 1],
  extrapolate: "clamp",
});

const miniBarTranslateY = scrollY.interpolate({
  inputRange: [140, 220],
  outputRange: [8, 0],
  extrapolate: "clamp",
});

  /* -------------------- Auth watcher -------------------- */

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return unsub;
  }, []);

  useEffect(() => {
  const unsub = navigation.addListener("tabPress", () => {
    if (!navigation.isFocused()) return;

    setCategoryFilter("all");

    listRef.current?.scrollToOffset?.({
      offset: 0,
      animated: true,
    });
  });

  return unsub;
}, [navigation]);

  /* -------------------- Load Market Area (realtime) -------------------- */

  useEffect(() => {
    if (!uid) return;

    const ref = doc(db, "users", uid);

    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;

      const data: any = snap.data();
      const area = data.marketArea || {};

      const savedState = (area.state || "").toString().toUpperCase();
      const savedCity = (area.city || "").toString();
      const savedZip = (area.zip || "").toString();

      const r = Number(area.radiusMiles ?? 100);
      const nextRadius = Number.isFinite(r) ? r : 100;

      const savedLat = typeof area.lat === "number" ? area.lat : null;
      const savedLng = typeof area.lng === "number" ? area.lng : null;

      setStateFilter(savedState);
      setCityFilter(savedCity);
      setZipFilter(savedZip);

      setRadiusMiles(nextRadius);
      setMarketLat(savedLat);
      setMarketLng(savedLng);
    });

    return () => unsub();
  }, [uid]);

  /* -------------------- Listings (realtime) -------------------- */

  useEffect(() => {
    const q = query(
      collection(db, "listings"),
      where("status", "==", "active"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Listing[];
      setListings(items);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  /* -------------------- Seller data -------------------- */

  useEffect(() => {
  const sellerIds = Array.from(
    new Set(
      listings
        .map((item) => item.sellerId)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  );

  if (sellerIds.length === 0) {
    setSellerNames({});
    setSellerPhotos({});
    setSellerRatings({});
    setSellerRatingCounts({});
    return;
  }

  const unsubs = sellerIds.map((sellerId) =>
    onSnapshot(
      doc(db, "users", sellerId),
      (snap) => {
        const data: any = snap.exists() ? snap.data() : null;

        const name =
          (data?.displayName || data?.name || "").toString().trim() || "Seller";

        const photoUrl =
          typeof data?.photoUrl === "string" && data.photoUrl.length > 0
            ? data.photoUrl
            : null;

        const ratingAverage =
          typeof data?.ratingAverage === "number" ? data.ratingAverage : null;

        const ratingCount =
          typeof data?.ratingCount === "number" ? data.ratingCount : null;

        setSellerNames((prev) => ({ ...prev, [sellerId]: name }));
        setSellerPhotos((prev) => ({ ...prev, [sellerId]: photoUrl }));
        setSellerRatings((prev) => ({ ...prev, [sellerId]: ratingAverage }));
        setSellerRatingCounts((prev) => ({ ...prev, [sellerId]: ratingCount }));
      },
      (e) => {
        console.log("Seller snapshot error:", sellerId, e);
      }
    )
  );

  return () => {
    unsubs.forEach((unsub) => unsub());
  };
}, [listings]);

  /* -------------------- Favorites (realtime) -------------------- */

  useEffect(() => {
    if (!uid) {
      setFavoriteIds([]);
      return;
    }

    const favRef = collection(db, "users", uid, "favorites");
    const unsub = onSnapshot(
      favRef,
      (snap) => {
        setFavoriteIds(snap.docs.map((d) => d.id));
      },
      (err) => {
        console.log("Favorites snapshot error:", err?.code, err?.message);
        setFavoriteIds([]);
      }
    );

    return () => unsub();
  }, [uid]);

  /* -------------------- Toggle Favorite (optimistic) -------------------- */

  const toggleFavorite = async (item: Listing) => {
    const user = auth.currentUser;
    if (!user) return;

    const ref = doc(db, "users", user.uid, "favorites", item.id);
    const isFav = favoriteIds.includes(item.id);

    setFavoriteIds((prev) => {
      if (isFav) return prev.filter((id) => id !== item.id);
      return [item.id, ...prev];
    });

    try {
      if (isFav) {
        await deleteDoc(ref);
      } else {
        await setDoc(
          ref,
          {
            createdAt: serverTimestamp(),
            listingId: item.id,
            title: item.title ?? "",
            price: Number(item.price ?? 0),
            pricingType: item.pricingType ?? "total",
            unit: item.unit ?? "",
            category: item.category ?? "",
            photoUrl: item.photoUrls?.[0] ?? "",
            city: item.city ?? "",
            state: item.state ?? "",
            lat: item.lat ?? null,
            lng: item.lng ?? null,
          },
          { merge: true }
        );
      }
    } catch (e) {
      setFavoriteIds((prev) => {
        if (isFav) return [item.id, ...prev];
        return prev.filter((id) => id !== item.id);
      });
      console.log("toggleFavorite error:", e);
    }
  };

  /* -------------------- Filtering -------------------- */

  const onRefresh = async () => {
  setRefreshing(true);

  setCategoryFilter("all");

  listRef.current?.scrollToOffset?.({
    offset: 0,
    animated: true,
  });

  setTimeout(() => {
    setRefreshing(false);
  }, 600);
};

  const filteredListings = useMemo(() => {
    return listings
      .filter((l) => {
        const listingCat = (l.category ?? "").toString().trim().toLowerCase();
        const matchCategory =
          categoryFilter === "all" ? true : listingCat === categoryFilter;

        let matchDistance = true;

        const hasMarketCenter = marketLat != null && marketLng != null;
        const hasListingCoords = l.lat != null && l.lng != null;

        if (hasMarketCenter && hasListingCoords) {
          matchDistance =
            milesBetween(marketLat!, marketLng!, l.lat!, l.lng!) <= radiusMiles;
        } else {
          matchDistance = true;
        }

        return matchCategory && matchDistance;
      })
            .sort((a, b) => {
        const now = Date.now();

        const aPromoted =
          a.isPromoted === true &&
          (!a.promotionExpiresAt ||
            new Date(
              a.promotionExpiresAt?.seconds
                ? a.promotionExpiresAt.seconds * 1000
                : a.promotionExpiresAt
            ).getTime() > now);

        const bPromoted =
          b.isPromoted === true &&
          (!b.promotionExpiresAt ||
            new Date(
              b.promotionExpiresAt?.seconds
                ? b.promotionExpiresAt.seconds * 1000
                : b.promotionExpiresAt
            ).getTime() > now);

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

        const da =
          marketLat != null && marketLng != null && a.lat != null && a.lng != null
            ? milesBetween(marketLat, marketLng, a.lat, a.lng)
            : Number.POSITIVE_INFINITY;

        const db =
          marketLat != null && marketLng != null && b.lat != null && b.lng != null
            ? milesBetween(marketLat, marketLng, b.lat, b.lng)
            : Number.POSITIVE_INFINITY;

        return da - db;
      });
  }, [listings, categoryFilter, marketLat, marketLng, radiusMiles]);

  /* -------------------- Header UI inside list -------------------- */

  const headerContent = (
    <View>
      <Animated.View
        style={[
          styles.collapsibleWrap,
          {
            height: filtersHeight,
            opacity: filtersOpacity,
            transform: [{ translateY: filtersTranslateY }],
          },
        ]}
      >
        <View style={styles.collapsibleInner}>
          <Pressable
            onPress={() => router.push("/(tabs)/market-area")}
            style={styles.marketRow}
          >
            <View style={styles.marketCard}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.marketTitle}>
                  📍 {cityFilter ? `${cityFilter}, ` : ""}
                  {stateFilter || "Set your market"} • {radiusMiles} mi
                </Text>

                <Text style={styles.marketSubtitle}>
                  Browse listings close to your chosen area
                  {zipFilter ? ` • ZIP ${zipFilter}` : ""}
                </Text>
              </View>

              <Text style={styles.changeText}>Change</Text>
            </View>
          </Pressable>

          <ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}
  contentContainerStyle={styles.categoryRow}
  keyboardShouldPersistTaps="handled"
>
  {[
    { key: "all", label: "All" },
    { key: "livestock", label: "🐄 Livestock" },
    { key: "produce", label: "🌽 Produce" },
    { key: "farm_goods", label: "🌾 Farm Goods" },
    { key: "equipment", label: "🚜 Equipment" },
  ].map((item) => {
    const selected = categoryFilter === item.key;

    return (
      <Pressable
        key={item.key}
        onPress={() =>
  setCategoryFilter(
    item.key as "all" | "livestock" | "produce" | "farm_goods" | "equipment"
  )
}

        style={[
          styles.categoryPill,
          {
            borderColor: selected ? "#1f7a3f" : "#dbe4dc",
            backgroundColor: selected ? "#e6f4ea" : "#fff",
          },
        ]}
      >
        <Text
          style={{
            fontWeight: "900",
            fontSize: 16,
            color: selected ? "#166534" : "#111827",
          }}
        >
          {item.label}
        </Text>
      </Pressable>
    );
  })}
</ScrollView>

          {categoryFilter !== "all" && (
            <Pressable
              onPress={() => setCategoryFilter("all")}
              style={styles.clearFilterWrap}
            >
              <Text style={styles.clearFilterText}>Clear category filter</Text>
            </Pressable>
          )}
        </View>
      </Animated.View>

      <Text style={styles.countText}>{filteredListings.length} listings near you</Text>
    </View>
  );

  /* -------------------- UI -------------------- */

  if (loading) {
    return (
      <Screen center style={{ backgroundColor: theme.colors.backgroundTint }}>
        <ActivityIndicator color={theme.colors.brand} />
        <Text style={{ color: theme.colors.subtext, fontWeight: "700", marginTop: 8 }}>
          Loading listings…
        </Text>
      </Screen>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <Screen style={{ backgroundColor: theme.colors.backgroundTint }}>
        <Text style={styles.header}>Marketplace</Text>

        <Animated.View
          pointerEvents="box-none"
          style={{
            opacity: miniBarOpacity,
            transform: [{ translateY: miniBarTranslateY }],
            marginBottom: 6,
          }}
        >
          <Pressable
            onPress={() => router.push("/(tabs)/market-area")}
            style={styles.miniMarketBar}
          >
            <Text style={styles.miniMarketText}>
              📍 {cityFilter ? `${cityFilter}, ` : ""}
              {stateFilter || "Set your market"} • {radiusMiles} mi
              {zipFilter ? ` • ZIP ${zipFilter}` : ""}
            </Text>
          </Pressable>
        </Animated.View>

        <Animated.FlatList
  ref={listRef}
  data={filteredListings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
          <ListingCard
  title={item.title}
  category={item.category}
  price={`$${item.price}`}
  subtitle={`${item.city || ""}, ${item.state || ""}`}
  sellerName={
    item.sellerName || (item.sellerId ? sellerNames[item.sellerId] : undefined)
  }
  sellerPhotoUrl={item.sellerId ? sellerPhotos[item.sellerId] : null}
  sellerRatingAverage={item.sellerId ? sellerRatings[item.sellerId] : null}
  sellerRatingCount={item.sellerId ? sellerRatingCounts[item.sellerId] : null}
  images={item.photoUrls}
  quantity={item.quantity}
    distance={
    marketLat != null &&
    marketLng != null &&
    item.lat != null &&
    item.lng != null
      ? `${Math.round(
          milesBetween(marketLat, marketLng, item.lat, item.lng)
        )} mi`
      : undefined
  }
    isPromoted={item.isPromoted}
  promotionExpiresAt={item.promotionExpiresAt}
  rightElement={
    <FavoriteHeartButton
      isFav={favoriteIds.includes(item.id)}
      onPress={() => toggleFavorite(item)}
    />
  }
  onPress={() =>
    router.push({
      pathname: "/(tabs)/listing/[id]",
      params: { id: item.id, from: "home" },
    })
  }
/>  
          )}
          ListHeaderComponent={headerContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No listings yet 🌱</Text>
              <Text style={styles.emptyText}>
                Try changing your category or market area to see more nearby listings.
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
  <RefreshControl
    refreshing={refreshing}
    onRefresh={onRefresh}
    tintColor={theme.colors.brand}
  />
}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
        />
      </Screen>
    </TouchableWithoutFeedback>
  );
}

/* -------------------- Styles -------------------- */

const styles = StyleSheet.create({
  header: {
    ...theme.type.h1,
    color: theme.colors.text,
    marginBottom: 6,
    marginTop: 2,
  },

  collapsibleWrap: {
    overflow: "hidden",
    marginBottom: 6,
  },

  collapsibleInner: {
    paddingBottom: 12,
  },

  marketRow: {
    marginTop: 2,
    marginBottom: 8,
  },

  marketCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.space.md,
    paddingVertical: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  marketTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.colors.text,
  },

  marketSubtitle: {
    color: theme.colors.subtext,
    fontWeight: "700",
    marginTop: 6,
    fontSize: 15,
    lineHeight: 21,
  },

  changeText: {
    color: theme.colors.brand,
    fontWeight: "900",
    fontSize: 16,
  },

  categoryRow: {
  flexDirection: "row",
  gap: 8,
  alignItems: "center",
  paddingRight: 16,
  paddingTop: 4,
  paddingBottom: 10,
},

  categoryPill: {
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 999,
  alignSelf: "flex-start",
  borderWidth: 1,
  borderColor: "#dbe4dc",
  backgroundColor: "#fff",
},

  clearFilterWrap: {
    marginTop: 6,
    marginBottom: 4,
  },

  clearFilterText: {
    color: theme.colors.brand,
    fontWeight: "900",
  },

  miniMarketBar: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
    marginBottom: 2,
  },

  miniMarketText: {
    fontWeight: "800",
    color: theme.colors.text,
  },

  countText: {
    fontWeight: "900",
    fontSize: 17,
    color: theme.colors.subtext,
    marginTop: 4,
    marginBottom: 8,
  },

  emptyWrap: {
    marginTop: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.space.lg,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 6,
  },

  emptyText: {
    color: theme.colors.subtext,
    fontWeight: "700",
    lineHeight: 20,
  },
});