"use client";

import { useState } from "react";
import { Artist } from "@/lib/supabase";

type Props = {
  artist: Artist;
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
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.focus();
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

export default function ArtistCard({ artist }: Props) {
  const [contactCount, setContactCount] = useState(artist.contact_count ?? 0);
  const [contacted, setContacted] = useState(artist.contacted);
  const [replied, setReplied] = useState(artist.reply_received);
  const [loading, setLoading] = useState(false);

  const isLowConfidence = artist.confidence_score !== null && artist.confidence_score <= 60;
  const isSecondContact = contacted && !replied && contactCount >= 1;

  async function callContactApi(contact_method: "instagram" | "email") {
    await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ melon_artist_id: artist.melon_artist_id, contact_method }),
    });
    setContacted(true);
    setContactCount((n) => n + 1);
  }

  async function handleDM() {
    if (!artist.instagram_handle || replied) return;
    setLoading(true);
    copyToClipboard(`안녕하세요 ${artist.name}님`);
    window.open(`https://ig.me/m/${artist.instagram_handle}`, "_blank");
    try {
      await callContactApi("instagram");
    } catch (e) {
      console.error("contacted 업데이트 실패:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleEmail() {
    if (!artist.email || replied) return;
    setLoading(true);
    window.location.href = `mailto:${artist.email}?subject=음원 홍보 문의&body=안녕하세요 ${artist.name}님`;
    try {
      await callContactApi("email");
    } catch (e) {
      console.error("contacted 업데이트 실패:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleReply() {
    if (replied) return;
    setLoading(true);
    try {
      await fetch("/api/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ melon_artist_id: artist.melon_artist_id }),
      });
      setReplied(true);
    } catch (e) {
      console.error("reply 업데이트 실패:", e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{artist.name}</span>
            {isSecondContact && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
                2차 발송
              </span>
            )}
            {isLowConfidence && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                확인필요
              </span>
            )}
          </div>
          <div className="text-sm text-gray-500 mt-0.5">
            {[artist.genre, artist.agency].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0 ml-3">
          {artist.instagram_handle && (
            <a
              href={`https://www.instagram.com/${artist.instagram_handle}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-500 hover:underline"
            >
              @{artist.instagram_handle}
            </a>
          )}
          {artist.email && (
            <span className="text-xs text-gray-400">{artist.email}</span>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-1 flex-wrap">
        {/* DM 버튼 */}
        <button
          onClick={handleDM}
          disabled={loading || !artist.instagram_handle || replied}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors min-w-[80px] ${
            replied
              ? "bg-gray-100 text-gray-400 cursor-default"
              : !artist.instagram_handle
              ? "bg-gray-50 text-gray-300 cursor-not-allowed"
              : isSecondContact
              ? "bg-orange-500 text-white hover:bg-orange-600"
              : contacted
              ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {replied ? "발송완료" : isSecondContact ? "2차 DM" : contacted ? "재발송" : "DM 보내기"}
        </button>

        {/* 이메일 버튼 (이메일 확보된 경우만) */}
        {artist.email && (
          <button
            onClick={handleEmail}
            disabled={loading || replied}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors min-w-[80px] ${
              replied
                ? "bg-gray-100 text-gray-400 cursor-default"
                : isSecondContact
                ? "bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100"
                : "bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
            }`}
          >
            {replied ? "완료" : isSecondContact ? "2차 메일" : "이메일"}
          </button>
        )}

        {/* 답장옴 버튼 */}
        <button
          onClick={handleReply}
          disabled={replied || loading}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors min-w-[80px] ${
            replied
              ? "bg-gray-100 text-gray-400 cursor-default"
              : "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
          }`}
        >
          {replied ? "답장완료" : "답장옴"}
        </button>
      </div>
    </div>
  );
}
