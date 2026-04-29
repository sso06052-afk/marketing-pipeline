import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const { melon_artist_id, reply_result, memo, followup_date } = await req.json();

  if (!melon_artist_id) {
    return NextResponse.json({ error: "melon_artist_id 필요" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (reply_result !== undefined) update.reply_result = reply_result;
  if (memo !== undefined) update.memo = memo;
  if (followup_date !== undefined) update.followup_date = followup_date || null;

  const { error } = await supabase
    .from("artists")
    .update(update)
    .eq("melon_artist_id", melon_artist_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
