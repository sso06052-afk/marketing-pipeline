"use client";

import { useEffect, useState } from "react";
import { supabase, Artist } from "@/lib/supabase";
import ArtistRow from "@/components/ArtistRow";
import ArtistPanel from "@/components/ArtistPanel";
import StatCard from "@/components/StatCard";
import Pagination from "@/components/Pagination";
import TableSkeleton from "@/components/TableSkeleton";

type ArtistWithSong = Artist & { songs: { title: string; album: string | null; release_date: string | null }[] };

const PAGE_SIZE = 30;

type StatusFilter =
  | "전체"
  | "발송대기"
  | "발송완료"
  | "답장_긍정"
  | "답장_보류"
  | "답장_거절"
  | "검토필요"
  | "마케팅진행중"
  | "마케팅완료";

type SortOption = "최신수집" | "오래된수집" | "신뢰도높은순" | "발송일최신" | "이름순";

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: "전체", label: "전체" },
  { value: "발송대기", label: "발송 대기" },
  { value: "발송완료", label: "발송 완료" },
  { value: "답장_긍정", label: "긍정" },
  { value: "답장_보류", label: "보류" },
  { value: "답장_거절", label: "거절" },
  { value: "검토필요", label: "검토 필요" },
  { value: "마케팅진행중", label: "마케팅 진행중" },
  { value: "마케팅완료", label: "마케팅 완료" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "최신수집", label: "수집일 최신순" },
  { value: "오래된수집", label: "수집일 오래된순" },
  { value: "신뢰도높은순", label: "신뢰도 높은순" },
  { value: "발송일최신", label: "발송일 최신순" },
  { value: "이름순", label: "이름 가나다순" },
];

type DailyStat = { date: string; collected: number; insta: number };
type ReplyResultStat = { positive: number; rejected: number; pending: number };
type PeriodFilter = 7 | 14 | 30 | "all";

export default function DbPage() {
  const [view, setView] = useState<"list" | "stats">("list");
  const [panelArtist, setPanelArtist] = useState<(Artist & { songs?: { title: string; album: string | null }[] }) | null>(null);

  // 목록
  const [artists, setArtists] = useState<ArtistWithSong[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("전체");
  const [sort, setSort] = useState<SortOption>("최신수집");

  // 통계
  const [statsLoading, setStatsLoading] = useState(false);
  const [summary, setSummary] = useState({
    total: 0,
    instaCount: 0,
    instaRate: 0,
    contactedCount: 0,
    sendRate: 0,
    repliedCount: 0,
    replyRate: 0,
    positiveCount: 0,
    dealCount: 0,
    dealRate: 0,
    weekNew: 0,
    weekNewDelta: 0,
    weekInstaRate: 0,
    weekInstaRateDelta: 0,
  });
  const [allDaily, setAllDaily] = useState<DailyStat[]>([]);
  const [replyResult, setReplyResult] = useState<ReplyResultStat>({ positive: 0, rejected: 0, pending: 0 });
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>(14);

  useEffect(() => { setPage(1); }, [search, status, sort]);
  useEffect(() => { fetchData(); }, [page, search, status, sort]);
  useEffect(() => { if (view === "stats") fetchStats(); }, [view]);

  async function fetchData() {
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("artists")
      .select("*, songs(title, album)", { count: "exact" })
      .range(from, to);

    if (status === "발송대기") query = query.eq("contacted", false).eq("needs_review", false);
    else if (status === "발송완료") query = query.eq("contacted", true).eq("reply_received", false);
    else if (status === "답장_긍정") query = query.eq("reply_result", "긍정");
    else if (status === "답장_보류") query = query.eq("reply_result", "보류");
    else if (status === "답장_거절") query = query.eq("reply_result", "거절");
    else if (status === "검토필요") query = query.eq("needs_review", true);
    else if (status === "마케팅진행중") query = query.eq("deal_status", "진행중");
    else if (status === "마케팅완료") query = query.eq("deal_status", "완료");

    if (search) query = query.ilike("name", `%${search}%`);

    if (sort === "최신수집") query = query.order("created_at", { ascending: false });
    else if (sort === "오래된수집") query = query.order("created_at", { ascending: true });
    else if (sort === "신뢰도높은순") query = query.order("confidence_score", { ascending: false });
    else if (sort === "발송일최신") query = query.order("contacted_date", { ascending: false });
    else if (sort === "이름순") query = query.order("name", { ascending: true });

    const { data, count } = await query;
    setArtists((data as ArtistWithSong[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }

  async function fetchStats() {
    setStatsLoading(true);
    const { data } = await supabase
      .from("artists")
      .select("instagram_handle, contacted, reply_received, reply_result, deal_status, created_at");

    if (!data) { setStatsLoading(false); return; }

    const total = data.length;
    const instaCount = data.filter((a) => a.instagram_handle).length;
    const contactedCount = data.filter((a) => a.contacted).length;
    const repliedCount = data.filter((a) => a.reply_received).length;
    const positiveCount = data.filter((a) => a.reply_result === "긍정").length;
    const rejectedCount = data.filter((a) => a.reply_result === "거절").length;
    const pendingCount = data.filter((a) => a.reply_result === "보류").length;
    const dealCount = data.filter((a) => a.deal_status != null).length;

    // 주간 추세 계산
    const now = new Date();
    const d7 = new Date(now); d7.setDate(d7.getDate() - 7);
    const d14 = new Date(now); d14.setDate(d14.getDate() - 14);
    const d7str = d7.toISOString().split("T")[0];
    const d14str = d14.toISOString().split("T")[0];
    const thisWeek = data.filter((a) => (a.created_at as string).slice(0, 10) >= d7str);
    const prevWeek = data.filter((a) => {
      const d = (a.created_at as string).slice(0, 10);
      return d >= d14str && d < d7str;
    });
    const weekNew = thisWeek.length;
    const prevNew = prevWeek.length;
    const weekInstaFound = thisWeek.filter((a) => a.instagram_handle).length;
    const prevInstaFound = prevWeek.filter((a) => a.instagram_handle).length;
    const weekInstaRate = weekNew ? Math.round((weekInstaFound / weekNew) * 100) : 0;
    const prevInstaRate = prevNew ? Math.round((prevInstaFound / prevNew) * 100) : 0;

    setSummary({
      total,
      instaCount,
      instaRate: total ? Math.round((instaCount / total) * 100) : 0,
      contactedCount,
      sendRate: instaCount ? Math.round((contactedCount / instaCount) * 100) : 0,
      repliedCount,
      replyRate: contactedCount ? Math.round((repliedCount / contactedCount) * 100) : 0,
      positiveCount,
      dealCount,
      dealRate: contactedCount ? Math.round((dealCount / contactedCount) * 100) : 0,
      weekNew,
      weekNewDelta: weekNew - prevNew,
      weekInstaRate,
      weekInstaRateDelta: weekInstaRate - prevInstaRate,
    });

    setReplyResult({ positive: positiveCount, rejected: rejectedCount, pending: pendingCount });

    // 날짜별 수집 + 인스타 확보 집계
    const dailyCollectedMap: Record<string, number> = {};
    const dailyInstaMap: Record<string, number> = {};
    data.forEach((a) => {
      const date = (a.created_at as string).split("T")[0];
      dailyCollectedMap[date] = (dailyCollectedMap[date] ?? 0) + 1;
      if (a.instagram_handle) {
        dailyInstaMap[date] = (dailyInstaMap[date] ?? 0) + 1;
      }
    });
    const allDates = Array.from(new Set([...Object.keys(dailyCollectedMap), ...Object.keys(dailyInstaMap)])).sort();
    setAllDaily(
      allDates.map((date) => ({
        date,
        collected: dailyCollectedMap[date] ?? 0,
        insta: dailyInstaMap[date] ?? 0,
      }))
    );

    setStatsLoading(false);
  }

  function handleSearch() { setSearch(searchInput); }
  function handleReset() { setSearch(""); setSearchInput(""); setStatus("전체"); setSort("최신수집"); }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilter = search || status !== "전체" || sort !== "최신수집";

  return (
    <>
    <ArtistPanel
      artist={panelArtist}
      onClose={() => setPanelArtist(null)}
      onUpdate={fetchData}
    />
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* 헤더 + 뷰 탭 */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">전체 관리</h1>
            <p className="text-sm text-gray-400 mt-0.5">수집된 아티스트 전체 관리</p>
          </div>
          <div className="flex rounded-lg overflow-hidden border border-gray-200 text-sm font-medium">
            {(["list", "stats"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-1.5 transition-colors ${
                  view === v ? "bg-indigo-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                {v === "list" ? "목록" : "통계"}
              </button>
            ))}
          </div>
        </div>

        {/* 목록 뷰 */}
        {view === "list" && (
          <>
            {/* 필터 바 */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 mb-4">
              {/* 검색 + 정렬 행 */}
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="가수명 검색..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  <button
                    onClick={handleSearch}
                    className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
                  >
                    검색
                  </button>
                </div>
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-xs text-gray-400 font-medium">정렬</span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortOption)}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                {hasFilter && (
                  <button
                    onClick={handleReset}
                    className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5"
                  >
                    초기화
                  </button>
                )}
              </div>

              {/* 상태 칩 */}
              <div className="flex flex-wrap gap-1.5">
                {STATUS_CHIPS.map((chip) => (
                  <button
                    key={chip.value}
                    onClick={() => setStatus(chip.value)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                      status === chip.value
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
                <span className="ml-auto text-xs text-gray-400 self-center">총 {total}명</span>
              </div>
            </div>

            {/* 테이블 */}
            {loading ? (
              <TableSkeleton rows={8} showDateCol />
            ) : artists.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-600">검색 결과 없음</p>
                <p className="text-xs text-gray-400 mt-1">조건을 바꾸거나 필터를 초기화해보세요</p>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
                  <table className="w-full min-w-[580px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left text-xs font-medium text-gray-500 py-3 pl-4 pr-2">가수명</th>
                        <th className="text-left text-xs font-medium text-gray-500 py-3 px-2">대표곡</th>
                        <th className="text-left text-xs font-medium text-gray-500 py-3 px-2">연락처</th>
                        <th className="text-left text-xs font-medium text-gray-500 py-3 px-3">신뢰도</th>
                        <th className="text-left text-xs font-medium text-gray-500 py-3 px-3">수집일</th>
                        <th className="text-left text-xs font-medium text-gray-500 py-3 pl-3 pr-4">상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {artists.map((a) => (
                        <ArtistRow key={a.melon_artist_id} artist={a} onOpen={setPanelArtist} onUpdate={fetchData} showCreatedAt />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end mt-3">
                  <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                </div>
              </>
            )}
          </>
        )}

        {/* 통계 뷰 */}
        {view === "stats" && (
          statsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <div className="h-3 w-20 bg-gray-100 rounded mb-3" />
                  <div className="h-7 w-16 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <StatsView
              summary={summary}
              allDaily={allDaily}
              replyResult={replyResult}
              periodFilter={periodFilter}
              setPeriodFilter={setPeriodFilter}
            />
          )
        )}
      </div>
    </main>
    </>
  );
}

// ─── 통계 뷰 컴포넌트 ─────────────────────────────────────────────────────────

type SummaryState = {
  total: number;
  instaCount: number;
  instaRate: number;
  contactedCount: number;
  sendRate: number;
  repliedCount: number;
  replyRate: number;
  positiveCount: number;
  dealCount: number;
  dealRate: number;
  weekNew: number;
  weekNewDelta: number;
  weekInstaRate: number;
  weekInstaRateDelta: number;
};

type StatsViewProps = {
  summary: SummaryState;
  allDaily: DailyStat[];
  replyResult: ReplyResultStat;
  periodFilter: PeriodFilter;
  setPeriodFilter: (v: PeriodFilter) => void;
};

const PERIOD_BUTTONS: { value: PeriodFilter; label: string }[] = [
  { value: 7, label: "7일" },
  { value: 14, label: "14일" },
  { value: 30, label: "30일" },
  { value: "all", label: "전체" },
];

function StatsView({ summary, allDaily, replyResult, periodFilter, setPeriodFilter }: StatsViewProps) {
  const [trendMode, setTrendMode] = useState<"chart" | "calendar">("chart");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() }; // 0-based
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // 기간 필터 적용
  const filteredDaily = (() => {
    if (periodFilter === "all") return allDaily;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - periodFilter);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    return allDaily.filter((d) => d.date >= cutoffStr);
  })();

  const maxCollected = Math.max(...filteredDaily.map((d) => d.collected), 1);

  // 전체 날짜별 Map (달력용)
  const dailyMap = Object.fromEntries(allDaily.map((d) => [d.date, d]));

  // 달력 셀 색상
  function calCellColor(collected: number): string {
    if (!collected) return "bg-gray-50 text-gray-300";
    if (collected >= 20) return "bg-indigo-600 text-white";
    if (collected >= 10) return "bg-indigo-400 text-white";
    if (collected >= 5)  return "bg-indigo-200 text-indigo-800";
    return "bg-indigo-100 text-indigo-700";
  }

  // 달력 그리드 생성
  function buildCalendarDays() {
    const { year, month } = calendarMonth;
    const firstDay = new Date(year, month, 1).getDay(); // 0=일
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }

  function calDateStr(day: number) {
    const { year, month } = calendarMonth;
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // 퍼널 데이터
  const funnelSteps = [
    { label: "수집", count: summary.total, rate: null },
    { label: "인스타확보", count: summary.instaCount, rate: summary.total ? Math.round((summary.instaCount / summary.total) * 100) : 0 },
    { label: "DM발송", count: summary.contactedCount, rate: summary.instaCount ? Math.round((summary.contactedCount / summary.instaCount) * 100) : 0 },
    { label: "답장", count: summary.repliedCount, rate: summary.contactedCount ? Math.round((summary.repliedCount / summary.contactedCount) * 100) : 0 },
    { label: "긍정", count: summary.positiveCount, rate: summary.repliedCount ? Math.round((summary.positiveCount / summary.repliedCount) * 100) : 0 },
    { label: "계약", count: summary.dealCount, rate: summary.contactedCount ? Math.round((summary.dealCount / summary.contactedCount) * 100) : 0 },
  ];

  const totalReply = replyResult.positive + replyResult.rejected + replyResult.pending;

  return (
    <>
      {/* ① 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {/* 이번 주 신규 (추세 포함) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col gap-0.5">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">이번 주 신규</span>
          <span className="text-2xl font-bold text-gray-900 tabular-nums">{summary.weekNew}<span className="text-sm font-normal text-gray-400 ml-1">명</span></span>
          {summary.weekNewDelta !== 0 && (
            <span className={`text-xs font-medium ${summary.weekNewDelta > 0 ? "text-emerald-600" : "text-red-500"}`}>
              {summary.weekNewDelta > 0 ? "▲" : "▼"} 전주 대비 {Math.abs(summary.weekNewDelta)}명
            </span>
          )}
        </div>
        {/* 인스타 확보율 (추세 포함) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col gap-0.5">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">인스타 확보율</span>
          <span className="text-2xl font-bold text-gray-900 tabular-nums">{summary.weekInstaRate}<span className="text-sm font-normal text-gray-400 ml-0.5">%</span></span>
          {summary.weekInstaRateDelta !== 0 && (
            <span className={`text-xs font-medium ${summary.weekInstaRateDelta > 0 ? "text-emerald-600" : "text-red-500"}`}>
              {summary.weekInstaRateDelta > 0 ? "▲" : "▼"} {Math.abs(summary.weekInstaRateDelta)}%p
            </span>
          )}
        </div>
        <StatCard label="발송률" value={`${summary.sendRate}%`} sub={`${summary.contactedCount}명`} />
        <StatCard label="답장률" value={`${summary.replyRate}%`} sub={`${summary.repliedCount}명`} />
        <StatCard label="긍정 답장" value={summary.positiveCount} sub="명" />
        <StatCard label="계약 성사율" value={`${summary.dealRate}%`} sub={`접촉 ${summary.contactedCount}명 중 ${summary.dealCount}명`} />
      </div>

      {/* ② 퍼널 섹션 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <h2 className="font-semibold text-gray-800 mb-5">발송 퍼널</h2>
        <div className="flex flex-col gap-1.5">
          {funnelSteps.map((step, idx) => {
            const maxCount = funnelSteps[0].count || 1;
            const widthPct = Math.max(Math.round((step.count / maxCount) * 100), step.count > 0 ? 8 : 0);
            const colors = [
              "bg-indigo-500",
              "bg-indigo-400",
              "bg-blue-400",
              "bg-emerald-400",
              "bg-emerald-500",
              "bg-violet-500",
            ];
            return (
              <div key={step.label} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-16 shrink-0 text-right">{step.label}</span>
                <div className="flex-1 flex items-center gap-2">
                  <div
                    className={`h-8 rounded-md ${colors[idx]} transition-all flex items-center px-3`}
                    style={{ width: `${widthPct}%`, minWidth: step.count > 0 ? "3rem" : "0" }}
                  >
                    <span className="text-white text-xs font-semibold whitespace-nowrap">
                      {step.count > 0 ? `${step.count}명` : ""}
                    </span>
                  </div>
                  {step.rate !== null && step.rate > 0 && (
                    <span className="text-xs text-gray-400 shrink-0">전단계 대비 {step.rate}%</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ③ 날짜별 추이 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800">날짜별 수집 추이</h2>
          <div className="flex items-center gap-2">
            {/* 차트/달력 토글 */}
            <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-medium">
              <button
                onClick={() => setTrendMode("chart")}
                className={`px-3 py-1.5 transition-colors ${trendMode === "chart" ? "bg-indigo-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
              >
                차트
              </button>
              <button
                onClick={() => setTrendMode("calendar")}
                className={`px-3 py-1.5 transition-colors ${trendMode === "calendar" ? "bg-indigo-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
              >
                달력
              </button>
            </div>
            {/* 기간 필터 (차트 모드에서만) */}
            {trendMode === "chart" && (
              <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-medium">
                {PERIOD_BUTTONS.map((btn) => (
                  <button
                    key={String(btn.value)}
                    onClick={() => setPeriodFilter(btn.value)}
                    className={`px-3 py-1.5 transition-colors ${periodFilter === btn.value ? "bg-indigo-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 차트 모드 */}
        {trendMode === "chart" && (
          <>
            <div className="flex items-center gap-4 mb-3">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="inline-block w-3 h-3 rounded-sm bg-indigo-500" />수집
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" />인스타확보
              </div>
            </div>
            {filteredDaily.length === 0 ? (
              <p className="text-sm text-gray-400">해당 기간 데이터 없음</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {[...filteredDaily].reverse().map(({ date, collected, insta }) => {
                  const collectedWidth = maxCollected ? Math.round((collected / maxCollected) * 100) : 0;
                  const instaWidth = maxCollected ? Math.round((insta / maxCollected) * 100) : 0;
                  const rate = collected ? Math.round((insta / collected) * 100) : 0;
                  return (
                    <div key={date} className="flex items-center gap-3 text-sm">
                      <span className="text-gray-500 w-12 shrink-0 text-xs">{date.slice(5)}</span>
                      <div className="flex-1 flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <div className="w-48 bg-gray-100 rounded-full h-2">
                            <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${collectedWidth}%` }} />
                          </div>
                          <span className="text-gray-600 text-xs w-12">{collected}명</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-48 bg-gray-100 rounded-full h-2">
                            <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${instaWidth}%` }} />
                          </div>
                          <span className="text-gray-600 text-xs w-12">{insta}명</span>
                        </div>
                      </div>
                      <span className={`text-xs font-medium w-10 text-right ${rate >= 70 ? "text-emerald-600" : rate >= 40 ? "text-yellow-600" : "text-gray-400"}`}>
                        {rate}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* 달력 모드 */}
        {trendMode === "calendar" && (() => {
          const { year, month } = calendarMonth;
          const cells = buildCalendarDays();
          const monthLabel = `${year}년 ${month + 1}월`;
          const selectedStat = selectedDate ? dailyMap[selectedDate] : null;

          return (
            <div>
              {/* 월 네비게이션 */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => {
                    setCalendarMonth((m) => {
                      const d = new Date(m.year, m.month - 1, 1);
                      return { year: d.getFullYear(), month: d.getMonth() };
                    });
                    setSelectedDate(null);
                  }}
                  className="text-gray-400 hover:text-gray-700 px-2 py-1 rounded text-sm"
                >
                  ‹
                </button>
                <span className="text-sm font-semibold text-gray-700">{monthLabel}</span>
                <button
                  onClick={() => {
                    setCalendarMonth((m) => {
                      const d = new Date(m.year, m.month + 1, 1);
                      return { year: d.getFullYear(), month: d.getMonth() };
                    });
                    setSelectedDate(null);
                  }}
                  className="text-gray-400 hover:text-gray-700 px-2 py-1 rounded text-sm"
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
              <div className="grid grid-cols-7 gap-1">
                {cells.map((day, i) => {
                  if (!day) return <div key={`empty-${i}`} />;
                  const dateStr = calDateStr(day);
                  const stat = dailyMap[dateStr];
                  const isSelected = selectedDate === dateStr;
                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                      className={`rounded-lg py-2 px-1 text-center transition-all border ${
                        isSelected
                          ? "border-indigo-500 ring-2 ring-indigo-300"
                          : "border-transparent hover:border-gray-200"
                      } ${calCellColor(stat?.collected ?? 0)}`}
                    >
                      <div className="text-xs font-semibold">{day}</div>
                      {stat ? (
                        <div className="text-[10px] mt-0.5 opacity-80">{stat.collected}명</div>
                      ) : (
                        <div className="text-[10px] mt-0.5 opacity-0">0</div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* 선택 날짜 상세 */}
              {selectedDate && (
                <div className="mt-4 rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3">
                  <div className="text-xs font-semibold text-indigo-700 mb-2">{selectedDate}</div>
                  {selectedStat ? (
                    <div className="flex gap-6">
                      <div>
                        <div className="text-[11px] text-gray-500">수집</div>
                        <div className="text-xl font-bold text-gray-900">{selectedStat.collected}명</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-gray-500">인스타 확보</div>
                        <div className="text-xl font-bold text-emerald-600">{selectedStat.insta}명</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-gray-500">확보율</div>
                        <div className={`text-xl font-bold ${
                          selectedStat.collected
                            ? Math.round((selectedStat.insta / selectedStat.collected) * 100) >= 70
                              ? "text-emerald-600"
                              : Math.round((selectedStat.insta / selectedStat.collected) * 100) >= 40
                              ? "text-yellow-600"
                              : "text-red-500"
                            : "text-gray-300"
                        }`}>
                          {selectedStat.collected ? Math.round((selectedStat.insta / selectedStat.collected) * 100) : 0}%
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">이 날 수집 없음</p>
                  )}
                </div>
              )}

              {/* 달력 범례 */}
              <div className="flex items-center gap-3 mt-3 text-[11px] text-gray-400">
                <span>적음</span>
                <div className="flex gap-1">
                  {["bg-indigo-100","bg-indigo-200","bg-indigo-400","bg-indigo-600"].map((c) => (
                    <span key={c} className={`inline-block w-4 h-4 rounded ${c}`} />
                  ))}
                </div>
                <span>많음</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ④ 답장 결과 분포 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 mb-4">답장 결과 분포</h2>
        {totalReply === 0 ? (
          <p className="text-sm text-gray-400">답장 데이터 없음</p>
        ) : (
          <>
            {/* 비율 바 */}
            <div className="flex h-4 rounded-full overflow-hidden mb-4">
              {replyResult.positive > 0 && (
                <div
                  className="bg-green-500 h-full"
                  style={{ width: `${Math.round((replyResult.positive / totalReply) * 100)}%` }}
                />
              )}
              {replyResult.pending > 0 && (
                <div
                  className="bg-yellow-400 h-full"
                  style={{ width: `${Math.round((replyResult.pending / totalReply) * 100)}%` }}
                />
              )}
              {replyResult.rejected > 0 && (
                <div
                  className="bg-red-400 h-full"
                  style={{ width: `${Math.round((replyResult.rejected / totalReply) * 100)}%` }}
                />
              )}
            </div>
            <div className="flex flex-col gap-2">
              {[
                { label: "긍정", count: replyResult.positive, color: "bg-green-500", textColor: "text-green-700" },
                { label: "보류", count: replyResult.pending, color: "bg-yellow-400", textColor: "text-yellow-700" },
                { label: "거절", count: replyResult.rejected, color: "bg-red-400", textColor: "text-red-700" },
              ].map(({ label, count, color, textColor }) => {
                const pct = totalReply ? Math.round((count / totalReply) * 100) : 0;
                return (
                  <div key={label} className="flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-2 w-16 shrink-0">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />
                      <span className="text-gray-600">{label}</span>
                    </div>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className={`${color} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={`font-medium w-8 text-right ${textColor}`}>{count}명</span>
                    <span className="text-gray-400 text-xs w-8 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
