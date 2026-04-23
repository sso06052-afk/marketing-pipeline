import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const { melon_artist_id, contact_method } = await req.json();

  if (!melon_artist_id) {
    return NextResponse.json({ error: "melon_artist_id 필요" }, { status: 400 });
  }

  // increment_contact_count RPC: contact_count +1, contacted=true, contacted_date=now() 원자적 실행
  const { error: rpcError } = await supabase.rpc("increment_contact_count", {
    artist_id: melon_artist_id,
  });

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  // contact_method 기록 (instagram / email)
  if (contact_method === "instagram" || contact_method === "email") {
    await supabase
      .from("artists")
      .update({ contact_method })
      .eq("melon_artist_id", melon_artist_id)
      .is("contact_method", null); // 첫 발송 때만 설정, 이후 덮어쓰지 않음
  }

  return NextResponse.json({ ok: true });
}
