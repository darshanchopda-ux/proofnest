import type { AgreementClause, AgreementFacts } from "@/db/schema";

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

export type Decision = "already_there" | "wear_and_tear" | "no_receipt" | "check" | "likely_valid";

export const DECISIONS: Record<Decision, string> = {
  already_there: "Dispute: already there at move-in",
  wear_and_tear: "Dispute: normal wear and tear",
  no_receipt: "Dispute: no bill or receipt shared",
  check: "Ask the owner to explain",
  likely_valid: "Accept this charge",
};

export const AI_LABEL: Record<Decision, string> = {
  already_there: "Already there",
  wear_and_tear: "Wear and tear",
  no_receipt: "No bill",
  check: "Check this",
  likely_valid: "Likely valid",
};

export const DISPUTED: Decision[] = ["already_there", "wear_and_tear", "no_receipt"];

export type ChargeDTO = {
  id: string;
  item: string;
  amount: number;
  aiVerdict: Decision | null;
  decision: Decision;
  photoNs: number[];
  reason: string;
  confidence: number | null;
  source: "ai" | "manual";
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
  agreement: AgreementDTO | null;
  ownerReview: OwnerReviewDTO | null;
  charges: ChargeDTO[];
  analyzedAt: string | null;
};

export type AgreementFileDTO = {
  name: string;
  contentType: string;
  sizeBytes: number;
  /** Same-origin URL that streams the private file to its owner. */
  href: string;
};

export type AgreementDTO = {
  files: AgreementFileDTO[];
  facts: AgreementFacts;
  clauses: AgreementClause[];
  flags: string[];
  pages: number;
  /** True when the agreement was pasted as text rather than uploaded. */
  pasted: boolean;
  readAt: string | null;
  /** True once the tenant has applied or set aside the suggested flat details. */
  reviewed: boolean;
};

export type OwnerReviewDTO = {
  /** Secret part of the owner's link: /confirm/<token>. */
  token: string;
  status: "pending" | "confirmed" | "disputed";
  /** The P-numbers the owner was shown. */
  photoNs: number[];
  ownerName: string;
  ownerNote: string;
  createdAt: string;
  respondedAt: string | null;
  recordHash: string;
  /** True when the photos have changed since the link was made. */
  stale: boolean;
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
