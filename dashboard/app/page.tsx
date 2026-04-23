"use client";

import { useEffect, useRef, useState } from "react";
import { supabase, Artist } from "@/lib/supabase";
import ArtistRow from "@/components/ArtistRow";
import StatCard from "@/components/StatCard";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 30;

type Tab = "pending" | "contacted" | "replied" | "review";
type ArtistWithSong = Artist & { songs: { title: string; album: string | null }[] };

const TABS: { id: Tab; label: string }[] = [
  { id: "pending", label: "발송대기" },
  { id: "contacted", label: "발송완료" },
  { id: "replied", label: "답장완료" },
  { id: "review", label: "검토필요" },
];

export default function HomePage() {
  const [artists, setArtists] = useState<ArtistWithSong[]>([]);
  const [tab, setTab] = useState<Tab>("pending");
  const [tabCounts, setTabCounts] = useState({ pending: 0, contacted: 0, replied: 0, review: 0 });
  const [todayStats, setTodayStats] = useState({ new: 0, instaRate: 0, contacted: 0, reply: 0 });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // 파이프라인 실행
  const [running, setRunning] = useState(false);
  const [melonOnly, setMelonOnly] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => { fetchTodayStats(); fetchTabCounts(); }, []);
  useEffect(() => { setPage(1); }, [tab]);
  useEffect(() => { fetchArtists(); }, [tab, page]);
  useEffect(() => {
    if (showLogs) logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, showLogs]);

  async function fetchTodayStats() {
    const { data } = await supabase
      .from("artists")
      .select("instagram_handle, contacted, reply_received")
      .gte("created_at", `${today}T00:00:00`);
    if (!data) return;
    const instaFound = data.filter((a) => a.instagram_handle).length;
    setTodayStats({
      new: data.length,
      instaRate: data.length ? Math.round((instaFound / data.length) * 100) : 0,
      contacted: data.filter((a) => a.contacted).length,
      reply: data.filter((a) => a.reply_received).length,
    });
  }

  async function fetchTabCounts() {
    const { data } = await supabase
      .from("artists")
      .select("contacted, reply_received, needs_review");
    if (!data) return;
    setTabCounts({
      pending: data.filter((a) => !a.contacted && !a.needs_review).length,
      contacted: data.filter((a) => a.contacted && !a.reply_received).length,
      replied: data.filter((a) => a.reply_received).length,
      review: data.filter((a) => a.needs_review).length,
    });
  }

  async function fetchArtists() {
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("artists")
      .select("*, songs(title, album)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (tab === "pending") query = query.eq("contacted", false).eq("needs_review", false);
    else if (tab === "contacted") query = query.eq("contacted", true).eq("reply_received", false);
    else if (tab === "replied") query = query.eq("reply_received", true);
    else if (tab === "review") query = query.eq("needs_review", true);

    const { data, count } = await query;
    setArtists((data as ArtistWithSong[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }

  async function runPipeline() {
    if (running) return;
    setRunning(true);
    setLogs([]);
    setShowLogs(true);

    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ melon_only: melonOnly }),
      });

      if (!res.body) throw new Error("스트림 없음");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.log) setLogs((prev) => [...prev, payload.log]);
            if (payload.done) {
              const ok = payload.code === 0;
              setLogs((prev) => [
                ...prev,
                ok ? "✅ 완료! 목록을 새로고침합니다..." : `❌ 오류 (종료코드: ${payload.code})`,
              ]);
              if (ok) setTimeout(() => { fetchTodayStats(); fetchTabCounts(); fetchArtists(); }, 1000);
            }
          } catch {}
        }
      }
    } catch (e) {
      setLogs((prev) => [...prev, `[오류] ${String(e)}`]);
    } finally {
      setRunning(false);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">음원 홍보 대시보드</h1>
            <p className="text-sm text-gray-400 mt-0.5">오늘 {today}</p>
          </div>
          <div className="flex items-center gap-3">
            {showLogs && (
              <button onClick={() => setShowLogs(false)} className="text-xs text-gray-400 hover:text-gray-600">
                로그 숨기기
              </button>
            )}
            {/* 멜론만 토글 */}
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <div
                onClick={() => !running && setMelonOnly((v) => !v)}
                className={`w-8 h-4 rounded-full transition-colors relative ${melonOnly ? "bg-indigo-500" : "bg-gray-300"} ${running ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${melonOnly ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
              <span className="text-xs text-gray-500">멜론만</span>
            </label>
            <button
              onClick={runPipeline}
              disabled={running}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                running ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-indigo-600 text-white hover:bg-indigo-700"
              }`}
            >
              {running ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  실행 중...
                </>
              ) : (
                `▶ ${melonOnly ? "멜론 수집" : "파이프라인 실행"}`
              )}
            </button>
          </div>
        </div>

        {/* 로그 패널 */}
        {showLogs && (
          <div className="mb-5 bg-gray-900 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
              <span className="text-xs text-gray-400 font-mono">파이프라인 로그</span>
              <button onClick={() => setShowLogs(false)} className="text-gray-500 hover:text-gray-300 text-xs">닫기</button>
            </div>
            <div className="h-52 overflow-y-auto p-4 font-mono text-xs text-green-400 space-y-0.5">
              {logs.length === 0 ? (
                <span className="text-gray-500">시작 중...</span>
              ) : (
                logs.map((line, i) => (
                  <div key={i} className="leading-5 whitespace-pre-wrap break-all">{line}</div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        )}

        {/* 오늘 통계 */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          <StatCard label="오늘 신규" value={todayStats.new} sub="명" />
          <StatCard label="인스타 확보율" value={`${todayStats.instaRate}%`} />
          <StatCard label="발송 완료" value={todayStats.contacted} sub="명" />
          <StatCard label="답장" value={todayStats.reply} sub="명" />
        </div>

        {/* 탭 */}
        <div className="flex gap-1 mb-4 border-b border-gray-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                tab === t.id ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"
              }`}>
                {tabCounts[t.id]}
              </span>
            </button>
          ))}
        </div>

        {/* 테이블 */}
        {loading ? (
          <div className="text-center text-gray-400 py-20">불러오는 중...</div>
        ) : artists.length === 0 ? (
          <div className="text-center text-gray-400 py-20">해당 항목이 없습니다.</div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 py-3 pl-4 pr-2">가수명</th>
                    <th className="text-left text-xs font-medium text-gray-500 py-3 px-2">대표곡</th>
                    <th className="text-left text-xs font-medium text-gray-500 py-3 px-2">연락처</th>
                    <th className="text-center text-xs font-medium text-gray-500 py-3 px-2">신뢰도</th>
                    <th className="text-left text-xs font-medium text-gray-500 py-3 pl-2 pr-4">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {artists.map((a) => (
                    <ArtistRow key={a.melon_artist_id} artist={a} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-gray-400">총 {total}명</span>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
