-- =============================================
-- 음원 홍보 파이프라인 Supabase 스키마
-- =============================================

-- artists 테이블
CREATE TABLE IF NOT EXISTS artists (
    melon_artist_id  TEXT PRIMARY KEY,
    genie_artist_id  TEXT,
    source           TEXT DEFAULT 'melon',
    name             TEXT NOT NULL,
    genre            TEXT,
    agency           TEXT,
    instagram_handle TEXT,
    instagram_url    TEXT,
    instagram_source TEXT CHECK (instagram_source IN ('melon', 'spotify', 'youtube', 'google', 'manual')),
    confidence_score INTEGER CHECK (confidence_score BETWEEN 0 AND 100),
    needs_review     BOOLEAN DEFAULT false,
    not_found_reason TEXT,
    email            TEXT,
    email_source     TEXT CHECK (email_source IN ('youtube_about', 'manual')),
    contacted        BOOLEAN DEFAULT false,
    contacted_date   TIMESTAMP WITH TIME ZONE,
    contact_count    INTEGER DEFAULT 0,
    contact_method   TEXT CHECK (contact_method IN ('instagram', 'email')),
    reply_received   BOOLEAN DEFAULT false,
    reply_date       TIMESTAMP WITH TIME ZONE,
    reply_result     TEXT CHECK (reply_result IN ('긍정', '거절', '보류')),
    memo             TEXT,
    followup_date    DATE,
    deal_status      TEXT CHECK (deal_status IN ('진행중', '완료')),
    deal_count       INTEGER DEFAULT 0,
    last_crawled     DATE DEFAULT CURRENT_DATE,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- songs 테이블
CREATE TABLE IF NOT EXISTS songs (
    melon_song_id   TEXT PRIMARY KEY,
    melon_artist_id TEXT REFERENCES artists(melon_artist_id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    album           TEXT,
    release_date    DATE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Google CSE 일별 사용량 추적 테이블
CREATE TABLE IF NOT EXISTS config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =============================================
-- 인덱스
-- =============================================
CREATE INDEX IF NOT EXISTS idx_artists_needs_review   ON artists(needs_review) WHERE needs_review = true;
CREATE INDEX IF NOT EXISTS idx_artists_contacted       ON artists(contacted);
CREATE INDEX IF NOT EXISTS idx_artists_created_at      ON artists(created_at);
CREATE INDEX IF NOT EXISTS idx_songs_melon_artist_id   ON songs(melon_artist_id);

-- =============================================
-- contacted=true 행 보호 트리거
-- upsert 시 contacted=true인 가수의 핵심 필드 덮어쓰기 방지
-- =============================================
CREATE OR REPLACE FUNCTION protect_contacted_artist()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.contacted = true THEN
        -- contacted된 가수는 연락 상태 필드를 파이프라인 upsert가 초기화하지 못하도록 보호
        NEW.contacted        := OLD.contacted;
        NEW.contacted_date   := OLD.contacted_date;
        NEW.reply_received   := OLD.reply_received;
        NEW.reply_date       := OLD.reply_date;
    END IF;
    -- contact_count는 항상 감소 불가 (파이프라인 upsert가 0으로 초기화하는 것 방지)
    NEW.contact_count := GREATEST(COALESCE(OLD.contact_count, 0), COALESCE(NEW.contact_count, 0));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_contacted ON artists;
CREATE TRIGGER trg_protect_contacted
    BEFORE UPDATE ON artists
    FOR EACH ROW EXECUTE FUNCTION protect_contacted_artist();

-- =============================================
-- RLS (Row Level Security)
-- =============================================
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE config  ENABLE ROW LEVEL SECURITY;

-- anon 키로 읽기 허용 (대시보드 클라이언트)
CREATE POLICY "anon_read_artists" ON artists
    FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_songs" ON songs
    FOR SELECT TO anon USING (true);

-- anon 키로 artists 업데이트 허용 (contacted, reply_received 갱신)
CREATE POLICY "anon_update_artists" ON artists
    FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- service_role 키로 모든 작업 허용 (파이프라인 서버)
CREATE POLICY "service_all_artists" ON artists
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_songs" ON songs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_config" ON config
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================
-- RPC: 발송 시 contact_count 원자적 증가
-- 대시보드 API Route에서 호출
-- =============================================
CREATE OR REPLACE FUNCTION increment_contact_count(artist_id TEXT)
RETURNS void AS $$
    UPDATE artists
    SET
        contact_count  = contact_count + 1,
        contacted      = true,
        contacted_date = now()
    WHERE melon_artist_id = artist_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- =============================================
-- 기존 DB 마이그레이션용 (이미 테이블이 있는 경우 실행)
-- =============================================
-- ALTER TABLE artists ADD COLUMN IF NOT EXISTS genie_artist_id TEXT;
-- ALTER TABLE artists ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'melon';
-- ALTER TABLE artists ADD COLUMN IF NOT EXISTS not_found_reason TEXT;
-- ALTER TABLE artists ADD COLUMN IF NOT EXISTS reply_result TEXT CHECK (reply_result IN ('긍정', '거절', '보류'));
-- ALTER TABLE artists ADD COLUMN IF NOT EXISTS memo TEXT;
-- ALTER TABLE artists ADD COLUMN IF NOT EXISTS followup_date DATE;
-- ALTER TABLE artists ADD COLUMN IF NOT EXISTS deal_status TEXT CHECK (deal_status IN ('진행중', '완료'));
-- ALTER TABLE artists ADD COLUMN IF NOT EXISTS deal_count INTEGER DEFAULT 0;
