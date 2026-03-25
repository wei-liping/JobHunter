"use client";

import { useCallback, useRef, useState, type ClipboardEvent } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  description?: string;
  accept: string;
  disabled?: boolean;
  onFile: (file: File) => Promise<void> | void;
};

function pickFirstImageFromPaste(e: ClipboardEvent<HTMLDivElement>) {
  const items = e.clipboardData?.items;
  if (!items) return null;
  for (const item of Array.from(items)) {
    if (item.kind === "file") {
      const f = item.getAsFile();
      if (f && f.type.startsWith("image/")) return f;
    }
  }
  return null;
}

export function FileDropzone({
  title,
  description,
  accept,
  disabled,
  onFile,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      if (disabled) return;
      setBusy(true);
      try {
        await onFile(file);
      } finally {
        setBusy(false);
      }
    },
    [disabled, onFile],
  );

  const pasteFromClipboard = useCallback(async () => {
    if (disabled || busy) return;
    if (
      typeof navigator === "undefined" ||
      !navigator.clipboard ||
      !("read" in navigator.clipboard)
    ) {
      return;
    }
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((t) => t.startsWith("image/"));
      if (!imageType) continue;
      const blob = await item.getType(imageType);
      const file = new File([blob], `clipboard-${Date.now()}.png`, {
        type: imageType,
      });
      await handleFile(file);
      return;
    }
  }, [busy, disabled, handleFile]);

  return (
    <div className="space-y-2">
      <div
        tabIndex={0}
        className={cn(
          "rounded-lg border bg-background p-3 outline-none transition-colors",
          dragOver ? "border-primary bg-muted/40" : "border-input",
          disabled ? "opacity-60" : "cursor-pointer",
        )}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onPaste={(e) => {
          const f = pickFirstImageFromPaste(e);
          if (!f) return;
          e.preventDefault();
          void handleFile(f);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          if (disabled) return;
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (disabled) return;
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled) return;
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium">{title}</div>
            <div className="text-xs text-muted-foreground">
              {description ??
                "支持拖拽/选择文件；粘贴图片请先聚焦此区域再 Ctrl/Cmd+V。"}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || disabled}
              onClick={(e) => {
                e.stopPropagation();
                void pasteFromClipboard();
              }}
            >
              粘贴截图
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy || disabled}
            >
              {busy ? "处理中…" : "选择文件"}
            </Button>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void handleFile(file);
          }}
        />
      </div>
    </div>
  );
}
