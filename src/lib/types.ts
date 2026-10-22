import type { AgreementClause, AgreementFacts } from "@/db/schema";

export type Condition = "good" | "worn" | "damaged";
export type Stage = "movein" | "moveout";
export type Step = "record" | "moveout" | "check" | "letter";
export type PhotoPhase = "movein" | "moveout";

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
  /** "live" when taken with ProofNest's camera screen, stamped with the day code; "upload" for any other file. */
  capture: "live" | "upload";
  /** Taken for the move-in record, or at key handover. */
  phase: PhotoPhase;
  dayCode: string;
  /** When a public timestamp authority signed this photo's fingerprint, and which one. */
  timestampedAt: string | null;
  timestampBy: string;
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
  /** The tenant said the AI's reading of this charge is wrong; its reason is then left out of the letter. */
  aiFlagged: boolean;
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
  /** Today's code for this flat, printed on photos taken with the camera screen. */
  dayCode: string;
  /** The latest owner link, answered or not: drives the tenant's "ask your owner" panel. */
  ownerReview: OwnerReviewDTO | null;
  /** The owner's latest answer, which stays the evidence while a newer link waits. */
  ownerAnswer: OwnerReviewDTO | null;
  /** Photos taken at key handover, compared room by room with the move-in ones. */
  moveOutPhotos: PhotoDTO[];
  /** The same owner link and answer, for the move-out photos. */
  moveOutReview: OwnerReviewDTO | null;
  moveOutAnswer: OwnerReviewDTO | null;
  charges: ChargeDTO[];
  analyzedAt: string | null;
  /** The deposit receipt: when and to whom it was paid, the UPI or cheque reference, and who holds it now. */
  depositPaidOn: string | null;
  depositPaidTo: string;
  depositRef: string;
  depositHolder: string;
  /** Language the AI writes the refund letter in. */
  letterLanguage: string;
  /** Money received back, and amounts the owner says they're keeping. */
  refunds: RefundDTO[];
  /** "owner" for the tenant who made this flat in ProofNest; "member" for a flatmate who joined it. */
  access: "owner" | "member";
  members: MemberDTO[];
};

/** A flatmate who joined through an invite link, and their part of the deposit. */
export type MemberDTO = { id: string; name: string; depositShare: number | null; isYou: boolean };

export type RefundDTO = { id: string; kind: "received" | "held"; amount: number; on: string | null; note: string };

/** Languages the refund letter can be written in. */
export const LETTER_LANGUAGES = ["English", "Hindi", "Marathi", "Kannada", "Tamil", "Telugu", "Bengali", "Gujarati", "Malayalam", "Punjabi"];

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
  /** Which record the owner was asked about. */
  kind: "movein" | "moveout";
  /** Who answered: "owner", "agent" or "family" ("" if they didn't say). */
  ownerRole: string;
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
    | "address"
    | "ownerName"
    | "tenantName"
    | "moveIn"
    | "keysHandedOver"
    | "monthlyRent"
    | "deposit"
    | "refundDays"
    | "evidenceNotes"
    | "deductionsText"
    | "letter"
    | "depositPaidOn"
    | "depositPaidTo"
    | "depositRef"
    | "depositHolder"
    | "letterLanguage"
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
