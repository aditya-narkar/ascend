import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/notification-scheduler`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
    })

    const data = await res.json()
    return NextResponse.json({ ok: res.ok, ...data }, { status: res.ok ? 200 : 500 })
  } catch (err) {
    console.error('Notification scheduler error:', err)
    return NextResponse.json({ error: 'Failed to invoke scheduler' }, { status: 500 })
  }
}
