export default async function handler(request) {
  try {
    // 1️⃣ 方法校验
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method Not Allowed' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 2️⃣ JSON 解析兜底（核心）
    let body
    try {
      body = await request.json()
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { text = '', mode = 'smart' } = body

    if (!text) {
      return new Response(
        JSON.stringify({ summary: '' }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    const summary = generateSummaryByMode(text, mode)

    return new Response(
      JSON.stringify({ summary }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    // 3️⃣ 终极兜底：永远不要让异常冒泡到 ESA
    return new Response(
      JSON.stringify({
        error: String(e?.message || e)
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

function generateSummaryByMode(text, mode) {
  const cleanText = text.replace(/\n+/g, ' ')
  if (!cleanText) return ''

  // ① 智能模式
  if (mode === 'smart') {
    const sentences = cleanText.match(/[^。！？.!?]+[。！？.!?]*/g) || []
    let summary = ''
    for (const s of sentences) {
      if ((summary + s).length > 120) break
      summary += s
    }
    if (summary.length < cleanText.length) {
      summary = summary.trim() + ' ……'
    }
    return summary
  }

  // ② 首段模式
  if (mode === 'first') {
    return cleanText.slice(0, 100) + (cleanText.length > 100 ? ' ……' : '')
  }

  // ③ 长度限制模式
  if (mode === 'length') {
    return cleanText.slice(0, 80) + (cleanText.length > 80 ? ' ……' : '')
  }

  return cleanText
}
