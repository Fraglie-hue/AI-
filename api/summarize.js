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

function generateSmartSummary(cleanText, maxLen = 120) {
  const sentences =
    cleanText.match(/[^。！？.!?]+[。！？.!?]*/g) || []

  if (sentences.length === 0) return cleanText.slice(0, maxLen)

  // ===== 1️⃣ 段落拆分 & 首句索引 =====
  const paragraphs = cleanText.split(/\n+/).filter(Boolean)
  const paragraphFirstSentences = new Set()

  paragraphs.forEach(p => {
    const m = p.match(/[^。！？.!?]+[。！？.!?]*/)
    if (m) paragraphFirstSentences.add(m[0])
  })

  // ===== 2️⃣ 标题关键词（取首行）=====
  const titleLine = paragraphs[0] || ''
  const titleWords = titleLine
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1)

  // ===== 3️⃣ 词频 =====
  const words = cleanText
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1)

  const freq = {}
  for (const w of words) freq[w] = (freq[w] || 0) + 1

  // ===== 4️⃣ 句子打分 =====
  const scored = sentences.map((s, i) => {
    let score = 0

    // 高频词
    for (const w in freq) {
      if (s.includes(w)) score += freq[w]
    }

    // 标题关键词加权
    for (const w of titleWords) {
      if (s.includes(w)) score += 6
    }

    // 段落首句加权
    if (paragraphFirstSentences.has(s)) {
      score += 8
    }

    // 位置权重（弱化版）
    score += Math.max(0, 6 - i)

    // 总结信号词
    if (/(因此|总之|综上|可以看出|本文|主要|核心)/.test(s)) {
      score += 6
    }

    // 数字 / 英文信息
    if (/\d/.test(s)) score += 2
    if (/[A-Z]{2,}/.test(s)) score += 2

    // 长度惩罚
    if (s.length < 8) score -= 6
    if (s.length > 80) score -= 4

    return { s, score, i }
  })

  // ===== 5️⃣ 排序 + 选择（防重复）=====
  scored.sort((a, b) => b.score - a.score)

  const selected = []
  let summary = ''

  function isSimilar(a, b) {
    const len = Math.min(a.length, b.length)
    let same = 0
    for (let i = 0; i < len; i++) {
      if (a[i] === b[i]) same++
    }
    return same / len > 0.6
  }

  for (const item of scored) {
    if (summary.length + item.s.length > maxLen) continue

    // 防止选到高度相似句
    if (selected.some(x => isSimilar(x.s, item.s))) continue

    selected.push(item)
    summary += item.s
    if (summary.length >= maxLen) break
  }

  // ===== 6️⃣ 按原顺序拼接 =====
  selected.sort((a, b) => a.i - b.i)

  let result = selected.map(x => x.s).join('').trim()
  if (result.length < cleanText.length) result += ' ……'

  return result
}


function generateSummaryByMode(text, mode) {
  const cleanText = text.replace(/\n+/g, ' ').trim()
  if (!cleanText) return ''

  // ② 首段模式（保持原样）
  if (mode === 'first') {
    return cleanText.slice(0, 100) + (cleanText.length > 100 ? ' ……' : '')
  }

  // ③ 定长模式（保持原样）
  if (mode === 'length') {
    return cleanText.slice(0, 80) + (cleanText.length > 80 ? ' ……' : '')
  }

  // ===== ① 智能模式（升级版）=====
  if (mode === 'smart') {
  return generateSmartSummary(cleanText, 120)
}
  return cleanText
}
