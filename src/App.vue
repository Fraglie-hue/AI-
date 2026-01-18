<script setup>
import { computed, ref, watch } from 'vue'
// 主题模式
const theme = ref(localStorage.getItem('edge-note-theme') || 'light')
const hoverId = ref(null)
const sortedNotes = computed(() =>
  [...notes.value].sort((a, b) => b.updatedAt - a.updatedAt)
)


watch(theme, (val) => {
  localStorage.setItem('edge-note-theme', val)
})

// 摘要模式
const summaryMode = ref('smart')
const summary = ref('')
// 可选值：smart | first | length

const showGuide = ref(!localStorage.getItem('edge-note-guide-seen'))

function closeGuide() {
  showGuide.value = false
  localStorage.setItem('edge-note-guide-seen', '1')
}


// 是否显示摘要对比
const showCompare = ref(false)
const highlightChunks = computed(() => {
  if (!showCompare.value) return []

  const text = content.value
  const summaryText = summary.value

  if (!text || !summaryText) {
    return [{ text, highlight: false }]
  }

  // 取摘要中的有效句子
  const parts = summaryText
    .replace(/……/g, '')
    .split(/[。！？.!?]/)
    .map(s => s.trim())
    .filter(s => s.length > 6 && text.includes(s))

  let chunks = [{ text, highlight: false }]

  parts.forEach(part => {
    const newChunks = []

    chunks.forEach(chunk => {
      if (chunk.highlight) {
        newChunks.push(chunk)
        return
      }

      const pieces = chunk.text.split(part)

      if (pieces.length === 1) {
        newChunks.push(chunk)
      } else {
        pieces.forEach((p, i) => {
          if (p) {
            newChunks.push({ text: p, highlight: false })
          }
          if (i < pieces.length - 1) {
            newChunks.push({ text: part, highlight: true })
          }
        })
      }
    })

    chunks = newChunks
  })

  return chunks
})


const STORAGE_KEY = 'edge-note-notes'

// 生成一个简单的 id
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// 从本地读取
function loadNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

// 初始化：如果本地没数据，就给一条默认笔记
const notes = ref(loadNotes())
if (notes.value.length === 0) {
  notes.value = [
    { id: uid(), 
      title: '第一条笔记', 
      manualTitle: false,  
      content: '你好，Edge Note！\n你可以新建、切换、删除笔记。', 
      updatedAt: Date.now() },
  ]
}

const activeId = ref(notes.value[0]?.id || '')
const editingTitle = ref(false)
const tempTitle = ref('')

function startEditTitle() {
  if (!activeNote.value) return
  editingTitle.value = true
  tempTitle.value = activeNote.value.title || ''
}

function saveTitle() {
  if (!activeNote.value) return
  activeNote.value.title = (tempTitle.value || '（无标题）').slice(0, 20)
  activeNote.value.manualTitle = true
  activeNote.value.updatedAt = Date.now()
  editingTitle.value = false
}


// 自动保存到本地
watch(
  notes,
  (val) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
    } catch (e) {
      alert('本地存储已满，建议删除部分笔记')
    }
  },
  { deep: true }
)

// 当前选中的笔记
const activeNote = computed(() => notes.value.find((n) => n.id === activeId.value))

// 编辑区绑定的内容（通过 computed 双向绑定）
const content = computed({
  get() {
    return activeNote.value?.content ?? ''
  },
  set(v) {
    if (!activeNote.value) return
    activeNote.value.content = v
    // ⭐ 只有在“未手动修改标题”时，才自动生成
    if (!activeNote.value.manualTitle) {
      const firstLine = (v.split('\n')[0] || '').trim()
      activeNote.value.title = firstLine
        ? firstLine.slice(0, 12)
        : '（无标题）'
  }

  activeNote.value.updatedAt = Date.now()
  },
})

function createNote() {
  const n = { 
    id: uid(), 
    title: '（无标题）', 
    manualTitle: false,  
    content: '', 
    updatedAt: Date.now() }
  notes.value.unshift(n)
  activeId.value = n.id
}

function deleteActive() {
  if (!activeNote.value) return
  const ok = confirm(`确定删除「${activeNote.value.title}」吗？`)
  if (!ok) return
  const idx = notes.value.findIndex((n) => n.id === activeId.value)
  notes.value.splice(idx, 1)
  if(notes.value.length === 0){
    createNote()        // 👈 自动新建一条空笔记
  } else {
    activeId.value = notes.value[0].id
  }

}

function formatTime(ts) {
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}


// 摘要生成函数
async function fetchSummary() {
  try {
    const text = content.value.trim()
    if (!text) {
      summary.value = ''
      return
    }

// ✅ 本地开发环境兜底
    if (import.meta.env.DEV) {
      summary.value = text.slice(0, 100)
      return
    }

    const res = await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        mode: summaryMode.value
      })
    })

    const raw = await res.text()

    if (!res.ok) {
  // 这里会把 599/500 的返回内容吐出来（通常就是报错堆栈）
      throw new Error(`HTTP ${res.status}: ${raw.slice(0, 300)}`)
    }

    let data
    try {
      data = JSON.parse(raw)
    } catch {
      throw new Error(`Response is not JSON: ${raw.slice(0, 300)}`)
    }

    summary.value = data?.summary ?? ''

  } catch (e) {
    console.error('摘要生成失败', e)
    summary.value = '摘要生成失败，请稍后重试'
  }
}


let timer = null

watch([content, summaryMode], () => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    fetchSummary()
  }, 300)
})



// 创建新笔记（包括摘要）
async function createNoteFromSummary() {
  try {
    // 确保摘要是最新的
    await fetchSummary()

    if (!summary.value) {
      alert('摘要为空，无法创建新笔记')
      return
    }

    createNote()
    content.value = summary.value
  } catch (e) {
    console.error(e)
    alert('生成摘要失败，无法创建新笔记')
  }
}


async function copySummary() {
  if (!summary.value) return
  try {
    await navigator.clipboard.writeText(summary.value)
    alert('摘要已复制到剪贴板')
  } catch (e) {
    alert('复制失败：请手动选中摘要内容复制（可能是浏览器权限限制）')
  }
}


function exportNote(type = 'md') {
  if (!activeNote.value) return

  let content = ''
  let filename = (activeNote.value.title || 'note')
  .replace(/[\\/:*?"<>|]/g, '_')
  .trim()


  if (type === 'md') {
    content = `# ${activeNote.value.title}

    > 导出时间：${new Date().toLocaleString()}

    ${activeNote.value.content}
    `

    filename += '.md'
  } else {
    content = activeNote.value.content
    filename += '.txt'
  }

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()

  URL.revokeObjectURL(url)
}


</script>


<template>
 <div
  :style="{
    fontFamily: 'system-ui',
    height: '100vh',
    display: 'flex',
    background: theme === 'dark' ? '#0f172a' : '#f6f7fb',
    color: theme === 'dark' ? '#e5e7eb' : '#111827',
    transition: 'all 0.25s ease'
  }"
>

    <!-- 左侧列表 -->
    <aside
      :style="{
        width: '260px',
        borderRight: theme === 'dark' ? '1px solid #1e293b' : '1px solid #eee',
        padding: '16px',
        boxSizing: 'border-box',
        overflow: 'auto',
        background: theme === 'dark' ? '#020617' : '#ffffff',
        transition: 'all 0.25s ease'
      }"
    >

      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <h2 style="margin:0;">Edge Note</h2>
        <button
          @click="createNote"
          style="
            margin-top: 12px;
            padding: 12px 18px;
            background: linear-gradient(135deg, #4CAF50, #43a047);
            color: white;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            font-size: 15px;
            box-shadow: 0 6px 12px rgba(76,175,80,0.3);
          "
        >


          + 空白笔记
        </button>
      </div>

      <div style="margin-top: 12px; color:#666; font-size:12px;">
        共 {{ notes.length }} 条
      </div>

      <div style="margin-top: 12px; display:flex; flex-direction:column; gap:8px;">
        <button
          v-for="n in sortedNotes"
          :key="n.id"
          @mouseenter="hoverId = n.id"
          @mouseleave="hoverId = null"
          @click="activeId = n.id"
          :style="{
            textAlign: 'left',
            padding: '10px',
            border: '1px solid #eee',
            background: 
              n.id === activeId 
                ? (theme === 'dark' ? '#1e293b' : '#eef2ff')
                : (theme === 'dark' ? '#020617' : '#fff'),
            boxShadow: 
              n.id === activeId
                ? '0 4px 10px rgba(80,100,255,0.15)'
                : n.id === hoverId
                  ? '0 4px 10px rgba(0,0,0,0.06)'
                  : 'none',
            
            transform:
              n.id === activeId
                ? 'translateY(-2px)'
                : 'translateY(0)',

            transition: 'all 0.2s ease',
          }"
        >
          <div style="font-weight: 600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            {{ n.title }}
          </div>
          <div style="font-size: 12px; color:#888; margin-top:4px;">
            {{ formatTime(n.updatedAt) }}
          </div>
        </button>
      </div>
    </aside>

    <!-- 右侧编辑 -->
    <main
      :style="{
        flex: 1,
        padding: '24px',
        boxSizing: 'border-box',
        overflow: 'auto',
        maxWidth: '900px',
        margin: '16px',
        background: theme === 'dark' ? '#020617' : 'white',
        borderRadius: '16px',
        boxShadow:
          theme === 'dark'
            ? '0 10px 30px rgba(0,0,0,0.6)'
            : '0 10px 30px rgba(0,0,0,0.06)',
        transition: 'all 0.25s ease',
      }"
    >


      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <div>
          <div style="display:flex; align-items:center; gap:8px;">
            <h1 v-if="!editingTitle" style="margin:0 0 6px;">
              {{ activeNote?.title || '（无笔记）' }}
            </h1>

        <input
          v-else
          v-model="tempTitle"
          style="padding:6px 8px; border:1px solid #ddd; border-radius:8px;"
          />

      <button
        v-if="activeNote && !editingTitle"
        @click="startEditTitle"
        style="padding:6px 10px; border:1px solid #ddd; border-radius:8px; cursor:pointer;"
      >
        ✏️ 改标题
      </button>

      <button
        v-if="activeNote && editingTitle"
        @click="saveTitle"
        style="padding:6px 10px; border:1px solid #ddd; border-radius:8px; cursor:pointer;"
      >
        ✅ 保存
      </button>
    </div>

          <div style="color:#888; font-size:12px;">
            最后修改：{{ activeNote ? formatTime(activeNote.updatedAt) : '-' }}
          </div>
        </div>

        
      <button
        @click="exportNote('md')"
        style="padding:6px 10px; border:1px solid #ddd; border-radius:6px; cursor:pointer;"
      >
        导出 MD
      </button>

      <button
        @click="exportNote('txt')"
        style="padding:6px 10px; border:1px solid #ddd; border-radius:6px; cursor:pointer;"
      >
        导出 TXT
      </button>

      <button
        @click="deleteActive"
        :disabled="notes.length === 0"
        style="padding: 8px 12px; border: 1px solid #f1c0c0; background: #fff5f5; cursor: pointer; border-radius: 8px;"
      >
        删除
      </button>
    </div>


      <button
        @click="theme = theme === 'dark' ? 'light' : 'dark'"
        style="
          padding: 6px 10px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          background: rgba(0,0,0,0.05);
        "
      >
        {{ theme === 'dark' ? '☀️ 浅色' : '🌙 深色' }}
      </button>

      <!-- 摘要生成面板 -->
      <div style="margin-top: 20px;">
      <div style="margin-bottom: 10px;">
        <label style="font-size: 14px; color: #555;">摘要模式：</label>
        <select v-model="summaryMode" style="margin-left: 8px; padding: 4px;">
          <option value="smart">智能摘要</option>
          <option value="first">首段摘要</option>
          <option value="length">定长摘要</option>
        </select>
        <span style="margin-left:10px; font-size:12px; color:#888;">
          当前模式：
          {{
            summaryMode === 'smart'
              ? '智能语义提取'
              : summaryMode === 'first'
                ? '首段内容摘要'
                : '固定长度截取'
          }}
        </span>

        </div>
        <textarea
          v-model="content"
          rows="8"
          placeholder="在这里粘贴你的文章内容..."
          style="width: 100%; padding: 12px; font-size: 16px; box-sizing: border-box;"
        ></textarea>
        <button
          @click="createNoteFromSummary"
          style="margin-top: 12px; padding: 10px 15px; background-color: #4CAF50; color: white; border: none; cursor: pointer;"
        >
          生成摘要并保存为新笔记
        </button>
      </div>
        <div style="margin-top: 10px;">
          <label style="font-size: 14px; cursor: pointer;">
            <input type="checkbox" v-model="showCompare" />
            显示摘要对比
          </label>
      </div>


      <div style="margin-top: 18px;">
      <!-- 标题 + 操作按钮 -->
        <div
          style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
         "
        >
          <h3 style="margin: 0;">摘要内容</h3>

          <button
            @click="copySummary"
            style="
              padding: 4px 8px;
              font-size: 12px;
              border-radius: 6px;
              border: 1px solid #ddd;
              cursor: pointer;
              background: white;
            "
          >
            📋 复制摘要
          </button>
        </div>

  <!-- 摘要卡片（你原来的，不动） -->
  <div
    :style="{
      padding: '16px',
      borderRadius: '12px',
      background:
        theme === 'dark'
          ? 'linear-gradient(135deg, #020617, #1e293b)'
          : 'linear-gradient(135deg, #f8fafc, #eef2ff)',
      border: '1px solid #e5e7eb',
      minHeight: '60px',
      whiteSpace: 'pre-wrap',
      fontSize: '15px',
      lineHeight: 1.6,
      transition: 'all 0.25s ease',
    }"
  >
    {{ summary || '请输入内容后生成摘要' }}
  </div>




        <div
          v-if="showCompare"
          style="
            margin-top: 12px;
            padding: 12px;
            border: 1px dashed #ddd;
            background: #f8fafc;
            white-space: pre-wrap;
            color: #666;
          "
        >
          <strong>原文：</strong><br />
          <div>
            <span
              v-for="(chunk, index) in highlightChunks"
              :key="index"
          >
            <mark
              v-if="chunk.highlight"
              class="highlight"
            >
              {{ chunk.text }}
            </mark>
            <span v-else>
              {{ chunk.text }}
            </span>
          </span>
        </div>

        </div>
      </div>
    </main>

    <div
  v-if="showGuide"
  style="
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
  "
>
  <div
    style="
      background: white;
      padding: 24px;
      border-radius: 16px;
      max-width: 420px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.2);
    "
  >
    <h2>👋 欢迎使用 Edge Note</h2>
    <p style="color:#555; line-height:1.6;">
      这是一个支持文章摘要、摘要对比、高亮关键词和深色模式的轻量笔记工具。
    </p>
    <p style="color:#777; font-size:14px;">
      试试粘贴一段文章，生成摘要吧～
    </p>
    <button
      @click="closeGuide"
      style="
        margin-top: 16px;
        padding: 10px 18px;
        border-radius: 8px;
        border: none;
        background: #4CAF50;
        color: white;
        cursor: pointer;
      "
    >
      我知道了
    </button>
  </div>
</div>


  </div>
</template>

<style scoped>
.highlight {
  background: linear-gradient(135deg, #fde68a, #facc15);
  padding: 0 4px;
  border-radius: 4px;
}
</style>
