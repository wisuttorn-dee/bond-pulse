import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.107.0/+esm'

const SUPABASE_URL = 'https://vzxxpsbpsqifpdejirxx.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_MM0stuYzn60rnZstXHJpgQ_bIBZUuPD'
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })

let latestRows = []
let lastFetchedKey = null
let activeKey = null
let fetchInFlight = false
let observer = null

function esc(value='') {
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))
}

function getHostSession() {
  try {
    const raw = sessionStorage.getItem('bp_host')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function medal(rank) {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return String(rank)
}

function rowsHtml(rows, compact=false) {
  if (!rows.length) return '<div class="leader-empty">ยังไม่มีคะแนน</div>'
  const visible = compact ? rows.slice(0, 10) : rows
  return visible.map(row => `
    <div class="leader-row ${Number(row.rank) <= 3 ? 'leader-top' : ''}">
      <span class="leader-rank">${medal(Number(row.rank))}</span>
      <span class="leader-name">${esc(row.nickname)}</span>
      <span class="leader-score"><strong>${Number(row.score)}</strong>/5</span>
      <span class="leader-progress">ตอบ ${Number(row.answered)}/5</span>
      <span class="leader-status">${row.completed ? '✓ เล่นครบ' : 'กำลังเล่น'}</span>
    </div>
  `).join('') + (compact && rows.length > 10 ? `<div class="leader-more">และอีก ${rows.length - 10} คน</div>` : '')
}

function removeLeaderboard() {
  document.querySelectorAll('.instructor-leaderboard').forEach(el => el.remove())
}

function updateLandingCopy() {
  const small = document.querySelector('.menu .small')
  if (small && small.textContent.includes('ไม่มี leaderboard')) {
    small.textContent = 'ผู้เรียนใช้เพียง Room Code + ชื่อเล่น ไม่มีบัญชี ไม่แสดง Ranking บนหน้าจอนักศึกษา และไม่คิดคะแนนจากความเร็ว'
  }
}

function detectHostState() {
  if (location.hash !== '#host') return { key: null, mode: null }

  const hostGrid = document.querySelector('.host-grid')
  if (hostGrid) {
    if (hostGrid.querySelector('.room-code')) return { key: null, mode: null }
    const reveal = hostGrid.querySelector('.reveal')
    if (!reveal) return { key: null, mode: null }
    const roundText = hostGrid.querySelector('.round-no')?.textContent?.trim() || 'round'
    return { key: `revealed:${roundText}`, mode: 'round', hostGrid }
  }

  const headings = [...document.querySelectorAll('.panel h1')]
  const finalHeading = headings.find(h => h.textContent?.includes('สรุปผลทั้งห้อง'))
  if (finalHeading) return { key: 'final', mode: 'final', finalPanel: finalHeading.closest('.panel') }

  return { key: null, mode: null }
}

function renderLeaderboard(state) {
  if (!state?.key || !latestRows.length && lastFetchedKey !== state.key) return
  if (document.querySelector('.instructor-leaderboard')) return

  const section = document.createElement('section')
  section.className = 'panel instructor-leaderboard'

  if (state.mode === 'round' && state.hostGrid) {
    section.innerHTML = `
      <div class="leader-head">
        <div><h3>Ranking หลังเฉลย</h3><p>คะแนนสะสม ณ สิ้นรอบนี้</p></div>
        <span class="badge">ไม่ใช้ความเร็วตัดสิน</span>
      </div>
      <div class="leader-table leader-compact">
        <div class="leader-header"><span>อันดับ</span><span>ผู้เล่น</span><span>คะแนน</span><span>การตอบ</span><span>สถานะ</span></div>
        ${rowsHtml(latestRows, true)}
      </div>
      <div class="small">Ranking จะแสดงเฉพาะหลังผู้สอนกดเฉลย และจะหายเมื่อเริ่มรอบถัดไป</div>
    `
    state.hostGrid.insertAdjacentElement('afterend', section)
    return
  }

  if (state.mode === 'final' && state.finalPanel) {
    section.innerHTML = `
      <div class="leader-head">
        <div><h2>Final Ranking</h2><p>สรุปลำดับคะแนนของห้องเกมครั้งนี้</p></div>
        <span class="badge">Final result</span>
      </div>
      <div class="leader-table">
        <div class="leader-header"><span>อันดับ</span><span>ผู้เล่น</span><span>คะแนน</span><span>การตอบ</span><span>สถานะ</span></div>
        ${rowsHtml(latestRows, false)}
      </div>
      <div class="small">กรณีคะแนนเท่ากัน ผู้เล่นได้อันดับเดียวกัน และไม่ใช้เวลาตอบเป็นตัวตัดสิน</div>
    `
    const takeaway = state.finalPanel.querySelector('.takeaway')
    if (takeaway) takeaway.insertAdjacentElement('beforebegin', section)
    else state.finalPanel.appendChild(section)
  }
}

async function fetchLeaderboardOnce(state) {
  if (!state?.key || fetchInFlight) return
  const host = getHostSession()
  if (!host) return

  fetchInFlight = true
  const requestedKey = state.key
  try {
    const { data, error } = await supabase.rpc('bp_host_leaderboard', {
      p_room_id: host.roomId,
      p_host_token: host.hostToken,
    })
    if (error) return

    latestRows = Array.isArray(data) ? data : []
    lastFetchedKey = requestedKey

    const currentState = detectHostState()
    if (currentState.key === requestedKey) renderLeaderboard(currentState)
  } finally {
    fetchInFlight = false
  }
}

function syncRankingVisibility() {
  updateLandingCopy()
  const state = detectHostState()

  if (!state.key) {
    activeKey = null
    removeLeaderboard()
    return
  }

  activeKey = state.key

  // The host screen itself re-renders periodically. Reinsert the already-fetched
  // snapshot without querying Supabase again.
  if (lastFetchedKey === state.key) {
    renderLeaderboard(state)
    return
  }

  removeLeaderboard()
  fetchLeaderboardOnce(state)
}

function begin() {
  if (observer) observer.disconnect()
  observer = new MutationObserver(() => syncRankingVisibility())
  observer.observe(document.querySelector('#app') || document.body, { childList: true, subtree: true })
  syncRankingVisibility()
}

window.addEventListener('hashchange', () => {
  latestRows = []
  lastFetchedKey = null
  activeKey = null
  removeLeaderboard()
  setTimeout(syncRankingVisibility, 50)
})

begin()
