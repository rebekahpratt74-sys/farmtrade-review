import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function NewMessageScreen() {
  const params = useLocalSearchParams<{
    listingId?: string;
    sellerId?: string;
  }>();

  const listingId = params.listingId ?? "(unknown)";
  const sellerId = params.sellerId ?? "(unknown)";

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Start Conversation</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Listing ID</Text>
        <Text style={styles.value}>{listingId}</Text>

        <Text style={[styles.label, { marginTop: 12 }]}>Seller ID</Text>
        <Text style={styles.value}>{sellerId}</Text>
      </View>

      <Pressable
        style={styles.primaryBtn}
        onPress={() =>
          alert("Messaging system coming next! 🚜💬")
        }
      >
        <Text style={styles.primaryBtnText}>
          Start Conversation (Coming Soon)
        </Text>
      </Pressable>

      <Pressable
        style={styles.secondaryBtn}
        onPress={() => router.back()}
      >
        <Text style={styles.secondaryBtnText}>Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 16,
  },
  card: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    backgroundColor: "#fff",
  },
  label: {
    fontSize: 12,
    color: "#667",
    fontWeight: "700",
  },
  value: {
    fontSize: 14,
    fontWeight: "800",
  },
  primaryBtn: {
    backgroundColor: "#1f7a3f",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "900",
  },
  secondaryBtn: {
    backgroundColor: "#eee",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  secondaryBtnText: {
    fontWeight: "800",
  },
});