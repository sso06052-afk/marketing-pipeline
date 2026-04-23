"use client";

import { useState } from "react";
import { Artist } from "@/lib/supabase";

type Song = { title: string; album: string | null };
type Props = {
  artist: Artist & { songs?: Song[] };
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

export default function ArtistRow({ artist }: Props) {
  const [contactCount, setContactCount] = useState(artist.contact_count ?? 0);
  const [contacted, setContacted] = useState(artist.contacted);
  const [replied, setReplied] = useState(artist.reply_received);
  const [loading, setLoading] = useState(false);

  const song = artist.songs?.[0];
  const isSecondContact = contacted && !replied && contactCount >= 1;
  const isLowConf = artist.confidence_score !== null && artist.confidence_score <= 60;

  async function callContact(method: "instagram" | "email") {
    await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ melon_artist_id: artist.melon_artist_id, contact_method: method }),
    });
    setContacted(true);
    setContactCount((n) => n + 1);
  }

  async function handleDM() {
    if (!artist.instagram_handle || replied) return;
    setLoading(true);
    copyToClipboard(`안녕하세요 ${artist.name}님`);
    window.open(`https://ig.me/m/${artist.instagram_handle}`, "_blank");
    try { await callContact("instagram"); } catch {}
    setLoading(false);
  }

  async function handleEmail() {
    if (!artist.email || replied) return;
    setLoading(true);
    window.location.href = `mailto:${artist.email}?subject=음원 홍보 문의&body=안녕하세요 ${artist.name}님`;
    try { await callContact("email"); } catch {}
    setLoading(false);
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
    } catch {}
    setLoading(false);
  }

  const scoreColor =
    artist.confidence_score === null
      ? "text-gray-300"
      : artist.confidence_score >= 80
      ? "text-emerald-600"
      : artist.confidence_score >= 60
      ? "text-yellow-600"
      : "text-red-500";

  return (
    <tr className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${replied ? "opacity-50" : ""}`}>
      {/* 가수명 */}
      <td className="py-3 pl-4 pr-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-gray-900 text-sm">{artist.name}</span>
          {isSecondContact && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">2차</span>
          )}
          {isLowConf && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">확인</span>
          )}
          {replied && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">답장</span>
          )}
        </div>
        <div className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[120px]">
          {[artist.genre, artist.agency].filter(Boolean).join(" · ") || "—"}
        </div>
      </td>

      {/* 대표곡 */}
      <td className="py-3 px-2 max-w-[140px]">
        <div className="text-sm text-gray-700 truncate">{song?.title ?? "—"}</div>
        <div className="text-[11px] text-gray-400 truncate">{song?.album ?? ""}</div>
      </td>

      {/* 연락처 */}
      <td className="py-3 px-2 min-w-[150px]">
        {artist.instagram_handle ? (
          <a
            href={`https://www.instagram.com/${artist.instagram_handle}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-500 hover:underline truncate block max-w-[150px]"
          >
            @{artist.instagram_handle}
          </a>
        ) : artist.email ? (
          <span className="text-sm text-purple-600 truncate block max-w-[150px]">{artist.email}</span>
        ) : (
          <span className="text-sm text-gray-300">없음</span>
        )}
        {artist.instagram_source && (
          <span className="text-[10px] text-gray-400">{artist.instagram_source}</span>
        )}
      </td>

      {/* 신뢰도 */}
      <td className="py-3 px-2 text-center">
        <span className={`text-sm font-semibold tabular-nums ${scoreColor}`}>
          {artist.confidence_score ?? "—"}
        </span>
      </td>

      {/* 액션 */}
      <td className="py-3 pl-2 pr-4">
        <div className="flex items-center gap-1.5">
          {/* DM 버튼 */}
          {artist.instagram_handle && (
            <button
              onClick={handleDM}
              disabled={loading || replied}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                replied
                  ? "bg-gray-100 text-gray-400 cursor-default"
                  : isSecondContact
                  ? "bg-orange-500 text-white hover:bg-orange-600"
                  : contacted
                  ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {isSecondContact ? "2차DM" : contacted ? "재DM" : "DM"}
            </button>
          )}

          {/* 이메일 버튼 */}
          {artist.email && (
            <button
              onClick={handleEmail}
              disabled={loading || replied}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                replied
                  ? "bg-gray-100 text-gray-400 cursor-default"
                  : isSecondContact
                  ? "bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100"
                  : "bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
              }`}
            >
              {isSecondContact ? "2차메일" : "메일"}
            </button>
          )}

          {/* 답장옴 */}
          <button
            onClick={handleReply}
            disabled={replied || loading}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              replied
                ? "bg-green-50 text-green-600 cursor-default"
                : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
            }`}
          >
            {replied ? "답장✓" : "답장"}
          </button>
        </div>
      </td>
    </tr>
  );
}
