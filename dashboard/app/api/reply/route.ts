import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const { melon_artist_id } = await req.json();

  if (!melon_artist_id) {
    return NextResponse.json({ error: "melon_artist_id 필요" }, { status: 400 });
  }

  const { error } = await supabase
    .from("artists")
    .update({ reply_received: true, reply_date: new Date().toISOString() })
    .eq("melon_artist_id", melon_artist_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
