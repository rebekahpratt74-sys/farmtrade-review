import { db } from "@/lib/firebase";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useCallback, useEffect, useRef } from "react";

export function useTypingHeartbeat(conversationId: string, uid: string) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const sendTyping = useCallback(async () => {
    const ref = doc(db, "conversations", conversationId);

    await setDoc(
      ref,
      {
        typing: {
          [uid]: serverTimestamp(),
        },
      },
      { merge: true }
    );
  }, [conversationId, uid]);

  const startTyping = () => {
    if (intervalRef.current) return;

    sendTyping();

    intervalRef.current = setInterval(() => {
      sendTyping();
    }, 3000);
  };

  const stopTyping = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopTyping();
  }, []);

  return { startTyping, stopTyping, sendTyping };
}