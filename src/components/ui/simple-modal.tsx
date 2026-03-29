"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

export function SimpleModal({
  open,
  title,
  children,
  onClose,
  primaryLabel = "确定",
  onPrimary,
  secondaryLabel,
  onSecondary,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/30 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="simple-modal-title"
    >
      <Card className="my-4 w-full max-w-md border-sky-100 shadow-[0_24px_70px_rgba(59,130,246,0.18)] sm:my-0">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle id="simple-modal-title" className="text-lg">
              {title}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} type="button">
              关闭
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">{children}</div>
          <div className="flex flex-wrap justify-end gap-2">
            {secondaryLabel && (
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  onSecondary?.();
                }}
              >
                {secondaryLabel}
              </Button>
            )}
            <Button
              type="button"
              onClick={() => {
                onPrimary?.();
                onClose();
              }}
            >
              {primaryLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
