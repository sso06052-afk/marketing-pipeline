"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import StatCard from "@/components/StatCard";

type SourceStat = { source: string; count: number };
type GenreStat = { genre: string; count: number };
type DailyStat = { date: string; count: number };

export default function StatsPage() {
  const [summary, setSummary] = useState({
    total: 0,
    instaRate: 0,
    pending: 0,
    contacted: 0,
    replied: 0,
  });
  const [sources, setSources] = useState<SourceStat[]>([]);
  const [genres, setGenres] = useState<GenreStat[]>([]);
  const [daily, setDaily] = useState<DailyStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    setLoading(true);
    const { data } = await supabase
      .from("artists")
      .select(
        "instagram_handle, instagram_source, contacted, reply_received, genre, created_at"
      );

    if (!data) {
      setLoading(false);
      return;
    }

    const total = data.length;
    const instaFound = data.filter((a) => a.instagram_handle).length;
    const contactedCount = data.filter((a) => a.contacted).length;
    const repliedCount = data.filter((a) => a.reply_received).length;

    setSummary({
      total,
      instaRate: total ? Math.round((instaFound / total) * 100) : 0,
      pending: total - contactedCount,
      contacted: contactedCount,
      replied: repliedCount,
    });

    // source 별 집계
    const sourceMap: Record<string, number> = {};
    data.forEach((a) => {
      if (a.instagram_source) {
        sourceMap[a.instagram_source] = (sourceMap[a.instagram_source] ?? 0) + 1;
      }
    });
    setSources(
      Object.entries(sourceMap)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
    );

    // 장르별 집계
    const genreMap: Record<string, number> = {};
    data.forEach((a) => {
      const g = a.genre ?? "기타";
      genreMap[g] = (genreMap[g] ?? 0) + 1;
    });
    setGenres(
      Object.entries(genreMap)
        .map(([genre, count]) => ({ genre, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    );

    // 날짜별 수집 추이 (최근 14일)
    const dailyMap: Record<string, number> = {};
    data.forEach((a) => {
      const date = a.created_at.split("T")[0];
      dailyMap[date] = (dailyMap[date] ?? 0) + 1;
    });
    setDaily(
      Object.entries(dailyMap)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-14)
    );

    setLoading(false);
  }

  const sourceLabel: Record<string, string> = {
    melon: "멜론",
    spotify: "스포티파이",
    youtube: "유튜브",
    google: "구글",
    manual: "수동",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">
        불러오는 중...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">전체 현황 통계</h1>

        {/* 요약 지표 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <StatCard label="전체 가수" value={summary.total} />
          <StatCard label="인스타 확보율" value={`${summary.instaRate}%`} />
          <StatCard label="발송 대기" value={summary.pending} />
          <StatCard label="발송 완료" value={summary.contacted} />
          <StatCard label="답장 수" value={summary.replied} />
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* 인스타 출처별 비율 */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-4">인스타 출처별</h2>
            <div className="flex flex-col gap-2">
              {sources.map(({ source, count }) => (
                <div key={source} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{sourceLabel[source] ?? source}</span>
                  <span className="font-medium text-gray-900">{count}명</span>
                </div>
              ))}
              {sources.length === 0 && (
                <p className="text-sm text-gray-400">데이터 없음</p>
              )}
            </div>
          </div>

          {/* 장르별 분포 */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-4">장르별 분포</h2>
            <div className="flex flex-col gap-2">
              {genres.map(({ genre, count }) => (
                <div key={genre} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{genre}</span>
                  <span className="font-medium text-gray-900">{count}명</span>
                </div>
              ))}
              {genres.length === 0 && (
                <p className="text-sm text-gray-400">데이터 없음</p>
              )}
            </div>
          </div>
        </div>

        {/* 날짜별 수집 추이 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4">날짜별 수집 추이 (최근 14일)</h2>
          {daily.length === 0 ? (
            <p className="text-sm text-gray-400">데이터 없음</p>
          ) : (
            <div className="flex flex-col gap-2">
              {daily.map(({ date, count }) => {
                const maxCount = Math.max(...daily.map((d) => d.count));
                const barWidth = maxCount ? Math.round((count / maxCount) * 100) : 0;
                return (
                  <div key={date} className="flex items-center gap-3 text-sm">
                    <span className="text-gray-500 w-24 shrink-0">{date}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className="text-gray-700 w-10 text-right">{count}명</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
