import { onAuthStateChanged, type User } from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";

type AuthState = {
  user: User | null;
  initializing: boolean;
};

const AuthContext = createContext<AuthState>({
  user: null,
  initializing: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      if (u) {
        try {
          const userRef = doc(db, "users", u.uid);
          const snap = await getDoc(userRef);

          // ✅ Create user doc if it doesn't exist
          if (!snap.exists()) {
            await setDoc(userRef, {
              name: u.displayName || "",
              email: u.email || "",
              photoUrl: "",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }

          // ✅ Backfill createdAt if missing (for older users)
          else if (!snap.data()?.createdAt) {
            await setDoc(
              userRef,
              { createdAt: serverTimestamp() },
              { merge: true }
            );
          }
        } catch (e) {
          console.log("User doc creation error:", e);
        }
      }

      setInitializing(false);
    });

    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ user, initializing }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}