export function getCategoryEmoji(category?: string) {
  switch (category) {
    case "livestock":
      return "🐄";

    case "produce":
      return "🌽";

    case "farm_goods":
      return "🌾";

    case "equipment":
      return "🚜";

    default:
      return "📦";
  }
}