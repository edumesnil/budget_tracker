import { useState } from "react";
import { css } from "../../../styled-system/css";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ValidatedTransaction } from "@/lib/parsers/types";

interface UnparseableSectionProps {
  rows: ValidatedTransaction[];
}

export function UnparseableSection({ rows }: UnparseableSectionProps) {
  const [open, setOpen] = useState(false);

  if (rows.length === 0) return null;

  return (
    <div className={css({ mt: "2" })}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={css({
          display: "flex",
          alignItems: "center",
          gap: "2",
          fontSize: "sm",
          color: "fg.muted",
          cursor: "pointer",
          bg: "transparent",
          border: "none",
          p: "0",
          _hover: { color: "fg.default" },
        })}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {rows.length} row{rows.length > 1 ? "s" : ""} could not be parsed
      </button>

      {open && (
        <div
          className={css({
            mt: "2",
            display: "flex",
            flexDir: "column",
            gap: "1",
          })}
        >
          {rows.map((row, i) => (
            <div
              key={i}
              className={css({
                px: "3",
                py: "2",
                bg: "bg.subtle",
                rounded: "md",
                fontSize: "xs",
                color: "fg.muted",
              })}
            >
              <span className={css({ color: "fg.disabled", mr: "2" })}>{row.parseError}:</span>
              {row.rawLine}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
