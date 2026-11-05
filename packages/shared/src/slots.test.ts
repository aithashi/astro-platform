import { describe, expect, it } from "vitest";
import { generateSlots, type AvailabilityRule } from "./slots.ts";

// 2026-11-09 is a Monday.
const monday: AvailabilityRule = { weekday: 1, startTime: "10:00", endTime: "12:00", slotMinutes: 30, active: true };
const now = new Date("2026-11-01T00:00:00Z");
const ist = (s: string) => new Date(`${s}+05:30`);

describe("generateSlots", () => {
  it("cuts weekly hours into IST slots", () => {
    const slots = generateSlots({ rules: [monday], fromDate: "2026-11-09", days: 1, now });
    expect(slots).toHaveLength(4);
    expect(slots[0]?.start).toEqual(ist("2026-11-09T10:00:00"));
    expect(slots[3]?.end).toEqual(ist("2026-11-09T12:00:00"));
  });

  it("skips inactive days and whole-day blocks", () => {
    expect(generateSlots({ rules: [{ ...monday, active: false }], fromDate: "2026-11-09", days: 1, now })).toHaveLength(0);
    expect(
      generateSlots({ rules: [monday], exceptions: [{ date: "2026-11-09", kind: "block" }], fromDate: "2026-11-09", days: 7, now }),
    ).toHaveLength(0);
  });

  it("applies partial blocks, extra hours and busy ranges", () => {
    const slots = generateSlots({
      rules: [monday],
      exceptions: [
        { date: "2026-11-09", kind: "block", startTime: "10:00", endTime: "10:30" },
        { date: "2026-11-09", kind: "extra", startTime: "18:00", endTime: "19:00" },
      ],
      busy: [{ start: ist("2026-11-09T11:00:00"), end: ist("2026-11-09T11:30:00") }],
      fromDate: "2026-11-09",
      days: 1,
      now,
    });
    expect(slots.map((s) => s.start)).toEqual([
      ist("2026-11-09T10:30:00"),
      ist("2026-11-09T11:30:00"),
      ist("2026-11-09T18:00:00"),
      ist("2026-11-09T18:30:00"),
    ]);
  });

  it("drops slots inside the booking lead time", () => {
    const slots = generateSlots({
      rules: [monday],
      fromDate: "2026-11-09",
      days: 1,
      now: ist("2026-11-09T10:15:00"),
      minLeadMinutes: 60,
    });
    expect(slots.map((s) => s.start)).toEqual([ist("2026-11-09T11:30:00")]);
  });
});
