/// <reference path="./deno-shim.d.ts" />
// Deploy: supabase functions deploy delete-partner --no-verify-jwt
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing or invalid Authorization' }, 401)
    }

    const token = authHeader.slice('Bearer '.length).trim()
    let jwtPayload: Record<string, unknown>
    try {
      const payloadB64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
      jwtPayload = JSON.parse(atob(payloadB64)) as Record<string, unknown>
    } catch {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const exp = jwtPayload['exp'] as number | undefined
    if (!exp || Math.floor(Date.now() / 1000) > exp) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const appMeta = jwtPayload['app_metadata'] as Record<string, unknown> | undefined
    if (appMeta?.['role'] !== 'admin') {
      return jsonResponse({ error: 'Forbidden' }, 403)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Server misconfigured' }, 500)
    }

    const body = (await req.json()) as { partnerId?: string }
    const partnerId = typeof body.partnerId === 'string' ? body.partnerId.trim() : ''
    if (!partnerId) {
      return jsonResponse({ error: 'partnerId is required' }, 400)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: partnerRow, error: partnerFetchError } = await adminClient
      .from('v2_partners')
      .select('id, auth_user_id')
      .eq('id', partnerId)
      .maybeSingle()

    if (partnerFetchError) {
      console.error('partner fetch:', partnerFetchError.message)
      return jsonResponse({ error: `Failed to load partner: ${partnerFetchError.message}` }, 500)
    }
    if (!partnerRow) {
      return jsonResponse({ error: 'Partner not found' }, 404)
    }

    const authUserId =
      partnerRow.auth_user_id && typeof partnerRow.auth_user_id === 'string'
        ? partnerRow.auth_user_id
        : null

    const { error: carsError } = await adminClient
      .from('v2_cars')
      .update({ partner_id: null, ownership_type: 'rental' })
      .eq('partner_id', partnerId)

    if (carsError) {
      console.error('unlink cars:', carsError.message)
      return jsonResponse({ error: `Failed to unlink cars: ${carsError.message}` }, 500)
    }

    const { error: clearAuthFkError } = await adminClient
      .from('v2_partners')
      .update({ auth_user_id: null })
      .eq('id', partnerId)

    if (clearAuthFkError) {
      console.error('clear auth_user_id:', clearAuthFkError.message)
      return jsonResponse({ error: `Failed to clear partner auth link: ${clearAuthFkError.message}` }, 500)
    }

    if (authUserId) {
      const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(authUserId)
      if (authDeleteError) {
        console.error('deleteUser:', authDeleteError.message)
        return jsonResponse({ error: `Auth delete failed: ${authDeleteError.message}` }, 500)
      }
    }

    const { error: deletePartnerError } = await adminClient.from('v2_partners').delete().eq('id', partnerId)
    if (deletePartnerError) {
      console.error('delete partner:', deletePartnerError.message)
      return jsonResponse({ error: `Failed to delete partner: ${deletePartnerError.message}` }, 500)
    }

    return jsonResponse({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    console.error('Unhandled exception:', message)
    return jsonResponse({ error: message }, 500)
  }
})
