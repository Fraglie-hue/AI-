// functions/index.js

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      // ===== 1️⃣ 只允许 /api/summarize =====
      if (url.pathname !== "/api/summarize") {
        return new Response("Not Found", { status: 404 });
      }

      // ===== 2️⃣ CORS 预检 =====
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

      // ===== 3️⃣ 只允许 POST =====
      if (request.method !== "POST") {
        return json({ error: "Method Not Allowed" }, 405);
      }

      // ===== 4️⃣ 读取请求体 =====
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON" }, 400);
      }

      const text = (body.text || "").trim();
      if (!text) {
        return json({ error: "text is required" }, 400);
      }

      // ===== 5️⃣ 读取 ESA 环境变量（关键）=====
      const apiKey = env.DASHSCOPE_API_KEY;
      if (!apiKey) {
        return json({ error: "Missing DASHSCOPE_API_KEY" }, 500);
      }

      // ===== 6️⃣ 调用通义千问 =====
      const resp = await fetch(
        "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "qwen-turbo",
            input: {
              prompt: `请将下面内容生成 80-150 字的中文摘要，并列出 3 个要点：\n${text}`,
            },
            parameters: {
              temperature: 0.3,
              max_tokens: 400,
            },
          }),
        }
      );

      const raw = await resp.text();
      if (!resp.ok) {
        return json({ error: "LLM request failed", detail: raw }, 500);
      }

      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        return json({ error: "Bad LLM JSON", raw }, 500);
      }

      const summary =
        data?.output?.text ||
        data?.output?.choices?.[0]?.text ||
        "";

      return json({ summary });
    } catch (e) {
      // ===== 7️⃣ 终极兜底 =====
      return json(
        { error: "Edge runtime error", detail: String(e?.message || e) },
        500
      );
    }
  },
};
