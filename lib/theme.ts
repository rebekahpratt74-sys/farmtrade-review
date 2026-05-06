export const theme = {
  colors: {
    // Base
    bg: "#ffffff",
    surface: "#ffffff",
    mutedBg: "#C7DCCB",
    surface2: "#F3F7F1",

    // Text
    text: "#0f172a",
    subtext: "#64748b",
    muted: "#94a3b8",

    // Borders
    border: "#d6e2d3",
    borderStrong: "#bfd0bb",

    // Brand
    brand: "#166534",
    brandBright: "#15803D",

    // Danger
    danger: "#e11d48",
    dangerSoft: "#fff1f2",
    dangerBorder: "#fecaca",

    // Chips / pills
    chipBg: "#C7DCCB",
    chipBorder: "#9fbeaa",
    chipText: "#166534",

    // Extras
    avatarBg: "#E5E7EB",
    slate700: "#334155",
    dangerText: "#9f1239",

    // New background tint
    backgroundTint: "#F3F7F1",
  },

  radius: {
    sm: 12,
    md: 16,
    lg: 18,
    xl: 22,
    pill: 999,
  },

  space: {
    xs: 6,
    sm: 10,
    md: 12,
    lg: 16,
    xl: 22,
  },

  type: {
    h1: { fontSize: 30, fontWeight: "900" as const },
    h2: { fontSize: 18, fontWeight: "900" as const },
    title: { fontSize: 16, fontWeight: "900" as const },
    body: { fontSize: 14, fontWeight: "700" as const },
    sub: { fontSize: 12, fontWeight: "800" as const },
  },
};