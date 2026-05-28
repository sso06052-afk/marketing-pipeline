import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({ source: "melon", pages: 1 }));
  const source = body.source === "genie" ? "genie" : "melon";
  const pages = Math.min(Math.max(Number(body.pages) || 1, 1), 5);
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
        try {
          controller.close();
        } catch {}
      };

      const child = spawn("python3", args, {
        cwd: pipelineDir,
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
      });

      child.stdout.on("data", (chunk: Buffer) => {
        chunk.toString().split("\n").filter(Boolean).forEach((line) => send(line));
      });

      child.stderr.on("data", (chunk: Buffer) => {
        chunk.toString().split("\n").filter(Boolean).forEach((line) => send(line));
      });

      child.on("close", (code) => {
        send("", true, code ?? 0);
        finish();
      });

      child.on("error", (err) => {
        send(`[오류] ${err.message}`);
        send("", true, -1);
        finish();
      });
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
