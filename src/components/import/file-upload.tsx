import { useCallback, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { css } from "../../../styled-system/css";
import * as Card from "@/components/ui/card";

interface FileUploadProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export function FileUpload({ onFile, disabled }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile, disabled],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFile(file);
      // Reset so the same file can be re-selected
      e.target.value = "";
    },
    [onFile],
  );

  return (
    <Card.Root>
      <Card.Body className={css({ pt: "6" })}>
        <div
          role="button"
          tabIndex={0}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!disabled) inputRef.current?.click();
            }
          }}
          className={css({
            display: "flex",
            flexDir: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "3",
            py: "12",
            rounded: "lg",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1,
            bg: dragOver ? "colorPalette.2" : "bg.subtle",
            transition: "background 150ms, outline-color 150ms",
            outline: "2px dashed",
            outlineColor: dragOver ? "colorPalette.8" : "border.subtle",
            outlineOffset: "-2px",
            _hover: disabled ? {} : { bg: "colorPalette.2", outlineColor: "colorPalette.8" },
          })}
        >
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              w: "10",
              h: "10",
              rounded: "full",
              bg: "colorPalette.3",
              color: "colorPalette.11",
            })}
          >
            <Upload size={18} />
          </div>
          <div className={css({ textAlign: "center" })}>
            <p className={css({ fontSize: "sm", fontWeight: "500", color: "fg.default" })}>
              Drop a bank statement here or click to browse
            </p>
            <p className={css({ fontSize: "xs", color: "fg.muted", mt: "1" })}>PDF or CSV</p>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.csv"
          onChange={handleChange}
          className={css({ srOnly: true })}
        />
      </Card.Body>
    </Card.Root>
  );
}
