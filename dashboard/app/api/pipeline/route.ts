import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export const maxDuration = 300; // Vercel Pro: 5분

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({ source: "melon", pages: 1 }));
  const source = ["genie", "genie_genre"].includes(body.source) ? body.source : "melon";
  const mode = ["collect", "search", "full"].includes(body.mode) ? body.mode : "full";
  const pages = Math.min(Math.max(Number(body.pages) || 1, 1), 5);
  const limit = Number(body.limit) > 0 ? Math.floor(Number(body.limit)) : undefined;
  const date = typeof body.date === "string" ? body.date : undefined;

  const railwayUrl = process.env.PIPELINE_API_URL;
  const apiSecret = process.env.PIPELINE_SECRET ?? "";

  // Railway 서버가 설정된 경우 — 서버사이드 프록시 (API 키 노출 없음)
  if (railwayUrl) {
    const upstream = await fetch(`${railwayUrl}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiSecret ? { "x-api-key": apiSecret } : {}),
      },
      body: JSON.stringify({ source, pages, mode, ...(limit ? { limit } : {}), ...(date ? { date } : {}) }),
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "Railway 서버 오류" }, { status: 502 });
    }

    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  // 로컬 개발 — 직접 python3 실행
  const pipelineDir = path.resolve(process.cwd(), "../pipeline");
  const args = ["pipeline.py", "--source", source, "--pages", String(pages)];
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (log: string, done = false, code?: number) => {
        if (closed) return;
        const payload = done ? { done: true, code } : { log };
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          closed = true;
        }
      };
      const finish = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch {}
      };

      const child = spawn("python3", args, {
        cwd: pipelineDir,
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
      });
      child.stdout.on("data", (chunk: Buffer) =>
        chunk.toString().split("\n").filter(Boolean).forEach((l) => send(l))
      );
      child.stderr.on("data", (chunk: Buffer) =>
        chunk.toString().split("\n").filter(Boolean).forEach((l) => send(l))
      );
      child.on("close", (code) => { send("", true, code ?? 0); finish(); });
      child.on("error", (err) => { send(`[오류] ${err.message}`); send("", true, -1); finish(); });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
