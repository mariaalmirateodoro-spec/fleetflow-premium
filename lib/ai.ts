// ============================================================
// FleetFlow Premium – AI Assistant (Mock Implementation)
// Replace with real OpenAI calls when API key is configured
// ============================================================

import type { AISuggestion, Booking, Quote, Supplier, VehicleType } from '@/types'

const OPENAI_AVAILABLE = !!process.env.OPENAI_API_KEY

// ─── Vehicle recommendation ───────────────────────────────────
export async function suggestVehicle(guestCount: number, hasLuggage: boolean, isVIP: boolean): Promise<AISuggestion['vehicleRecommendation']> {
  if (OPENAI_AVAILABLE) {
    // Real OpenAI call would go here
  }

  // Mock logic
  let type: VehicleType = 'sedan'
  let reason = ''

  if (isVIP) {
    type = 'luxury'
    reason = 'VIP guest — luxury vehicle recommended for premium experience and impression.'
  } else if (guestCount >= 10) {
    type = 'minibus'
    reason = `Group of ${guestCount} guests requires a minibus for comfortable transportation.`
  } else if (guestCount >= 6) {
    type = 'van'
    reason = `${guestCount} guests with potential luggage are best served by a spacious van.`
  } else if (guestCount >= 3) {
    type = 'suv'
    reason = `${guestCount} guests — SUV recommended for comfort and luggage space.`
  } else {
    type = 'sedan'
    reason = hasLuggage
      ? 'Standard sedan suits 1–2 guests; ensure boot space is confirmed with supplier.'
      : 'Standard sedan is the most cost-effective and comfortable choice.'
  }

  return { type, reason }
}

// ─── Supplier recommendation ──────────────────────────────────
export async function recommendSupplier(
  suppliers: Supplier[],
  vehicleType: VehicleType,
  budget: number | null
): Promise<AISuggestion['supplierRecommendation']> {
  if (OPENAI_AVAILABLE) {
    // Real OpenAI call would go here
  }

  // Mock: filter available suppliers that handle the vehicle type
  const eligible = suppliers.filter(
    (s) => s.is_available && s.vehicle_types.includes(vehicleType)
  )

  if (eligible.length === 0) {
    return undefined
  }

  // Score = 60% rating + 40% price (lower is better)
  const maxRate = Math.max(...eligible.map((s) => s.base_rate_usd ?? 0))
  const scored = eligible.map((s) => {
    const priceScore = maxRate > 0 ? 1 - (s.base_rate_usd ?? 0) / maxRate : 0.5
    const ratingScore = s.rating / 5
    const score = ratingScore * 0.6 + priceScore * 0.4
    return { ...s, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]

  const reasons: string[] = []
  if (best.is_preferred) reasons.push('preferred partner')
  if (best.rating >= 4.5) reasons.push(`top-rated at ${best.rating}★`)
  if (budget && best.base_rate_usd && best.base_rate_usd < budget * 0.8) {
    reasons.push('well within budget')
  }

  return {
    supplierId: best.id,
    supplierName: best.company_name,
    reason: reasons.length > 0
      ? `Best match: ${reasons.join(', ')}. Handles ${vehicleType} vehicles with ${best.total_bookings} completed trips.`
      : `Highest overall score balancing rating (${best.rating}★) and pricing.`,
  }
}

// ─── Draft supplier inquiry email ────────────────────────────
export async function draftSupplierEmail(booking: Booking, supplier: Supplier): Promise<string> {
  if (OPENAI_AVAILABLE) {
    // Real OpenAI call would go here
  }

  const pickupDate = new Date(booking.pickup_datetime).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const pickupTime = new Date(booking.pickup_datetime).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  })

  return `Subject: Vehicle Quote Request – ${booking.reference_number} | ${pickupDate}

Dear ${supplier.contact_person},

I hope this message finds you well. I am writing on behalf of our guest relations team to request a quote for the following transportation requirement:

BOOKING DETAILS:
• Reference: ${booking.reference_number}
• Guest Name: ${booking.guest_name} (${booking.guest_nationality})
• Guest Count: ${booking.guest_count} passenger${booking.guest_count > 1 ? 's' : ''}
• Vehicle Type: ${booking.vehicle_type.charAt(0).toUpperCase() + booking.vehicle_type.slice(1)}
• Driver Required: ${booking.driver_required ? 'Yes' : 'No'}
• Pick-up: ${booking.pickup_location}
• Date & Time: ${pickupDate} at ${pickupTime}
• Drop-off: ${booking.dropoff_location}
${booking.budget_usd ? `• Budget: PHP ${booking.budget_usd}` : ''}
${booking.notes ? `• Special Notes: ${booking.notes}` : ''}

Could you please provide your best quote at your earliest convenience? We would appreciate a response within 24 hours.

Please confirm vehicle availability, driver details (if applicable), and any additional charges.

Warm regards,
FleetFlow Premium – Guest Transport Operations
Email: operations@fleetflow.com
`
}

// ─── Viber message draft ─────────────────────────────────────
export function generateViberMessage(booking: Booking, supplier: Supplier): string {
  const pickupDate = new Date(booking.pickup_datetime).toLocaleDateString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
  const pickupTime = new Date(booking.pickup_datetime).toLocaleTimeString('en-PH', {
    hour: '2-digit', minute: '2-digit',
  })

  return `Hi ${supplier.contact_person}! 👋

We have a transport booking and would like your quote:

📋 Ref: ${booking.reference_number}
👤 Guest: ${booking.guest_name} (${booking.guest_nationality}) — ${booking.guest_count} pax
🚗 Vehicle: ${booking.vehicle_type.charAt(0).toUpperCase() + booking.vehicle_type.slice(1)}${booking.driver_required ? ' with driver' : ''}
📍 From: ${booking.pickup_location}
📍 To: ${booking.dropoff_location}
📅 Date: ${pickupDate} at ${pickupTime}${booking.budget_usd ? `\n💰 Budget: PHP ${booking.budget_usd}` : ''}${booking.notes ? `\n📝 Notes: ${booking.notes}` : ''}

Please reply with your best rate ASAP. Thank you! 🙏
— FleetFlow Team`
}

// ─── Guest notification email ────────────────────────────────
export function draftGuestEmail(booking: Booking, selectedQuote?: Quote | null): string {
  const pickupDate = new Date(booking.pickup_datetime).toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const pickupTime = new Date(booking.pickup_datetime).toLocaleTimeString('en-PH', {
    hour: '2-digit', minute: '2-digit',
  })
  const vehicleLabel = booking.vehicle_type.charAt(0).toUpperCase() + booking.vehicle_type.slice(1)

  if (selectedQuote) {
    return `Subject: Booking Confirmed – ${booking.reference_number}

Dear ${booking.guest_name},

Great news! Your transport booking has been confirmed. Here are your final details:

✅ BOOKING CONFIRMATION
• Reference No.: ${booking.reference_number}
• Vehicle: ${selectedQuote.vehicle_model ? selectedQuote.vehicle_model : vehicleLabel}${booking.driver_required ? ' with driver' : ''}
• Passengers: ${booking.guest_count} pax
• Pick-up: ${booking.pickup_location}
• Drop-off: ${booking.dropoff_location}
• Date & Time: ${pickupDate} at ${pickupTime}
${selectedQuote.total_amount ? `• Total Cost: PHP ${selectedQuote.total_amount.toLocaleString()}` : ''}
${booking.special_requests ? `• Special Requests: ${booking.special_requests}` : ''}

Please be at the pick-up location at least 5 minutes before your scheduled time. Your driver will be waiting for you.

For any questions or changes, please contact us immediately.

Warm regards,
FleetFlow Premium – Guest Transport Operations
Email: operations@fleetflow.com`
  }

  return `Subject: Booking Update – ${booking.reference_number}

Dear ${booking.guest_name},

Thank you for choosing FleetFlow Premium. Your transport booking has been received and is currently being processed.

📋 BOOKING DETAILS
• Reference No.: ${booking.reference_number}
• Vehicle: ${vehicleLabel}${booking.driver_required ? ' with driver' : ''}
• Passengers: ${booking.guest_count} pax
• Pick-up: ${booking.pickup_location}
• Drop-off: ${booking.dropoff_location}
• Date & Time: ${pickupDate} at ${pickupTime}
${booking.special_requests ? `• Special Requests: ${booking.special_requests}` : ''}

We are currently confirming vehicle availability and will send you a confirmation with final details shortly.

For any questions, please do not hesitate to contact us.

Warm regards,
FleetFlow Premium – Guest Transport Operations
Email: operations@fleetflow.com`
}

// ─── Booking summary ─────────────────────────────────────────
export async function summarizeBooking(booking: Booking): Promise<string> {
  if (OPENAI_AVAILABLE) {
    // Real OpenAI call would go here
  }

  const date = new Date(booking.pickup_datetime)
  const daysUntil = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const timeframe = daysUntil > 0 ? `in ${daysUntil} day${daysUntil > 1 ? 's' : ''}` : 'in the past'

  return `Booking ${booking.reference_number}: ${booking.guest_name} (${booking.guest_nationality}) — ${booking.guest_count} guest${booking.guest_count > 1 ? 's' : ''} — requires a ${booking.vehicle_type}${booking.driver_required ? ' with driver' : ''} from ${booking.pickup_location} to ${booking.dropoff_location}, ${timeframe}. Status: ${booking.status.toUpperCase()}${booking.budget_usd ? `. Budget: PHP ${booking.budget_usd}` : ''}.${booking.notes ? ` Notes: ${booking.notes}` : ''}`
}
