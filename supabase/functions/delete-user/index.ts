import { createClient } from 'npm:@supabase/supabase-js@2';

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply(405, { error: 'Method not allowed' });
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return reply(401, { error: 'Authentication required' });
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return reply(503, { error: 'Deletion service unavailable' });
  try {
    const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    // A target user ID in the request body is deliberately ignored.
    const { data, error } = await client.auth.getUser(authorization.slice(7));
    if (error || !data.user) return reply(401, { error: 'Invalid session' });
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    // Database ownership FKs cascade entries, goals, profile and owned zones.
    // Deploy only after those FKs have been verified on the actual database.
    const result = await admin.auth.admin.deleteUser(data.user.id);
    if (result.error) return reply(500, { error: 'Account deletion failed' });
    return reply(200, { deleted: true });
  } catch {
    return reply(500, { error: 'Account deletion failed' });
  }
});
