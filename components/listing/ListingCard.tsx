import React, { useMemo, useState } from "react";
import {
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getCategoryEmoji } from "../../lib/categoryIcon";
import { theme } from "../../lib/theme";
import RatingStars from "../ui/RatingStars";

type Props = {
  title: string;
  category?: string;
  price: string;
  subtitle?: string;
  sellerName?: string;
  sellerPhotoUrl?: string | null;
  sellerRatingAverage?: number | null;
  sellerRatingCount?: number | null;
  image?: string;
  images?: string[];
  quantity?: number;
  distance?: string;
    isPromoted?: boolean;
  promotionExpiresAt?: any;
  rightElement?: React.ReactNode;
  onPress?: () => void;
};

export function ListingCard({
  title,
  category,
  price,
  subtitle,
  sellerName,
  sellerPhotoUrl,
  sellerRatingAverage,
  sellerRatingCount,
  image,
  images,
  quantity,
  distance,
  isPromoted,
  promotionExpiresAt,
  rightElement,
  onPress,
}: Props) {
  const [activeIndex, setActiveIndex] = useState(0);

    const activePromotion = useMemo(() => {
    if (!isPromoted) return false;
    if (!promotionExpiresAt) return true;

    const expiresAt =
      typeof promotionExpiresAt?.toDate === "function"
        ? promotionExpiresAt.toDate().getTime()
        : promotionExpiresAt?.seconds
          ? promotionExpiresAt.seconds * 1000
          : new Date(promotionExpiresAt).getTime();

    return expiresAt > Date.now();
  }, [isPromoted, promotionExpiresAt]);

  const photoList = useMemo(() => {
    if (Array.isArray(images) && images.length > 0) {
      return images.filter((u): u is string => typeof u === "string" && u.length > 0);
    }
    if (image) return [image];
    return [];
  }, [images, image]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const cardWidth = e.nativeEvent.layoutMeasurement.width;
    const next = Math.round(x / cardWidth);
    setActiveIndex(next);
  };

  return (
      <View style={[styles.card, activePromotion && styles.cardPromoted]}>  
      {photoList.length > 0 ? (
        <View style={styles.imageWrap}>
          {photoList.length === 1 ? (
            <Pressable onPress={onPress}>
              <Image source={{ uri: photoList[0] }} style={styles.image} />
            </Pressable>
          ) : (
            <View>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onMomentumEnd}
              >
                {photoList.map((uri, index) => (
                  <Pressable key={`${uri}-${index}`} onPress={onPress}>
                    <Image source={{ uri }} style={styles.image} />
                  </Pressable>
                ))}
              </ScrollView>

              <View style={styles.dotsWrap}>
                {photoList.map((_, i) => {
                  const active = i === activeIndex;
                  return (
                    <View
                      key={i}
                      style={[styles.dot, active ? styles.dotActive : styles.dotInactive]}
                    />
                  );
                })}
              </View>
            </View>
          )}
        </View>
      ) : (
        <Pressable onPress={onPress}>
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.imagePlaceholderText}>No Photo</Text>
          </View>
        </Pressable>
      )}

            <Pressable onPress={onPress}>
                {activePromotion && (
          <View style={styles.promotedBadge}>
            <Text style={styles.promotedBadgeText}>Promoted</Text>
          </View>
        )}

        <View style={styles.row}>
          <Text style={styles.title} numberOfLines={1}>
            {category ? `${getCategoryEmoji(category)} ${title}` : title}
          </Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>{price}</Text>
            {rightElement}
          </View>
        </View>

        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}

        {sellerName ? (
          <>
            <View style={styles.sellerRow}>
              <View style={styles.sellerAvatar}>
                {sellerPhotoUrl ? (
                  <Image source={{ uri: sellerPhotoUrl }} style={styles.sellerAvatarImage} />
                ) : (
                  <Text style={styles.sellerInitial}>
                    {(sellerName.trim()?.[0] || "S").toUpperCase()}
                  </Text>
                )}
              </View>

              <Text style={styles.sellerName} numberOfLines={1}>
                Sold by {sellerName}
              </Text>
            </View>

            <View style={styles.ratingWrap}>
              <RatingStars
  rating={sellerRatingAverage}
  count={sellerRatingCount}
  size={12}
  showTopRatedBadge
/>
            </View>
          </>
        ) : null}

        {quantity === 0 ? (
          <Text style={styles.soldOut}>SOLD OUT</Text>
        ) : quantity ? (
          <Text style={styles.quantity}>
            {quantity === 1 ? "Only 1 available" : `Available: ${quantity}`}
          </Text>
        ) : null}

        {distance ? <Text style={styles.distance}>{distance}</Text> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
    card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.space.md,
    marginBottom: theme.space.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  cardPromoted: {
    borderColor: "#F59E0B",
    borderWidth: 2,
  },

  promotedBadge: {
    alignSelf: "flex-start",
    marginBottom: 8,
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
    marginBottom: theme.space.sm,
    borderRadius: theme.radius.md,
    overflow: "hidden",
  },

  image: {
    width: 320,
    height: 180,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.mutedBg,
    marginRight: 8,
  },

  imagePlaceholder: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  imagePlaceholderText: {
    color: theme.colors.subtext,
    fontWeight: "700",
  },

  dotsWrap: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },

  dot: {
    height: 8,
    borderRadius: 999,
  },

  dotActive: {
    width: 18,
    backgroundColor: "#fff",
  },

  dotInactive: {
    width: 8,
    backgroundColor: "rgba(255,255,255,0.6)",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.space.sm,
  },

  title: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "800",
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
  },

  price: {
    color: theme.colors.brand,
    fontWeight: "900",
  },

  subtitle: {
    color: theme.colors.subtext,
    fontWeight: "600",
    marginTop: 4,
  },

  sellerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },

  sellerAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: "hidden",
    backgroundColor: theme.colors.avatarBg,
    alignItems: "center",
    justifyContent: "center",
  },

  sellerAvatarImage: {
    width: "100%",
    height: "100%",
  },

  sellerInitial: {
    fontSize: 11,
    fontWeight: "900",
    color: theme.colors.slate700,
  },

  sellerName: {
    color: theme.colors.subtext,
    fontWeight: "700",
    fontSize: 13,
    flex: 1,
  },

  ratingWrap: {
    marginTop: 4,
    marginLeft: 30,
  },

  quantity: {
    marginTop: 4,
    fontWeight: "800",
    color: theme.colors.brand,
  },

  soldOut: {
    marginTop: 4,
    fontWeight: "900",
    color: "#b91c1c",
  },

  distance: {
    marginTop: 4,
    fontWeight: "700",
    color: theme.colors.subtext,
  },
});