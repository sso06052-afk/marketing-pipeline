"use client";

import { useEffect, useState } from "react";
import { supabase, Artist, Song } from "@/lib/supabase";

type ReviewItem = Artist & { song?: Song };

export default function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [handles, setHandles] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReview();
  }, []);

  async function fetchReview() {
    setLoading(true);
    const { data: artists } = await supabase
      .from("artists")
      .select("*")
      .eq("needs_review", true)
      .order("created_at", { ascending: false });

    if (!artists) {
      setLoading(false);
      return;
    }

    const ids = artists.map((a) => a.melon_artist_id);
    const { data: songs } = await supabase
      .from("songs")
      .select("*")
      .in("melon_artist_id", ids);

    const songMap: Record<string, Song> = {};
    songs?.forEach((s) => {
      songMap[s.melon_artist_id] = s;
    });

    setItems(artists.map((a) => ({ ...a, song: songMap[a.melon_artist_id] })));
    setLoading(false);
  }

  async function handleSave(artistId: string) {
    const handle = handles[artistId]?.trim().replace(/^@/, "");
    if (!handle) return;

    setSaving((prev) => ({ ...prev, [artistId]: true }));

    const { error } = await supabase
      .from("artists")
      .update({
        instagram_handle: handle,
        instagram_url: `https://www.instagram.com/${handle}/`,
        instagram_source: "manual",
        needs_review: false,
      })
      .eq("melon_artist_id", artistId);

    if (!error) {
      setItems((prev) => prev.filter((i) => i.melon_artist_id !== artistId));
    }

    setSaving((prev) => ({ ...prev, [artistId]: false }));
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">수동 확인 큐</h1>
        <p className="text-sm text-gray-500 mb-6">
          인스타 계정을 자동으로 찾지 못한 가수 목록입니다.
        </p>

        {loading ? (
          <div className="text-center text-gray-400 py-16">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="text-center text-gray-400 py-16">
            수동 확인이 필요한 가수가 없습니다.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {items.map((item) => (
              <div
                key={item.melon_artist_id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="font-semibold text-gray-900 text-lg">
                      {item.name}
                    </span>
                    {item.song && (
                      <div className="text-sm text-gray-500 mt-0.5">
                        {item.song.title}
                        {item.song.album && ` · ${item.song.album}`}
                      </div>
                    )}
                  </div>
                  <a
                    href={`https://www.melon.com/artist/detail.htm?artistId=${item.melon_artist_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline shrink-0 ml-4"
                  >
                    멜론 페이지 →
                  </a>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="@instagram_handle"
                    value={handles[item.melon_artist_id] ?? ""}
                    onChange={(e) =>
                      setHandles((prev) => ({
                        ...prev,
                        [item.melon_artist_id]: e.target.value,
                      }))
                    }
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <button
                    onClick={() => handleSave(item.melon_artist_id)}
                    disabled={saving[item.melon_artist_id]}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving[item.melon_artist_id] ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
