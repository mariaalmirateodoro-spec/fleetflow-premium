// ============================================================
// FleetFlow Premium – Shared TypeScript Types
// ============================================================

export type UserRole = 'admin' | 'staff' | 'manager' | 'finance'
export type BookingStatus = 'pending' | 'quoted' | 'approved' | 'completed' | 'cancelled'
export type VehicleType = 'sedan' | 'suv' | 'van' | 'minibus' | 'luxury' | 'pickup'
export type ApprovalAction = 'approved' | 'rejected' | 'revision_requested'
export type NotificationType = 'new_request' | 'approval_needed' | 'approved' | 'payment_due' | 'system' | 'new_booking'

// ─────────────────────────────────────────────────────────────
// Database row types
// ─────────────────────────────────────────────────────────────

export interface NotificationPreferences {
  new_booking_request: boolean
  approval_needed: boolean
  booking_approved: boolean
  payment_due: boolean
  system_notifications: boolean
}

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  avatar_url: string | null
  department: string | null
  phone: string | null
  is_active: boolean
  last_login_at: string | null
  notification_preferences: NotificationPreferences | null
  created_at: string
  updated_at: string
}

export interface Supplier {
  id: string
  company_name: string
  contact_person: string
  phone: string
  email: string
  address: string | null
  vehicle_types: VehicleType[]
  base_rate_usd: number | null
  rating: number
  total_bookings: number
  is_available: boolean
  is_preferred: boolean
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Booking {
  id: string
  reference_number: string
  guest_name: string
  guest_nationality: string
  guest_count: number
  guest_phone: string | null
  guest_email: string | null
  guest_line_id: string | null
  pickup_datetime: string
  dropoff_datetime: string | null
  pickup_location: string
  dropoff_location: string
  vehicle_type: VehicleType
  driver_required: boolean
  driver_id: string | null
  vehicle_plate: string | null
  vehicle_model: string | null
  budget_usd: number | null
  final_cost_usd: number | null
  status: BookingStatus
  notes: string | null
  special_requests: string | null
  assigned_supplier: string | null
  created_by: string | null
  approved_by: string | null
  approved_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  created_at: string
  updated_at: string
  // Modification request fields
  modification_status: string | null
  modification_pickup_datetime: string | null
  modification_pickup_location: string | null
  modification_dropoff_location: string | null
  modification_notes: string | null
  modification_requested_at: string | null
  // Relations
  profiles?: Profile
  suppliers?: Supplier
  drivers?: Pick<Driver, 'id' | 'full_name' | 'phone' | 'license_number'>
}

export interface Quote {
  id: string
  booking_id: string
  supplier_id: string
  total_amount: number
  includes_driver: boolean
  vehicle_model: string | null
  estimated_duration_hours: number | null
  valid_until: string | null
  notes: string | null
  is_selected: boolean
  created_by: string | null
  created_at: string
  // Relations
  suppliers?: Supplier
}

export interface Approval {
  id: string
  booking_id: string
  reviewer_id: string
  action: ApprovalAction
  comments: string | null
  revision_notes: string | null
  created_at: string
  // Relations
  profiles?: Profile
  bookings?: Booking
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  booking_id: string | null
  is_read: boolean
  created_at: string
}

// ─────────────────────────────────────────────────────────────
// Form / API input types
// ─────────────────────────────────────────────────────────────

export interface CreateBookingInput {
  guest_name: string
  guest_nationality: string
  guest_count: number
  guest_phone?: string
  guest_email?: string
  guest_line_id?: string
  pickup_datetime: string
  dropoff_datetime?: string
  pickup_location: string
  dropoff_location: string
  vehicle_type: VehicleType
  driver_required: boolean
  budget_usd?: number
  notes?: string
  special_requests?: string
}

export interface CreateSupplierInput {
  company_name: string
  contact_person: string
  phone: string
  email: string
  address?: string
  vehicle_types: VehicleType[]
  base_rate_usd?: number
  notes?: string
}

export interface Driver {
  id: string
  full_name: string
  phone: string
  license_number: string
  license_expiry: string | null
  vehicle_types: VehicleType[]
  is_available: boolean
  assigned_supplier_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Relations
  suppliers?: Supplier
}

export interface CreateDriverInput {
  full_name: string
  phone: string
  license_number: string
  license_expiry?: string
  vehicle_types: VehicleType[]
  is_available?: boolean
  assigned_supplier_id?: string
  notes?: string
}

export interface CreateQuoteInput {
  booking_id: string
  supplier_id: string
  total_amount: number
  includes_driver: boolean
  vehicle_model?: string
  estimated_duration_hours?: number
  valid_until?: string
  notes?: string
}

// ─────────────────────────────────────────────────────────────
// UI / Component types
// ─────────────────────────────────────────────────────────────

export interface StatsCard {
  label: string
  value: string | number
  change?: string
  changeType?: 'up' | 'down' | 'neutral'
  icon: string
}

export interface ActivityItem {
  id: string
  type: string
  description: string
  user: string
  timestamp: string
  booking_ref?: string
}

export interface DashboardStats {
  totalBookings: number
  pendingCount: number
  monthlySpend: number
  supplierCount: number
  upcomingBookings: Booking[]
  recentActivity: ActivityItem[]
  bookingsByStatus: { status: BookingStatus; count: number }[]
  monthlySpendData: { month: string; amount: number }[]
}

export interface FilterParams {
  status?: BookingStatus
  search?: string
  dateFrom?: string
  dateTo?: string
  vehicleType?: VehicleType
  supplierId?: string
}

export interface PaginationParams {
  page: number
  pageSize: number
}

export interface ApiResponse<T> {
  data: T | null
  error: string | null
  count?: number
}

export interface AISuggestion {
  vehicleRecommendation?: {
    type: VehicleType
    reason: string
  }
  supplierRecommendation?: {
    supplierId: string
    supplierName: string
    reason: string
  }
  emailDraft?: string
  summary?: string
}
