import { createContext, useContext, useState } from "react";

export type CreateDraft = {
  title?: string;
  category?: string;

  price?: number;
  pricingType?: "total" | "per_unit";
  unit?: string;
  quantity?: number;
  condition?: string;

  description?: string;

  city?: string;
  state?: string;
  zip?: string;
  lat?: number | null;
  lng?: number | null;

  photoUrls?: string[];
  localPhotoUris?: string[];
  photoOrder?: string[];
  removedRemoteUrls?: string[];

  isPromoted?: boolean;
  promotionExpiresAt?: any;
};

type StartEditingPayload = CreateDraft & {
  id: string;
};

type CreateContextType = {
  draft: CreateDraft;
  setDraft: (data: Partial<CreateDraft>) => void;
  resetDraft: () => void;

  isEditing: boolean;
  editId: string | null;

  loadingExisting: boolean;

  startEditing: (listing: StartEditingPayload) => void;
  stopEditing: () => void;
};

const CreateContext = createContext<CreateContextType | null>(null);

export function CreateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [draft, setDraftState] = useState<CreateDraft>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [loadingExisting] = useState(false);

  const setDraft = (data: Partial<CreateDraft>) => {
    setDraftState((prev) => ({ ...prev, ...data }));
  };

  const resetDraft = () => {
    setDraftState({});
    setEditId(null);
  };

  const startEditing = (listing: StartEditingPayload) => {
    setEditId(listing.id);

    setDraftState({
      title: listing.title ?? "",
      category: listing.category ?? "",

      price: listing.price ?? undefined,
      pricingType: listing.pricingType ?? "total",
      unit: listing.unit ?? "",
      quantity: listing.quantity ?? undefined,
      condition: listing.condition ?? "",

      description: listing.description ?? "",

      city: listing.city ?? "",
      state: listing.state ?? "",
      zip: listing.zip ?? "",
      lat: listing.lat ?? null,
      lng: listing.lng ?? null,

      photoUrls: Array.isArray(listing.photoUrls) ? listing.photoUrls : [],
      localPhotoUris: [],
      photoOrder: Array.isArray(listing.photoOrder)
        ? listing.photoOrder
        : Array.isArray(listing.photoUrls)
          ? listing.photoUrls
          : [],
      removedRemoteUrls: [],

      isPromoted: listing.isPromoted ?? false,
      promotionExpiresAt: listing.promotionExpiresAt ?? null,
    });
  };

  const stopEditing = () => {
    setEditId(null);
  };

  const value: CreateContextType = {
    draft,
    setDraft,
    resetDraft,

    isEditing: !!editId,
    editId,

    loadingExisting,

    startEditing,
    stopEditing,
  };

  return (
    <CreateContext.Provider value={value}>
      {children}
    </CreateContext.Provider>
  );
}

export function useCreate() {
  const ctx = useContext(CreateContext);

  if (!ctx) {
    throw new Error("useCreate must be used inside <CreateProvider />");
  }

  return ctx;
}