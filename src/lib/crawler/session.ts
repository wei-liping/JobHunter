/**
 * 登录态预留：将 Playwright storageState 路径或序列化 Cookie 传入
 * `crawlJobWithPlaywright`，在 browser.newContext({ storageState }) 中恢复会话。
 *
 * 示例（未接线的占位）：
 * ```ts
 * export type CrawlerAuthOptions = {
 *   storageStatePath?: string;
 *   extraHTTPHeaders?: Record<string, string>;
 * };
 * ```
 */

export type CrawlerAuthOptions = {
  /** Playwright 导出的 storage_state.json 路径 */
  storageStatePath?: string;
  extraHTTPHeaders?: Record<string, string>;
};
