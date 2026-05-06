import React, { useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Text,
  View,
} from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH;
const HERO_HEIGHT = 300;

type Props = {
  photos?: string[];
};

export function ListingPhotoCarousel({ photos = [] }: Props) {
  const listRef = useRef<FlatList<string>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const cleanPhotos = useMemo(() => {
    const arr = Array.isArray(photos) ? photos.filter((p) => !!p) : [];
    return arr;
  }, [photos]);

  const hasPhotos = cleanPhotos.length > 0;

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const next = Math.round(x / CARD_WIDTH);
    setActiveIndex(next);
  };

  if (!hasPhotos) {
    return (
      <View
        style={{
          width: "100%",
          height: HERO_HEIGHT,
          backgroundColor: "#E5E7EB",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#6B7280", fontWeight: "800" }}>No photo available</Text>
      </View>
    );
  }

  if (cleanPhotos.length === 1) {
    return (
      <View>
        <Image
          source={{ uri: cleanPhotos[0] }}
          style={{
            width: "100%",
            height: HERO_HEIGHT,
            backgroundColor: "#E5E7EB",
          }}
          resizeMode="cover"
        />

        <View
          style={{
            position: "absolute",
            right: 12,
            bottom: 12,
            backgroundColor: "rgba(17,24,39,0.75)",
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }}>1 / 1</Text>
        </View>
      </View>
    );
  }

  return (
    <View>
      <FlatList
        ref={listRef}
        data={cleanPhotos}
        keyExtractor={(item, i) => `${item}-${i}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={{
              width: CARD_WIDTH,
              height: HERO_HEIGHT,
              backgroundColor: "#E5E7EB",
            }}
            resizeMode="cover"
          />
        )}
      />

      {/* photo count pill */}
      <View
        style={{
          position: "absolute",
          right: 12,
          bottom: 14,
          backgroundColor: "rgba(17,24,39,0.75)",
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }}>
          {activeIndex + 1} / {cleanPhotos.length}
        </Text>
      </View>

      {/* dots */}
      <View
        style={{
          position: "absolute",
          bottom: 14,
          left: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
        }}
      >
        {cleanPhotos.map((_, i) => {
          const active = i === activeIndex;
          return (
            <View
              key={i}
              style={{
                width: active ? 16 : 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: active ? "#fff" : "rgba(255,255,255,0.55)",
              }}
            />
          );
        })}
      </View>
    </View>
  );
}