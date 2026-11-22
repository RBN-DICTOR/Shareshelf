export const ITEM_CATEGORIES = [
  'Tools',
  'Electronics',
  'Education',
  'Household',
  'Outdoor',
  'Events',
  'Sports',
  'Other',
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const ITEM_CONDITIONS = ['Like new', 'Good', 'Fair'] as const;
export type ItemCondition = (typeof ITEM_CONDITIONS)[number];

export type BorrowRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'active'
  | 'return_requested'
  | 'completed'
  | 'cancelled';

export interface Profile {
  id: string;
  full_name: string;
  neighborhood: string | null;
  created_at?: string;
}

export interface Item {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  category: ItemCategory;
  condition: ItemCondition;
  image_url: string | null;
  neighborhood: string;
  is_available: boolean;
  rules: string | null;
  replacement_value: number;
  is_demo: boolean;
  created_at: string;
  owner?: Profile | null;
}

export interface ItemBusyDate {
  item_id: string;
  start_date: string;
  end_date: string;
  status: 'approved' | 'active' | 'return_requested';
}

export interface BorrowRequest {
  id: string;
  item_id: string;
  borrower_id: string;
  owner_id: string;
  start_date: string;
  end_date: string;
  message: string | null;
  status: BorrowRequestStatus;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  item?: Item | null;
  borrower?: Profile | null;
  owner?: Profile | null;
}

export interface WantResponse {
  id: string;
  want_id: string;
  responder_id: string;
  message: string;
  created_at: string;
  responder?: Profile | null;
}

export interface ItemWant {
  id: string;
  requester_id: string;
  title: string;
  description: string | null;
  category: ItemCategory | string;
  neighborhood: string;
  needed_by: string;
  status: 'open' | 'fulfilled';
  is_demo: boolean;
  created_at: string;
  requester?: Profile | null;
  want_responses?: WantResponse[];
}

export interface NotificationItem {
  id: string;
  user_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface CommunityImpact {
  items_listed: number;
  completed_exchanges: number;
  borrowed_now: number;
  money_saved: number;
  items_reused: number;
  demo_items: number;
}

export interface DebugErrorLog {
  id: string;
  time: string;
  context: string;
  message: string;
  raw?: unknown;
}
