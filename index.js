const admin = require("firebase-admin");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");

admin.initializeApp();
setGlobalOptions({ region: "us-central1" });

const STRIPE_SECRET = defineSecret("STRIPE_SECRET");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

//
// =========================
// CREATE SUBSCRIPTION
// =========================
//
exports.createProSubscription = onCall(
  { secrets: [STRIPE_SECRET] },
  async (req) => {
    try {
      const stripe = require("stripe")(STRIPE_SECRET.value());

      const uid = req.auth?.uid;
      const { email } = req.data;

      if (!uid) throw new Error("User not authenticated");
      if (!email) throw new Error("Missing email");

      const customer = await stripe.customers.create({
        email,
        metadata: { uid },
      });

      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [
          {
            price: "price_1TQO2cLQMXcVVEGF2gtfimzv",
          },
        ],
        payment_behavior: "default_incomplete",
        expand: ["latest_invoice.confirmation_secret"],
      });

      const clientSecret =
        subscription.latest_invoice?.confirmation_secret?.client_secret;

      if (!clientSecret) {
        console.error("Missing confirmation secret:", subscription);
        throw new Error("Missing subscription client secret");
      }

      return { clientSecret };
    } catch (err) {
      console.error("Create subscription error:", err);
      throw new Error("Unable to start checkout");
    }
  }
);

//
// =========================
// BILLING PORTAL
// =========================
//
exports.createPortalSession = onCall(
  { secrets: [STRIPE_SECRET] },
  async (req) => {
    try {
      const stripe = require("stripe")(STRIPE_SECRET.value());

      const uid = req.auth?.uid;
      if (!uid) throw new Error("Not authenticated");

      const db = admin.firestore();
      const userSnap = await db.collection("users").doc(uid).get();

      if (!userSnap.exists) throw new Error("User not found");

      const user = userSnap.data();

      if (!user?.stripeCustomerId) {
        throw new Error("No Stripe customer found");
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: "https://example.com",
      });

      return { url: session.url };
    } catch (err) {
      console.error("Portal session error:", err);
      throw new Error("Unable to open billing portal");
    }
  }
);

//
// =========================
// STRIPE WEBHOOK
// =========================
//
exports.stripeWebhook = onRequest(
  { secrets: [STRIPE_SECRET, STRIPE_WEBHOOK_SECRET] },
  async (req, res) => {
    const stripe = require("stripe")(STRIPE_SECRET.value());
    const db = admin.firestore();

    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        STRIPE_WEBHOOK_SECRET.value()
      );
    } catch (err) {
      console.error("Webhook signature failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      const eventType = event.type;
      const object = event.data.object;
      const customerId = object.customer;

      if (!customerId) {
        return res.json({ received: true });
      }

      const customer = await stripe.customers.retrieve(customerId);
      const uid = customer.metadata?.uid;

      if (!uid) {
        return res.json({ received: true });
      }

      const userRef = db.collection("users").doc(uid);

      // 🟢 SUBSCRIPTION CREATED / UPDATED → mark as Pro ONLY
      if (
        eventType === "customer.subscription.created" ||
        eventType === "customer.subscription.updated"
      ) {
        await userRef.set(
          {
            subscriptionStatus: "pro",
            subscriptionPlan: "monthly",
            stripeCustomerId: customerId,
            subscriptionUpdatedAt:
              admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      // 💰 PAYMENT SUCCEEDED → RESET MONTHLY CREDITS
      if (eventType === "invoice.payment_succeeded") {
        await userRef.set(
          {
            subscriptionStatus: "pro",
            subscriptionPlan: "monthly",
            monthlyPromotionCredits: 1, // 🔥 ONLY RESET HERE
            subscriptionUpdatedAt:
              admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        console.log("✅ Monthly credits reset for user:", uid);
      }

      // 🔴 CANCEL / FAIL → downgrade
      if (
        eventType === "customer.subscription.deleted" ||
        eventType === "invoice.payment_failed"
      ) {
        await userRef.set(
          {
            subscriptionStatus: "free",
            subscriptionPlan: "none",
            maxActiveListings: 5,
            subscriptionUpdatedAt:
              admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        console.log("⬇️ User downgraded:", uid);
      }

      res.json({ received: true });
    } catch (err) {
      console.error("Webhook handler error:", err);
      res.status(500).send("Webhook handler failed");
    }
  }
);

//
// =========================
// PUSH NOTIFICATIONS
// =========================
//
exports.sendMessageNotification = onDocumentCreated(
  "conversations/{conversationId}/messages/{messageId}",
  async (event) => {
    try {
      const snap = event.data;
      if (!snap) return;

      const message = snap.data();
      const conversationId = event.params.conversationId;

      const db = admin.firestore();
      const convSnap = await db.collection("conversations").doc(conversationId).get();
      if (!convSnap.exists) return;

      const conv = convSnap.data();
      const senderId = message.senderId;

      const senderSnap = await db.collection("users").doc(senderId).get();
      const senderName = senderSnap.data()?.name || "Someone";

      const recipientId = conv.participantIds.find((id) => id !== senderId);
      if (!recipientId) return;

      const userSnap = await db.collection("users").doc(recipientId).get();
      const tokens = userSnap.data()?.expoPushTokens || [];

      if (!tokens.length) return;

      const notifications = tokens.map((to) => ({
        to,
        sound: "default",
        title: `${conv.listingTitle || "Your listing"} - ${senderName}`,
        body: message.text || "New message",
        data: { conversationId },
      }));

      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notifications),
      });
    } catch (err) {
      console.error("Push notification error:", err);
    }
  }
);

//
// =========================
// PROMOTION CREDIT (FIXED)
// =========================
//
exports.usePromotionCredit = onCall(async (req) => {
  try {
    const uid = req.auth?.uid;
    const { listingId } = req.data || {};

    if (!uid) throw new Error("Not authenticated");
    if (!listingId) throw new Error("Missing listingId");

    const db = admin.firestore();
    const userRef = db.collection("users").doc(uid);
    const listingRef = db.collection("listings").doc(listingId);

    const expiresAt = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    );

    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const listingSnap = await tx.get(listingRef);

      if (!userSnap.exists) throw new Error("User not found");
      if (!listingSnap.exists) throw new Error("Listing not found");

      const user = userSnap.data();
      const listing = listingSnap.data();

      if (user.subscriptionStatus !== "pro") {
        throw new Error("Not a Pro user");
      }

      if (listing.sellerId !== uid) {
        throw new Error("Not your listing");
      }

      const credits = Number(user.monthlyPromotionCredits || 0);

      if (credits <= 0) {
        throw new Error("No promotion credits left");
      }

      tx.update(userRef, {
        monthlyPromotionCredits: credits - 1,
      });

      tx.update(listingRef, {
        isPromoted: true,
        promotionDays: 7,
        promotionExpiresAt: expiresAt,
      });
    });

    return { success: true };
  } catch (err) {
    console.error("Promotion credit error:", err);
    throw new Error(err.message || "Unable to use promotion credit");
  }
});
exports.createPromotionPayment = onCall(
  { secrets: [STRIPE_SECRET] },
  async (req) => {
    try {
      const stripe = require("stripe")(STRIPE_SECRET.value());

      const uid = req.auth?.uid;
      const { amount, listingId, days } = req.data || {};

      console.log("🔥 createPromotionPayment called:", {
        uid,
        amount,
        listingId,
        days,
      });

      // 🔥 TEMP: allow even if uid missing (for testing)
      if (!amount || !listingId || !days) {
        throw new Error("Missing required fields");
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "usd",
        payment_method_types: ["card"],
        metadata: {
          uid: uid || "unknown",
          listingId,
          days: String(days),
          type: "promotion",
        },
      });

      return {
        clientSecret: paymentIntent.client_secret,
      };
    } catch (err) {
      console.error("❌ Promotion payment error FULL:", err);
      throw new Error(err.message || "Unable to start promotion payment");
    }
  }
);
exports.applyPaidPromotion = onCall(async (req) => {
  try {
    const uid = req.auth?.uid;
    const { listingId, days } = req.data || {};

    if (!uid) throw new Error("Not authenticated");
    if (!listingId) throw new Error("Missing listingId");
    if (!days) throw new Error("Missing days");

    const db = admin.firestore();
    const listingRef = db.collection("listings").doc(listingId);

    const listingSnap = await listingRef.get();
    if (!listingSnap.exists) throw new Error("Listing not found");

    const listing = listingSnap.data();

    if (listing.sellerId !== uid) {
      throw new Error("Not your listing");
    }

    const expiresAt = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000)
    );

    await listingRef.update({
      isPromoted: true,
      promotionDays: Number(days),
      promotionExpiresAt: expiresAt,
      promotedAt: admin.firestore.FieldValue.serverTimestamp(),
      promotionType: "paid",
    });

    return { success: true };
  } catch (err) {
    console.error("Paid promotion error:", err);
    throw new Error(err.message || "Unable to apply paid promotion");
  }
});

//
// =========================
// CLEANUP EXPIRED PROMOTIONS
// =========================
//
exports.cleanupExpiredPromotions = onSchedule(
  {
    schedule: "every 1 hours",
    timeZone: "America/New_York",
  },
  async () => {
    try {
      const db = admin.firestore();
      const now = Date.now();

      const snap = await db
        .collection("listings")
        .where("isPromoted", "==", true)
        .get();

      const batch = db.batch();
      let cleanedCount = 0;

      for (const docSnap of snap.docs) {
        const data = docSnap.data();

        if (!data.promotionExpiresAt) continue;

        const expiresAt =
          typeof data.promotionExpiresAt?.toDate === "function"
            ? data.promotionExpiresAt.toDate().getTime()
            : data.promotionExpiresAt?.seconds
              ? data.promotionExpiresAt.seconds * 1000
              : new Date(data.promotionExpiresAt).getTime();

        if (expiresAt <= now) {
          // 🔔 Send push notification
          try {
            const sellerId = data.sellerId;

            if (sellerId) {
              const userSnap = await db.collection("users").doc(sellerId).get();
              const userData = userSnap.data();
              const tokens = userData?.expoPushTokens || [];

              if (tokens.length > 0) {
                const messages = tokens.map((token) => ({
                  to: token,
                  sound: "default",
                  title: "🚀 Promotion ended",
                  body: `${data.title || "Your listing"} is no longer boosted. Tap to promote again.`,
                  data: {
                    type: "promotion_expired",
                    listingId: docSnap.id,
                  },
                }));

                await fetch("https://exp.host/--/api/v2/push/send", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(messages),
                });
              }
            }
          } catch (err) {
            console.error("Push notification error:", err);
          }

          batch.update(docSnap.ref, {
            isPromoted: false,
            promotionExpiredAlert: true,
            promotionExpiredAt: admin.firestore.FieldValue.serverTimestamp(),
            promotionType: null,
            promotionDays: null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          cleanedCount += 1;
        }
      }

      if (cleanedCount > 0) {
        await batch.commit();
      }

      console.log(`✅ Cleaned up ${cleanedCount} expired promotions.`);
    } catch (err) {
      console.error("❌ Cleanup expired promotions error:", err);
    }
  }
);