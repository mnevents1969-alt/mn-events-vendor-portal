// Centralized vendor-facing policy and help copy, so the same text isn't duplicated
// across Help.tsx, BookStall.tsx, MyStall.tsx and Payments.tsx. Moving this to a
// backend-editable "content" table is a reasonable Phase 4+ step — for now it lives in
// one file rather than scattered inline strings.

export type HelpTopic = {
  slug: string;
  title: string;
  sub: string;
  body: string[];
};

export const HELP_TOPICS: HelpTopic[] = [
  {
    slug: "vendor-rules",
    title: "Vendor Rules",
    sub: "Setup, products and conduct",
    body: [
      "Arrive by the reporting time shared for your event — late setup may forfeit your stall slot.",
      "Display only the products and categories listed on your approved application. Undeclared categories may be asked to be removed on the day.",
      "MN Events assigns the exact stall position based on the event layout, your stall type and category. Requests for a specific position aren't guaranteed.",
      "Transferring, sharing or subletting your stall to another vendor or brand is not permitted without prior written approval from MN Events.",
      "Keep your space, signage and conduct professional — repeated complaints can affect approval for future events."
    ]
  },
  {
    slug: "cancellation",
    title: "Cancellation",
    sub: "Terms and refund status",
    body: [
      "Cancellations more than 7 days before the event are eligible for a refund, less a processing fee.",
      "Cancellations within 7 days of the event are generally non-refundable, except where MN Events cancels or reschedules the event.",
      "Refunds, when applicable, are processed to the original payment method and reflect in the Payments tab once complete.",
      "To cancel a confirmed booking, contact MN Events support with your event name and registered mobile number."
    ]
  },
  {
    slug: "faqs",
    title: "FAQs",
    sub: "Bookings, stalls and payments",
    body: [
      "When will my stall number be assigned? — Stall numbers are finalised closer to the event date once the full layout is confirmed; check My Stall for updates.",
      "What furniture is included? — Check the Inclusions section on the event's details page — this varies by event and stall type.",
      "How do I download a receipt? — Once a payment is confirmed, its receipt appears under Payments → Documents.",
      "Can I transfer or share my stall? — No, not without MN Events' prior written approval — see Vendor Rules."
    ]
  },
  {
    slug: "support",
    title: "Support",
    sub: "Booking and event-day help",
    body: [
      "For booking questions, payment issues or event-day support, call MN Events directly.",
      "Keep your registered business name and mobile number handy when you call — it helps us find your booking faster."
    ]
  }
];

export const SUPPORT_PHONE = "9652644079";
export const SUPPORT_EMAIL = "mnevents1969@gmail.com";

export function supportMailto(subject: string, vendorName?: string) {
  const body = `Hi MN Events,%0D%0A%0D%0A${vendorName ? `Business: ${vendorName}%0D%0A` : ""}`;
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${body}`;
}
