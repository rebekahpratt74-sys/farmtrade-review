import * as Location from "expo-location";
import { router } from "expo-router";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { CityAutocomplete } from "../../components/location/CityAutocomplete";
import { Card } from "../../components/ui/Card";
import { Screen } from "../../components/ui/Screen";
import { auth, db } from "../../lib/firebase";
import { theme } from "../../lib/theme";

export default function MarketAreaScreen() {
  const [loading, setLoading] = useState(true);

  const [stateInput, setStateInput] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [zipInput, setZipInput] = useState("");

  const [radiusMiles, setRadiusMiles] = useState(100);

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  const uid = auth.currentUser?.uid ?? null;

  /* -------------------- Load saved market area -------------------- */

  useEffect(() => {
    const load = async () => {
      if (!uid) {
        setLoading(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", uid));
        const data: any = snap.exists() ? snap.data() : null;
        const area = data?.marketArea;

        setStateInput((area?.state ?? "").toString().toUpperCase());
        setCityInput((area?.city ?? "").toString());
        setZipInput((area?.zip ?? "").toString());

        const r = Number(area?.radiusMiles ?? 100);
        setRadiusMiles(Number.isFinite(r) ? r : 100);

        setLat(typeof area?.lat === "number" ? area.lat : null);
        setLng(typeof area?.lng === "number" ? area.lng : null);
      } catch (e) {
        console.log("Load market area error:", e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [uid]);

  /* -------------------- Actions -------------------- */

 const apply = async () => {
  Keyboard.dismiss();
  if (!uid) return;

  const nextState = stateInput.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
  const nextCity = cityInput.trim();
  const nextZip = zipInput.trim().replace(/[^0-9]/g, "").slice(0, 5);

  if (nextState.length !== 2) return;

  // ✅ Geocode (ZIP first)
  let nextLat: number | null = null;
  let nextLng: number | null = null;

  try {
    const queryStr =
      nextZip.length === 5
        ? `${nextZip}, ${nextState}`
        : nextCity
        ? `${nextCity}, ${nextState}`
        : nextState;

    const results = await Location.geocodeAsync(queryStr);
    if (results?.[0]) {
      nextLat = results[0].latitude;
      nextLng = results[0].longitude;
    }
  } catch (e) {
    console.log("Geocode market area failed:", e);
  }

  // ✅ 1) UPDATE LOCAL STATE FIRST (instant UI update)
  setStateInput(nextState);
  setCityInput(nextCity);
  setZipInput(nextZip);
  setLat(nextLat);
  setLng(nextLng);
  // radiusMiles is already state — no need to set it here unless you want

  // ✅ 2) SAVE TO FIRESTORE
  try {
    await updateDoc(doc(db, "users", uid), {
      marketArea: {
        state: nextState,
        city: nextCity,
        zip: nextZip,
        radiusMiles,
        lat: nextLat,
        lng: nextLng,
        updatedAt: serverTimestamp(),
      },
    });

    // ✅ 3) GO BACK
    router.back();
  } catch (e: any) {
    console.log("Save marketArea error:", e?.message ?? e);
  }
};

  const clear = async () => {
  Keyboard.dismiss();

  // ✅ instant UI update
  setStateInput("");
  setCityInput("");
  setZipInput("");
  setRadiusMiles(100);
  setLat(null);
  setLng(null);

  if (!uid) return;

  try {
    await updateDoc(doc(db, "users", uid), {
      marketArea: {
        state: "",
        city: "",
        zip: "",
        radiusMiles: 100,
        lat: null,
        lng: null,
        updatedAt: serverTimestamp(),
      },
    });
  } catch (e: any) {
    console.log("Clear marketArea error:", e?.message ?? e);
  }
};

  /* -------------------- UI -------------------- */

  if (loading) {
    return (
      <Screen center>
        <ActivityIndicator />
        <Text>Loading…</Text>
      </Screen>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <Screen>
        <Text style={{ fontSize: 26, fontWeight: "900" }}>Market Area</Text>
        <Text style={{ color: theme.colors.subtext, marginTop: 6, fontWeight: "700" }}>
          Choose where “nearby” is for your marketplace feed.
        </Text>

        <Card style={{ marginTop: theme.space.md }}>
          <View style={{ gap: theme.space.sm }}>
            {/* State + City */}
            <View style={{ flexDirection: "row", gap: theme.space.sm }}>
              <View style={{ flex: 0.6 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "900",
                    color: theme.colors.subtext,
                    marginBottom: 6,
                  }}
                >
                  State
                </Text>
                <TextInput
                  value={stateInput}
                  onChangeText={(t) =>
                    setStateInput(t.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))
                  }
                  placeholder="MO"
                  maxLength={2}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  placeholderTextColor={theme.colors.subtext}
                  style={{
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.mutedBg,
                    borderRadius: theme.radius.md,
                    paddingHorizontal: theme.space.md,
                    paddingVertical: 10,
                    fontWeight: "900",
                    color: theme.colors.text,
                    textAlign: "center",
                  }}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "900",
                    color: theme.colors.subtext,
                    marginBottom: 6,
                  }}
                >
                  City
                </Text>

                <CityAutocomplete
                  city={cityInput}
                  state={stateInput}
                  onCityChange={setCityInput}
                  placeholder="Pick a market town…"
                  onSelect={(s) => {
                    setCityInput(s.city);
                    setStateInput(s.state);
                    if (s.zip) setZipInput(s.zip);
                    setLat(s.lat);
                    setLng(s.lng);
                  }}
                />
              </View>
            </View>

            {/* ZIP */}
            <Text
              style={{
                fontSize: 12,
                fontWeight: "900",
                color: theme.colors.subtext,
                marginBottom: 6,
                marginTop: 10,
              }}
            >
              ZIP (recommended)
            </Text>
            <TextInput
              value={zipInput}
              onChangeText={(t) => setZipInput(t.replace(/[^0-9]/g, "").slice(0, 5))}
              placeholder="ZIP"
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              placeholderTextColor={theme.colors.subtext}
              style={{
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.mutedBg,
                borderRadius: theme.radius.md,
                paddingHorizontal: theme.space.md,
                paddingVertical: 10,
                fontWeight: "900",
                color: theme.colors.text,
              }}
            />

            {/* Distance */}
            <Text style={{ fontWeight: "900", marginTop: 10, color: theme.colors.text }}>
              Distance
            </Text>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
              {[10, 25, 50, 100].map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setRadiusMiles(m)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: radiusMiles === m ? theme.colors.brand : theme.colors.border,
                    backgroundColor: radiusMiles === m ? theme.colors.chipBg : "#fff",
                  }}
                >
                  <Text style={{ fontWeight: "900" }}>{m} mi</Text>
                </Pressable>
              ))}
            </View>

            {/* Buttons */}
            <View style={{ flexDirection: "row", gap: theme.space.sm, marginTop: theme.space.md }}>
              <Pressable
                onPress={apply}
                style={{
                  flex: 1,
                  backgroundColor: theme.colors.brand,
                  borderRadius: theme.radius.md,
                  paddingVertical: 12,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "900" }}>Apply</Text>
              </Pressable>

              <Pressable
                onPress={clear}
                style={{
                  paddingHorizontal: theme.space.lg,
                  borderRadius: theme.radius.md,
                  paddingVertical: 12,
                  backgroundColor: theme.colors.mutedBg,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: theme.colors.text, fontWeight: "900" }}>Clear</Text>
              </Pressable>
            </View>

            {/* Tiny info */}
            <Text style={{ color: theme.colors.subtext, fontWeight: "700", marginTop: 6 }}>
              {lat != null && lng != null
                ? `Center saved: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
                : "Tip: Pick a city for best accuracy."}
            </Text>
          </View>
        </Card>
      </Screen>
    </TouchableWithoutFeedback>
  );
}