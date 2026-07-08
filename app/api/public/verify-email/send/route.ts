import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { sendVerificationCodeEmail } from '@/lib/email'

// ─── Rate limiting: max 3 codes per email per 10 minutes ─────
const RATE_LIMIT_MAX = 3
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const CODE_EXPIRY_MS = 10 * 60 * 1000

const sendCountByEmail = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(email: string): boolean {
  const now = Date.now()
  const entry = sendCountByEmail.get(email)
  if (!entry || now > entry.resetAt) {
    sendCountByEmail.set(email, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000)) // 6 digits
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    if (!checkRateLimit(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Too many verification codes requested for this email. Please wait a few minutes and try again.' },
        { status: 429 }
      )
    }

    const adminClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    )

    const code = generateCode()
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS).toISOString()

    const { error } = await adminClient.from('email_verifications').insert({
      email: normalizedEmail,
      code,
      expires_at: expiresAt,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await sendVerificationCodeEmail(normalizedEmail, code)

    return NextResponse.json({ sent: true })
  } catch (err) {
    console.error('[verify-email/send] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
