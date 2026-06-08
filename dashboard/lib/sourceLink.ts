/**
 * 가수의 source 필드에 따라 외부 음원 페이지 링크를 반환합니다.
 *
 * - melon  → 멜론 가수 페이지
 * - genie / genie_genre → 지니 곡 페이지 (첫 곡 melon_song_id 사용)
 *                          곡 ID 없으면 지니 가수 페이지로 폴백
 */
export function getSourceLink(artist: {
  source: string;
  melon_artist_id: string;
  genie_artist_id?: string | null;
  songs?: Array<{ melon_song_id?: string | null }>;
}): { url: string; label: string } {
  const isGenie =
    artist.source === "genie" || artist.source === "genie_genre";

  if (isGenie) {
    const songId = artist.songs?.[0]?.melon_song_id;
    if (songId) {
      return {
        url: `https://www.genie.co.kr/detail/songInfo?xgnm=${songId}`,
        label: "지니 →",
      };
    }
    // 폴백: 지니 가수 페이지
    const genieArtistId = artist.genie_artist_id ?? "";
    return {
      url: `https://www.genie.co.kr/detail/artistInfo?xxnm=${genieArtistId}`,
      label: "지니 →",
    };
  }

  // 기본: 멜론 가수 페이지
  return {
    url: `https://www.melon.com/artist/detail.htm?artistId=${artist.melon_artist_id}`,
    label: "멜론 →",
  };
}
