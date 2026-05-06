import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useMemo } from "react";
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
import { useCreate } from "../../../hooks/createContext";
import { theme } from "../../../lib/theme";

type PhotoItem =
  | { type: "remote"; uri: string }
  | { type: "local"; uri: string };

const MAX_PHOTOS = 5;

export default function PhotosScreen() {
  const { draft, setDraft, loadingExisting } = useCreate();
  const insets = useSafeAreaInsets();

  const remoteUris = useMemo(
    () =>
      Array.isArray(draft.photoUrls)
        ? draft.photoUrls.filter(
            (u): u is string => typeof u === "string" && u.length > 0
          )
        : [],
    [draft.photoUrls]
  );

  const localUris = useMemo(
    () =>
      Array.isArray(draft.localPhotoUris)
        ? draft.localPhotoUris.filter(
            (u): u is string => typeof u === "string" && u.length > 0
          )
        : [],
    [draft.localPhotoUris]
  );

  const orderUris = useMemo(() => {
    const fallback = [...remoteUris, ...localUris];
    const order =
      Array.isArray(draft.photoOrder) && draft.photoOrder.length > 0
        ? draft.photoOrder.filter(
            (u): u is string => typeof u === "string" && u.length > 0
          )
        : fallback;

    const allowed = new Set([...remoteUris, ...localUris]);
    return order.filter((u) => allowed.has(u));
  }, [draft.photoOrder, remoteUris, localUris]);

  const photoItems: PhotoItem[] = useMemo(() => {
    const localSet = new Set(localUris);
    return orderUris.map((uri) => ({
      type: localSet.has(uri) ? ("local" as const) : ("remote" as const),
      uri,
    }));
  }, [orderUris, localUris]);

  const addPhotos = async () => {
  const currentCount = photoItems.length;
  const remainingSlots = MAX_PHOTOS - currentCount;

  if (remainingSlots <= 0) {
    Alert.alert("Photo Limit", "You can upload up to 5 photos per listing.");
    return;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    quality: 0.8,
    selectionLimit: remainingSlots,
  });

  if (result.canceled) return;

  const selectedUris = result.assets.map((a) => a.uri).filter(Boolean);
  const allowedUris = selectedUris.slice(0, remainingSlots);

  if (selectedUris.length > remainingSlots) {
    Alert.alert(
      "Photo Limit",
      `You can upload up to 5 photos per listing. You can add ${remainingSlots} more.`
    );
  }

  const baseOrder =
    Array.isArray(draft.photoOrder) && draft.photoOrder.length > 0
      ? draft.photoOrder
      : [...remoteUris, ...localUris];

  setDraft({
    localPhotoUris: [...localUris, ...allowedUris],
    photoOrder: [...baseOrder, ...allowedUris],
  });
};

  const removePhoto = (item: PhotoItem) => {
    Alert.alert(
      "Remove photo?",
      "This will update your photos when you save changes.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            if (item.type === "local") {
              setDraft({
                localPhotoUris: localUris.filter((u) => u !== item.uri),
                photoOrder: orderUris.filter((u) => u !== item.uri),
              });
            } else {
              setDraft({
                photoUrls: remoteUris.filter((u) => u !== item.uri),
                removedRemoteUrls: [...(draft.removedRemoteUrls ?? []), item.uri],
                photoOrder: orderUris.filter((u) => u !== item.uri),
              });
            }
          },
        },
      ]
    );
  };

  const setAsCover = (uri: string) => {
    setDraft({
      photoOrder: [uri, ...orderUris.filter((u) => u !== uri)],
    });
  };

  const movePhoto = (uri: string, direction: -1 | 1) => {
    const idx = orderUris.indexOf(uri);
    const newIdx = idx + direction;
    if (idx < 0 || newIdx < 0 || newIdx >= orderUris.length) return;

    const next = [...orderUris];
    const temp = next[idx];
    next[idx] = next[newIdx];
    next[newIdx] = temp;

    setDraft({ photoOrder: next });
  };

  const canNext = photoItems.length > 0 && photoItems.length <= MAX_PHOTOS;

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 16),
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={[
            styles.floatingBackBtn,
            { top: Math.max(insets.top, 12) },
          ]}
        >
          <Text style={styles.floatingBackText}>Back</Text>
        </Pressable>

        <Text style={styles.eyebrow}>Step 3</Text>
        <Text style={styles.header}>Photos</Text>
        <Text style={styles.subheader}>
  Add up to 5 photos, choose a cover image, and reorder them with the arrows.
</Text>

        {loadingExisting ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={theme.colors.brand} />
            <Text style={styles.loadingText}>Loading listing…</Text>
          </View>
        ) : null}

        <Pressable style={styles.addBtn} onPress={addPhotos}>
          <Text style={styles.addBtnText}>Add Photos</Text>
        </Pressable>

        {photoItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No photos added yet</Text>
            <Text style={styles.emptyText}>
              Add at least one photo so buyers can clearly see your listing.
            </Text>
          </View>
        ) : (
          <FlatList
            data={photoItems}
            keyExtractor={(it, i) => `${it.type}:${it.uri}:${i}`}
            numColumns={3}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: 150,
            }}
            renderItem={({ item }) => {
              const isCover = orderUris[0] === item.uri;

              return (
                <Pressable
                  style={[styles.photoWrap, isCover && styles.photoWrapCover]}
                  onPress={() => setAsCover(item.uri)}
                >
                  <Image source={{ uri: item.uri }} style={styles.photo} />

                  {isCover ? (
                    <View style={styles.coverPill}>
                      <Text style={styles.coverText}>Cover</Text>
                    </View>
                  ) : null}

                  <Pressable
                    style={styles.removeBtn}
                    onPress={() => removePhoto(item)}
                    hitSlop={10}
                  >
                    <Text style={styles.removeText}>✕</Text>
                  </Pressable>

                  <Pressable
                    style={styles.leftBtn}
                    onPress={() => movePhoto(item.uri, -1)}
                    hitSlop={10}
                  >
                    <Text style={styles.arrowText}>‹</Text>
                  </Pressable>

                  <Pressable
                    style={styles.rightBtn}
                    onPress={() => movePhoto(item.uri, 1)}
                    hitSlop={10}
                  >
                    <Text style={styles.arrowText}>›</Text>
                  </Pressable>
                </Pressable>
              );
            }}
          />
        )}
      </View>

      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <Pressable
          style={[styles.nextBtn, !canNext && styles.disabled]}
          disabled={!canNext}
          onPress={() => {
  if (photoItems.length > MAX_PHOTOS) {
    Alert.alert("Photo Limit", "You can upload up to 5 photos per listing.");
    return;
  }

  router.push("/(tabs)/create/review");
}}
        >
          <Text style={styles.nextText}>Next</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.backgroundTint,
  },

  content: {
    flex: 1,
    paddingHorizontal: 20,
  },

  floatingBackBtn: {
    position: "absolute",
    right: 20,
    zIndex: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },

  floatingBackText: {
    fontWeight: "900",
    color: "#111827",
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: theme.colors.brand,
    marginBottom: 8,
    marginTop: 44,
  },

  header: {
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 6,
    color: theme.colors.text,
  },

  subheader: {
    color: "#64748B",
    marginBottom: 16,
    fontWeight: "600",
    lineHeight: 22,
  },

  loadingWrap: {
    paddingVertical: 14,
  },

  loadingText: {
    textAlign: "center",
    marginTop: 8,
    color: "#667",
    fontWeight: "700",
  },

  addBtn: {
    backgroundColor: theme.colors.brand,
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 14,
  },

  addBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
    marginTop: 8,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 6,
  },

  emptyText: {
    color: "#64748B",
    textAlign: "center",
    fontWeight: "600",
    lineHeight: 20,
  },

  photoWrap: {
    width: "33.33%",
    aspectRatio: 1,
    padding: 4,
  },

  photoWrapCover: {
    opacity: 1,
  },

  photo: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "#eee",
  },

  coverPill: {
    position: "absolute",
    left: 10,
    top: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(31,122,63,0.95)",
  },

  coverText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
  },

  removeBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },

  removeText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 16,
  },

  leftBtn: {
    position: "absolute",
    bottom: 10,
    left: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },

  rightBtn: {
    position: "absolute",
    bottom: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },

  arrowText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 18,
  },

  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    gap: 10,
  },

  nextBtn: {
    flex: 1,
    backgroundColor: theme.colors.brand,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },

  disabled: {
    opacity: 0.4,
  },

  nextText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  },
});