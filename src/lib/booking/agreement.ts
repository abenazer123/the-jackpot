/**
 * Booking agreement + payment terms for the guest confirmation page
 * (/confirm/[token]). Single editable source for the schedule, the
 * acknowledgments, the security hold, the fee schedule, and the full
 * agreement modal copy.
 *
 * IMPORTANT
 * - Numbers/terms here are the ones Abe confirmed from the booking mockup.
 *   Confirm every figure and have the agreement reviewed before it is sent
 *   to a guest. This is a binding document.
 * - FILL the BUSINESS placeholders (LLC, address, phone) before sending.
 * - Brand rule: no dashes of any kind in any copy. Keep it that way.
 */

/** Bump when the agreement copy/terms change, stored with each signature. */
export const AGREEMENT_VERSION = "2026-06-29";

/** Business details. Phone still to fill. */
export const BUSINESS = {
  llc: "Stravon Group LLC",
  address: "4505 N Harding Ave, Chicago, IL",
  phone: "[your number]",
};

/** Stay logistics. Check in 12 PM and check out 1 PM are exclusive perks
 *  extended to this booking (standard is 4 PM / 11 AM). */
export const STAY = {
  checkIn: "12:00 PM",
  checkInNote: "Exclusive early check in",
  checkOut: "1:00 PM",
  checkOutNote: "Exclusive late check out",
  maxGuests: 14,
  quietHours: "9:00 PM to 8:00 AM",
  outdoorMusic: "10:00 AM to 6:00 PM",
  holdUsd: 250,
};

/** Reserves the dates today; counts toward the first payment. */
export const DEPOSIT_NOW_USD = 500;

export interface ScheduleRow {
  when: string;
  what: string;
  amountCents: number;
  now?: boolean;
}

/**
 * How much the guest chooses to pay today:
 *   reserve - the flat $500 that holds the dates (lowest commitment)
 *   half    - 50 percent of the total today, final 50 percent at milestone 2
 *   full    - the whole total today, nothing else due
 * Same grand total in every case; there is no discount for paying early.
 */
export type PaymentPlan = "reserve" | "half" | "full";

export const PAYMENT_PLANS: readonly PaymentPlan[] = ["reserve", "half", "full"];

export function isPaymentPlan(v: unknown): v is PaymentPlan {
  return v === "reserve" || v === "half" || v === "full";
}

/** Amount due today for the chosen plan, derived from the real total. */
export function planAmountCents(totalCents: number, plan: PaymentPlan): number {
  if (plan === "full") return totalCents;
  if (plan === "half") return Math.round(totalCents / 2);
  return DEPOSIT_NOW_USD * 100;
}

/** Human label for a plan (admin, PDF, certificate). */
export function planLabel(plan: PaymentPlan): string {
  if (plan === "full") return "Paid in full";
  if (plan === "half") return "50 percent today";
  return "Reserve ($500 today)";
}

/**
 * Build the payment schedule from the real total, for the chosen plan.
 *   reserve: $500 now, balance to 50 percent by milestone 1, final 50 percent
 *            by milestone 2.
 *   half:    50 percent now, final 50 percent by milestone 2.
 *   full:    the whole total now, nothing else due.
 */
export function paymentSchedule(
  totalCents: number,
  milestone1: string,
  milestone2: string,
  plan: PaymentPlan = "reserve",
): ScheduleRow[] {
  const half = Math.round(totalCents / 2);

  if (plan === "full") {
    return [
      {
        when: "Today",
        what: "Paid in full. Nothing else is due before your stay.",
        amountCents: totalCents,
        now: true,
      },
    ];
  }

  if (plan === "half") {
    return [
      {
        when: "Today",
        what: "50 percent today. Reserves your dates and counts toward your stay.",
        amountCents: half,
        now: true,
      },
      {
        when: `By ${milestone2}`,
        what: "The final 50 percent, due before arrival.",
        amountCents: totalCents - half,
      },
    ];
  }

  const nowCents = DEPOSIT_NOW_USD * 100;
  return [
    {
      when: "Today",
      what: "Reserves your dates and applies toward your first payment.",
      amountCents: nowCents,
      now: true,
    },
    {
      when: `By ${milestone1}`,
      what: "Brings you to 50 percent paid. Your deposit counts toward this.",
      amountCents: Math.max(0, half - nowCents),
    },
    {
      when: `By ${milestone2}`,
      what: "The final 50 percent, due before arrival.",
      amountCents: totalCents - half,
    },
  ];
}

/** The five required acknowledgments (each its own checkbox). */
export const ACKNOWLEDGMENTS: ReadonlyArray<{ id: string; lead: string; rest: string }> = [
  {
    id: "agreement",
    lead: "I have read the full Rental Agreement and House Rules",
    rest: "and I have authority to agree on behalf of my crew.",
  },
  {
    id: "payment",
    lead: "Payment and cancellation:",
    rest: "I understand the payment schedule and the cancellation terms: a full refund 60 or more days before arrival, a 50 percent refund 30 to 59 days before, and no refund within 30 days of arrival.",
  },
  {
    id: "hold",
    lead: "Hold and card on file:",
    rest: "I authorize a $250 refundable hold and agree my card stays on file for any documented damage or rule violation fee, charged only with prior written notice.",
  },
  {
    id: "parties",
    lead: "No parties or events:",
    rest: "only my registered guests may gather, and hosting a party or event means a $500 fee and possible cancellation.",
  },
  {
    id: "overnight",
    lead: "Overnight and visitors:",
    rest: "only registered guests stay overnight, and any visitor must be approved by the host in advance.",
  },
];

/** The fee schedule shown inside the agreement. */
export const FEE_SCHEDULE: ReadonlyArray<string> = [
  "Smoking or vaping indoors: $500 plus possible cancellation",
  "Unauthorized party or event: $500 plus possible cancellation",
  "Unregistered or unauthorized guest: $150 per person, per night",
  "Hot tub hygiene misuse: $200 to $350",
  "Hot tub substances, glass, or cover damage: $150 to $500",
  "Fire pit or grill misuse: $100 to $300",
  "Excessive cleaning: $150 to $300",
];

/** The full agreement, rendered in the modal. Plain, no dashes. */
export const AGREEMENT_SECTIONS: ReadonlyArray<{ h: string; body: string[] }> = [
  {
    h: "The basics",
    body: [
      `This agreement is between The Jackpot (operated by ${BUSINESS.llc}) and the guest named on this page, for a 2 night stay at the home in North Park, Chicago. The primary renter must be 25 or older, present for the stay, and responsible for all guests.`,
    ],
  },
  {
    h: "Your stay (not a tenancy)",
    body: [
      "This is a short term, transient stay only. You are a guest with permission to stay for these dates. You do not gain any tenancy or residency rights, and no landlord tenant relationship is created. You agree to leave by check out.",
    ],
  },
  {
    h: "Maximum occupancy",
    body: [
      "Up to 14 overnight guests, all listed on the guest roster before check in. Exceeding the cap or adding unlisted overnight guests is a breach and grounds for immediate termination without refund.",
    ],
  },
  {
    h: "Payment and cancellation",
    body: [
      "You choose how to pay today: a $500 reserve, 50 percent, or the full amount, with any balance due on the dates shown on this page. The same total applies in every case, and what you pay today is applied to your stay.",
      "Cancellation is based on how far ahead you cancel. Cancel 60 or more days before arrival for a full refund of everything paid. Cancel 30 to 59 days before arrival for a 50 percent refund of the total. Cancel fewer than 30 days before arrival and no refund is given. Approved refunds return to your original card within 5 to 10 business days.",
    ],
  },
  {
    h: "Security hold and card on file",
    body: [
      "No security deposit is charged. A temporary $250 authorization hold is placed before check in and released after the stay. Your card stays on file and is only charged for documented damage, missing items, excessive cleaning, or rule violations, always after written notice, photos, and direct communication.",
    ],
  },
  {
    h: "Celebrations, parties, and visitors",
    body: [
      "Your registered crew is welcome to celebrate. No parties, events, or large gatherings. Any gathering is limited to registered guests, must follow all house rules, and must cause no neighbor disturbance or damage. A party or event means a $500 fee and possible cancellation.",
      "No visitors without advance written approval, with name and headcount agreed ahead of time. Approved visitors may never stay overnight, per City of Chicago rules.",
    ],
  },
  {
    h: "Quiet hours, music, and conduct",
    body: [
      "Quiet hours run 9:00 PM to 8:00 AM, indoors and out. Modest outdoor music is allowed only 10:00 AM to 6:00 PM, and none outside that window. Shoes off inside. Keep doors and gates closed. No pets. No smoking or vaping indoors or on the enclosed patio.",
    ],
  },
  {
    h: "Prohibited uses",
    body: [
      "No illegal activity or controlled substances. No firearms. No subletting or re listing the booking. No commercial use, filming, or photography for hire without consent. No tampering with smoke or carbon monoxide detectors, cameras, or locks. No glass in the hot tub, fire pit, or grill areas.",
    ],
  },
  {
    h: "Fees",
    body: FEE_SCHEDULE as string[],
  },
  {
    h: "Amenities and assumption of risk",
    body: [
      "The hot tub, fire pit, grill, and all features are used at your own risk. Follow all safety instructions in the House Rules. Report any pre existing damage within 3 hours of check in and you will not be held responsible for it.",
    ],
  },
  {
    h: "Cameras and privacy",
    body: [
      "The home has exterior security cameras only, at entry points and the driveway or alley, for security and guest count verification. There are no cameras inside the home. Please do not disable or cover them.",
    ],
  },
  {
    h: "Insurance",
    body: [
      "The host's insurance does not cover your or your group's personal belongings, and the host is not responsible for lost, stolen, or damaged items. You are encouraged to carry your own coverage.",
    ],
  },
  {
    h: "Events beyond our control",
    body: [
      "Neither side is liable for a failure to perform caused by events beyond reasonable control, such as natural disaster, severe weather, utility failure, or government action. In that case we will work in good faith toward a reschedule or a fair refund.",
    ],
  },
  {
    h: "Electronic signature",
    body: [
      "You agree to sign electronically. Your typed full legal name together with the acknowledgment boxes on this page are your electronic signature, legally binding to the same extent as a handwritten one under the federal ESIGN Act and the Illinois UETA. You consent to receive this agreement, notices, and receipts electronically.",
    ],
  },
  {
    h: "Other terms",
    body: [
      "Governed by Illinois law (Cook County). The guest indemnifies the host except for the host's gross negligence, and host liability is capped at amounts paid. This is the entire agreement and supersedes any side promises. If any part is unenforceable, the rest still applies. Parking, garage access, and amenity instructions are in the House Rules and Amenity Guide, which is part of this agreement. If the Guide and this agreement ever conflict, this agreement controls.",
    ],
  },
];

/** Closing disclaimer line in the modal. */
export const AGREEMENT_DISCLAIMER =
  "Summary shown for review. The full signed agreement and House Rules and Amenity Guide are the controlling documents and will be attached to your confirmation.";

/** The set of acknowledgment ids that must all be checked to sign. */
export const REQUIRED_ACK_IDS: ReadonlyArray<string> = ACKNOWLEDGMENTS.map(
  (a) => a.id,
);

/**
 * Deterministic, exact serialization of the agreement a guest sees, so the
 * signature record can store a SHA-256 of it (proof of which terms were
 * agreed to). Hash this server-side; never trust a client-supplied hash.
 */
export function agreementCanonicalText(): string {
  const parts: string[] = [
    "The Jackpot Rental Agreement and House Rules",
    `Version: ${AGREEMENT_VERSION}`,
  ];
  for (const s of AGREEMENT_SECTIONS) {
    parts.push(`## ${s.h}`);
    for (const b of s.body) parts.push(b);
  }
  parts.push("## Acknowledgments");
  for (const a of ACKNOWLEDGMENTS) parts.push(`${a.lead} ${a.rest}`);
  parts.push(AGREEMENT_DISCLAIMER);
  return parts.join("\n");
}
