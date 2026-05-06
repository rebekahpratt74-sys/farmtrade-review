import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCreate } from "../../../hooks/createContext";
import { theme } from "../../../lib/theme";

const UNIT_PRESETS = ["each", "lb", "dozen", "bushel", "bale", "head", "ton"];
const CONDITION_OPTIONS = ["New", "Like New", "Good", "Fair", "For Parts"];

export default function DetailsScreen() {
  const { draft, setDraft, isEditing } = useCreate();

  const [pricingType, setPricingType] = useState<"total" | "per_unit">(
    draft.pricingType ?? "total"
  );

  const [price, setPrice] = useState(draft.price != null ? String(draft.price) : "");
  const [unit, setUnit] = useState(draft.unit ?? "");
  const [description, setDescription] = useState(draft.description ?? "");
  const [city, setCity] = useState(draft.city ?? "");
  const [stateVal, setStateVal] = useState(draft.state ?? "");
  const [zip, setZip] = useState(draft.zip ?? "");
  const [quantity, setQuantity] = useState(
    draft.quantity != null ? String(draft.quantity) : ""
  );
  const [condition, setCondition] = useState(draft.condition ?? "");

  const [lat, setLat] = useState<number | null>(
    typeof draft.lat === "number" ? draft.lat : null
  );
  const [lng, setLng] = useState<number | null>(
    typeof draft.lng === "number" ? draft.lng : null
  );
  const [lookingUpZip, setLookingUpZip] = useState(false);
  const [lastZipLookup, setLastZipLookup] = useState("");

  const insets = useSafeAreaInsets();

  useEffect(() => {
    setPricingType(draft.pricingType ?? "total");
    setPrice(draft.price != null ? String(draft.price) : "");
    setUnit(draft.unit ?? "");
    setDescription(draft.description ?? "");
    setCity(draft.city ?? "");
    setStateVal(draft.state ?? "");
    setZip(draft.zip ?? "");
    setQuantity(draft.quantity != null ? String(draft.quantity) : "");
    setCondition(draft.condition ?? "");
    setLat(typeof draft.lat === "number" ? draft.lat : null);
    setLng(typeof draft.lng === "number" ? draft.lng : null);
  }, [
    draft.pricingType,
    draft.price,
    draft.unit,
    draft.description,
    draft.city,
    draft.state,
    draft.zip,
    draft.quantity,
    draft.condition,
    draft.lat,
    draft.lng,
  ]);

  useEffect(() => {
    const lookupZip = async () => {
      if (zip.length !== 5) return;
      if (zip === lastZipLookup) return;

      try {
        setLookingUpZip(true);

        const geo = await Location.geocodeAsync(zip);

        if (!geo?.[0]) return;

        const first = geo[0];
        setLat(first.latitude ?? null);
        setLng(first.longitude ?? null);

        const reverse = await Location.reverseGeocodeAsync({
          latitude: first.latitude,
          longitude: first.longitude,
        });

        if (!reverse?.[0]) {
          setLastZipLookup(zip);
          return;
        }

        const place = reverse[0];

        const nextCity = place.city || place.subregion || place.district || city || "";

        const nextState = place.region || stateVal || "";

        if (nextCity) setCity(nextCity);

        if (nextState) {
          setStateVal(nextState.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2));
        }

        setLastZipLookup(zip);
      } catch (e) {
        console.log("ZIP lookup failed:", e);
      } finally {
        setLookingUpZip(false);
      }
    };

    lookupZip();
  }, [zip, lastZipLookup]);

  const isEquipment = draft.category === "equipment";

  const onNext = () => {
    const p = Number(price);
    const q = Number(quantity || 0);

    if (!price.trim() || Number.isNaN(p) || p < 0) {
      Alert.alert("Price needed", "Please enter a valid price.");
      return;
    }

    if (pricingType === "per_unit" && !unit.trim()) {
      Alert.alert("Unit needed", "Please enter a unit.");
      return;
    }

    if (quantity.trim() && (Number.isNaN(q) || q < 0)) {
      Alert.alert("Quantity needed", "Please enter a valid quantity.");
      return;
    }

    const st = stateVal.trim().toUpperCase();

    if (st.length !== 2) {
      Alert.alert("State needed", "Use 2-letter state code (TN)");
      return;
    }

    if (!city.trim() && !zip.trim()) {
      Alert.alert("Location needed", "Enter city or ZIP.");
      return;
    }

    setDraft({
      pricingType,
      price: p,
      unit: pricingType === "per_unit" ? unit.trim() : "",
      description: description.trim(),
      city: city.trim(),
      state: st,
      zip: zip.trim(),
      quantity: Number(quantity || 0),
      condition: isEquipment ? condition : "",
      lat,
      lng,
    });

    router.push("/(tabs)/create/photos");
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom + 30, 40),
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

        <Text style={styles.eyebrow}>Step 2</Text>

        <Text style={styles.title}>
          {isEditing ? "Edit details" : "Details"}
        </Text>

        <Text style={styles.subtitle}>
          Add pricing, description, and location.
        </Text>

        <Text style={styles.label}>Pricing Type</Text>

        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggle, pricingType === "total" && styles.toggleSelected]}
            onPress={() => setPricingType("total")}
          >
            <Text
              style={[
                styles.toggleText,
                pricingType === "total" && styles.toggleTextSelected,
              ]}
            >
              Total
            </Text>
          </Pressable>

          <Pressable
            style={[styles.toggle, pricingType === "per_unit" && styles.toggleSelected]}
            onPress={() => setPricingType("per_unit")}
          >
            <Text
              style={[
                styles.toggleText,
                pricingType === "per_unit" && styles.toggleTextSelected,
              ]}
            >
              Per Unit
            </Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Price</Text>

        <TextInput
          value={price}
          onChangeText={(t) => setPrice(t.replace(/[^0-9.]/g, ""))}
          keyboardType="decimal-pad"
          placeholder="0"
          style={styles.input}
        />

        {pricingType === "per_unit" && (
          <>
            <Text style={styles.label}>Unit</Text>

            <TextInput
              value={unit}
              onChangeText={setUnit}
              placeholder="lb, each, bale..."
              style={styles.input}
            />

            <View style={styles.unitWrap}>
              {UNIT_PRESETS.map((u) => {
                const selected = unit.toLowerCase() === u;

                return (
                  <Pressable
                    key={u}
                    onPress={() => setUnit(u)}
                    style={[styles.unitChip, selected && styles.unitChipSelected]}
                  >
                    <Text
                      style={[
                        styles.unitText,
                        selected && styles.unitTextSelected,
                      ]}
                    >
                      {u}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        <Text style={styles.label}>Quantity Available</Text>

        <TextInput
          value={quantity}
          onChangeText={(t) => setQuantity(t.replace(/[^0-9]/g, ""))}
          keyboardType="number-pad"
          placeholder="Example: 25"
          style={styles.input}
        />

        <Text style={styles.label}>Description</Text>

        <TextInput
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="Tell buyers anything helpful..."
          style={[styles.input, styles.textArea]}
        />

        {isEquipment && (
          <>
            <Text style={styles.label}>Condition</Text>

            <View style={styles.conditionWrap}>
              {CONDITION_OPTIONS.map((option) => {
                const selected = condition === option;

                return (
                  <Pressable
                    key={option}
                    onPress={() => setCondition(option)}
                    style={[
                      styles.conditionChip,
                      selected && styles.conditionChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.conditionText,
                        selected && styles.conditionTextSelected,
                      ]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        <Text style={styles.label}>Location</Text>

        <View style={styles.row}>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="City"
            style={[styles.input, { flex: 1 }]}
          />

          <TextInput
            value={stateVal}
            onChangeText={(t) =>
              setStateVal(t.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))
            }
            placeholder="ST"
            maxLength={2}
            style={[styles.input, styles.state]}
          />
        </View>

        <Text style={styles.label}>ZIP</Text>

        <TextInput
          value={zip}
          onChangeText={(t) => {
            const cleaned = t.replace(/[^0-9]/g, "").slice(0, 5);
            setZip(cleaned);

            if (cleaned.length < 5) setLastZipLookup("");
          }}
          keyboardType="number-pad"
          placeholder="ZIP"
          style={styles.input}
        />

        {lookingUpZip ? (
          <Text style={styles.lookupText}>Looking up city and state…</Text>
        ) : zip.length === 5 && !!city.trim() && !!stateVal.trim() ? (
          <Text style={styles.lookupText}>
            Auto-filled from ZIP: {city.trim()}, {stateVal.trim().toUpperCase()}
          </Text>
        ) : null}

        <Pressable onPress={onNext} style={styles.button}>
          <Text style={styles.buttonText}>Next</Text>
        </Pressable>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.backgroundTint,
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
    color: "#1f7a3f",
    marginBottom: 8,
    marginTop: 44,
  },

  title: {
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 16,
    color: "#64748B",
    marginBottom: 22,
    fontWeight: "600",
  },

  label: {
    fontWeight: "900",
    marginBottom: 6,
    marginTop: 14,
  },

  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    fontWeight: "700",
  },

  textArea: {
    minHeight: 110,
  },

  toggleRow: {
    flexDirection: "row",
    gap: 10,
  },

  toggle: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    backgroundColor: "#fff",
  },

  toggleSelected: {
    borderColor: "#1f7a3f",
    backgroundColor: "#DCFCE7",
  },

  toggleText: {
    fontWeight: "800",
  },

  toggleTextSelected: {
    color: "#166534",
  },

  unitWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },

  unitChip: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#fff",
  },

  unitChipSelected: {
    borderColor: "#1f7a3f",
    backgroundColor: "#DCFCE7",
  },

  unitText: {
    fontWeight: "800",
  },

  unitTextSelected: {
    color: "#166534",
  },

  conditionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },

  conditionChip: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#fff",
  },

  conditionChipSelected: {
    borderColor: "#1f7a3f",
    backgroundColor: "#DCFCE7",
  },

  conditionText: {
    fontWeight: "800",
    color: "#111827",
  },

  conditionTextSelected: {
    color: "#166534",
  },

  row: {
    flexDirection: "row",
    gap: 10,
  },

  state: {
    width: 70,
    textAlign: "center",
  },

  lookupText: {
    marginTop: 8,
    color: "#166534",
    fontWeight: "700",
    fontSize: 13,
  },

  button: {
    backgroundColor: "#1f7a3f",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 26,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 18,
  },
});