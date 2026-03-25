"use client";

import { useState } from "react";
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
      <Button variant="outline" size="sm" onClick={onOpen}>
        API 设置
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-xl">
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
            <CardContent className="space-y-4">
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
                >
                  测试连接
                </Button>
                <Button onClick={persist}>保存配置</Button>
                <Button variant="outline" onClick={clear}>
                  清空
                </Button>
              </div>
              {message && (
                <p className="rounded border bg-muted px-3 py-2 text-sm">
                  {message}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
