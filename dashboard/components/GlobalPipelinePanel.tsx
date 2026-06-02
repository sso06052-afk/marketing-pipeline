"use client";

import PipelineProgress from "@/components/PipelineProgress";
import { usePipeline } from "@/components/PipelineProvider";

export default function GlobalPipelinePanel() {
  const { showPanel, events, logs, running, closePanel } = usePipeline();

  if (!showPanel) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 pt-4">
      <PipelineProgress
        events={events}
        rawLogs={logs}
        running={running}
        onClose={closePanel}
      />
    </div>
  );
}
