export type Condition = "good" | "worn" | "damaged";
export type Stage = "movein" | "moveout";
export type Step = "record" | "check" | "letter";

export const CONDITIONS: Record<Condition, string> = { good: "Good", worn: "Worn", damaged: "Damaged" };

export type PhotoDTO = {
  id: string;
  n: number;
  room: string;
  condition: Condition;
  note: string;
  /** Same-origin URL that streams the private image after an ownership check, or null for example photos. */
  src: string | null;
  isExample: boolean;
  sha256: string;
  takenAt: string | null;
  takenFrom: string;
  addedAt: string;
};

export type FlatDTO = {
  id: string;
  stage: Stage;
  isExample: boolean;
  address: string;
  ownerName: string;
  tenantName: string;
  moveIn: string | null;
  keysHandedOver: string | null;
  monthlyRent: string | null;
  deposit: string | null;
  refundDays: number | null;
  rooms: string[];
  evidenceNotes: string;
  deductionsText: string;
  letter: string;
  photos: PhotoDTO[];
  hasAgreement: boolean;
  chargeCount: number;
};

/** Fields the details panel may edit. */
export type FlatPatch = Partial<
  Pick<
    FlatDTO,
    "address" | "ownerName" | "tenantName" | "moveIn" | "keysHandedOver" | "monthlyRent" | "deposit" | "refundDays" | "evidenceNotes" | "deductionsText" | "letter"
  >
>;

export type NewFlatInput = {
  stage: Stage;
  address: string;
  ownerName: string;
  moveIn: string;
  keysHandedOver: string;
  monthlyRent: string;
  deposit: string;
  refundDays: string;
};
