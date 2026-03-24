/// <reference path="./deno-shim.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Only allow redirects to our partner invite completion route (admin-only caller, but keep strict).
 */
function sanitizeInviteRedirect(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return undefined
  }
  const okProto =
    url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === 'localhost')
  if (!okProto) return undefined
  const path = url.pathname.replace(/\/$/, '') || '/'
  if (path !== '/partner/accept-invite') return undefined
  return url.toString()
}

async function findUserIdByEmail(
  adminClient: ReturnType<typeof createClient>,
  email: string,
): Promise<string | null> {
  const normalized = email.toLowerCase()
  let page = 1
  const perPage = 1000
  for (;;) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error || !data?.users?.length) return null
    const hit = data.users.find((u) => u.email?.toLowerCase() === normalized)
    if (hit?.id) return hit.id
    if (data.users.length < perPage) return null
    page += 1
    if (page > 50) return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const role =
      user.app_metadata && typeof user.app_metadata === 'object' && 'role' in user.app_metadata
        ? (user.app_metadata as { role?: unknown }).role
        : undefined

    if (role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = (await req.json()) as { email?: string; redirectTo?: string }
    const email = body.email?.trim()
    if (!email) {
      return new Response(JSON.stringify({ error: 'email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const redirectTo = sanitizeInviteRedirect(body.redirectTo)

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const inviteOpts = redirectTo ? { redirectTo } : undefined

    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, inviteOpts)

    if (!error && data?.user?.id) {
      return new Response(JSON.stringify({ userId: data.user.id }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const msg = error?.message?.toLowerCase() ?? ''
    const already =
      msg.includes('already') ||
      msg.includes('registered') ||
      msg.includes('exists') ||
      error?.status === 422

    if (already) {
      const existingId = await findUserIdByEmail(adminClient, email)
      if (existingId) {
        return new Response(JSON.stringify({ userId: existingId, reused: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    return new Response(JSON.stringify({ error: error?.message ?? 'Invite failed' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
