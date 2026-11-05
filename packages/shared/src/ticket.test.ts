import { describe, expect, it } from "vitest";
import {
  canTransition,
  classifyTicket,
  formatTicketRef,
  initialStatus,
  phoneSchema,
  requiresPayment,
  statusAfterDecision,
  ticketFormSchema,
} from "./ticket.ts";

const base = {
  serviceId: "6f1c6c3e-6d7c-4a52-9b5e-3f8a1e2b4c5d",
  phone: "98765 43210",
  concern: "Need guidance about my career change this year.",
  consent: true as const,
};

describe("phoneSchema", () => {
  it("normalises a 10-digit Indian mobile to E.164", () => {
    expect(phoneSchema.parse("98765-43210")).toBe("+919876543210");
    expect(phoneSchema.parse("+919876543210")).toBe("+919876543210");
  });
  it("rejects landlines and short numbers", () => {
    expect(phoneSchema.safeParse("0801234567").success).toBe(false);
    expect(phoneSchema.safeParse("12345").success).toBe(false);
  });
});

describe("ticketFormSchema", () => {
  it("requires a name unless anonymous", () => {
    expect(ticketFormSchema.safeParse(base).success).toBe(false);
    expect(ticketFormSchema.safeParse({ ...base, isAnonymous: true }).success).toBe(true);
    expect(ticketFormSchema.safeParse({ ...base, name: "Asha" }).success).toBe(true);
  });
  it("requires a WhatsApp number when it differs from the phone", () => {
    const r = ticketFormSchema.safeParse({ ...base, name: "Asha", whatsappSameAsPhone: false });
    expect(r.success).toBe(false);
  });
  it("treats an empty email as absent and requires consent", () => {
    expect(ticketFormSchema.parse({ ...base, name: "Asha", email: "" }).email).toBeUndefined();
    expect(ticketFormSchema.safeParse({ ...base, name: "Asha", consent: false }).success).toBe(false);
  });
});

describe("ticket flow", () => {
  it("classifies the three cases", () => {
    expect(classifyTicket({ knownClient: true, queryKind: "new" })).toBe("A");
    expect(classifyTicket({ knownClient: true, queryKind: "followup" })).toBe("B");
    expect(classifyTicket({ knownClient: false, queryKind: "followup" })).toBe("C");
  });
  it("sends A straight to booking and B/C to review", () => {
    expect(initialStatus("A")).toBe("awaiting_slot");
    expect(initialStatus("B")).toBe("pending_review");
    expect(initialStatus("C")).toBe("pending_review");
  });
  it("maps provider decisions", () => {
    expect(statusAfterDecision("paid_booking")).toBe("awaiting_slot");
    expect(statusAfterDecision("text_reply")).toBe("accepted");
    expect(statusAfterDecision("reject")).toBe("rejected");
    expect(requiresPayment("A")).toBe(true);
    expect(requiresPayment("B", "free_booking")).toBe(false);
    expect(requiresPayment("C", "paid_booking")).toBe(true);
  });
  it("guards transitions", () => {
    expect(canTransition("slot_held", "awaiting_payment")).toBe(true);
    expect(canTransition("rejected", "confirmed")).toBe(false);
  });
  it("formats refs in IST", () => {
    // 2026-10-31 20:00 UTC is already 1 Nov in IST.
    expect(formatTicketRef(new Date("2026-10-31T20:00:00Z"), 42)).toBe("AST-2611-0042");
  });
});
