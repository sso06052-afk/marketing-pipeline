"use client";

import { useEffect, useState, useRef } from "react";

export type PipelineEvent =
  | { type: "stage"; stage: StageId; status: "start" | "progress" | "complete"; [k: string]: unknown }
  | { type: "artist"; status: "processing" | "done" | "review" | "skip"; name: string; handle?: string | null; score?: number | null; source?: string | null; reason?: string | null; index: number; total: number }
  | { type: "pipeline"; status: "complete"; stats: PipelineStats; duration_sec: number }
  | { type: "pipeline"; status: "error"; message: string };

type StageId = "collecting" | "classifying" | "searching" | "saving";

type StageState = "pending" | "active" | "done";

type PipelineStats = {
  new: number;
  insta_found: number;
  needs_review: number;
  songs_added: number;
  insta_rate: number;
  existing_songs: number;
};

type ArtistResult = {
  name: string;
  status: "done" | "review" | "skip";
  handle?: string | null;
  score?: number | null;
  reason?: string | null;
};

const STAGE_LABELS: Record<StageId, string> = {
  collecting: "신곡 수집",
  classifying: "신규 분류",
  searching: "인스타 탐색",
  saving: "데이터 저장",
};

const STAGE_ORDER: StageId[] = ["collecting", "classifying", "searching", "saving"];

export default function PipelineProgress({
  events,
  rawLogs,
  running,
  onClose,
}: {
  events: PipelineEvent[];
  rawLogs: string[];
  running: boolean;
  onClose: () => void;
}) {
  const [showRawLogs, setShowRawLogs] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const rawLogsEndRef = useRef<HTMLDivElement>(null);

  // 경과 시간 타이머
  useEffect(() => {
    if (running && startTimeRef.current === null) {
      startTimeRef.current = Date.now();
    }
    if (!running) {
      startTimeRef.current = null;
      return;
    }
    const t = setInterval(() => {
      if (startTimeRef.current) {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 500);
    return () => clearInterval(t);
  }, [running]);

  // 자동 스크롤
  useEffect(() => {
    if (showRawLogs) rawLogsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [rawLogs, showRawLogs]);

  // 이벤트로부터 상태 계산
  const state = computeState(events);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-indigo-50 to-violet-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎵</span>
          <span className="text-sm font-semibold text-gray-800">
            {state.pipelineStatus === "complete"
              ? "수집 완료"
              : state.pipelineStatus === "error"
              ? "오류 발생"
              : running
              ? "수집 진행 중"
              : "준비"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 font-mono tabular-nums">
            ⏱️ {formatTime(state.pipelineStatus === "complete" ? Math.round(state.durationSec ?? elapsed) : elapsed)}
          </span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">
            닫기
          </button>
        </div>
      </div>

      {/* 단계별 카드 */}
      <div className="p-5 space-y-3">
        {STAGE_ORDER.map((stage, idx) => (
          <StageCard
            key={stage}
            number={idx + 1}
            label={STAGE_LABELS[stage]}
            state={state.stages[stage]}
            detail={state.stageDetails[stage]}
            progress={
              stage === "searching" && state.stages.searching === "active"
                ? { current: state.searchProcessed, total: state.searchTotal }
                : null
            }
          />
        ))}
      </div>

      {/* 처리 중 가수 + 최근 결과 */}
      {(state.processingArtist || state.recentResults.length > 0) && (
        <div className="px-5 pb-5 space-y-3">
          {state.processingArtist && state.pipelineStatus !== "complete" && (
            <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 rounded-lg border border-indigo-100">
              <span className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-indigo-900">
                <span className="font-semibold">처리 중:</span> {state.processingArtist}
              </span>
            </div>
          )}

          {state.recentResults.length > 0 && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 overflow-hidden">
              <div className="px-3 py-2 text-[11px] font-medium text-gray-500 bg-white border-b border-gray-100">
                최근 결과
              </div>
              <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {state.recentResults
                  .slice()
                  .reverse()
                  .map((r, i) => (
                    <ArtistResultRow key={`${r.name}-${i}`} result={r} />
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 완료 요약 */}
      {state.pipelineStatus === "complete" && state.finalStats && (
        <div className="mx-5 mb-5 p-5 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
          <div className="text-sm font-bold text-green-800 mb-3 flex items-center gap-1.5">
            ✅ 완료
          </div>
          <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-sm">
            <SummaryRow label="신규 가수" value={`${state.finalStats.new}명`} />
            <SummaryRow
              label="인스타 확보"
              value={`${state.finalStats.insta_found}명 (${state.finalStats.insta_rate}%)`}
            />
            <SummaryRow label="검토 필요" value={`${state.finalStats.needs_review}명`} highlight={state.finalStats.needs_review > 0} />
            <SummaryRow label="저장된 곡" value={`${state.finalStats.songs_added}곡`} />
          </div>
        </div>
      )}

      {/* 오류 표시 */}
      {state.pipelineStatus === "error" && (
        <div className="mx-5 mb-5 p-4 bg-red-50 rounded-lg border border-red-200 text-sm text-red-800">
          ❌ {state.errorMessage}
        </div>
      )}

      {/* 고급 로그 토글 */}
      <div className="border-t border-gray-100">
        <button
          onClick={() => setShowRawLogs((v) => !v)}
          className="w-full px-5 py-2.5 text-xs text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-1.5"
        >
          <span>{showRawLogs ? "▲" : "▼"}</span>
          {showRawLogs ? "로그 숨기기" : "자세한 로그 보기"}
          <span className="text-gray-400">({rawLogs.length})</span>
        </button>

        {showRawLogs && (
          <div className="bg-gray-900 max-h-60 overflow-y-auto p-4 font-mono text-[11px] text-green-400 space-y-0.5">
            {rawLogs.length === 0 ? (
              <span className="text-gray-500">로그 없음</span>
            ) : (
              rawLogs.map((line, i) => (
                <div key={i} className="leading-5 whitespace-pre-wrap break-all">
                  {line}
                </div>
              ))
            )}
            <div ref={rawLogsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 서브 컴포넌트 ────────────────────────────────────────────

function StageCard({
  number,
  label,
  state,
  detail,
  progress,
}: {
  number: number;
  label: string;
  state: StageState;
  detail: string | null;
  progress: { current: number; total: number } | null;
}) {
  const icon =
    state === "done" ? "✓" : state === "active" ? "" : "";
  const bgColor =
    state === "done"
      ? "bg-green-50 border-green-200"
      : state === "active"
      ? "bg-indigo-50 border-indigo-200"
      : "bg-gray-50 border-gray-100";
  const textColor =
    state === "done"
      ? "text-green-900"
      : state === "active"
      ? "text-indigo-900"
      : "text-gray-400";
  const numberBg =
    state === "done"
      ? "bg-green-500 text-white"
      : state === "active"
      ? "bg-indigo-600 text-white"
      : "bg-gray-200 text-gray-500";

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${bgColor}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${numberBg}`}>
        {state === "done" ? icon : number}
      </div>
      <div className={`flex-1 ${textColor}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{label}</span>
          {detail && (
            <span className="text-xs font-mono tabular-nums">{detail}</span>
          )}
        </div>
        {progress && progress.total > 0 && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-white rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
            <span className="text-[11px] text-indigo-700 font-mono tabular-nums shrink-0">
              {progress.current}/{progress.total}
            </span>
          </div>
        )}
      </div>
      {state === "active" && (
        <span className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />
      )}
    </div>
  );
}

function ArtistResultRow({ result }: { result: ArtistResult }) {
  if (result.status === "done") {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-green-600 shrink-0">✓</span>
          <span className="font-medium text-gray-800 truncate">{result.name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-gray-500">
          <span className="text-indigo-600">@{result.handle}</span>
          {result.score && <span className="text-gray-400">({result.score}점)</span>}
        </div>
      </div>
    );
  }
  if (result.status === "review") {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-amber-500 shrink-0">⚠️</span>
          <span className="font-medium text-gray-800 truncate">{result.name}</span>
        </div>
        <span className="text-amber-600 shrink-0">검토 필요</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-gray-400 shrink-0">⊘</span>
        <span className="text-gray-500 truncate">{result.name}</span>
      </div>
      <span className="text-gray-400 shrink-0 truncate max-w-[140px]">{result.reason ?? "스킵"}</span>
    </div>
  );
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-600">{label}</span>
      <span className={`font-semibold tabular-nums ${highlight ? "text-amber-700" : "text-gray-900"}`}>
        {value}
      </span>
    </div>
  );
}

// ─── 이벤트 → 상태 계산 ────────────────────────────────────────

function computeState(events: PipelineEvent[]) {
  const stages: Record<StageId, StageState> = {
    collecting: "pending",
    classifying: "pending",
    searching: "pending",
    saving: "pending",
  };
  const stageDetails: Record<StageId, string | null> = {
    collecting: null,
    classifying: null,
    searching: null,
    saving: null,
  };
  let processingArtist: string | null = null;
  let searchProcessed = 0;
  let searchTotal = 0;
  const recentResults: ArtistResult[] = [];
  let pipelineStatus: "running" | "complete" | "error" = "running";
  let finalStats: PipelineStats | null = null;
  let durationSec: number | null = null;
  let errorMessage = "";

  for (const ev of events) {
    if (ev.type === "stage") {
      if (ev.status === "start") stages[ev.stage] = "active";
      if (ev.status === "complete") {
        stages[ev.stage] = "done";
        if (ev.stage === "collecting" && typeof ev.total_songs === "number") {
          stageDetails.collecting = `${ev.total_songs}곡`;
        }
        if (ev.stage === "classifying") {
          const n = (ev.new_count as number) ?? 0;
          const e = (ev.existing_count as number) ?? 0;
          stageDetails.classifying = `신규 ${n}명 · 기존 ${e}곡`;
        }
        if (ev.stage === "saving" && typeof ev.existing_songs === "number") {
          stageDetails.saving = `기존 신곡 ${ev.existing_songs}곡`;
        }
      }
      if (ev.stage === "searching" && ev.status === "start") {
        searchTotal = (ev.total as number) ?? 0;
      }
    } else if (ev.type === "artist") {
      if (ev.status === "processing") {
        processingArtist = ev.name;
      } else {
        searchProcessed = ev.index;
        if (ev.status !== "skip" || ev.reason) {
          recentResults.push({
            name: ev.name,
            status: ev.status,
            handle: ev.handle,
            score: ev.score,
            reason: ev.reason,
          });
        }
        // 마지막 처리 가수 = 본인
        if (processingArtist === ev.name) processingArtist = null;
      }
    } else if (ev.type === "pipeline") {
      if (ev.status === "complete") {
        pipelineStatus = "complete";
        finalStats = ev.stats;
        durationSec = ev.duration_sec;
      } else if (ev.status === "error") {
        pipelineStatus = "error";
        errorMessage = ev.message;
      }
    }
  }

  // 탐색 단계 진행 상세
  if (stages.searching === "active" && searchTotal > 0) {
    stageDetails.searching = `${searchProcessed}/${searchTotal}`;
  } else if (stages.searching === "done" && searchTotal > 0) {
    stageDetails.searching = `${searchTotal}명 처리 완료`;
  }

  return {
    stages,
    stageDetails,
    processingArtist,
    searchProcessed,
    searchTotal,
    recentResults: recentResults.slice(-30),
    pipelineStatus,
    finalStats,
    durationSec,
    errorMessage,
  };
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
