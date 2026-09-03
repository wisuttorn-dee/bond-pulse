import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.107.0/+esm'

const SUPABASE_URL = 'https://vzxxpsbpsqifpdejirxx.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_MM0stuYzn60rnZstXHJpgQ_bIBZUuPD'
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })

let pollId = null
let observer = null
let latestRows = []

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

async function fetchLeaderboard() {
  const host = getHostSession()
  if (!host || location.hash !== '#host') return
  const { data, error } = await supabase.rpc('bp_host_leaderboard', {
    p_room_id: host.roomId,
    p_host_token: host.hostToken,
  })
  if (!error) {
    latestRows = Array.isArray(data) ? data : []
    renderLeaderboard()
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

function renderLeaderboard() {
  if (location.hash !== '#host') return

  const shell = document.querySelector('.shell')
  if (!shell) return

  const hostGrid = document.querySelector('.host-grid')
  const finalPanel = !hostGrid ? document.querySelector('.panel h1')?.closest('.panel') : null
  const isLobby = Boolean(hostGrid?.querySelector('.room-code'))

  document.querySelectorAll('.instructor-leaderboard').forEach(el => el.remove())
  if (isLobby) return

  const section = document.createElement('section')
  section.className = 'panel instructor-leaderboard'

  if (hostGrid) {
    section.innerHTML = `
      <div class="leader-head">
        <div><h3>อันดับคะแนนผู้เล่น</h3><p>Live leaderboard เฉพาะหน้าจอผู้สอน</p></div>
        <span class="badge">ไม่ใช้ความเร็วตัดสิน</span>
      </div>
      <div class="leader-table leader-compact">
        <div class="leader-header"><span>อันดับ</span><span>ผู้เล่น</span><span>คะแนน</span><span>การตอบ</span><span>สถานะ</span></div>
        ${rowsHtml(latestRows, true)}
      </div>
      <div class="small">ผู้ที่คะแนนเท่ากันได้อันดับเดียวกัน คะแนนเรียงจากจำนวนข้อที่ตอบถูกเท่านั้น</div>
    `
    hostGrid.insertAdjacentElement('afterend', section)
  } else if (finalPanel) {
    section.innerHTML = `
      <div class="leader-head">
        <div><h2>สรุปลำดับคะแนนผู้เล่น</h2><p>ผลของห้องเกมครั้งนี้</p></div>
        <span class="badge">Final ranking</span>
      </div>
      <div class="leader-table">
        <div class="leader-header"><span>อันดับ</span><span>ผู้เล่น</span><span>คะแนน</span><span>การตอบ</span><span>สถานะ</span></div>
        ${rowsHtml(latestRows, false)}
      </div>
      <div class="small">กรณีคะแนนเท่ากัน ผู้เล่นได้อันดับเดียวกัน ไม่มีการใช้เวลาตอบเป็นตัวตัดสิน</div>
    `
    const takeaway = finalPanel.querySelector('.takeaway')
    if (takeaway) takeaway.insertAdjacentElement('beforebegin', section)
    else finalPanel.appendChild(section)
  }
}

function updateLandingCopy() {
  const small = document.querySelector('.menu .small')
  if (small && small.textContent.includes('ไม่มี leaderboard')) {
    small.textContent = 'ผู้เรียนใช้เพียง Room Code + ชื่อเล่น ไม่มีบัญชี ไม่แสดง leaderboard บนหน้าจอนักศึกษา และไม่คิดคะแนนจากความเร็ว'
  }
}

function begin() {
  if (observer) observer.disconnect()
  observer = new MutationObserver(() => {
    updateLandingCopy()
    if (location.hash === '#host') renderLeaderboard()
  })
  observer.observe(document.body, { childList: true, subtree: true })

  if (pollId) clearInterval(pollId)
  pollId = setInterval(fetchLeaderboard, 2000)
  fetchLeaderboard()
  updateLandingCopy()
}

window.addEventListener('hashchange', () => {
  latestRows = []
  if (location.hash === '#host') fetchLeaderboard()
})

begin()
