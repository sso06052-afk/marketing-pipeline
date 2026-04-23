"use client";

import { useEffect, useState } from "react";
import { supabase, Artist } from "@/lib/supabase";
import Pagination from "@/components/Pagination";

type ArtistWithSong = Artist & { songs: { title: string; album: string | null }[] };

const PAGE_SIZE = 50;

function StatusBadge({ artist }: { artist: Artist }) {
  if (artist.reply_received)
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">답장완료</span>;
  if (artist.contacted && (artist.contact_count ?? 0) >= 2)
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">2차완료</span>;
  if (artist.contacted)
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">발송완료</span>;
  if (artist.needs_review)
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-100 text-yellow-700">검토필요</span>;
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-50 text-gray-400">대기</span>;
}

function ContactBadge({ method }: { method: string | null }) {
  if (!method) return <span className="text-gray-300">—</span>;
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
      method === "instagram" ? "bg-pink-50 text-pink-600" : "bg-purple-50 text-purple-600"
    }`}>
      {method === "instagram" ? "인스타" : "이메일"}
    </span>
  );
}

function SourceBadge({ source }: { source: string | null }) {
  const colors: Record<string, string> = {
    melon: "bg-green-50 text-green-600",
    spotify: "bg-emerald-50 text-emerald-600",
    youtube: "bg-red-50 text-red-600",
    google: "bg-blue-50 text-blue-600",
    manual: "bg-gray-50 text-gray-600",
  };
  if (!source || source === "none") return <span className="text-gray-300">—</span>;
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${colors[source] ?? "bg-gray-50 text-gray-500"}`}>
      {source}
    </span>
  );
}

export default function DbPage() {
  const [artists, setArtists] = useState<ArtistWithSong[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    fetchData();
  }, [page, search]);

  async function fetchData() {
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("artists")
      .select("*, songs(title, album)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (search) query = query.ilike("name", `%${search}%`);

    const { data, count } = await query;
    setArtists((data as ArtistWithSong[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">전체 DB</h1>
            <p className="text-sm text-gray-400 mt-0.5">수집된 아티스트 전체 목록</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="가수명 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button
              onClick={() => setSearch(searchInput)}
              className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
            >
              검색
            </button>
            {search && (
              <button
                onClick={() => { setSearch(""); setSearchInput(""); }}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg"
              >
                초기화
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">불러오는 중...</div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-left">
                    <th className="py-3 pl-4 pr-2 text-xs font-medium text-gray-500 whitespace-nowrap">가수명</th>
                    <th className="py-3 px-2 text-xs font-medium text-gray-500 whitespace-nowrap">장르 / 소속사</th>
                    <th className="py-3 px-2 text-xs font-medium text-gray-500 whitespace-nowrap">대표곡</th>
                    <th className="py-3 px-2 text-xs font-medium text-gray-500 whitespace-nowrap">인스타</th>
                    <th className="py-3 px-2 text-xs font-medium text-gray-500 whitespace-nowrap">출처</th>
                    <th className="py-3 px-2 text-xs font-medium text-gray-500 whitespace-nowrap">이메일</th>
                    <th className="py-3 px-2 text-xs font-medium text-gray-500 text-center whitespace-nowrap">신뢰도</th>
                    <th className="py-3 px-2 text-xs font-medium text-gray-500 whitespace-nowrap">상태</th>
                    <th className="py-3 px-2 text-xs font-medium text-gray-500 whitespace-nowrap">발송수단</th>
                    <th className="py-3 px-2 text-xs font-medium text-gray-500 text-center whitespace-nowrap">발송횟수</th>
                    <th className="py-3 px-2 text-xs font-medium text-gray-500 whitespace-nowrap">수집일</th>
                    <th className="py-3 pl-2 pr-4 text-xs font-medium text-gray-500 whitespace-nowrap">발송일</th>
                  </tr>
                </thead>
                <tbody>
                  {artists.map((a) => {
                    const song = a.songs?.[0];
                    const scoreColor =
                      a.confidence_score == null ? "text-gray-300" :
                      a.confidence_score >= 80 ? "text-emerald-600 font-semibold" :
                      a.confidence_score >= 60 ? "text-yellow-600 font-semibold" :
                      "text-red-500 font-semibold";

                    return (
                      <tr key={a.melon_artist_id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                        {/* 가수명 */}
                        <td className="py-2.5 pl-4 pr-2 whitespace-nowrap">
                          <a
                            href={`https://www.melon.com/artist/detail.htm?artistId=${a.melon_artist_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-gray-900 hover:text-indigo-600 transition-colors"
                          >
                            {a.name}
                          </a>
                        </td>
                        {/* 장르 / 소속사 */}
                        <td className="py-2.5 px-2 text-gray-500 text-xs whitespace-nowrap">
                          <div>{a.genre ?? "—"}</div>
                          <div className="text-gray-400">{a.agency ?? ""}</div>
                        </td>
                        {/* 대표곡 */}
                        <td className="py-2.5 px-2 text-gray-600 max-w-[140px]">
                          <div className="truncate">{song?.title ?? "—"}</div>
                          <div className="text-xs text-gray-400 truncate">{song?.album ?? ""}</div>
                        </td>
                        {/* 인스타 */}
                        <td className="py-2.5 px-2 whitespace-nowrap">
                          {a.instagram_handle ? (
                            <a
                              href={`https://www.instagram.com/${a.instagram_handle}/`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline text-xs"
                            >
                              @{a.instagram_handle}
                            </a>
                          ) : (
                            <span className="text-gray-300 text-xs">없음</span>
                          )}
                        </td>
                        {/* 출처 */}
                        <td className="py-2.5 px-2">
                          <SourceBadge source={a.instagram_source} />
                        </td>
                        {/* 이메일 */}
                        <td className="py-2.5 px-2 max-w-[160px]">
                          {a.email ? (
                            <span className="text-xs text-purple-600 truncate block">{a.email}</span>
                          ) : (
                            <span className="text-gray-300 text-xs">없음</span>
                          )}
                        </td>
                        {/* 신뢰도 */}
                        <td className={`py-2.5 px-2 text-center text-sm tabular-nums ${scoreColor}`}>
                          {a.confidence_score ?? "—"}
                        </td>
                        {/* 상태 */}
                        <td className="py-2.5 px-2 whitespace-nowrap">
                          <StatusBadge artist={a} />
                        </td>
                        {/* 발송수단 */}
                        <td className="py-2.5 px-2">
                          <ContactBadge method={a.contact_method} />
                        </td>
                        {/* 발송횟수 */}
                        <td className="py-2.5 px-2 text-center text-sm text-gray-600 tabular-nums">
                          {a.contact_count || "—"}
                        </td>
                        {/* 수집일 */}
                        <td className="py-2.5 px-2 text-xs text-gray-400 whitespace-nowrap">
                          {a.created_at.slice(0, 10)}
                        </td>
                        {/* 발송일 */}
                        <td className="py-2.5 pl-2 pr-4 text-xs text-gray-400 whitespace-nowrap">
                          {a.contacted_date ? a.contacted_date.slice(0, 10) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-gray-400">총 {total}명{search && ` ("${search}" 검색 결과)`}</span>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
