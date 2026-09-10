// Lightweight host-side excitement layer. No Supabase calls and no extra realtime channels.
let lastAnswered = null
let lastMilestone = 0

function parseCounts() {
  const badge = [...document.querySelectorAll('.round-head .badge')].find(el => el.textContent?.includes('ตอบแล้ว'))
  if (!badge) return null
  const match = badge.textContent.match(/ตอบแล้ว\s*(\d+)\s*\/\s*(\d+)/)
  if (!match) return null
  return { answered: Number(match[1]), total: Number(match[2]) }
}

function waitingForAnswers() {
  if (location.hash !== '#host') return false
  const grid = document.querySelector('.host-grid')
  if (!grid || grid.querySelector('.room-code')) return false
  if (grid.querySelector('.reveal')) return false
  return Boolean(document.querySelector('#reveal'))
}

function messageFor(percent, remaining) {
  if (percent >= 100) return 'ครบแล้ว! พร้อมเฉลยได้เลย 🎉'
  if (percent >= 75) return `เกือบครบแล้ว เหลืออีก ${remaining} คน`
  if (percent >= 50) return `เกินครึ่งห้องแล้ว เหลืออีก ${remaining} คน`
  if (percent >= 25) return `คำตอบกำลังเข้ามาเรื่อย ๆ เหลืออีก ${remaining} คน`
  return 'กำลังรับคำตอบจากทั้งห้อง'
}

function makeBurst(container) {
  const burst = document.createElement('div')
  burst.className = 'energy-burst'
  burst.innerHTML = '<span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>'
  container.appendChild(burst)
  setTimeout(() => burst.remove(), 1100)
}

function currentMilestone(percent) {
  if (percent >= 100) return 100
  if (percent >= 75) return 75
  if (percent >= 50) return 50
  if (percent >= 25) return 25
  return 0
}

function enhance() {
  const existing = document.querySelector('.answer-energy')
  if (!waitingForAnswers()) {
    if (existing) existing.remove()
    lastAnswered = null
    lastMilestone = 0
    return
  }

  const counts = parseCounts()
  const grid = document.querySelector('.host-grid')
  const mainPanel = grid?.querySelector('.panel')
  if (!counts || !mainPanel) return

  const percent = counts.total ? Math.min(100, Math.round((counts.answered / counts.total) * 100)) : 0
  const remaining = Math.max(0, counts.total - counts.answered)
  let card = existing

  if (!card) {
    card = document.createElement('section')
    card.className = 'answer-energy'
    const roundHead = mainPanel.querySelector('.round-head')
    if (roundHead) roundHead.insertAdjacentElement('afterend', card)
    else mainPanel.prepend(card)
  }

  card.innerHTML = `
    <div class="answer-energy-inner">
      <div class="energy-ring" style="--p:${percent}">
        <div class="energy-count"><strong>${counts.answered}</strong><span>จาก ${counts.total} คน</span></div>
      </div>
      <div class="energy-copy">
        <div class="energy-live"><span class="energy-live-dot"></span> LIVE <span class="energy-dots"><i></i><i></i><i></i></span></div>
        <h3>กำลังรับคำตอบ...</h3>
        <div class="energy-message">${messageFor(percent, remaining)}</div>
        <div class="energy-sub">${percent}% ของผู้เล่นส่งคำตอบแล้ว</div>
        <div class="energy-mini-track"><div class="energy-mini-fill" style="width:${percent}%"></div></div>
      </div>
    </div>`

  if (lastAnswered !== null && counts.answered > lastAnswered) {
    card.classList.remove('bump')
    void card.offsetWidth
    card.classList.add('bump')
  }

  const milestone = currentMilestone(percent)
  if (milestone > lastMilestone && milestone >= 25) {
    makeBurst(card)
    lastMilestone = milestone
  }
  lastAnswered = counts.answered
}

// Host state already refreshes once per second. This timer only inspects the local DOM.
setInterval(enhance, 350)
window.addEventListener('hashchange', () => {
  lastAnswered = null
  lastMilestone = 0
  setTimeout(enhance, 50)
})
setTimeout(enhance, 50)
