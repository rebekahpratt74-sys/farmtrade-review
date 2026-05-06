import { router, useLocalSearchParams } from "expo-router";
import {
  collection,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { FarmButton } from "../../../components/ui/FarmButton";
import RateSellerCard from "../../../components/ui/RateSellerCard";
import { auth, db } from "../../../lib/firebase";
import { theme } from "../../../lib/theme";

type Message = {
  id: string;
  senderId: string;
  text: string;
  createdAt?: any;
};

type Conversation = {
  id: string;
  participantIds: string[];
  buyerId?: string;
  sellerId?: string;
  listingId?: string;
  listingTitle?: string;
  unreadCount?: Record<string, number>;
  typing?: Record<string, any>;
  buyerCompleted?: boolean;
  sellerCompleted?: boolean;
  saleStatus?: "open" | "completed";
};

export default function MessageThreadScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const conversationId = params.id ? String(params.id) : "";

  const uid = auth.currentUser?.uid ?? null;

  const [loading, setLoading] = useState(true);
  const [conv, setConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");

  const listRef = useRef<FlatList<Message>>(null);

  const canSend = useMemo(() => {
    return !!uid && !!conversationId && text.trim().length > 0;
  }, [uid, conversationId, text]);

  const isBuyer = !!uid && !!conv?.buyerId && uid === conv.buyerId;
  const isSeller = !!uid && !!conv?.sellerId && uid === conv.sellerId;

  const saleCompleted = conv?.saleStatus === "completed";
  const buyerCompleted = !!conv?.buyerCompleted;
  const sellerCompleted = !!conv?.sellerCompleted;

  const canRateSeller = useMemo(() => {
    if (!uid || !conv) return false;
    if (!conv.sellerId) return false;
    if (conv.saleStatus !== "completed") return false;
    return uid === conv.buyerId;
  }, [uid, conv]);

  /* ---------------- TYPING SETUP ---------------- */

  const otherId = useMemo(() => {
    if (!uid || !conv) return null;
    return conv.participantIds.find((p) => p !== uid) ?? null;
  }, [uid, conv]);

  const lastTypingSentRef = useRef(0);
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendTypingPing = async () => {
    if (!uid || !conversationId) return;

    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;

    const convRef = doc(db, "conversations", conversationId);
    await setDoc(convRef, { typing: { [uid]: serverTimestamp() } }, { merge: true });
  };

  const startTyping = () => {
    if (typingIntervalRef.current) return;

    sendTypingPing();

    typingIntervalRef.current = setInterval(() => {
      sendTypingPing();
    }, 3000);
  };

  const stopTyping = () => {
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopTyping();
  }, []);

  const otherIsTyping = useMemo(() => {
    if (!conv || !otherId) return false;
    const ts = conv.typing?.[otherId];
    const ms = ts?.toMillis?.() ?? null;
    if (!ms) return false;
    return Date.now() - ms < 6000;
  }, [conv, otherId]);

  /* ---------------- CONVERSATION LISTENER ---------------- */

  useEffect(() => {
    if (!conversationId) return;

    const ref = doc(db, "conversations", conversationId);

    const unsub = onSnapshot(ref, async (snap) => {
      if (!snap.exists()) {
        setConv(null);
        setLoading(false);
        return;
      }

      const data: any = snap.data();

      const c: Conversation = {
        id: snap.id,
        participantIds: data.participantIds ?? [],
        buyerId: data.buyerId ?? "",
        sellerId: data.sellerId ?? "",
        listingId: data.listingId ?? "",
        listingTitle: data.listingTitle ?? "",
        unreadCount: data.unreadCount ?? {},
        typing: data.typing ?? {},
        buyerCompleted: !!data.buyerCompleted,
        sellerCompleted: !!data.sellerCompleted,
        saleStatus: data.saleStatus ?? "open",
      };

      setConv(c);
      setLoading(false);

      if (uid) {
        const myUnread = c.unreadCount?.[uid] ?? 0;
        if (myUnread > 0) {
          await updateDoc(ref, {
            [`unreadCount.${uid}`]: 0,
          });
        }
      }
    });

    return () => unsub();
  }, [conversationId, uid]);

  /* ---------------- MESSAGES LISTENER ---------------- */

  useEffect(() => {
    if (!conversationId) return;

    const q = query(
      collection(db, "conversations", conversationId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const rows: Message[] = snap.docs.map((d) => {
        const data: any = d.data();
        return {
          id: d.id,
          senderId: data.senderId ?? "",
          text: data.text ?? "",
          createdAt: data.createdAt ?? null,
        };
      });

      setMessages(rows);

      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 50);
    });

    return () => unsub();
  }, [conversationId]);

  /* ---------------- SEND MESSAGE ---------------- */

  const send = async () => {
    if (!uid || !conv) return;

    const body = text.trim();
    if (!body) return;

    const otherId = conv.participantIds.find((p) => p !== uid) ?? null;
    if (!otherId) return;

    setText("");
    stopTyping();

    const convRef = doc(db, "conversations", conversationId);
    const msgCol = collection(db, "conversations", conversationId, "messages");

    try {
      const batch = writeBatch(db);

      const msgRef = doc(msgCol);
      batch.set(msgRef, {
        senderId: uid,
        text: body,
        createdAt: serverTimestamp(),
      });

      batch.update(convRef, {
        lastMessageText: body,
        lastMessageAt: serverTimestamp(),
        lastMessageSenderId: uid,
        updatedAt: serverTimestamp(),
        hiddenFor: {},
        [`unreadCount.${otherId}`]: increment(1),
        [`unreadCount.${uid}`]: 0,
        [`typing.${uid}`]: null,
      });

      await batch.commit();
    } catch (e: any) {
      console.log("Send error:", e?.message ?? e);
    }
  };

  /* ---------------- SALE COMPLETION ---------------- */

  const markSaleComplete = async () => {
    if (!uid || !conv) return;

    const convRef = doc(db, "conversations", conversationId);

    try {
      if (saleCompleted) return;

      const updates: Record<string, any> = {
        updatedAt: serverTimestamp(),
      };

      if (isBuyer) updates.buyerCompleted = true;
      if (isSeller) updates.sellerCompleted = true;

      const nextBuyerCompleted = isBuyer ? true : buyerCompleted;
      const nextSellerCompleted = isSeller ? true : sellerCompleted;

      if (nextBuyerCompleted && nextSellerCompleted) {
        updates.saleStatus = "completed";
        updates.completedAt = serverTimestamp();
      }

      await updateDoc(convRef, updates);

      if (nextBuyerCompleted && nextSellerCompleted) {
        Alert.alert("Sale completed", "Both sides confirmed the sale.");
      } else {
        Alert.alert(
          "Marked complete",
          "Your confirmation was saved. Waiting on the other person."
        );
      }
    } catch (e: any) {
      console.log("markSaleComplete error:", e?.message ?? e);
      Alert.alert("Error", e?.message ?? "Could not update sale status.");
    }
  };

  const saleStatusText = useMemo(() => {
    if (saleCompleted) return "Sale completed";

    if (isBuyer && buyerCompleted && !sellerCompleted) {
      return "You confirmed completion. Waiting on seller.";
    }

    if (isSeller && sellerCompleted && !buyerCompleted) {
      return "You confirmed completion. Waiting on buyer.";
    }

    if (buyerCompleted && !sellerCompleted) {
      return "Buyer confirmed completion. Waiting on seller.";
    }

    if (sellerCompleted && !buyerCompleted) {
      return "Seller confirmed completion. Waiting on buyer.";
    }

    return "Mark this sale complete when the transaction is finished.";
  }, [saleCompleted, isBuyer, isSeller, buyerCompleted, sellerCompleted]);

  const myCompletionDone = (isBuyer && buyerCompleted) || (isSeller && sellerCompleted);

  /* ---------------- UI STATES ---------------- */

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading chat…</Text>
      </View>
    );
  }

  if (!conv) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Conversation not found</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  /* ---------------- RENDER ---------------- */

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={styles.top}>
        <Text style={styles.topTitle} numberOfLines={1}>
          {conv.listingTitle || "Chat"}
        </Text>

        {otherIsTyping && <Text style={styles.typing}>typing…</Text>}
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const mine = item.senderId === uid;

          return (
            <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
              <Text style={[styles.bubbleText, mine ? styles.textMine : styles.textTheirs]}>
                {item.text}
              </Text>
            </View>
          );
        }}
      />

      {(isBuyer || isSeller) && (
        <View style={styles.completionCard}>
          <Text style={styles.completionTitle}>Sale completion</Text>
          <Text style={styles.completionText}>{saleStatusText}</Text>

          {!saleCompleted && (
            <Pressable
              onPress={markSaleComplete}
              disabled={myCompletionDone}
              style={[
                styles.completeBtn,
                myCompletionDone && styles.completeBtnDisabled,
              ]}
            >
              <Text style={styles.completeBtnText}>
                {myCompletionDone ? "Waiting on other person" : "Mark Sale Complete"}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {canRateSeller && conv.sellerId && uid ? (
        <View style={styles.ratingSection}>
          <RateSellerCard
            sellerId={conv.sellerId}
            buyerId={uid}
            conversationId={conversationId}
            listingId={conv.listingId ?? ""}
          />
        </View>
      ) : null}

      <View style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            startTyping();
            sendTypingPing();
          }}
          onFocus={startTyping}
          onBlur={stopTyping}
          placeholder="Message…"
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
          multiline
        />

        <FarmButton title="Send" onPress={send} disabled={!canSend} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },

  top: {
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },

  topTitle: { ...theme.type.title, color: theme.colors.text },

  typing: {
    marginTop: 4,
    color: theme.colors.brandBright,
    fontWeight: "900",
  },

  listContent: {
    padding: theme.space.md,
    paddingBottom: theme.space.lg,
  },

  bubble: {
    maxWidth: "78%",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    marginBottom: theme.space.sm,
    borderWidth: 2,
  },

  bubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: theme.colors.brand,
    borderColor: theme.colors.brand,
  },

  bubbleTheirs: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.surface2,
    borderColor: theme.colors.border,
  },

  bubbleText: { fontWeight: "800", lineHeight: 19 },
  textMine: { color: "#fff" },
  textTheirs: { color: theme.colors.text },

  completionCard: {
    paddingHorizontal: theme.space.md,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: theme.colors.surface,
  },

  completionTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: theme.colors.text,
  },

  completionText: {
    marginTop: 4,
    color: theme.colors.subtext,
    fontWeight: "700",
  },

  completeBtn: {
    marginTop: 10,
    backgroundColor: theme.colors.brand,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    alignItems: "center",
  },

  completeBtnDisabled: {
    opacity: 0.65,
  },

  completeBtnText: {
    color: "#fff",
    fontWeight: "900",
  },

  ratingSection: {
    paddingHorizontal: theme.space.md,
    paddingTop: 6,
    backgroundColor: theme.colors.surface,
  },

  composer: {
    flexDirection: "row",
    gap: theme.space.sm,
    padding: theme.space.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },

  input: {
    flex: 1,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.md,
    fontWeight: "700",
    maxHeight: 110,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { marginTop: 8, color: theme.colors.subtext, fontWeight: "800" },
  title: { ...theme.type.h2, color: theme.colors.text },

  backBtn: {
    marginTop: 12,
    padding: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  backText: { fontWeight: "900", color: theme.colors.text },
});