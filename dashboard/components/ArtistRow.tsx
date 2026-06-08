"use client";

import { useState } from "react";
import { Artist } from "@/lib/supabase";
import { useToast } from "@/components/Toaster";

export type Song = { melon_song_id?: string | null; title: string; album: string | null; release_date: string | null };
export type ArtistWithSong = Artist & { songs?: Song[] };
type Props = {
  artist: ArtistWithSong;
  onOpen: (artist: ArtistWithSong) => void;
  onUpdate?: () => void;
  showCreatedAt?: boolean;
};

function copyToClipboard(text: string) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}
function fallbackCopy(text: string) {
  const el = document.createElement("textarea");
  el.value = text;
  el.style.cssText = "position:fixed;opacity:0";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

const RESULT_STYLES: Record<string, string> = {
  긍정: "bg-green-100 text-green-700",
  거절: "bg-red-100 text-red-600",
  보류: "bg-yellow-100 text-yellow-700",
};

export default function ArtistRow({ artist, onOpen, onUpdate, showCreatedAt }: Props) {
  const { showToast } = useToast();
  const [dmLoading, setDmLoading] = useState(false);
  const [localContacted, setLocalContacted] = useState(artist.contacted);
  const [localCount, setLocalCount] = useState(artist.contact_count ?? 0);

  const song = artist.songs?.[0];
  const replied = artist.reply_received;
  const replyResult = artist.reply_result;
  const isSecondContact = localContacted && !replied && localCount >= 1;
  const isLowConf = artist.confidence_score !== null && artist.confidence_score !== undefined && artist.confidence_score <= 60;

  async function handleQuickDM(e: React.MouseEvent) {
    e.stopPropagation();
    const handle = artist.instagram_handle;
    if (!handle || replied || dmLoading) return;
    setDmLoading(true);
    copyToClipboard(`안녕하세요 ${artist.name}님`);
    window.open(`https://ig.me/m/${handle}`, "_blank");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ melon_artist_id: artist.melon_artist_id, contact_method: "instagram" }),
      });
      if (!res.ok) throw new Error();
      setLocalContacted(true);
      setLocalCount((n) => n + 1);
      showToast(`${artist.name} DM 발송 완료`, "success");
      onUpdate?.();
    } catch {
      showToast("발송 기록 중 오류가 발생했습니다", "error");
    }
    setDmLoading(false);
  }

  const score = artist.confidence_score;
  const scoreBarColor =
    score == null ? "bg-gray-200"
    : score >= 80 ? "bg-emerald-400"
    : score >= 60 ? "bg-yellow-400"
    : "bg-red-400";
  const scoreTextColor =
    score == null ? "text-gray-300"
    : score >= 80 ? "text-emerald-600"
    : score >= 60 ? "text-yellow-600"
    : "text-red-500";

  return (
    <tr
      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors h-12 cursor-pointer ${replied ? "opacity-60" : ""}`}
      onClick={() => onOpen(artist)}
    >
      {/* 가수명 */}
      <td className="py-0 pl-4 pr-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-gray-900 text-sm">{artist.name}</span>
          {isSecondContact && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">2차</span>
          )}
          {isLowConf && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">확인</span>
          )}
          {replyResult && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${RESULT_STYLES[replyResult] ?? ""}`}>
              {replyResult}
            </span>
          )}
        </div>
        <div className="text-[11px] text-gray-400 truncate max-w-[120px]">
          {[artist.genre, artist.agency].filter(Boolean).join(" · ") || "—"}
        </div>
      </td>

      {/* 대표곡 */}
      <td className="py-0 px-3 max-w-[140px]">
        <div className="text-sm text-gray-700 truncate">{song?.title ?? "—"}</div>
        <div className="text-[11px] text-gray-400 truncate">
          {song?.release_date ? song.release_date.slice(5).replace("-", ".") : song?.album ?? ""}
        </div>
      </td>

      {/* 연락처 */}
      <td className="py-0 px-3 min-w-[140px]">
        {artist.instagram_handle ? (
          <span className="text-sm text-blue-500 truncate block max-w-[140px]">@{artist.instagram_handle}</span>
        ) : artist.email ? (
          <span className="text-sm text-purple-600 truncate block max-w-[140px]">{artist.email}</span>
        ) : (
          <span className="text-sm text-gray-300">없음</span>
        )}
        {artist.instagram_source && (
          <span className="text-[10px] text-gray-400">{artist.instagram_source}</span>
        )}
      </td>

      {/* 신뢰도 */}
      <td className="py-0 px-3">
        <div className="flex flex-col gap-1 w-20">
          <span className={`text-xs font-semibold tabular-nums ${scoreTextColor}`}>{score ?? "—"}</span>
          <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full ${scoreBarColor}`}
              style={{ width: score != null ? `${score}%` : "0%" }}
            />
          </div>
        </div>
      </td>

      {/* 수집일 */}
      {showCreatedAt && (
        <td className="py-0 px-3 text-xs text-gray-400 whitespace-nowrap">
          {artist.created_at.slice(0, 10)}
        </td>
      )}

      {/* 액션 */}
      <td className="py-0 pl-3 pr-4">
        <div className="flex items-center gap-1.5">
          {/* DM 빠른 버튼 */}
          {artist.instagram_handle && !replied && (
            <button
              onClick={handleQuickDM}
              disabled={dmLoading}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                dmLoading ? "bg-gray-100 text-gray-400"
                : isSecondContact ? "bg-orange-500 text-white hover:bg-orange-600"
                : localContacted ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
              }`}
            >
              {dmLoading ? "..." : isSecondContact ? "2차DM" : localContacted ? "재DM" : "DM"}
            </button>
          )}
          {/* 상태 뱃지 */}
          {replied ? (
            <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${RESULT_STYLES[replyResult ?? ""] ?? "bg-indigo-50 text-indigo-600"}`}>
              {replyResult ?? "답장"}
            </span>
          ) : !artist.instagram_handle && !artist.email ? (
            <span className="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-400 font-medium whitespace-nowrap">
              연락처없음
            </span>
          ) : null}
          {artist.deal_status && (
            <span className={`text-[10px] px-2 py-1 rounded-full font-medium whitespace-nowrap ${
              artist.deal_status === "진행중" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-700"
            }`}>
              {artist.deal_status}{artist.deal_count > 1 ? ` ${artist.deal_count}회` : ""}
            </span>
          )}
          {artist.memo && (
            <span className="text-[10px] text-gray-400" title={artist.memo}>📝</span>
          )}
          {artist.followup_date && (
            <span className="text-[10px] text-blue-400" title={`재연락 ${artist.followup_date}`}>🔁</span>
          )}
        </div>
      </td>
    </tr>
  );
}
