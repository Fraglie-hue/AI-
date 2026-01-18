export default async function handler(request) {
  if (request.method !== 'POST') {
  return new Response('Method Not Allowed', { status: 405 })
}

const { text, mode } = await request.json()

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
