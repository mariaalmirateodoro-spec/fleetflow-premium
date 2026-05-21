import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { suggestVehicle, recommendSupplier, draftSupplierEmail, summarizeBooking, generateViberMessage, draftGuestEmail, generateGuestViberMessage } from '@/lib/ai'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'suggest_vehicle': {
        const { guestCount, hasLuggage, isVIP } = body
        const suggestion = await suggestVehicle(guestCount ?? 1, hasLuggage ?? false, isVIP ?? false)
        return NextResponse.json({ vehicle: suggestion })
      }

      case 'recommend_supplier': {
        const { vehicleType, budget } = body
        const { data: suppliers } = await supabase.from('suppliers').select('*').eq('is_available', true)
        const suggestion = await recommendSupplier(suppliers ?? [], vehicleType, budget)
        return NextResponse.json({ supplier: suggestion })
      }

      case 'draft_email': {
        const { booking, supplier } = body
        const email = await draftSupplierEmail(booking, supplier)
        return NextResponse.json({ email })
      }

      case 'summarize': {
        const { booking } = body
        const summary = await summarizeBooking(booking)
        return NextResponse.json({ summary })
      }

      case 'viber_message': {
        const { booking, supplier } = body
        const message = generateViberMessage(booking, supplier)
        return NextResponse.json({ message })
      }

      case 'guest_email': {
        const { booking, selectedQuote } = body
        const email = draftGuestEmail(booking, selectedQuote ?? null)
        return NextResponse.json({ email })
      }

      case 'guest_viber_message': {
        const { booking, selectedQuote } = body
        const trackingUrl = `${request.nextUrl.origin}/book/status/${booking.reference_number}`
        const message = generateGuestViberMessage(booking, selectedQuote ?? null, trackingUrl)
        return NextResponse.json({ message })
      }

      case 'guest_line_message': {
        const { booking, selectedQuote } = body
        const trackingUrl = `${request.nextUrl.origin}/book/status/${booking.reference_number}`
        const message = generateGuestViberMessage(booking, selectedQuote ?? null, trackingUrl)
        return NextResponse.json({ message })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (err) {
    console.error('[ai/route]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
