import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const { melon_artist_id, deal_status } = await req.json();
  if (!melon_artist_id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const update: Record<string, unknown> = { deal_status: deal_status ?? null };

  // 새 계약 시작(진행중) 시에만 deal_count 증가
  if (deal_status === '진행중') {
    const { data } = await supabase
      .from("artists")
      .select("deal_count, deal_status")
      .eq("melon_artist_id", melon_artist_id)
      .single();
    // 이미 진행중이 아닐 때만 카운트 증가
    if (data?.deal_status !== '진행중') {
      update.deal_count = (data?.deal_count ?? 0) + 1;
    }
  }

  const { error } = await supabase
    .from("artists")
    .update(update)
    .eq("melon_artist_id", melon_artist_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
