"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { PipelineEvent } from "@/components/PipelineProgress";
import { useToast } from "@/components/Toaster";

// ─── 타입 ────────────────────────────────────────────────────────

interface PipelineContextValue {
  running: boolean;
  events: PipelineEvent[];
  logs: string[];
  showPanel: boolean;
  source: "melon" | "genie" | "genie_genre";
  pages: number;
  setSource: (s: "melon" | "genie" | "genie_genre") => void;
  setPages: (n: number) => void;
  setShowPanel: (v: boolean) => void;
  runPipeline: (opts?: { limit?: number }) => void;
  closePanel: () => void;
}

const PipelineContext = createContext<PipelineContextValue>({
  running: false,
  events: [],
  logs: [],
  showPanel: false,
  source: "genie",
  pages: 1,
  setSource: () => {},
  setPages: () => {},
  setShowPanel: () => {},
  runPipeline: () => {},
  closePanel: () => {},
});

export function usePipeline() {
  return useContext(PipelineContext);
}

// ─── Provider ────────────────────────────────────────────────────

export function PipelineProvider({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast();

  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [source, setSource] = useState<"melon" | "genie" | "genie_genre">("genie");
  const [pages, setPages] = useState(1);

  // SSE reader 참조 (페이지 이동에도 연결 유지)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  // 중복 연결 방지 가드
  const connectingRef = useRef(false);

  // ─── SSE 스트림 파서 (공통) ──────────────────────────────────
  const processStream = useCallback(
    async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const payload = JSON.parse(line.slice(6));

              // job_id 수신 → localStorage 저장
              if (payload.job_id) {
                localStorage.setItem("pipeline_job_id", payload.job_id);
              }

              if (payload.log) {
                const log: string = payload.log;
                if (log.startsWith("EVENT:")) {
                  try {
                    const ev = JSON.parse(log.slice(6)) as PipelineEvent;
                    setEvents((prev) => [...prev, ev]);
                  } catch {}
                } else {
                  setLogs((prev) => [...prev, log]);
                }
              }

              if (payload.done) {
                const ok = payload.code === 0;
                const msg = ok ? "수집 완료" : `오류 발생 (코드: ${payload.code})`;
                showToast(msg, ok ? "success" : "error");

                if (ok && "Notification" in window && Notification.permission === "granted") {
                  new Notification("파이프라인 완료", {
                    body: msg,
                    icon: "/favicon.ico",
                  });
                }

                // localStorage 정리
                localStorage.removeItem("pipeline_job_id");

                // 페이지에 데이터 새로고침 신호
                window.dispatchEvent(
                  new CustomEvent("pipeline:done", { detail: { ok } })
                );
              }
            } catch {}
          }
        }
      } catch (e) {
        setLogs((prev) => [...prev, `[오류] ${String(e)}`]);
      } finally {
        readerRef.current = null;
        connectingRef.current = false;
        setRunning(false);
      }
    },
    [showToast]
  );

  // ─── 마운트 시 재접속 ────────────────────────────────────────
  useEffect(() => {
    const jobId = localStorage.getItem("pipeline_job_id");
    if (!jobId || connectingRef.current) return;

    const railwayUrl = process.env.NEXT_PUBLIC_PIPELINE_API_URL;
    const apiSecret = process.env.NEXT_PUBLIC_PIPELINE_SECRET ?? "";

    if (!railwayUrl) return; // fallback 환경에선 재접속 불가

    connectingRef.current = true;
    setRunning(true);
    setShowPanel(true);

    (async () => {
      try {
        const res = await fetch(`${railwayUrl}/logs/${jobId}`, {
          headers: apiSecret ? { "x-api-key": apiSecret } : {},
        });
        if (!res.ok || !res.body) {
          // 404 등 — 오래된 job_id 정리
          localStorage.removeItem("pipeline_job_id");
          connectingRef.current = false;
          setRunning(false);
          return;
        }
        await processStream(res.body.getReader());
      } catch (e) {
        setLogs((prev) => [...prev, `[재접속 오류] ${String(e)}`]);
        localStorage.removeItem("pipeline_job_id");
        connectingRef.current = false;
        setRunning(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 마운트 1회만

  // ─── 파이프라인 실행 ────────────────────────────────────────
  const runPipeline = useCallback(
    async (opts?: { limit?: number }) => {
      if (running || connectingRef.current) return;
      connectingRef.current = true;
      setRunning(true);
      setLogs([]);
      setEvents([]);
      setShowPanel(true);

      const railwayUrl = process.env.NEXT_PUBLIC_PIPELINE_API_URL;
      const apiSecret = process.env.NEXT_PUBLIC_PIPELINE_SECRET ?? "";

      try {
        const body: Record<string, unknown> = { source, pages };
        if (opts?.limit != null) body.limit = opts.limit;

        const res = railwayUrl
          ? await fetch(`${railwayUrl}/run`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(apiSecret ? { "x-api-key": apiSecret } : {}),
              },
              body: JSON.stringify(body),
            })
          : await fetch("/api/pipeline", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });

        if (!res.body) throw new Error("스트림 없음");
        await processStream(res.body.getReader());
      } catch (e) {
        setLogs((prev) => [...prev, `[오류] ${String(e)}`]);
        connectingRef.current = false;
        setRunning(false);
      }
    },
    [running, source, pages, processStream]
  );

  const closePanel = useCallback(() => setShowPanel(false), []);

  return (
    <PipelineContext.Provider
      value={{
        running,
        events,
        logs,
        showPanel,
        source,
        pages,
        setSource,
        setPages,
        setShowPanel,
        runPipeline,
        closePanel,
      }}
    >
      {children}
    </PipelineContext.Provider>
  );
}
