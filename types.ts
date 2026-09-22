export type VendorStatus = "pending_approval" | "approved" | "suspended" | "rejected";

export type StallVendor = {
  id: string;
  stall_name: string;
  is_admin: boolean;
  status: VendorStatus;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  product_category: string | null;
  products_to_display: string | null;
  instagram_handle: string | null;
  gstin: string | null;
  pan: string | null;
  photo_url: string | null;
  payment_pin_hash: string | null;
  city: string | null;
  created_at: string;
};

export type EventRow = {
  id: string;
  title: string;
  tag: string | null;
  description: string | null;
  location: string | null;
  venue: string | null;
  timing: string | null;
  image_url: string | null;
  starts_at: string;
  ends_at: string | null;
  status: "draft" | "published" | "archived" | "closed" | "cancelled";
  half_stall_price: number | null;
  full_stall_price: number | null;
  promotional_stall_price: number | null;
  inclusions: string[];
  half_stall_inclusions: string[] | null;
  full_stall_inclusions: string[] | null;
  categories: string[] | null;
  event_type: string | null;
  audience_count: number | null;
  slug: string;
  booking_deadline: string | null;
  rules: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  half_stall_capacity: number | null;
  full_stall_capacity: number | null;
  promotional_stall_capacity: number | null;
};

export type ApplicationStage =
  | "applied"
  | "reviewed"
  | "approved"
  | "stall_paid"
  | "confirmed"
  | "rejected"
  | "cancelled";

export type PaymentStatus = "unpaid" | "paid" | "refunded";

export type ApplicationRow = {
  id: string;
  vendor_id: string;
  event_id: string;
  stage: ApplicationStage;
  stall_fee_minor: number | null;
  currency: string;
  payment_status: PaymentStatus;
  notes: string | null;
  stall_type: string | null;
  product_category: string | null;
  products_to_display: string | null;
  special_requirements: string | null;
  stall_number: string | null;
  reporting_time: string | null;
  created_at: string;
  updated_at: string;
  events?: EventRow;
};

export type DirectoryEntry = { id: string; stall_name: string };

export type ApplicationStatusHistoryRow = {
  id: string;
  application_id: string;
  old_stage: ApplicationStage | null;
  new_stage: ApplicationStage;
  changed_at: string;
};

export type VendorStatusHistoryRow = {
  id: string;
  vendor_id: string;
  old_status: VendorStatus | null;
  new_status: VendorStatus;
  changed_at: string;
};

export type RedemptionRow = {
  id: string;
  receiver_vendor_id: string;
  issuer_vendor_id: string | null;
  issuer_name_freeform: string | null;
  amount_minor: number | null;
  currency: string;
  created_at: string;
};

export type RefundStatus = "requested" | "approved" | "rejected" | "processed";

export type RefundRequest = {
  id: string;
  application_id: string | null;
  vendor_id: string | null;
  amount_minor: number | null;
  currency: string;
  reason: string | null;
  status: RefundStatus;
  requested_by: string | null;
  decided_by: string | null;
  decided_at: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  applications?: ApplicationRow;
  stall_vendors?: StallVendor;
};

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export type SupportTicket = {
  id: string;
  vendor_id: string;
  subject: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  stall_vendors?: StallVendor;
};

export type SupportTicketMessage = {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: "vendor" | "admin";
  body: string;
  created_at: string;
};

export type AuditLogEntry = {
  id: string;
  actor_id: string;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};
