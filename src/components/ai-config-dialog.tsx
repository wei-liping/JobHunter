"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearAiConfig,
  loadAiConfig,
  saveAiConfig,
  type ClientAiConfig,
} from "@/lib/client/ai-config";
import { fetchWithAiHeaders } from "@/lib/client/fetch-with-ai";

export function AiConfigDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ClientAiConfig>(loadAiConfig());
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function onField(key: keyof ClientAiConfig, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onOpen() {
    setForm(loadAiConfig());
    setMessage("");
    setOpen(true);
  }

  async function testConnection() {
    setBusy(true);
    setMessage("");
    try {
      saveAiConfig(form);
      const res = await fetchWithAiHeaders("/api/ai/ping", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "连接失败");
      setMessage(`连接成功：${data.model}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "连接失败");
    } finally {
      setBusy(false);
    }
  }

  function persist() {
    saveAiConfig(form);
    setMessage("配置已保存到本地浏览器");
  }

  function clear() {
    clearAiConfig();
    setForm(loadAiConfig());
    setMessage("已清空本地配置");
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={onOpen}
        className="rounded-full border border-sky-100 bg-white text-sky-700 shadow-sm hover:bg-sky-50"
        aria-label="API 设置"
        title="API 设置"
      >
        <Settings2 className="h-4 w-4" />
      </Button>
      {open && mounted
        ? createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/30 p-4 sm:items-center">
          <Card className="my-4 w-full max-w-xl border-sky-100 shadow-[0_24px_70px_rgba(59,130,246,0.18)] sm:my-0 max-h-[calc(100vh-2rem)] overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>API 设置</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                >
                  关闭
                </Button>
              </div>
            </CardHeader>
            <CardContent className="max-h-[calc(100vh-10rem)] space-y-4 overflow-y-auto">
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => onField("apiKey", e.target.value)}
                  placeholder="sk-..."
                />
                <p className="text-xs text-muted-foreground">
                  仅保存在当前浏览器 localStorage，不上传数据库。
                </p>
              </div>
              <div className="space-y-2">
                <Label>Base URL</Label>
                <Input
                  value={form.baseUrl}
                  onChange={(e) => onField("baseUrl", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  豆包可填 <span className="font-medium text-sky-700">https://ark.cn-beijing.volces.com/api/v3</span>，
                  千问可填 <span className="font-medium text-sky-700">https://dashscope.aliyuncs.com/compatible-mode/v1</span>。
                </p>
              </div>
              <div className="space-y-2">
                <Label>模型名称</Label>
                <Input
                  value={form.model}
                  onChange={(e) => onField("model", e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={testConnection}
                  disabled={busy}
                  className="bg-sky-50 text-sky-700 hover:bg-sky-100"
                >
                  测试连接
                </Button>
                <Button onClick={persist} className="bg-sky-600 text-white hover:bg-sky-700">
                  保存配置
                </Button>
                <Button variant="outline" onClick={clear}>
                  清空
                </Button>
              </div>
              {message && (
                <p className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-800">
                  {message}
                </p>
              )}
            </CardContent>
          </Card>
        </div>,
        document.body,
      )
        : null}
    </>
  );
}
