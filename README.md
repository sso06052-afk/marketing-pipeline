# 음원 홍보 파이프라인

신곡 가수 자동 수집 → 인스타그램 탐색 → DM 발송 관리 시스템

---

## 구성

| 역할 | 설명 |
|---|---|
| **파이프라인** | 멜론/지니 신곡 페이지에서 가수 수집, 인스타 계정 자동 탐색, DB 저장 |
| **대시보드** | 브라우저에서 수집 실행, 가수 목록 확인, DM 발송 및 답장 관리 |

---

## 설치 및 실행

**[설치 가이드 보기](docs/client-setup-guide.md)**

처음 설치하는 경우 위 링크의 문서를 순서대로 따라하세요.

---

## 필요한 것

- Docker Desktop (무료, [다운로드](https://www.docker.com/products/docker-desktop))
- API 키 목록 (담당자에게 수령):
  - Supabase URL / Key (DB)
  - Serper API Key (구글 검색)
  - Gemini API Key (AI 판별)

---

## 빠른 시작 (설치 완료 후)

```bash
# 대시보드 켜기
docker start pipeline-dashboard

# 대시보드 끄기
docker stop pipeline-dashboard
```

브라우저에서 `http://localhost:3000` 접속

---

## 문의

설치 중 문제가 생기면 담당자에게 연락하세요.
