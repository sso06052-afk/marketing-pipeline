import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export async function POST(req: NextRequest) {
  const { melon_only } = await req.json().catch(() => ({ melon_only: false }));

  // dashboard/ 기준 한 단계 위가 프로젝트 루트, pipeline/ 폴더에서 실행
  const pipelineDir = path.resolve(process.cwd(), "../pipeline");
  const args = melon_only ? ["pipeline.py", "--melon-only"] : ["pipeline.py"];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (log: string, done = false, code?: number) => {
        const payload = done ? { done: true, code } : { log };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
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
        controller.close();
      });

      child.on("error", (err) => {
        send(`[오류] ${err.message}`);
        send("", true, -1);
        controller.close();
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
