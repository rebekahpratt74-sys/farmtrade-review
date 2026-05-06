import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { theme } from "../../lib/theme";

type Suggestion = {
  id: string;
  city: string;
  state: string;
  zip?: string;
  lat: number;
  lng: number;
  label: string;
};

function debounce<T extends (...args: any[]) => void>(fn: T, delay = 350) {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function normalizeState(stateCodeOrName: string, fallback: string) {
  const s = (stateCodeOrName || "").trim();
  const fb = (fallback || "").trim().toUpperCase();
  if (s.length === 2) return s.toUpperCase();
  return fb.length === 2 ? fb : s || fb;
}

function startsWithQuery(cityName: string, query: string) {
  const c = cityName.trim().toLowerCase();
  const q = query.trim().toLowerCase();

  if (!q) return true;
  if (c.startsWith(q)) return true;

  const words = c.split(" ");
  return words.some((w) => w.startsWith(q));
}

async function reverseZip(lat: number, lng: number): Promise<string | undefined> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, {
      headers: {
        "Accept-Language": "en",
        "User-Agent": "FarmTrade/1.0",
      },
    });
    const json: any = await res.json();
    const z = json?.address?.postcode ? String(json.address.postcode).slice(0, 5) : "";
    return z.length === 5 ? z : undefined;
  } catch {
    return undefined;
  }
}

export function CityAutocomplete({
  city,
  state,
  onCityChange,
  onSelect,
  placeholder = "Pick a market town…",
}: {
  city: string;
  state: string;
  onCityChange: (v: string) => void;
  onSelect: (s: { city: string; state: string; lat: number; lng: number; zip?: string }) => void;
  placeholder?: string;
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const latestReq = useRef(0);

  const canSearch = useMemo(() => {
    return state.trim().length === 2 && city.trim().length >= 2;
  }, [city, state]);

  const runSearch = useMemo(
    () =>
      debounce(async (text: string, st: string) => {
        const reqId = ++latestReq.current;

        if (st.length !== 2 || text.trim().length < 2) {
          setItems([]);
          return;
        }

        try {
          setLoading(true);

          const q = encodeURIComponent(`${text.trim()}, ${st}, USA`);
          const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=10&q=${q}`;

          const res = await fetch(url, {
            headers: {
              "Accept-Language": "en",
              "User-Agent": "FarmTrade/1.0",
            },
          });

          const json: any[] = await res.json();
          if (reqId !== latestReq.current) return;

          const mapped: Suggestion[] = (json || [])
            .map((r: any) => {
              const addr = r.address || {};

              const c =
                addr.city ||
                addr.town ||
                addr.village ||
                addr.hamlet ||
                addr.municipality ||
                "";

              const s = normalizeState(addr.state_code || "", st);
              const z = addr.postcode ? String(addr.postcode).slice(0, 5) : undefined;

              const lat = Number(r.lat);
              const lng = Number(r.lon);

              if (!c || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

              // ⭐ PREFIX FILTER
              if (!startsWithQuery(c, text)) return null;

              return {
                id: String(r.place_id),
                city: c,
                state: s,
                zip: z,
                lat,
                lng,
                label: `${c}, ${s}${z ? ` ${z}` : ""}`,
              };
            })
            .filter(Boolean) as Suggestion[];

          // ⭐ sort best matches first
          mapped.sort((a, b) => a.city.length - b.city.length);

          // ⭐ dedupe
          const seen = new Set<string>();
          const deduped = mapped.filter((x) => {
            if (seen.has(x.label)) return false;
            seen.add(x.label);
            return true;
          });

          setItems(deduped);
        } catch {
          setItems([]);
        } finally {
          setLoading(false);
        }
      }, 350),
    []
  );

  useEffect(() => {
    if (state.length !== 2) setOpen(false);
  }, [state]);

  useEffect(() => {
    const st = state.trim().toUpperCase();
    if (!canSearch) {
      setItems([]);
      return;
    }
    runSearch(city, st);
  }, [city, state, canSearch, runSearch]);

  return (
    <View style={{ width: "100%" }}>
      <TextInput
        value={city}
        onChangeText={(t) => {
          if (state.length === 2) {
            onCityChange(t);
            setOpen(true);
          }
        }}
        editable={state.length === 2}
        placeholder={state.length === 2 ? placeholder : "Enter state first"}
        placeholderTextColor={theme.colors.subtext}
        style={{
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor:
            state.length === 2
              ? theme.colors.mutedBg
              : theme.colors.mutedBg + "80",
          borderRadius: theme.radius.md,
          paddingHorizontal: theme.space.md,
          paddingVertical: 10,
          fontWeight: "900",
          color:
            state.length === 2
              ? theme.colors.text
              : theme.colors.subtext,
        }}
      />

      {open && (items.length > 0 || loading) && (
        <View
          style={{
            marginTop: 6,
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.md,
            overflow: "hidden",
            backgroundColor: "#fff",
            maxHeight: 220,
          }}
        >
          {loading ? (
            <Text style={{ padding: 12, fontWeight: "800", color: theme.colors.subtext }}>
              Searching…
            </Text>
          ) : (
            <FlatList
              keyboardShouldPersistTaps="handled"
              data={items}
              keyExtractor={(i) => i.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={async () => {
  // If the suggestion already has a zip, use it.
  // Otherwise: reverse lookup by lat/lng to try to get a zip.
  const z = item.zip ?? (await reverseZip(item.lat, item.lng));

  onSelect({
    city: item.city,
    state: item.state,
    zip: z,
    lat: item.lat,
    lng: item.lng,
  });

  setOpen(false);
}}
                  style={({ pressed }) => ({
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    backgroundColor: pressed ? theme.colors.mutedBg : "#fff",
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.mutedBg,
                  })}
                >
                  <Text style={{ fontWeight: "900", color: theme.colors.text }}>
                    {item.label}
                  </Text>
                </Pressable>
              )}
            />
          )}
        </View>
      )}
    </View>
  );
}