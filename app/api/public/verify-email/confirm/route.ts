import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json()

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code are required.' }, { status: 400 })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const normalizedCode = String(code).trim()

    const adminClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    )

    // Most recent, unexpired, unused code for this email
    const { data: match, error } = await adminClient
      .from('email_verifications')
      .select('id, code, expires_at, used')
      .eq('email', normalizedEmail)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (!match || match.code !== normalizedCode) {
      return NextResponse.json({ error: 'Incorrect or expired code. Please try again or request a new one.' }, { status: 400 })
    }

    await adminClient
      .from('email_verifications')
      .update({ verified: true })
      .eq('id', match.id)

    return NextResponse.json({ verified: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
