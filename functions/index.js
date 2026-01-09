// functions/index.js

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      ...extraHeaders,
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // 🔍 环境变量自检（临时调试用）
  if (request.method === "GET" && url.pathname === "/api/env-check") {
    return new Response(
      JSON.stringify({
        hasKey: !!env.DASHSCOPE_API_KEY,
        keyLength: env.DASHSCOPE_API_KEY?.length || 0,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }


    // 只处理 /api/summarize
    if (url.pathname !== "/api/summarize") {
      return new Response("Not Found", { status: 404 });
    }

    // 预检请求
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
        },
      });
    }

    if (request.method !== "POST") {
      return json({ error: "Method Not Allowed" }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const text = (body?.text || "").trim();
    if (!text) return json({ error: "text is required" }, 400);

    // ✅ 在 ESA Pages 的“环境变量”里配置这个
    const apiKey = env.DASHSCOPE_API_KEY;
    if (!apiKey) return json({ error: "Missing DASHSCOPE_API_KEY in env" }, 500);
    const prompt = `请将下面内容用中文做一个简洁摘要（80-150字），并给出3条要点：
内容：
${text}`;

    const resp = await fetch(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen-turbo",
          input: { prompt },
          parameters: {
            result_format: "text",
            max_tokens: 400,
            temperature: 0.3,
          },
        }),
      }
    );

    const raw = await resp.text();
    if (!resp.ok) {
      return json(
        { error: "LLM request failed", status: resp.status, detail: raw.slice(0, 800) },
        500
      );
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return json({ error: "Bad LLM JSON", detail: raw.slice(0, 800) }, 500);
    }

    const summary =
      data?.output?.text ||
      data?.output?.choices?.[0]?.text ||
      data?.output?.choices?.[0]?.message?.content ||
      "";

    return json({ summary });
  },
};
