-- =============================================
-- 마이그레이션: artists 테이블에 deal 컬럼 2개 추가
-- 실행일: 2026-04-29
-- =============================================

ALTER TABLE artists
  ADD COLUMN IF NOT EXISTS deal_status text CHECK (deal_status IN ('진행중', '완료')),
  ADD COLUMN IF NOT EXISTS deal_count integer NOT NULL DEFAULT 0;
