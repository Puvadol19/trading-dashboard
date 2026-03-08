"use client";

import { INSTRUMENTS, type Instrument } from "@/lib/types";

interface InstrumentSelectorProps {
  value: Instrument;
  onChange: (instrument: Instrument) => void;
}

export function InstrumentSelector({
  value,
  onChange,
}: InstrumentSelectorProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {INSTRUMENTS.map((inst) => {
        const isActive = inst === value;
        return (
          <button
            key={inst}
            onClick={() => onChange(inst)}
            className={`px-2.5 py-1.5 text-xs font-mono rounded-md transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
            }`}
          >
            {inst.replace("_", "/")}
          </button>
        );
      })}
    </div>
  );
}
