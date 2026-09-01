"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { EvaluatorRecord } from "@/lib/types";

export function EvaluatorChip({ evaluator }: { evaluator: EvaluatorRecord }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex max-w-full items-center rounded-full border border-[#A5D6A7] bg-[#E8F5E9] px-2.5 py-0.5 text-xs font-medium text-[#1B5E20] transition-colors hover:bg-[#dcefdc]"
        >
          {evaluator.name}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="px-3 py-2 text-start">
        <p className="font-medium">{evaluator.name}</p>
        <p className="mt-1 text-[11px] opacity-90">ת.ז: {evaluator.tz || "—"}</p>
        <p className="text-[11px] opacity-90">מ.א: {evaluator.ma || "—"}</p>
      </TooltipContent>
    </Tooltip>
  );
}
