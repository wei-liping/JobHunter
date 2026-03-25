type FeishuTokenResp = {
  code: number;
  msg: string;
  tenant_access_token?: string;
  expire?: number;
};

type FeishuApiResp<T = unknown> = {
  code: number;
  msg: string;
  data?: T;
};

type BitableListData = {
  items?: Array<{ record_id?: string }>;
};

type BitableCreateData = {
  record?: { record_id?: string };
};

type FeishuRecord = Record<string, unknown>;

let cachedToken = "";
let tokenExpiresAt = 0;

const BASE_URL = process.env.FEISHU_BASE_URL || "https://open.feishu.cn";

function getEnv(name: string): string {
  return process.env[name] || "";
}

export function hasFeishuConfig() {
  return Boolean(
    getEnv("FEISHU_APP_ID") &&
    getEnv("FEISHU_APP_SECRET") &&
    getEnv("FEISHU_BITABLE_APP_TOKEN") &&
    getEnv("FEISHU_BITABLE_TABLE_ID"),
  );
}

export async function getTenantAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) return cachedToken;

  const appId = getEnv("FEISHU_APP_ID");
  const appSecret = getEnv("FEISHU_APP_SECRET");
  if (!appId || !appSecret) {
    throw new Error("Feishu app id/secret is missing.");
  }

  const res = await fetch(
    `${BASE_URL}/open-apis/auth/v3/tenant_access_token/internal`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    },
  );
  const data = (await res.json()) as FeishuTokenResp;
  if (!res.ok || data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`Feishu token failed: ${data.msg || "unknown"}`);
  }
  cachedToken = data.tenant_access_token;
  const ttlSec = data.expire || 7200;
  tokenExpiresAt = now + (ttlSec - 60) * 1000;
  return cachedToken;
}

export async function upsertBitableRecord(
  uniqueKey: string,
  fields: FeishuRecord,
) {
  const token = await getTenantAccessToken();
  const appToken = getEnv("FEISHU_BITABLE_APP_TOKEN");
  const tableId = getEnv("FEISHU_BITABLE_TABLE_ID");

  const filter = encodeURIComponent(
    `CurrentValue.[applicationId] = "${uniqueKey}"`,
  );
  const listUrl = `${BASE_URL}/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records?filter=${filter}`;
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const listJson = (await listRes.json()) as FeishuApiResp<BitableListData>;
  if (!listRes.ok || listJson.code !== 0) {
    throw new Error(`Feishu list records failed: ${listJson.msg || "unknown"}`);
  }

  const firstRecord = listJson.data?.items?.[0];
  if (firstRecord?.record_id) {
    const updateUrl = `${BASE_URL}/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/${firstRecord.record_id}`;
    const updateRes = await fetch(updateUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ fields }),
    });
    const updateJson = (await updateRes.json()) as FeishuApiResp;
    if (!updateRes.ok || updateJson.code !== 0) {
      throw new Error(`Feishu update failed: ${updateJson.msg || "unknown"}`);
    }
    return { mode: "update", recordId: firstRecord.record_id };
  }

  const createUrl = `${BASE_URL}/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`;
  const createRes = await fetch(createUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ fields }),
  });
  const createJson =
    (await createRes.json()) as FeishuApiResp<BitableCreateData>;
  if (!createRes.ok || createJson.code !== 0) {
    throw new Error(`Feishu create failed: ${createJson.msg || "unknown"}`);
  }
  return {
    mode: "create",
    recordId: createJson.data?.record?.record_id as string,
  };
}

export async function sendFeishuBotText(text: string) {
  const webhook = getEnv("FEISHU_BOT_WEBHOOK");
  if (!webhook) throw new Error("FEISHU_BOT_WEBHOOK is not set.");
  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      msg_type: "text",
      content: { text },
    }),
  });
  const data = (await res.json()) as FeishuApiResp;
  if (!res.ok || data.code !== 0) {
    throw new Error(`Feishu bot failed: ${data.msg || "unknown"}`);
  }
  return data;
}
