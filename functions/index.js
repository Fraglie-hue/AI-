// functions/index.js

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

function generateSummaryByMode(text, mode) {
  const cleanText = text.replace(/\n+/g, " ").trim();
  if (!cleanText) return "";

  // 智能模式（规则）
  if (mode === "smart") {
    const sentences = cleanText.match(/[^。！？.!?]+[。！？.!?]*/g) || [];
    let summary = "";
    for (const s of sentences) {
      if ((summary + s).length > 120) break;
      summary += s;
    }
    if (summary.length < cleanText.length) {
      summary = summary.trim() + " ……";
    }
    return summary;
  }

  // 首段模式
  if (mode === "first") {
    return cleanText.slice(0, 100) + (cleanText.length > 100 ? " ……" : "");
  }

  // 定长模式
  if (mode === "length") {
    return cleanText.slice(0, 80) + (cleanText.length > 80 ? " ……" : "");
  }

  return cleanText;
}

export default {
  async fetch(request) {
    try {
      const url = new URL(request.url);

      if (url.pathname !== "/api/summarize") {
        return new Response("Not Found", { status: 404 });
      }

      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
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

      const text = (body.text || "").trim();
      const mode = body.mode || "smart";

      if (!text) {
        return json({ summary: "" });
      }

      const summary = generateSummaryByMode(text, mode);
      return json({ summary });
    } catch (e) {
      return json(
        { error: "Edge runtime error", detail: String(e?.message || e) },
        500
      );
    }
  },
};

