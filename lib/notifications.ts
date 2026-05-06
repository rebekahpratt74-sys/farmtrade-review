import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { arrayUnion, doc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

// Show notifications while app is OPEN (foreground)

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,     // keeps compatibility
    shouldPlaySound: false,
    shouldSetBadge: false,

    // ✅ required by newer expo-notifications typings
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Robust way to get projectId (important for EAS builds; works in Expo Go too)
function getProjectId(): string | undefined {
  // EAS build / config
  const easProjectId =
    (Constants as any)?.expoConfig?.extra?.eas?.projectId ||
    (Constants as any)?.easConfig?.projectId;

  return easProjectId;
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.log("Push notifications require a physical device.");
      return null;
    }

    // Ask permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Push permission not granted.");
      return null;
    }

    const projectId = getProjectId();

    const token = (
      await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      )
    ).data;

    console.log("Expo push token:", token);
    return token;
  } catch (e: any) {
    console.log("registerForPushNotificationsAsync error:", e?.message ?? e);
    return null;
  }
}

export async function saveMyPushToken(token: string) {
  const user = auth.currentUser;
  if (!user) return;

  // Store multiple tokens (user might log in on multiple devices)
  await setDoc(
    doc(db, "users", user.uid),
    {
      expoPushTokens: arrayUnion(token),
      pushUpdatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}
