<script setup>
import { computed, ref, watch } from 'vue'

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
    { id: uid(), title: '第一条笔记', content: '你好，Edge Note！\n你可以新建、切换、删除笔记。', updatedAt: Date.now() },
  ]
}

const activeId = ref(notes.value[0]?.id || '')

// 自动保存到本地
watch(
  notes,
  (val) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
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
    // 自动生成标题：取第一行前 12 个字
    const firstLine = (v.split('\n')[0] || '').trim()
    activeNote.value.title = firstLine ? firstLine.slice(0, 12) : '（无标题）'
    activeNote.value.updatedAt = Date.now()
  },
})

function createNote() {
  const n = { id: uid(), title: '（无标题）', content: '', updatedAt: Date.now() }
  notes.value.unshift(n)
  activeId.value = n.id
}

function deleteActive() {
  if (!activeNote.value) return
  const ok = confirm(`确定删除「${activeNote.value.title}」吗？`)
  if (!ok) return
  const idx = notes.value.findIndex((n) => n.id === activeId.value)
  notes.value.splice(idx, 1)
  activeId.value = notes.value[0]?.id || ''
}

function formatTime(ts) {
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 摘要生成函数
function generateSummary() {
  const text = content.value.trim()
  if (!text) return ''

  // 1️⃣ 按中文/英文句号拆分
  const sentences = text
    .replace(/\n+/g, ' ')
    .split(/(?<=[。！？.!?])/)

  // 2️⃣ 取前 2～3 句作为摘要
  let summary = ''
  for (const s of sentences) {
    if ((summary + s).length > 120) break
    summary += s
  }

  // 3️⃣ 如果原文更长，补省略号
  if (summary.length < text.length) {
    summary = summary.trim() + ' ……'
  }

  return summary
}


// 创建新笔记（包括摘要）
function createNoteFromSummary() {
  const summary = generateSummary()
  createNote()
  content.value = summary
}
</script>

<template>
  <div style="font-family: system-ui; height: 100vh; display: flex;">
    <!-- 左侧列表 -->
    <aside
      style="
        width: 260px;
        border-right: 1px solid #eee;
        padding: 16px;
        box-sizing: border-box;
        overflow: auto;
      "
    >
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <h2 style="margin:0;">Edge Note</h2>
        <button
          @click="createNote"
          style="padding: 6px 10px; border: 1px solid #ccc; background: white; cursor: pointer;"
        >
          + 新建
        </button>
      </div>

      <div style="margin-top: 12px; color:#666; font-size:12px;">
        共 {{ notes.length }} 条
      </div>

      <div style="margin-top: 12px; display:flex; flex-direction:column; gap:8px;">
        <button
          v-for="n in notes"
          :key="n.id"
          @click="activeId = n.id"
          :style="{
            textAlign: 'left',
            padding: '10px',
            border: '1px solid #eee',
            background: n.id === activeId ? '#f3f7ff' : 'white',
            cursor: 'pointer',
            borderRadius: '8px',
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
    <main style="flex: 1; padding: 24px; box-sizing: border-box; overflow:auto; max-width: 900px;">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <div>
          <h1 style="margin:0 0 6px;">{{ activeNote?.title || '（无笔记）' }}</h1>
          <div style="color:#888; font-size:12px;">
            最后修改：{{ activeNote ? formatTime(activeNote.updatedAt) : '-' }}
          </div>
        </div>

        <button
          @click="deleteActive"
          :disabled="notes.length === 0"
          style="padding: 8px 12px; border: 1px solid #f1c0c0; background: #fff5f5; cursor: pointer; border-radius: 8px;"
        >
          删除
        </button>
      </div>

      <!-- 摘要生成面板 -->
      <div style="margin-top: 20px;">
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

      <div style="margin-top: 18px;">
        <h3 style="margin: 0 0 8px;">摘要内容</h3>
        <div style="padding: 12px; border: 1px solid #eee; min-height: 60px; white-space: pre-wrap;">
          {{ generateSummary() }}
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
</style>
