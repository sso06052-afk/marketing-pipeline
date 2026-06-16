"use client";

import { useEffect, useRef, useState } from "react";
import { supabase, Artist } from "@/lib/supabase";
import ArtistRow, { ArtistWithSong, Song } from "@/components/ArtistRow";
import { getSourceLink } from "@/lib/sourceLink";
import ArtistPanel from "@/components/ArtistPanel";
import Pagination from "@/components/Pagination";
import TableSkeleton from "@/components/TableSkeleton";
import { useToast } from "@/components/Toaster";
import { usePipeline } from "@/components/PipelineProvider";

type ReviewArtist = Artist & { songs?: Song[] };

const PAGE_SIZE = 30;

type Tab = "pending" | "awaiting" | "contacted" | "replied" | "review";

const TABS: { id: Tab; label: string }[] = [
  { id: "pending", label: "발송대기" },
  { id: "awaiting", label: "검색대기" },
  { id: "review", label: "검토필요" },
  { id: "contacted", label: "발송완료" },
  { id: "replied", label: "답장완료" },
];

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function formatDateLabel(dateStr: string): string {
  const today = getToday();
  if (dateStr === today) return `오늘 · ${dateStr}`;
  return dateStr;
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + delta);
  return d.toISOString().split("T")[0];
}

// SVG 도넛 차트 컴포넌트
function DonutChart({
  label,
  numerator,
  denominator,
  color,
}: {
  label: string;
  numerator: number;
  denominator: number;
  color: string;
}) {
  const pct = denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
  const isEmpty = denominator === 0;
  const strokeColor = isEmpty ? "#e5e7eb" : color;
  const dashArray = isEmpty ? "0 226" : `${pct * 2.26} 226`;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-5 flex flex-col items-center gap-2 sm:gap-3">
      <div className="relative w-20 h-20 sm:w-28 sm:h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* 배경 원 */}
          <circle
            cx="50"
            cy="50"
            r="36"
            fill="none"
            stroke="#f3f4f6"
            strokeWidth="8"
          />
          {/* 진행 원 */}
          <circle
            cx="50"
            cy="50"
            r="36"
            fill="none"
            stroke={strokeColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={dashArray}
            transform="rotate(-90 50 50)"
          />
        </svg>
        {/* 중앙 텍스트 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base sm:text-xl font-bold text-gray-900 leading-none">
            {isEmpty ? "—" : `${pct}%`}
          </span>
          {!isEmpty && (
            <span className="text-[9px] sm:text-[11px] text-gray-400 mt-0.5">
              {numerator}/{denominator}명
            </span>
          )}
        </div>
      </div>
      <span className="text-sm text-gray-600 font-medium">{label}</span>
    </div>
  );
}

export default function HomePage() {
  const { showToast } = useToast();
  const { running, source, setSource, pages, setPages, runPipeline } = usePipeline();

  // 슬라이드오버 패널
  const [panelArtist, setPanelArtist] = useState<ArtistWithSong | null>(null);

  // 날짜 선택
  const [selectedDate, setSelectedDate] = useState<string>(getToday());
  const today = getToday();

  // 달력 팝업
  const [showCalendar, setShowCalendar] = useState(false);
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [pendingDates, setPendingDates] = useState<Set<string>>(new Set());
  const calendarRef = useRef<HTMLDivElement>(null);

  // 아티스트 목록
  const [artists, setArtists] = useState<ArtistWithSong[]>([]);
  const [tab, setTab] = useState<Tab>("pending");
  const [tabCounts, setTabCounts] = useState({ pending: 0, awaiting: 0, contacted: 0, replied: 0, review: 0 });
  const [searchLimit, setSearchLimit] = useState(30);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // 날짜별 통계
  const [dateStats, setDateStats] = useState({
    total: 0,
    instaFound: 0,
    contacted: 0,
    replied: 0,
  });

  // 검토필요 탭 상태
  const [reviewHandles, setReviewHandles] = useState<Record<string, string>>({});
  const [reviewSaving, setReviewSaving] = useState<Record<string, boolean>>({});

  // 웹 알림 권한 요청
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    fetchPendingDates();
  }, []);

  // 파이프라인 완료 시 데이터 새로고침
  useEffect(() => {
    function handleDone() {
      fetchDateStats();
      fetchTabCounts();
      fetchArtists();
    }
    window.addEventListener("pipeline:done", handleDone);
    return () => window.removeEventListener("pipeline:done", handleDone);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, tab, page]);

  // 달력 외부 클릭 시 닫기
  useEffect(() => {
    if (!showCalendar) return;
    function handleClick(e: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setShowCalendar(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showCalendar]);

  // 날짜 변경 시 통계 + 탭 카운트 re-fetch
  useEffect(() => {
    fetchDateStats();
    fetchTabCounts();
    setPage(1);
  }, [selectedDate]);

  // 탭 변경 시 page 리셋
  useEffect(() => {
    setPage(1);
  }, [tab]);

  // 탭·페이지·날짜 변경 시 목록 re-fetch
  useEffect(() => {
    fetchArtists();
  }, [tab, page, selectedDate]);

  async function fetchPendingDates() {
    const { data } = await supabase
      .from("artists")
      .select("last_crawled")
      .eq("contacted", false)
      .eq("needs_review", false)
      .not("instagram_handle", "is", null)
      .not("last_crawled", "is", null);
    if (!data) return;
    const dates = new Set(data.map((a) => a.last_crawled as string));
    setPendingDates(dates);
  }

  function getDateRange(dateStr: string) {
    // Supabase는 UTC 저장 — KST(+09:00) 기준으로 하루 범위 지정
    return {
      start: `${dateStr}T00:00:00+09:00`,
      end: `${dateStr}T23:59:59+09:00`,
    };
  }

  async function fetchDateStats() {
    const { data } = await supabase
      .from("artists")
      .select("instagram_handle, contacted, reply_received")
      .eq("last_crawled", selectedDate);
    if (!data) return;
    setDateStats({
      total: data.length,
      instaFound: data.filter((a) => a.instagram_handle).length,
      contacted: data.filter((a) => a.contacted).length,
      replied: data.filter((a) => a.reply_received).length,
    });
  }

  async function fetchTabCounts() {
    const { data } = await supabase
      .from("artists")
      .select("contacted, reply_received, needs_review, instagram_handle")
      .eq("last_crawled", selectedDate);
    if (!data) return;
    setTabCounts({
      pending: data.filter((a) => !a.contacted && !a.needs_review && a.instagram_handle != null).length,
      awaiting: data.filter((a) => !a.contacted && !a.needs_review && !a.instagram_handle).length,
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
      .select("*, songs(melon_song_id, title, album, release_date)", { count: "exact" })
      .eq("last_crawled", selectedDate)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (tab === "pending") query = query.eq("contacted", false).eq("needs_review", false).not("instagram_handle", "is", null);
    else if (tab === "awaiting") query = query.eq("contacted", false).eq("needs_review", false).is("instagram_handle", null);
    else if (tab === "contacted") query = query.eq("contacted", true).eq("reply_received", false);
    else if (tab === "replied") query = query.eq("reply_received", true);
    else if (tab === "review") query = query.eq("needs_review", true);

    const { data, count } = await query;
    setArtists((data as ArtistWithSong[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }

  async function handleReviewSave(artist: ReviewArtist) {
    const raw = reviewHandles[artist.melon_artist_id] ?? "";
    const handle = raw.trim().replace(/^@/, "");
    if (!handle) return;
    setReviewSaving((p) => ({ ...p, [artist.melon_artist_id]: true }));
    try {
      const res = await fetch("/api/handle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ melon_artist_id: artist.melon_artist_id, instagram_handle: handle }),
      });
      if (!res.ok) throw new Error();
      setArtists((prev) => prev.filter((a) => a.melon_artist_id !== artist.melon_artist_id));
      setTabCounts((c) => ({ ...c, review: Math.max(0, c.review - 1) }));
      showToast(`${artist.name} 인스타 저장 완료`, "success");
    } catch {
      showToast("저장 중 오류가 발생했습니다", "error");
    }
    setReviewSaving((p) => ({ ...p, [artist.melon_artist_id]: false }));
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasNoData = dateStats.total === 0;

  // 도넛 데이터
  const instaRate = {
    numerator: dateStats.instaFound,
    denominator: dateStats.total,
  };
  const sendRate = {
    numerator: dateStats.contacted,
    denominator: dateStats.instaFound,
  };
  const replyRate = {
    numerator: dateStats.replied,
    denominator: dateStats.contacted,
  };

  return (
    <>
    <ArtistPanel
      artist={panelArtist}
      onClose={() => setPanelArtist(null)}
      onUpdate={() => { fetchArtists(); fetchTabCounts(); fetchDateStats(); }}
    />
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* 헤더 */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">음원 홍보 대시보드</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* 소스 선택 토글 */}
            <div
              className={`flex rounded-lg overflow-hidden border border-gray-200 text-xs font-medium ${
                running ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              {(["melon", "genie", "genie_genre"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSource(s)}
                  className={`px-3 py-1.5 transition-colors ${
                    source === s
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {s === "melon" ? "멜론" : s === "genie" ? "지니 신곡" : "지니 장르"}
                </button>
              ))}
            </div>
            {/* 페이지 수 선택 (지니 신곡·장르) */}
            {(source === "genie" || source === "genie_genre") && (
              <div className={`flex rounded-lg overflow-hidden border border-gray-200 text-xs font-medium ${running ? "opacity-50 pointer-events-none" : ""}`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setPages(n)}
                    className={`px-2.5 py-1.5 transition-colors ${
                      pages === n
                        ? "bg-violet-600 text-white"
                        : "bg-white text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {n}p
                  </button>
                ))}
              </div>
            )}
            {/* 정보 수집 버튼 */}
            <button
              onClick={() => runPipeline({ mode: "collect" })}
              disabled={running}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                running
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-indigo-600 text-white hover:bg-indigo-700"
              }`}
            >
              {running ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  실행 중...
                </>
              ) : (
                `▶ 정보 수집`
              )}
            </button>
            {/* 인스타 검색 영역 */}
            <div className={`flex items-center gap-1.5 ${running ? "opacity-50 pointer-events-none" : ""}`}>
              <input
                type="number"
                min={1}
                max={500}
                value={searchLimit}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(500, Number(e.target.value) || 1));
                  setSearchLimit(v);
                }}
                className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
              <button
                onClick={() => runPipeline({ mode: "search", limit: Math.max(1, Math.min(500, searchLimit)) })}
                disabled={running}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                인스타 검색
              </button>
            </div>
          </div>
        </div>

        {/* 날짜 선택기 */}
        <div className="flex items-center justify-center gap-4 mb-6 relative">
          <button
            onClick={() => setSelectedDate((d) => addDays(d, -1))}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 transition-colors font-bold text-lg"
          >
            ←
          </button>

          {/* 날짜 텍스트 — 클릭하면 달력 팝업 */}
          <button
            onClick={() => {
              const [y, m] = selectedDate.split("-").map(Number);
              setCalMonth({ year: y, month: m - 1 });
              setShowCalendar((v) => !v);
            }}
            className="text-base font-semibold text-gray-800 min-w-[200px] text-center hover:text-indigo-600 transition-colors"
          >
            {formatDateLabel(selectedDate)}
          </button>

          <button
            onClick={() => setSelectedDate((d) => addDays(d, 1))}
            disabled={selectedDate >= today}
            className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-lg transition-colors ${
              selectedDate >= today ? "text-gray-300 cursor-not-allowed" : "text-gray-500 hover:bg-gray-200"
            }`}
          >
            →
          </button>

          {/* 달력 팝업 */}
          {showCalendar && (
            <div
              ref={calendarRef}
              className="absolute top-10 left-1/2 -translate-x-1/2 z-50 bg-white rounded-2xl border border-gray-200 shadow-xl p-4 w-72"
            >
              {/* 월 네비게이션 */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setCalMonth((m) => {
                    const d = new Date(m.year, m.month - 1, 1);
                    return { year: d.getFullYear(), month: d.getMonth() };
                  })}
                  className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 text-sm"
                >
                  ‹
                </button>
                <span className="text-sm font-semibold text-gray-700">
                  {calMonth.year}년 {calMonth.month + 1}월
                </span>
                <button
                  onClick={() => setCalMonth((m) => {
                    const d = new Date(m.year, m.month + 1, 1);
                    return { year: d.getFullYear(), month: d.getMonth() };
                  })}
                  disabled={calMonth.year === new Date(today).getFullYear() && calMonth.month >= new Date(today).getMonth()}
                  className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 text-sm disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ›
                </button>
              </div>

              {/* 요일 헤더 */}
              <div className="grid grid-cols-7 mb-1">
                {["일","월","화","수","목","금","토"].map((d) => (
                  <div key={d} className="text-center text-[11px] text-gray-400 font-medium py-1">{d}</div>
                ))}
              </div>

              {/* 날짜 셀 */}
              <div className="grid grid-cols-7 gap-0.5">
                {(() => {
                  const { year, month } = calMonth;
                  const firstDay = new Date(year, month, 1).getDay();
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const cells: (number | null)[] = [];
                  for (let i = 0; i < firstDay; i++) cells.push(null);
                  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

                  return cells.map((day, i) => {
                    if (!day) return <div key={`e-${i}`} />;
                    const dateStr = `${year}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                    const isSelected = dateStr === selectedDate;
                    const isToday = dateStr === today;
                    const isFuture = dateStr > today;
                    const hasPending = pendingDates.has(dateStr);

                    return (
                      <button
                        key={dateStr}
                        disabled={isFuture}
                        onClick={() => {
                          setSelectedDate(dateStr);
                          setShowCalendar(false);
                        }}
                        className={`relative flex flex-col items-center justify-center h-9 rounded-lg text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                          isSelected
                            ? "bg-indigo-600 text-white"
                            : isToday
                            ? "bg-indigo-50 text-indigo-700 font-bold"
                            : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        {day}
                        {hasPending && !isSelected && (
                          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-orange-400" />
                        )}
                        {hasPending && isSelected && (
                          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white opacity-80" />
                        )}
                      </button>
                    );
                  });
                })()}
              </div>

              {/* 범례 */}
              <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-400">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                미발송 있음
              </div>
            </div>
          )}
        </div>

        {/* 도넛 차트 3개 */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
          <DonutChart
            label="인스타 확보율"
            numerator={instaRate.numerator}
            denominator={instaRate.denominator}
            color="#6366f1"
          />
          <DonutChart
            label="발송률"
            numerator={sendRate.numerator}
            denominator={sendRate.denominator}
            color="#3b82f6"
          />
          <DonutChart
            label="답장률"
            numerator={replyRate.numerator}
            denominator={replyRate.denominator}
            color="#10b981"
          />
        </div>

        {/* 데이터 없을 때 */}
        {hasNoData ? (
          <div className="text-center text-gray-400 py-20 bg-white rounded-xl border border-gray-100 shadow-sm">
            이 날 수집된 아티스트가 없습니다. 파이프라인을 실행해주세요.
          </div>
        ) : (
          <>
            {/* 탭 */}
            <div className="flex gap-0.5 mb-4 border-b border-gray-200 overflow-x-auto scrollbar-none">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1 shrink-0 whitespace-nowrap px-3 sm:px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    tab === t.id
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {t.label}
                  {t.id === "review" && tabCounts.review > 0 && tab !== "review" && (
                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  )}
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full ${
                      tab === t.id
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {tabCounts[t.id as keyof typeof tabCounts]}
                  </span>
                </button>
              ))}
            </div>

            {/* 검색대기 탭: 간단한 카드 목록 */}
            {tab === "awaiting" ? (
              loading ? (
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-pulse">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="h-4 w-24 bg-gray-100 rounded mb-2" />
                          <div className="h-3 w-36 bg-gray-100 rounded" />
                        </div>
                        <div className="h-3 w-12 bg-gray-100 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="mb-3 px-1 text-sm text-gray-500">
                    정보만 수집된 가수예요. 위 &apos;인스타 검색&apos;을 돌리면 인스타를 찾습니다.
                  </div>
                  {artists.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-xl border border-gray-100 shadow-sm">
                      <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                        <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-gray-600">검색 대기 없음</p>
                      <p className="text-xs text-gray-400 mt-1">이 날 인스타 검색이 필요한 가수가 없습니다</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col gap-2">
                        {(artists as ReviewArtist[]).map((a) => (
                          <div
                            key={a.melon_artist_id}
                            className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between"
                          >
                            <div>
                              <span className="font-semibold text-gray-900">{a.name}</span>
                              {a.songs?.[0] && (
                                <div className="text-sm text-gray-500 mt-0.5">
                                  {a.songs[0].title}
                                  {a.songs[0].album ? ` · ${a.songs[0].album}` : ""}
                                </div>
                              )}
                            </div>
                            {(() => {
                              const link = getSourceLink(a);
                              return (
                                <a
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-500 hover:underline shrink-0 ml-4"
                                >
                                  {link.label}
                                </a>
                              );
                            })()}
                          </div>
                        ))}
                      </div>
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xs text-gray-400">총 {total}명</span>
                          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                        </div>
                      )}
                    </>
                  )}
                </>
              )
            ) : /* 검토필요 탭: 카드 UI */
            tab === "review" ? (
              loading ? (
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-pulse">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="h-4 w-24 bg-gray-100 rounded mb-2" />
                          <div className="h-3 w-36 bg-gray-100 rounded" />
                        </div>
                        <div className="h-3 w-12 bg-gray-100 rounded" />
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1 h-9 bg-gray-100 rounded-lg" />
                        <div className="w-16 h-9 bg-gray-100 rounded-lg" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : artists.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-700">검토 완료</p>
                  <p className="text-xs text-gray-400 mt-1">검토 필요한 가수가 없습니다</p>
                </div>
              ) : (
                <>
                <div className="flex flex-col gap-3">
                  {(artists as ReviewArtist[]).map((a) => (
                    <div
                      key={a.melon_artist_id}
                      className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <span className="font-semibold text-gray-900">{a.name}</span>
                          {a.songs?.[0] && (
                            <div className="text-sm text-gray-500 mt-0.5">
                              {a.songs[0].title}
                              {a.songs[0].album ? ` · ${a.songs[0].album}` : ""}
                            </div>
                          )}
                        </div>
                        {(() => {
                          const link = getSourceLink(a);
                          return (
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:underline shrink-0 ml-4"
                            >
                              {link.label}
                            </a>
                          );
                        })()}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="@instagram_handle"
                          value={reviewHandles[a.melon_artist_id] ?? ""}
                          onChange={(e) =>
                            setReviewHandles((p) => ({
                              ...p,
                              [a.melon_artist_id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => e.key === "Enter" && handleReviewSave(a)}
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          autoFocus={false}
                        />
                        <button
                          onClick={() => handleReviewSave(a)}
                          disabled={reviewSaving[a.melon_artist_id]}
                          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
                        >
                          {reviewSaving[a.melon_artist_id] ? "저장 중..." : "저장"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-gray-400">총 {total}명</span>
                    <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                  </div>
                )}
                </>
              )
            ) : (
              /* 나머지 탭: 테이블 UI */
              loading ? (
                <TableSkeleton rows={8} />
              ) : artists.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-xl border border-gray-100 shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-600">항목 없음</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {tab === "pending" ? "파이프라인을 실행해 아티스트를 수집하세요" : "해당 상태의 아티스트가 없습니다"}
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
                    <table className="w-full min-w-[560px]">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="text-left text-xs font-medium text-gray-500 py-3 pl-4 pr-2">
                            가수명
                          </th>
                          <th className="text-left text-xs font-medium text-gray-500 py-3 px-2">
                            대표곡
                          </th>
                          <th className="text-left text-xs font-medium text-gray-500 py-3 px-2">
                            연락처
                          </th>
                          <th className="text-left text-xs font-medium text-gray-500 py-3 px-3">
                            신뢰도
                          </th>
                          <th className="text-left text-xs font-medium text-gray-500 py-3 pl-3 pr-4">
                            상태
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {artists.map((a) => (
                          <ArtistRow key={a.melon_artist_id} artist={a} onOpen={setPanelArtist} onUpdate={() => { fetchArtists(); fetchTabCounts(); }} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-gray-400">총 {total}명</span>
                    <Pagination
                      page={page}
                      totalPages={totalPages}
                      onPageChange={setPage}
                    />
                  </div>
                </>
              )
            )}
          </>
        )}
      </div>
    </main>
    </>
  );
}
