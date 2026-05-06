import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";

type SubmitSellerRatingArgs = {
  sellerId: string;
  buyerId: string;
  conversationId: string;
  listingId?: string;
  rating: number;
  reviewText?: string;
};

export async function submitSellerRating({
  sellerId,
  buyerId,
  conversationId,
  listingId = "",
  rating,
  reviewText = "",
}: SubmitSellerRatingArgs) {
  if (!sellerId) throw new Error("Missing sellerId");
  if (!buyerId) throw new Error("Missing buyerId");
  if (!conversationId) throw new Error("Missing conversationId");
  if (sellerId === buyerId) throw new Error("You cannot rate yourself");
  if (rating < 1 || rating > 5) throw new Error("Rating must be between 1 and 5");

  const reviewId = `${conversationId}_${buyerId}`;

  const sellerRef = doc(db, "users", sellerId);
  const sellerReviewRef = doc(db, "users", sellerId, "reviews", reviewId);
  const buyerReviewRef = doc(db, "users", buyerId, "myReviews", reviewId);

  await runTransaction(db, async (tx) => {
    const sellerSnap = await tx.get(sellerRef);
    const sellerReviewSnap = await tx.get(sellerReviewRef);

    if (sellerReviewSnap.exists()) {
      throw new Error("Rating already submitted");
    }

    const currentAverage =
      sellerSnap.exists() && typeof sellerSnap.data()?.ratingAverage === "number"
        ? sellerSnap.data()!.ratingAverage
        : 0;

    const currentCount =
      sellerSnap.exists() && typeof sellerSnap.data()?.ratingCount === "number"
        ? sellerSnap.data()!.ratingCount
        : 0;

    const totalBefore = currentAverage * currentCount;
    const nextCount = currentCount + 1;
    const totalAfter = totalBefore + rating;
    const nextAverage = totalAfter / nextCount;

    tx.set(
      sellerRef,
      {
        ratingAverage: Number(nextAverage.toFixed(2)),
        ratingCount: nextCount,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    const reviewData = {
      sellerId,
      buyerId,
      conversationId,
      listingId,
      rating,
      reviewText: reviewText.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    tx.set(sellerReviewRef, reviewData);
    tx.set(buyerReviewRef, reviewData);
  });
}

export async function getExistingSellerRating(
  sellerId: string,
  buyerId: string,
  conversationId: string
) {
  if (!sellerId || !buyerId || !conversationId) return null;

  const reviewId = `${conversationId}_${buyerId}`;

  const sellerReviewRef = doc(db, "users", sellerId, "reviews", reviewId);
  const buyerReviewRef = doc(db, "users", buyerId, "myReviews", reviewId);

  const sellerSnap = await getDoc(sellerReviewRef);

  if (!sellerSnap.exists()) return null;

  const data: any = sellerSnap.data();

  // Self-heal older reviews that exist on the seller side
  // but are missing from the buyer's myReviews collection.
  const buyerSnap = await getDoc(buyerReviewRef);

  if (!buyerSnap.exists()) {
    await setDoc(
      buyerReviewRef,
      {
        sellerId: data?.sellerId ?? sellerId,
        buyerId: data?.buyerId ?? buyerId,
        conversationId: data?.conversationId ?? conversationId,
        listingId: data?.listingId ?? "",
        rating: typeof data?.rating === "number" ? data.rating : 0,
        reviewText: typeof data?.reviewText === "string" ? data.reviewText : "",
        sellerResponse:
          typeof data?.sellerResponse === "string" ? data.sellerResponse : "",
        sellerResponseAt: data?.sellerResponseAt ?? null,
        createdAt: data?.createdAt ?? serverTimestamp(),
        updatedAt: data?.updatedAt ?? serverTimestamp(),
      },
      { merge: true }
    );
  }

  return {
    rating: typeof data?.rating === "number" ? data.rating : null,
    reviewText: typeof data?.reviewText === "string" ? data.reviewText : "",
  };
}