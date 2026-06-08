"use client";

import { useEffect, useRef, useState } from "react";
import { Artist } from "@/lib/supabase";
import { useToast } from "@/components/Toaster";
import { getSourceLink } from "@/lib/sourceLink";

type Song = { melon_song_id?: string | null; title: string; album: string | null };
type Props = {
  artist: (Artist & { songs?: Song[] }) | null;
  onClose: () => void;
  onUpdate: () => void;
};

const RESULT_STYLES: Record<string, string> = {
  긍정: "bg-green-100 text-green-700 border-green-200",
  거절: "bg-red-100 text-red-600 border-red-200",
  보류: "bg-yellow-100 text-yellow-700 border-yellow-200",
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

export default function ArtistPanel({ artist, onClose, onUpdate }: Props) {
  const { showToast } = useToast();
  const panelRef = useRef<HTMLDivElement>(null);

  const [contacted, setContacted] = useState(false);
  const [contactCount, setContactCount] = useState(0);
  const [replied, setReplied] = useState(false);
  const [replyResult, setReplyResult] = useState<string | null>(null);
  const [memo, setMemo] = useState("");
  const [followupDate, setFollowupDate] = useState("");
  const [handleInput, setHandleInput] = useState("");
  const [currentHandle, setCurrentHandle] = useState("");
  const [dealStatus, setDealStatus] = useState<'진행중' | '완료' | null>(null);
  const [dealCount, setDealCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [savingMemo, setSavingMemo] = useState(false);
  const [savingHandle, setSavingHandle] = useState(false);
  const [savingDeal, setSavingDeal] = useState(false);

  // artist 변경 시 상태 동기화
  useEffect(() => {
    if (!artist) return;
    setContacted(artist.contacted);
    setContactCount(artist.contact_count ?? 0);
    setReplied(artist.reply_received);
    setReplyResult(artist.reply_result ?? null);
    setMemo(artist.memo ?? "");
    setFollowupDate(artist.followup_date ?? "");
    setCurrentHandle(artist.instagram_handle ?? "");
    setHandleInput(artist.instagram_handle ?? "");
    setDealStatus(artist.deal_status ?? null);
    setDealCount(artist.deal_count ?? 0);
  }, [artist?.melon_artist_id]);

  // ESC 닫기
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 바깥 클릭 닫기
  useEffect(() => {
    if (!artist) return;
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [artist, onClose]);

  if (!artist) return null;

  const song = artist.songs?.[0];
  const isSecondContact = contacted && !replied && contactCount >= 1;

  async function handleDM() {
    if (!currentHandle || replied) return;
    setLoading(true);
    copyToClipboard(`안녕하세요 ${artist!.name}님`);
    window.open(`https://ig.me/m/${currentHandle}`, "_blank");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ melon_artist_id: artist!.melon_artist_id, contact_method: "instagram" }),
      });
      if (!res.ok) throw new Error();
      setContacted(true);
      setContactCount((n) => n + 1);
      showToast(`${artist!.name} DM 발송 완료`, "success");
      onUpdate();
    } catch {
      showToast("발송 기록 중 오류가 발생했습니다", "error");
    }
    setLoading(false);
  }

  async function handleEmail() {
    if (!artist!.email || replied) return;
    setLoading(true);
    window.location.href = `mailto:${artist!.email}?subject=음원 홍보 문의&body=안녕하세요 ${artist!.name}님`;
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ melon_artist_id: artist!.melon_artist_id, contact_method: "email" }),
      });
      if (!res.ok) throw new Error();
      setContacted(true);
      setContactCount((n) => n + 1);
      showToast(`${artist!.name} 이메일 발송 완료`, "success");
      onUpdate();
    } catch {
      showToast("발송 기록 중 오류가 발생했습니다", "error");
    }
    setLoading(false);
  }

  async function handleReplySubmit(result: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          melon_artist_id: artist!.melon_artist_id,
          reply_result: result,
          memo,
          followup_date: followupDate || null,
        }),
      });
      if (!res.ok) throw new Error();
      setReplied(true);
      setReplyResult(result);
      showToast(`답장 결과 저장 완료 (${result})`, "success");
      onUpdate();
    } catch {
      showToast("저장 중 오류가 발생했습니다", "error");
    }
    setLoading(false);
  }

  async function handleDealStatus(status: '진행중' | '완료' | null) {
    setSavingDeal(true);
    try {
      const res = await fetch("/api/deal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ melon_artist_id: artist!.melon_artist_id, deal_status: status }),
      });
      if (!res.ok) throw new Error();
      if (status === '진행중' && dealStatus !== '진행중') {
        setDealCount((n) => n + 1);
      }
      setDealStatus(status);
      showToast(status ? `마케팅 ${status} 설정` : "마케팅 상태 초기화", "success");
      onUpdate();
    } catch {
      showToast("저장 중 오류가 발생했습니다", "error");
    }
    setSavingDeal(false);
  }

  async function handleMemoSave() {
    setSavingMemo(true);
    try {
      const res = await fetch("/api/memo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          melon_artist_id: artist!.melon_artist_id,
          reply_result: replyResult,
          memo,
          followup_date: followupDate || null,
        }),
      });
      if (!res.ok) throw new Error();
      showToast("메모 저장 완료", "success");
      onUpdate();
    } catch {
      showToast("메모 저장 중 오류가 발생했습니다", "error");
    }
    setSavingMemo(false);
  }

  async function handleHandleSave() {
    setSavingHandle(true);
    try {
      const saved = handleInput.trim().replace(/^@/, "");
      const res = await fetch("/api/handle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ melon_artist_id: artist!.melon_artist_id, instagram_handle: saved }),
      });
      if (!res.ok) throw new Error();
      setCurrentHandle(saved);
      setHandleInput(saved);
      showToast("인스타 아이디 저장 완료", "success");
      onUpdate();
    } catch {
      showToast("저장 중 오류가 발생했습니다", "error");
    }
    setSavingHandle(false);
  }

  const scoreColor =
    artist.confidence_score == null ? "text-gray-300"
    : artist.confidence_score >= 80 ? "text-emerald-600"
    : artist.confidence_score >= 60 ? "text-yellow-600"
    : "text-red-500";

  return (
    <>
      {/* 딤 오버레이 */}
      <div className="fixed inset-0 bg-black/20 z-40 transition-opacity" />

      {/* 슬라이드오버 패널 */}
      <div
        ref={panelRef}
        className="fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right"
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900 text-base">{artist.name}</h2>
            {song && (
              <p className="text-sm text-gray-400 mt-0.5">{song.title}{song.album ? ` · ${song.album}` : ""}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5 ml-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 스크롤 컨텐츠 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* 연락처 정보 */}
          <section>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">연락처</p>
            <div className="space-y-2">
              {/* 인스타 핸들 */}
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                  <svg className="w-4 h-4 text-pink-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                  {currentHandle ? (
                    <a
                      href={`https://www.instagram.com/${currentHandle}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-500 hover:underline flex-1"
                    >
                      @{currentHandle}
                    </a>
                  ) : (
                    <span className="text-sm text-gray-400 flex-1">인스타 없음</span>
                  )}
                </div>
              </div>
              {/* 핸들 편집 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={handleInput}
                  onChange={(e) => setHandleInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleHandleSave()}
                  placeholder="@없이 아이디 입력"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <button
                  onClick={handleHandleSave}
                  disabled={savingHandle}
                  className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {savingHandle ? "저장 중" : "저장"}
                </button>
              </div>
              {/* 이메일 */}
              {artist.email && (
                <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                  <svg className="w-4 h-4 text-purple-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm text-gray-600 flex-1 truncate">{artist.email}</span>
                </div>
              )}
            </div>
          </section>

          {/* 아티스트 정보 */}
          <section>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">정보</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {artist.genre && (
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-400 mb-0.5">장르</p>
                  <p className="text-gray-700 font-medium">{artist.genre}</p>
                </div>
              )}
              {artist.agency && (
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-400 mb-0.5">소속사</p>
                  <p className="text-gray-700 font-medium truncate">{artist.agency}</p>
                </div>
              )}
              {artist.confidence_score != null && (
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-400 mb-0.5">신뢰도</p>
                  <p className={`font-semibold ${scoreColor}`}>{artist.confidence_score}</p>
                </div>
              )}
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-400 mb-0.5">수집일</p>
                <p className="text-gray-700 font-medium">{artist.created_at.slice(0, 10)}</p>
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              {(() => {
                const link = getSourceLink(artist);
                return (
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline"
                  >
                    {link.label === "멜론 →" ? "멜론 페이지 →" : link.label}
                  </a>
                );
              })()}
              {currentHandle && (
                <a
                  href={`https://www.instagram.com/${currentHandle}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-pink-500 hover:underline"
                >
                  인스타 →
                </a>
              )}
            </div>
          </section>

          {/* 발송 액션 */}
          <section>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">발송</p>
            <div className="flex gap-2">
              {currentHandle && (
                <button
                  onClick={handleDM}
                  disabled={loading || replied}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    replied ? "bg-gray-100 text-gray-400 cursor-default"
                    : isSecondContact ? "bg-orange-500 text-white hover:bg-orange-600"
                    : contacted ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                  }`}
                >
                  {isSecondContact ? "2차 DM" : contacted ? "재DM" : "DM 발송"}
                </button>
              )}
              {artist.email && (
                <button
                  onClick={handleEmail}
                  disabled={loading || replied}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                    replied ? "border-gray-200 text-gray-400 cursor-default"
                    : "border-purple-200 text-purple-700 hover:bg-purple-50"
                  }`}
                >
                  이메일
                </button>
              )}
            </div>
            {contacted && (
              <p className="text-xs text-gray-400 mt-2">
                {contactCount}회 발송 · {artist.contacted_date?.slice(0, 10) ?? ""}
              </p>
            )}
          </section>

          {/* 답장 */}
          <section>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">답장 결과</p>
            {replied && replyResult ? (
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${RESULT_STYLES[replyResult] ?? ""}`}>
                {replyResult}
              </div>
            ) : (
              <div className="flex gap-2">
                {(["긍정", "거절", "보류"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => handleReplySubmit(r)}
                    disabled={loading}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors hover:opacity-90 ${RESULT_STYLES[r]}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* 마케팅 계약 */}
          <section>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">마케팅 계약</p>
            <div className="flex gap-2">
              {(["진행중", "완료"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => handleDealStatus(dealStatus === s ? null : s)}
                  disabled={savingDeal}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                    dealStatus === s
                      ? s === "진행중"
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            {dealCount > 0 && (
              <p className="text-xs text-gray-400 mt-2">총 {dealCount}회 계약</p>
            )}
          </section>

          {/* 메모 */}
          <section>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">메모</p>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="메모를 입력하세요..."
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-2 flex-1">
                <label className="text-xs text-gray-400 shrink-0">재연락일</label>
                <input
                  type="date"
                  value={followupDate}
                  onChange={(e) => setFollowupDate(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 flex-1"
                />
              </div>
              <button
                onClick={handleMemoSave}
                disabled={savingMemo}
                className="px-4 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 font-medium"
              >
                {savingMemo ? "저장 중..." : "저장"}
              </button>
            </div>
          </section>

        </div>
      </div>
    </>
  );
}
