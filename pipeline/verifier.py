from __future__ import annotations
import os
import re
import logging
import google.generativeai as genai

logger = logging.getLogger(__name__)


def verify_account(
    name: str,
    album: str,
    candidates: list[str],
) -> tuple[str | None, int, bool]:
    """
    후보 인스타 계정 중 공식 계정 판별.
    반환: (handle, confidence_score, needs_review)
    """
    if not candidates:
        return None, 0, True

    if len(candidates) == 1:
        return candidates[0], 70, False

    # 후보 2개 이상 → Gemini 판별
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.warning("GEMINI_API_KEY 없음 — 첫 번째 후보 사용")
        return candidates[0], 50, True

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.0-flash")

        numbered = "\n".join(f"{i+1}. @{h}" for i, h in enumerate(candidates))
        prompt = (
            f"가수명: {name}\n"
            f"앨범명: {album}\n"
            f"후보 계정 목록:\n{numbered}\n\n"
            "위 가수의 공식 인스타그램 계정 번호만 답해. 불확실하면 '불확실'."
        )

        response = model.generate_content(prompt)
        answer = response.text.strip()
        logger.info("[%s] Gemini 응답: %s", name, answer)

        if "불확실" in answer:
            return candidates[0], 40, True

        match = re.search(r"\d+", answer)
        if match:
            idx = int(match.group()) - 1
            if 0 <= idx < len(candidates):
                return candidates[idx], 90, False

        # 번호 파싱 실패
        return candidates[0], 40, True

    except Exception as e:
        logger.warning("[%s] Gemini 호출 실패: %s", name, e)
        return candidates[0], 40, True
