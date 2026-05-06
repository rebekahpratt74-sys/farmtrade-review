import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Card } from "../../../components/ui/Card";
import { Screen } from "../../../components/ui/Screen";
import { Section } from "../../../components/ui/Section";
import { auth, db } from "../../../lib/firebase";
import { theme } from "../../../lib/theme";

type Conversation = {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  participantIds: string[];
  listingTitle?: string;
  listingPhotoUrl?: string;
  listingPrice?: number;
  listingPricingType?: "total" | "per_unit";
  listingUnit?: string;
  lastMessageText?: string;
  lastMessageAt?: any;
  lastMessageSenderId?: string;
  unreadCount?: Record<string, number>;
  updatedAt?: any;
  hiddenFor?: Record<string, boolean>;
  typing?: Record<string, any>;
  buyerCompleted?: boolean;
  sellerCompleted?: boolean;
  saleStatus?: "open" | "completed";
};

type PublicUser = {
  name?: string;
  photoUrl?: string | null;
};

function formatPrice(c: Conversation) {
  const p = Number(c.listingPrice ?? 0);
  if (!p) return "";
  if (c.listingPricingType === "per_unit" && c.listingUnit) return `$${p} / ${c.listingUnit}`;
  return `$${p}`;
}

function previewText(c: Conversation, myUid: string | null) {
  const t = (c.lastMessageText ?? "").trim();
  if (!t) return "No messages yet";
  if (myUid && c.lastMessageSenderId === myUid) return `You: ${t}`;
  return t;
}

function toMillis(ts: any): number {
  if (!ts) return 0;
  if (typeof ts?.toMillis === "function") return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === "number") return ts;
  return 0;
}

function relativeTime(ts: any) {
  const ms = toMillis(ts);
  if (!ms) return "";
  const now = Date.now();
  const diff = Math.max(0, now - ms);

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "now";
  if (diff < hour) return `${Math.floor(diff / minute)}m`;
  if (diff < day) return `${Math.floor(diff / hour)}h`;

  const days = Math.floor(diff / day);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d`;

  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isTyping(ts: any) {
  const ms = ts?.toMillis?.() ?? null;
  if (!ms) return false;
  return Date.now() - ms < 6000;
}

function getSaleBadge(
  item: Conversation,
  uid: string | null
): { label: string; kind: "success" | "warning" | "muted" } | null {
  if (!uid) return null;

  const isBuyer = uid === item.buyerId;
  const isSeller = uid === item.sellerId;

  const buyerCompleted = !!item.buyerCompleted;
  const sellerCompleted = !!item.sellerCompleted;
  const saleCompleted = item.saleStatus === "completed";

  if (saleCompleted) {
    return { label: "Completed", kind: "success" };
  }

  if (isBuyer) {
    if (!buyerCompleted && sellerCompleted) {
      return { label: "Waiting for your confirmation", kind: "warning" };
    }
    if (buyerCompleted && !sellerCompleted) {
      return { label: "Waiting for seller confirmation", kind: "muted" };
    }
  }

  if (isSeller) {
    if (!sellerCompleted && buyerCompleted) {
      return { label: "Waiting for your confirmation", kind: "warning" };
    }
    if (sellerCompleted && !buyerCompleted) {
      return { label: "Waiting for buyer confirmation", kind: "muted" };
    }
  }

  return null;
}

export default function MessagesInboxScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Conversation[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [errText, setErrText] = useState<string | null>(null);
  const [, setMinuteTick] = useState(0);
  const [, setTypingTick] = useState(0);

  const [otherUsers, setOtherUsers] = useState<Record<string, PublicUser>>({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return unsub;
  }, []);

  useEffect(() => {
    const id = setInterval(() => setMinuteTick((n) => n + 1), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTypingTick((n) => n + 1), 1500);
    return () => clearInterval(id);
  }, []);

  const emptyText = useMemo(() => {
    if (!uid) return "Log in to view messages.";
    return "No messages yet.\nFind a listing and tap “Message Seller”.";
  }, [uid]);

  const markConversationReadForMe = async (conversationId: string) => {
    if (!uid) return;
    try {
      await updateDoc(doc(db, "conversations", conversationId), {
        [`unreadCount.${uid}`]: 0,
      });
    } catch (e: any) {
      console.log("Mark read error:", e?.message ?? e);
    }
  };

  const hideConversationForMe = async (conversationId: string) => {
    if (!uid) return;
    try {
      await updateDoc(doc(db, "conversations", conversationId), {
        [`hiddenFor.${uid}`]: true,
        [`unreadCount.${uid}`]: 0,
      });
    } catch (e: any) {
      console.log("Hide conversation error:", e?.message ?? e);
    }
  };

  useEffect(() => {
    setItems([]);
    setErrText(null);
    setLoading(true);

    if (!uid) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "conversations"),
      where("participantIds", "array-contains", uid)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: Conversation[] = snap.docs.map((d) => {
          const data: any = d.data();
          return {
            id: d.id,
            listingId: data.listingId ?? "",
            buyerId: data.buyerId ?? "",
            sellerId: data.sellerId ?? "",
            participantIds: Array.isArray(data.participantIds) ? data.participantIds : [],
            listingTitle: data.listingTitle ?? "",
            listingPhotoUrl: data.listingPhotoUrl ?? "",
            listingPrice: Number(data.listingPrice ?? 0),
            listingPricingType: data.listingPricingType ?? "total",
            listingUnit: data.listingUnit ?? "",
            lastMessageText: data.lastMessageText ?? "",
            lastMessageAt: data.lastMessageAt ?? null,
            lastMessageSenderId: data.lastMessageSenderId ?? "",
            unreadCount: data.unreadCount ?? {},
            updatedAt: data.updatedAt ?? null,
            hiddenFor: data.hiddenFor ?? {},
            typing: data.typing ?? {},
            buyerCompleted: !!data.buyerCompleted,
            sellerCompleted: !!data.sellerCompleted,
            saleStatus: data.saleStatus ?? "open",
          };
        });

        rows.sort((a, b) => {
          const ta = Math.max(toMillis(a.lastMessageAt), toMillis(a.updatedAt));
          const tb = Math.max(toMillis(b.lastMessageAt), toMillis(b.updatedAt));
          return tb - ta;
        });

        setItems(rows.filter((c) => !(c.hiddenFor?.[uid])));
        setLoading(false);
      },
      (err) => {
        console.log("Inbox listener error:", err.code, err.message);
        setErrText(`${err.code}: ${err.message}`);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [uid]);

  useEffect(() => {
    const me = uid;
    if (!me) return;
    if (items.length === 0) return;

    const load = async () => {
      try {
        const needed = new Set<string>();

        for (const c of items) {
          const otherId = (c.participantIds || []).find((id) => id !== me) ?? null;
          if (otherId && !otherUsers[otherId]) needed.add(otherId);
        }

        if (needed.size === 0) return;

        const updates: Record<string, PublicUser> = {};
        for (const otherId of needed) {
          const snap = await getDoc(doc(db, "users", otherId));
          if (snap.exists()) {
            const data: any = snap.data();
            updates[otherId] = {
              name: (data.name ?? "").toString(),
              photoUrl: data.photoUrl ?? null,
            };
          } else {
            updates[otherId] = { name: "User", photoUrl: null };
          }
        }

        setOtherUsers((prev) => ({ ...prev, ...updates }));
      } catch (e: any) {
        console.log("Load other users error:", e?.message ?? e);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, uid]);

  if (loading) {
    return (
  <Screen style={{ backgroundColor: theme.colors.backgroundTint }}>
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Loading messages…</Text>
        </View>
      </Screen>
    );
  }

  return (
  <Screen style={{ backgroundColor: theme.colors.backgroundTint }}>
      <View style={styles.headerCard}>
  <View>
    <Text style={styles.header}>Messages</Text>
    <Text style={styles.subheader}>Deals, questions, and pickup plans</Text>
  </View>
</View>

      {errText ? (
        <View style={styles.errBox}>
          <Text style={styles.errTitle}>Inbox error</Text>
          <Text style={styles.errText}>{errText}</Text>
        </View>
      ) : null}

      <Section title="">
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={[
            { paddingBottom: theme.space.lg },
            items.length === 0 && { flex: 1, justifyContent: "center" },
          ]}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons name="chatbubble-ellipses" size={22} color={theme.colors.text} />
              </View>
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptyText}>{emptyText}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const me = uid ?? "";
            const unread = item.unreadCount?.[me] ?? 0;
            const isUnread = unread > 0;

            const timeLabel = relativeTime(item.lastMessageAt ?? item.updatedAt);

            const otherId = (item.participantIds || []).find((id) => id !== me) ?? "";
            const other = otherUsers[otherId];
            const displayName = (other?.name && other.name.trim()) || "User";
            const initial = displayName[0]?.toUpperCase() || "U";

            const otherIsTyping = !!otherId && isTyping(item.typing?.[otherId]);
            const preview = otherIsTyping ? "typing…" : previewText(item, uid);
            const saleBadge = getSaleBadge(item, uid);

            return (
              <Swipeable
                renderRightActions={() => (
                  <Pressable style={styles.swipeDelete} onPress={() => hideConversationForMe(item.id)}>
                    <Ionicons name="trash" size={18} color="white" />
                    <Text style={styles.swipeDeleteText}>Delete</Text>
                  </Pressable>
                )}
                overshootRight={false}
              >
                <Card
                  variant={isUnread ? "unread" : "default"}
                  padded={false}
                  style={styles.card}
                >
                  <View
  style={[styles.avatarWrap, isUnread && styles.avatarWrapUnread]}
>
  {item.listingPhotoUrl ? (
    <Image source={{ uri: item.listingPhotoUrl }} style={styles.avatarImg} />
  ) : (
    <Text style={styles.avatarInitial}>📦</Text>
  )}
</View>

                  <Pressable
                    style={{ flex: 1 }}
                    onPress={async () => {
                      await markConversationReadForMe(item.id);

                      router.push({
                        pathname: "/(tabs)/messages/[id]",
                        params: { id: item.id },
                      });
                    }}
                  >
                    <View style={styles.rowTop}>
                      <Pressable
  onPress={() => {
    if (!otherId) return;
    router.push({ pathname: "/public-profile/[uid]", params: { uid: otherId } });
  }}
>
  <Text style={[styles.name, isUnread && styles.nameUnread]} numberOfLines={1}>
    {displayName}
  </Text>
</Pressable>

                      <View style={styles.rightMeta}>
                        {!!timeLabel && (
                          <Text style={[styles.time, isUnread ? styles.timeUnread : styles.timeRead]}>
                            {timeLabel}
                          </Text>
                        )}

                        {isUnread ? <View style={styles.unreadPill} /> : null}
                      </View>
                    </View>

                    <View style={styles.listingLine}>
                      <Text style={styles.listingTitle} numberOfLines={1}>
                        {item.listingTitle || "Listing"}
                      </Text>

                      {!!formatPrice(item) && (
                        <View style={styles.pricePill}>
                          <Text style={styles.priceText}>{formatPrice(item)}</Text>
                        </View>
                      )}
                    </View>

                    {saleBadge ? (
                      <View
                        style={[
                          styles.saleBadge,
                          saleBadge.kind === "success"
                            ? styles.saleBadgeSuccess
                            : saleBadge.kind === "warning"
                              ? styles.saleBadgeWarning
                              : styles.saleBadgeMuted,
                        ]}
                      >
                        <Text
                          style={[
                            styles.saleBadgeText,
                            saleBadge.kind === "success"
                              ? styles.saleBadgeTextSuccess
                              : saleBadge.kind === "warning"
                                ? styles.saleBadgeTextWarning
                                : styles.saleBadgeTextMuted,
                          ]}
                        >
                          {saleBadge.label}
                        </Text>
                      </View>
                    ) : null}

                    <Text
                      style={[
                        styles.preview,
                        otherIsTyping
                          ? styles.previewTyping
                          : isUnread
                            ? styles.previewUnread
                            : styles.previewRead,
                      ]}
                      numberOfLines={1}
                    >
                      {preview}
                    </Text>
                  </Pressable>
                </Card>
              </Swipeable>
            );
          }}
        />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.space.md,
  },
  header: { ...theme.type.h1, color: theme.colors.text },
  subheader: {
  marginTop: 2,
  color: theme.colors.subtext,
  fontWeight: "800",
},

  errBox: {
    borderWidth: 1,
    borderColor: theme.colors.dangerBorder,
    backgroundColor: theme.colors.dangerSoft,
    padding: theme.space.md,
    borderRadius: theme.radius.lg,
    marginBottom: theme.space.md,
  },
  errTitle: { fontWeight: "900", color: theme.colors.dangerText, marginBottom: 4 },
  errText: { color: theme.colors.dangerText, fontWeight: "800" },

  card: {
  padding: theme.space.md,
  borderRadius: theme.radius.lg,
  marginBottom: theme.space.sm,
  flexDirection: "row",
  gap: theme.space.md,
  alignItems: "center",
  backgroundColor: theme.colors.surface,
  borderWidth: 1,
  borderColor: theme.colors.border,
  shadowColor: "#000",
  shadowOpacity: 0.04,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 1,
},
  avatarWrap: {
    width: 54,
    height: 54,
    borderRadius: theme.radius.md,
    overflow: "hidden",
    backgroundColor: theme.colors.avatarBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#e5e7eb",
  },
  avatarWrapUnread: { borderColor: theme.colors.brandBright },
  avatarImg: { width: "100%", height: "100%" },
  avatarInitial: { fontSize: 18, fontWeight: "900", color: theme.colors.text },

  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.space.sm,
  },
  rightMeta: { flexDirection: "row", alignItems: "center", gap: theme.space.sm },

  name: { ...theme.type.title, flex: 1, color: theme.colors.text },
  nameUnread: { color: theme.colors.text },

  time: { ...theme.type.sub },
  timeRead: { color: theme.colors.borderStrong },
  timeUnread: { color: theme.colors.text },

  unreadPill: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.danger,
  },

  listingLine: {
    marginTop: theme.space.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
  },
  listingTitle: {
  flex: 1,
  color: theme.colors.text,
  fontWeight: "900",
},

  pricePill: {
  paddingHorizontal: 10,
  paddingVertical: 5,
  borderRadius: theme.radius.pill,
  backgroundColor: theme.colors.surface,
  borderWidth: 1,
  borderColor: theme.colors.chipBorder,
},
priceText: {
  color: theme.colors.brand,
  fontWeight: "900",
  fontSize: 12,
},

  saleBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
  },

  saleBadgeSuccess: {
  backgroundColor: "#DCFCE7",
  borderColor: "#BBF7D0",
},
saleBadgeWarning: {
  backgroundColor: "#FEF3C7",
  borderColor: "#FDE68A",
},
saleBadgeMuted: {
  backgroundColor: theme.colors.surface,
  borderColor: theme.colors.border,
},

  saleBadgeText: {
    fontWeight: "900",
    fontSize: 12,
  },
  saleBadgeTextSuccess: {
    color: "#166534",
  },
  saleBadgeTextWarning: {
    color: "#92400E",
  },
  saleBadgeTextMuted: {
    color: "#475569",
  },

  preview: { marginTop: theme.space.xs },
  previewUnread: { color: theme.colors.text, fontWeight: "800" },
  previewRead: { color: theme.colors.muted, fontWeight: "800" },
  previewTyping: { color: theme.colors.brandBright, fontWeight: "900" },

  swipeDelete: {
    width: 92,
    marginBottom: theme.space.sm,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.danger,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  swipeDeleteText: { color: "#fff", fontWeight: "900" },

  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.space.xl,
    gap: theme.space.sm,
  },
  emptyIcon: {
  width: 54,
  height: 54,
  borderRadius: theme.radius.md,
  backgroundColor: theme.colors.mutedBg,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1,
  borderColor: theme.colors.border,
},
  emptyTitle: { ...theme.type.h2, color: theme.colors.text },
  emptyText: {
    textAlign: "center",
    color: theme.colors.subtext,
    fontWeight: "800",
    lineHeight: 20,
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { marginTop: 8, color: theme.colors.subtext, fontWeight: "800" },

  headerCard: {
  backgroundColor: theme.colors.surface,
  borderRadius: theme.radius.xl,
  padding: theme.space.lg,
  marginBottom: theme.space.lg,
  borderWidth: 1,
  borderColor: theme.colors.border,
},
});