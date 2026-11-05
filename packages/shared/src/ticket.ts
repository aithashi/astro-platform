import { z } from "zod";

export const TICKET_STATUSES = [
  "submitted",
  "pending_review",
  "accepted",
  "rejected",
  "awaiting_slot",
  "slot_held",
  "awaiting_payment",
  "confirmed",
  "replied",
  "completed",
  "cancelled",
  "no_show",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** A: existing client + new query, B: existing client + follow-up, C: new client. */
export const CASE_TYPES = ["A", "B", "C"] as const;
export type CaseType = (typeof CASE_TYPES)[number];

/** What the provider chooses when reviewing a B or C ticket. */
export const DECISIONS = ["paid_booking", "free_booking", "text_reply", "reject"] as const;
export type Decision = (typeof DECISIONS)[number];

export const QUERY_KINDS = ["new", "followup"] as const;
export type QueryKind = (typeof QUERY_KINDS)[number];

/** Indian mobile number in E.164 form, e.g. +919876543210. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .transform((v) => (/^[6-9]\d{9}$/.test(v) ? `+91${v}` : v))
  .pipe(z.string().regex(/^\+91[6-9]\d{9}$/, "invalid_phone"));

export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const ALLOWED_ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

export const ticketFormSchema = z
  .object({
    serviceId: z.uuid(),
    isAnonymous: z.boolean().default(false),
    name: z.string().trim().max(80).optional(),
    phone: phoneSchema,
    whatsappSameAsPhone: z.boolean().default(true),
    whatsappPhone: phoneSchema.optional(),
    email: z.email().optional().or(z.literal("").transform(() => undefined)),
    concern: z.string().trim().min(10, "concern_too_short").max(4000),
    /** Only shown when the phone matches a known client. */
    queryKind: z.enum(QUERY_KINDS).optional(),
    /** Self-declared by unknown numbers; the provider verifies it. */
    claimsExistingClient: z.boolean().default(false),
    followupOfRef: z.string().trim().max(20).optional(),
    language: z.enum(["en", "kn", "hi"]).default("en"),
    consent: z.literal(true, { error: "consent_required" }),
  })
  .refine((v) => v.isAnonymous || (v.name && v.name.length > 0), {
    path: ["name"],
    error: "name_required",
  })
  .refine((v) => v.whatsappSameAsPhone || v.whatsappPhone, {
    path: ["whatsappPhone"],
    error: "whatsapp_required",
  });

export type TicketFormInput = z.input<typeof ticketFormSchema>;
export type TicketForm = z.output<typeof ticketFormSchema>;

/**
 * Case A only applies to a client the DB already knows (or one whose self-declaration
 * staff verified). An unverified "I have consulted before" claim stays C until reviewed.
 */
export function classifyTicket(opts: { knownClient: boolean; queryKind?: QueryKind }): CaseType {
  if (!opts.knownClient) return "C";
  return opts.queryKind === "followup" ? "B" : "A";
}

export function initialStatus(caseType: CaseType): TicketStatus {
  return caseType === "A" ? "awaiting_slot" : "pending_review";
}

/** Status a reviewed B/C ticket moves to after the provider's decision. */
export function statusAfterDecision(decision: Decision): TicketStatus {
  switch (decision) {
    case "paid_booking":
    case "free_booking":
      return "awaiting_slot";
    case "text_reply":
      return "accepted";
    case "reject":
      return "rejected";
  }
}

export function requiresPayment(caseType: CaseType, decision?: Decision): boolean {
  if (caseType === "A") return true;
  return decision === "paid_booking";
}

const TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  submitted: ["pending_review", "awaiting_slot"],
  pending_review: ["accepted", "rejected", "awaiting_slot"],
  accepted: ["replied", "awaiting_slot", "cancelled"],
  rejected: [],
  awaiting_slot: ["slot_held", "confirmed", "cancelled"],
  slot_held: ["awaiting_payment", "confirmed", "awaiting_slot", "cancelled"],
  awaiting_payment: ["confirmed", "awaiting_slot", "cancelled"],
  confirmed: ["completed", "cancelled", "no_show", "awaiting_slot"],
  replied: ["completed"],
  completed: [],
  cancelled: [],
  no_show: ["awaiting_slot"],
};

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Human-readable ref, e.g. AST-2611-0042 (IST yymm + per-month sequence). Mirrors next_ticket_ref() in SQL. */
export function formatTicketRef(date: Date, seq: number): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const yy = String(ist.getUTCFullYear()).slice(2);
  const mm = String(ist.getUTCMonth() + 1).padStart(2, "0");
  return `AST-${yy}${mm}-${String(seq).padStart(4, "0")}`;
}

/** India has no DST, so a fixed offset is exact. */
export const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
