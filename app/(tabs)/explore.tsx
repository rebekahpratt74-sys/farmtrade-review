import { router, useLocalSearchParams } from "expo-router";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import CategoryPill from "../../components/ui/CategoryPill";
import { Screen } from "../../components/ui/Screen";
import { getCategoryEmoji } from "../../lib/categoryIcon";
import { db } from "../../lib/firebase";
import { theme } from "../../lib/theme";

type Listing = {
  id: string;
  title: string;
  category?: string;
  photoUrls?: string[];
  price?: number;
  pricingType?: "total" | "per_unit";
  unit?: string;
  city?: string;
  state?: string;
  createdAt?: any;
  status?: string;
  isPromoted?: boolean;
  promotionExpiresAt?: any;
  sellerRatingAverage?: number;
  sellerRatingCount?: number;
};

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "livestock", label: "🐄 Livestock" },
  { key: "produce", label: "🌽 Produce" },
  { key: "farm_goods", label: "🌾 Farm Goods" },
  { key: "equipment", label: "🚜 Equipment" },
] as const;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightedText({
  text,
  query,
  baseStyle,
  highlightStyle,
  numberOfLines,
}: {
  text: string;
  query: string;
  baseStyle: any;
  highlightStyle: any;
  numberOfLines?: number;
}) {
  const trimmed = query.trim();

  if (!trimmed) {
    return (
      <Text style={baseStyle} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  const regex = new RegExp(`(${escapeRegExp(trimmed)})`, "ig");
  const parts = text.split(regex);

  return (
    <Text style={baseStyle} numberOfLines={numberOfLines}>
      {parts.map((part, index) => {
        const isMatch = part.toLowerCase() === trimmed.toLowerCase();
        return (
          <Text key={`${part}-${index}`} style={isMatch ? highlightStyle : undefined}>
            {part}
          </Text>
        );
      })}
    </Text>
  );
}

export default function SearchScreen() {
  const params = useLocalSearchParams<{
    fromMap?: string;
    city?: string;
    state?: string;
    category?: string;
  }>();

  const [search, setSearch] = useState("");
  const [categoryKey, setCategoryKey] =
    useState<(typeof CATEGORIES)[number]["key"]>("all");
  const [sort, setSort] = useState<
  "newest" | "priceLow" | "priceHigh" | "ratingHigh"
>("newest");

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Listing[]>([]);
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

  const searchInputRef = useRef<TextInput | null>(null);
  const appliedMapParamsRef = useRef(false);

  useEffect(() => {
    const q = query(
      collection(db, "listings"),
      where("status", "==", "active"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsub = onSnapshot(q, (snap) => {
      const rows: Listing[] = snap.docs.map((d) => {
        const data: any = d.data();
                return {
          id: d.id,
          title: data.title ?? "Listing",
          category: data.category ?? "",
          photoUrls: Array.isArray(data.photoUrls) ? data.photoUrls : [],
          price: Number(data.price ?? 0),
          pricingType: data.pricingType ?? "total",
          unit: data.unit ?? "",
          city: data.city ?? "",
          state: data.state ?? "",
          sellerRatingAverage: data.sellerRatingAverage ?? 0,
          sellerRatingCount: data.sellerRatingCount ?? 0,
          isPromoted: data.isPromoted === true,
          promotionExpiresAt: data.promotionExpiresAt ?? null,
          createdAt: data.createdAt,
          status: data.status ?? "active",
        };
      });

      setItems(rows);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (appliedMapParamsRef.current) return;

    const fromMap = params.fromMap === "1";
    const city = typeof params.city === "string" ? params.city.trim() : "";
    const state = typeof params.state === "string" ? params.state.trim() : "";
    const category = typeof params.category === "string" ? params.category.trim() : "";

    if (!fromMap) return;

    const locationSearch =
      city && state ? `${city}, ${state}` : city || state || "";

    if (locationSearch) {
      setSearch(locationSearch);
    }

    if (
  category === "livestock" ||
  category === "produce" ||
  category === "farm_goods" ||
  category === "equipment"
) {
  setCategoryKey(category);
}

    appliedMapParamsRef.current = true;
  }, [params.fromMap, params.city, params.state, params.category]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 250);

    return () => clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    let data = [...items];

    if (categoryKey !== "all") {
      data = data.filter((l) => l.category === categoryKey);
    }

    if (search.trim()) {
      const s = search.toLowerCase();
      data = data.filter(
        (l) =>
          l.title?.toLowerCase().includes(s) ||
          l.city?.toLowerCase().includes(s) ||
          l.state?.toLowerCase().includes(s) ||
          `${l.city ?? ""}, ${l.state ?? ""}`.toLowerCase().includes(s)
      );
    }

        const isActivePromotion = (item: Listing) => {
      if (!item.isPromoted) return false;
      if (!item.promotionExpiresAt) return true;

      const expiresAt = item.promotionExpiresAt?.seconds
        ? item.promotionExpiresAt.seconds * 1000
        : new Date(item.promotionExpiresAt).getTime();

      return expiresAt > Date.now();
    };

    data.sort((a, b) => {
      const aPromoted = isActivePromotion(a);
      const bPromoted = isActivePromotion(b);

      if (aPromoted && !bPromoted) return -1;
      if (!aPromoted && bPromoted) return 1;

      if (sort === "priceLow") {
        return (a.price ?? 0) - (b.price ?? 0);
      }

      if (sort === "priceHigh") {
        return (b.price ?? 0) - (a.price ?? 0);
      }

      if (sort === "ratingHigh") {
        return (b.sellerRatingAverage ?? 0) - (a.sellerRatingAverage ?? 0);
      }

      const aCreated = a.createdAt?.seconds ?? 0;
      const bCreated = b.createdAt?.seconds ?? 0;
      return bCreated - aCreated;
    });

    return data;
  }, [items, search, categoryKey, sort]);

  const toggleSort = () => {
  setSort((prev) =>
    prev === "newest"
      ? "priceLow"
      : prev === "priceLow"
      ? "priceHigh"
      : prev === "priceHigh"
      ? "ratingHigh"
      : "newest"
  );
};

  const sortLabel =
  sort === "newest"
    ? "Newest"
    : sort === "priceLow"
    ? "Price ↑"
    : sort === "priceHigh"
    ? "Price ↓"
    : "Top Rated";

  const formatPrice = (l: Listing) => {
    const p = Number(l.price ?? 0);
    if (!p) return "";
    if (l.pricingType === "per_unit" && l.unit) return `$${p} / ${l.unit}`;
    return `$${p}`;
  };

  const locationText = (item: Listing) => {
    return `${item.city ? item.city : "Unknown city"}${item.state ? `, ${item.state}` : ""}`;
  };

  const clearSearch = () => {
    setSearch("");
    searchInputRef.current?.focus();
  };

  const hasSearch = search.trim().length > 0;

  const header = (
  <View>
    <View style={styles.headerWrap}>
      <Text style={styles.header}>Search</Text>
      <Text style={styles.subheader}>
        Find listings by keyword, city, or category
      </Text>
    </View>

    <View style={styles.toggleRow}>
      <View style={styles.toggleActive}>
        <Text style={styles.toggleActiveText}>List</Text>
      </View>

      <Pressable
        onPress={() => router.push("/(tabs)/map")}
        style={styles.toggleInactive}
      >
        <Text style={styles.toggleInactiveText}>Map</Text>
      </Pressable>
    </View>

    <View style={styles.searchWrap}>
      <TextInput
        ref={searchInputRef}
        value={search}
        onChangeText={setSearch}
        placeholder="Search listings, city, state…"
        onSubmitEditing={Keyboard.dismiss}
        style={styles.searchInput}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
      />

      {hasSearch && (
        <Pressable onPress={clearSearch} hitSlop={10} style={styles.clearBtn}>
          <Text style={styles.clearBtnText}>×</Text>
        </Pressable>
      )}
    </View>

    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.pillsScroll}
      contentContainerStyle={styles.pillsScrollContent}
    >
      {CATEGORIES.map((c) => (
        <View key={c.key} style={styles.pillWrap}>
          <CategoryPill
            label={c.label}
            selected={c.key === categoryKey}
            onPress={() => setCategoryKey(c.key)}
          />
        </View>
      ))}
    </ScrollView>

    <Pressable onPress={toggleSort} style={styles.sortWrap}>
      <Text style={styles.sortText}>Sort: {sortLabel}</Text>
    </Pressable>
  </View>
);

  return (
  <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <Screen style={styles.screen}>
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="never"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            onScrollBeginDrag={Keyboard.dismiss}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={header}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyTitle}>No listings match your search</Text>
                <Text style={styles.emptyText}>
                  Try a different keyword or switch categories.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/listing/[id]",
                    params: { id: item.id, from: "explore" },
                  })
                }
                style={styles.card}
              >
                <View style={styles.imageWrap}>
                  {!!item.photoUrls?.[0] && (
                    <Image
                      source={{ uri: item.photoUrls[0] }}
                      style={{ width: "100%", height: "100%" }}
                    />
                  )}
                </View>

                                <View style={{ flex: 1 }}>
                                    {isActivePromotion(item) && (
                    <View style={styles.promotedBadge}>
                      <Text style={styles.promotedBadgeText}>Promoted</Text>
                    </View>
                  )}

                  <HighlightedText
                    text={`${getCategoryEmoji(item.category)} ${item.title || "Listing"}`}
                    query={search}
                    numberOfLines={1}
                    baseStyle={styles.cardTitle}
                    highlightStyle={styles.highlight}
                  />

                  <Text style={styles.cardPrice} numberOfLines={1}>
                    {formatPrice(item)}
                  </Text>

                  <HighlightedText
                    text={locationText(item)}
                    query={search}
                    numberOfLines={1}
                    baseStyle={styles.cardLocation}
                    highlightStyle={styles.highlightLocation}
                  />
                </View>
              </Pressable>
            )}
          />
        )}
      </Screen>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  screen: {
  flex: 1,
  backgroundColor: theme.colors.backgroundTint,
},

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  listContent: {
  paddingHorizontal: 8,
  paddingTop: 8,
  paddingBottom: 24,
},

headerWrap: {
  marginBottom: 10,
},

header: {
  fontSize: 28,
  fontWeight: "900",
  color: theme.colors.text,
},

subheader: {
  marginTop: 2,
  color: theme.colors.subtext,
  fontWeight: "700",
},

  toggleRow: {
  flexDirection: "row",
  backgroundColor: theme.colors.surface,
  borderRadius: 14,
  padding: 4,
  marginBottom: 12,
  borderWidth: 1,
  borderColor: theme.colors.border,
},
toggleActive: {
  flex: 1,
  backgroundColor: theme.colors.brand,
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
  color: theme.colors.text,
  fontWeight: "900",
},

  searchWrap: {
    position: "relative",
    marginBottom: 12,
  },
  searchInput: {
  borderWidth: 1,
  borderColor: theme.colors.border,
  borderRadius: 12,
  paddingVertical: 12,
  paddingLeft: 12,
  paddingRight: 46,
  backgroundColor: theme.colors.surface,
  color: theme.colors.text,
},
  clearBtn: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  clearBtnText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#64748b",
  },

  pillsScroll: {
    marginBottom: 12,
    minHeight: 56,
  },
  pillsScrollContent: {
    alignItems: "center",
    paddingVertical: 6,
    paddingLeft: 2,
    paddingRight: 16,
  },
  pillWrap: {
    marginRight: 8,
  },

  sortWrap: {
    alignSelf: "flex-end",
    marginBottom: 12,
  },
  sortText: {
  fontWeight: "800",
  color: theme.colors.brand,
},

  emptyWrap: {
    marginTop: 28,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
  color: theme.colors.text,
  fontWeight: "900",
  fontSize: 18,
  textAlign: "center",
  marginBottom: 6,
},
emptyText: {
  color: theme.colors.subtext,
  fontWeight: "600",
  textAlign: "center",
  lineHeight: 20,
},

    card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    gap: 12,
    backgroundColor: theme.colors.surface,
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
  imageWrap: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
  },
  cardTitle: {
  fontWeight: "900",
  color: theme.colors.text,
},
cardPrice: {
  color: theme.colors.brand,
  fontWeight: "800",
},
cardLocation: {
  color: theme.colors.subtext,
  fontWeight: "700",
},

  highlight: {
    backgroundColor: "#FEF08A",
    color: "#111827",
  },
  highlightLocation: {
    backgroundColor: "#FEF08A",
    color: "#475569",
  },
});