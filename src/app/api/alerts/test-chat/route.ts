import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getChatConfig, postToGoogleChat } from '@/lib/googleChat';

// POST /api/alerts/test-chat — "Send test message" button on the Automations page.
export const dynamic = 'force-dynamic';

export async function POST() {
  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { webhookUrl } = await getChatConfig(createAdminClient());
  if (!webhookUrl) {
    return NextResponse.json({ error: 'Google Chat is not connected' }, { status: 400 });
  }

  try {
    await postToGoogleChat(webhookUrl, [
      `✅ Algorithm CRM is connected to this space — deal alerts will appear here. (Test sent by ${user.email})`,
    ]);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
