import { IST_OFFSET_MS } from "./ticket.ts";

/** Weekly availability, edited on the Manage Schedule page. Times are IST "HH:MM". */
export interface AvailabilityRule {
  weekday: number; // 0 = Sunday … 6 = Saturday
  startTime: string;
  endTime: string;
  slotMinutes: number;
  active: boolean;
}

/** A one-off change for a date (IST "YYYY-MM-DD"). No times = the whole day. */
export interface AvailabilityException {
  date: string;
  kind: "block" | "extra";
  startTime?: string;
  endTime?: string;
  slotMinutes?: number;
}

export interface BusyRange {
  start: Date;
  end: Date;
}

export interface Slot {
  start: Date;
  end: Date;
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** IST calendar date + minutes past IST midnight -> UTC instant. */
const istInstant = (date: string, minutes: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) - IST_OFFSET_MS + minutes * 60_000);

const istDateString = (d: Date) => new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

const addDays = (date: string, n: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const overlaps = (a: Slot, b: BusyRange) => a.start < b.end && b.start < a.end;

function cut(date: string, startTime: string, endTime: string, slotMinutes: number): Slot[] {
  const out: Slot[] = [];
  const end = toMinutes(endTime);
  for (let t = toMinutes(startTime); t + slotMinutes <= end; t += slotMinutes) {
    out.push({ start: istInstant(date, t), end: istInstant(date, t + slotMinutes) });
  }
  return out;
}

/**
 * Free slots for IST dates [fromDate, fromDate + days). Booked/held ranges are removed,
 * and slots starting before `now + minLeadMinutes` are dropped. The DB exclusion
 * constraint stays the real guard against double-booking; this is only for display.
 */
export function generateSlots(opts: {
  rules: AvailabilityRule[];
  exceptions?: AvailabilityException[];
  busy?: BusyRange[];
  fromDate: string;
  days: number;
  now?: Date;
  minLeadMinutes?: number;
}): Slot[] {
  const { rules, exceptions = [], busy = [], fromDate, days, now = new Date(), minLeadMinutes = 60 } = opts;
  const earliest = new Date(now.getTime() + minLeadMinutes * 60_000);
  const slots: Slot[] = [];

  for (let i = 0; i < days; i++) {
    const date = addDays(fromDate, i);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const dayExceptions = exceptions.filter((e) => e.date === date);
    if (dayExceptions.some((e) => e.kind === "block" && !e.startTime)) continue;

    let daySlots = rules
      .filter((r) => r.active && r.weekday === weekday)
      .flatMap((r) => cut(date, r.startTime, r.endTime, r.slotMinutes));

    for (const e of dayExceptions) {
      if (!e.startTime || !e.endTime) continue;
      if (e.kind === "extra") {
        const minutes = e.slotMinutes ?? rules.find((r) => r.weekday === weekday)?.slotMinutes ?? 30;
        daySlots.push(...cut(date, e.startTime, e.endTime, minutes));
      } else {
        const blocked = { start: istInstant(date, toMinutes(e.startTime)), end: istInstant(date, toMinutes(e.endTime)) };
        daySlots = daySlots.filter((s) => !overlaps(s, blocked));
      }
    }

    slots.push(...daySlots.filter((s) => s.start >= earliest && !busy.some((b) => overlaps(s, b))));
  }

  // Dedupe (overlapping rules/extras) and sort.
  const seen = new Set<number>();
  return slots
    .filter((s) => (seen.has(s.start.getTime()) ? false : (seen.add(s.start.getTime()), true)))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export { istDateString };
