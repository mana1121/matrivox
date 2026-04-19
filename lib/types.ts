export const CATEGORIES = ["Kebersihan", "ICT", "Fasiliti"] as const;
export type Category = (typeof CATEGORIES)[number];

export const STATUSES = ["Diterima", "Dalam Tindakan", "Selesai"] as const;
export type Status = (typeof STATUSES)[number];

export type Role = "admin" | "pic";

export type ClassificationResult = {
  category: Category | null;
  location: string | null;
  summary: string;
  confidence: number;
  needs_followup: boolean;
  followup_question: string | null;
  source: "claude" | "keyword";
};

export type AppUser = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  category_assigned: Category | null;
  whatsapp_phone: string | null;
  is_active: boolean;
};

export type Complaint = {
  id: string;
  complaint_code: string;
  complainant_phone: string;
  original_message: string;
  ai_summary: string | null;
  category: Category | null;
  location: string | null;
  assigned_pic_user_id: string | null;
  status: Status;
  evidence_file_url: string | null;
  source_channel: string;
  ai_confidence: number | null;
  created_at: string;
  updated_at: string;
};
