import React, { memo } from "react";
import { Image, Pressable, Text, View } from "react-native";

type Props = {
  title: string;                 // other user name
  avatarUrl?: string | null;
  lastMessageText?: string | null;
  timeLabel: string;             // your relative time string
  priceLabel?: string | null;    // "$250" or "$2.50/lb"
  listingTitle?: string | null;
  listingPhotoUrl?: string | null;

  unreadCount: number;
  onPress: () => void;
  onPressAvatar?: () => void;
};

function ConversationRow({
  title,
  avatarUrl,
  lastMessageText,
  timeLabel,
  priceLabel,
  listingTitle,
  listingPhotoUrl,
  unreadCount,
  onPress,
  onPressAvatar,
}: Props) {
  const isUnread = unreadCount > 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.9 : 1,
        backgroundColor: "#F3F4F6",
        borderRadius: 18,
        borderWidth: 2,
        borderColor: isUnread ? "#16A34A" : "#D1D5DB",
        padding: 12,
        marginBottom: 10,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {/* Avatar */}
        <Pressable
          onPress={onPressAvatar}
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            borderWidth: 3,
            borderColor: isUnread ? "#16A34A" : "#E5E7EB",
            overflow: "hidden",
            backgroundColor: "#E5E7EB",
            marginRight: 12,
          }}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={{ width: "100%", height: "100%" }} />
          ) : (
            <View style={{ width: "100%", height: "100%" }} />
          )}
        </Pressable>

        {/* Middle */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 16,
                fontWeight: isUnread ? "800" : "700",
                color: "#111827",
                paddingRight: 10,
              }}
            >
              {title}
            </Text>

            <Text style={{ fontSize: 12, color: "#6B7280", fontWeight: "600" }}>
              {timeLabel}
            </Text>
          </View>

          {!!lastMessageText && (
            <Text
              numberOfLines={1}
              style={{
                marginTop: 2,
                color: isUnread ? "#111827" : "#374151",
                fontWeight: isUnread ? "700" : "600",
              }}
            >
              {lastMessageText}
            </Text>
          )}

          {/* Listing strip */}
          {(listingTitle || priceLabel || listingPhotoUrl) && (
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
              {/* Listing thumbnail */}
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  overflow: "hidden",
                  borderWidth: 2,
                  borderColor: "#D1D5DB",
                  backgroundColor: "#E5E7EB",
                  marginRight: 10,
                }}
              >
                {listingPhotoUrl ? (
                  <Image source={{ uri: listingPhotoUrl }} style={{ width: "100%", height: "100%" }} />
                ) : (
                  <View style={{ width: "100%", height: "100%" }} />
                )}

                {/* NEW ribbon */}
                {isUnread && (
                  <View
                    style={{
                      position: "absolute",
                      top: 6,
                      left: -20,
                      transform: [{ rotate: "-20deg" }],
                      backgroundColor: "#16A34A",
                      paddingHorizontal: 18,
                      paddingVertical: 2,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: "#065F46",
                    }}
                  >
                    <Text style={{ color: "white", fontSize: 10, fontWeight: "900" }}>NEW</Text>
                  </View>
                )}
              </View>

              <View style={{ flex: 1 }}>
                {!!listingTitle && (
                  <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "800", color: "#111827" }}>
                    {listingTitle}
                  </Text>
                )}

                {!!priceLabel && (
                  <View
                    style={{
                      alignSelf: "flex-start",
                      marginTop: 4,
                      backgroundColor: "#111827",
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderWidth: 2,
                      borderColor: "#16A34A",
                    }}
                  >
                    <Text style={{ color: "white", fontWeight: "900", fontSize: 12 }}>
                      {priceLabel}
                    </Text>
                  </View>
                )}
              </View>

              {/* Unread bubble */}
              {isUnread && (
                <View
                  style={{
                    marginLeft: 10,
                    minWidth: 28,
                    height: 28,
                    borderRadius: 999,
                    backgroundColor: "#16A34A",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 2,
                    borderColor: "#065F46",
                    paddingHorizontal: 6,
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "900", fontSize: 12 }}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default memo(ConversationRow);