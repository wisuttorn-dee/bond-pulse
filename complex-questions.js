// Complex Bond Pulse question layer.
// Safe shuffle: questions only swap with another question that has the same
// correct answer category, so the existing backend scoring remains unchanged.

const complexQuestions = {
  1: {
    coupon: '5%',
    rate: 'Coupon 5% • Market Rate 7%',
    text: 'พันธบัตรเดิมจ่าย Coupon 5% ต่อปี แต่หลังจากธนาคารกลางขึ้นดอกเบี้ย พันธบัตรใหม่ที่มีความเสี่ยงและอายุคงเหลือใกล้เคียงกันให้ผลตอบแทน 7% ราคาพันธบัตรเดิมควรเปลี่ยนแปลงอย่างไร?',
    explanation: 'Coupon 5% ต่ำกว่าผลตอบแทนตลาด 7% พันธบัตรเดิมจึงน่าสนใจน้อยลง ราคาต้องลดลงเพื่อให้ผลตอบแทนแข่งขันกับตลาดได้ จึงเป็น Discount Bond'
  },
  2: {
    coupon: '6%',
    rate: 'Coupon 6% • Required Return 4%',
    text: 'พันธบัตรเดิมจ่าย Coupon 6% ต่อปี ขณะที่อัตราผลตอบแทนที่นักลงทุนต้องการลดจาก 6% เหลือ 4% หากความเสี่ยงและอายุคงเหลือไม่เปลี่ยน ราคาพันธบัตรเดิมควรเป็นอย่างไร?',
    explanation: 'Coupon 6% สูงกว่า Required Return 4% กระแสเงินสดของพันธบัตรเดิมจึงมีความน่าสนใจมากขึ้น นักลงทุนยอมจ่ายสูงกว่า Par Value จึงเป็น Premium Bond'
  },
  3: {
    coupon: '5%',
    rate: 'Par 1,000 • Coupon 5% • Market Rate 5%',
    text: 'บริษัทมีพันธบัตรมูลค่าที่ตราไว้ 1,000 บาท จ่าย Coupon 5% และปัจจุบัน Market Rate ของพันธบัตรที่มีความเสี่ยงใกล้เคียงกันเท่ากับ 5% พอดี ราคาพันธบัตรควรใกล้เคียงเท่าใด?',
    explanation: 'เมื่อ Coupon Rate เท่ากับ Market Rate มูลค่าปัจจุบันของกระแสเงินสดจะทำให้ราคาพันธบัตรอยู่ใกล้ Par Value หรือประมาณ 1,000 บาท จึงเป็น Par Bond'
  },
  4: {
    coupon: '4%',
    rate: 'Coupon 4% • Required Return 4% → 6%',
    text: 'นักลงทุนถือพันธบัตร Coupon 4% อยู่ แล้วมีข่าวว่าเงินเฟ้อสูงกว่าคาด ทำให้ตลาดปรับ Required Return ของพันธบัตรลักษณะเดียวกันจาก 4% เป็น 6% ราคาพันธบัตรเดิมมีแนวโน้มอย่างไร?',
    explanation: 'Required Return ที่สูงขึ้นทำให้มูลค่าปัจจุบันของดอกเบี้ยและเงินต้นในอนาคตลดลง ดังนั้นราคาพันธบัตรเดิมจึงลดลงและซื้อขายต่ำกว่า Par Value'
  },
  5: {
    coupon: '7%',
    rate: 'Coupon 7% • Market Rate 6% → 4%',
    text: 'นักลงทุนถือพันธบัตร Coupon 7% และคาดว่า Market Rate จะลดจาก 6% เหลือ 4% ในระยะใกล้ หากการคาดการณ์นี้เกิดขึ้นจริง ราคาพันธบัตรที่ถืออยู่มีแนวโน้มอย่างไร?',
    explanation: 'เมื่อ Market Rate ลดลง Coupon 7% ของพันธบัตรเดิมยิ่งน่าสนใจเมื่อเทียบกับพันธบัตรออกใหม่ นักลงทุนจึงยอมจ่ายราคาสูงขึ้นและพันธบัตรมีแนวโน้มเป็น Premium Bond'
  }
}

const safeOrders = [
  [1,2,3,4,5],
  [4,2,3,1,5],
  [1,5,3,4,2],
  [4,5,3,1,2]
]

function getRoomCode() {
  for (const key of ['bp_host','bp_player']) {
    try {
      const raw = sessionStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      if (parsed?.code) return String(parsed.code)
    } catch {}
  }
  return null
}

function getRoundNumber() {
  const text = document.querySelector('.round-no')?.textContent || ''
  const m = text.match(/รอบ\s*(\d+)/)
  return m ? Number(m[1]) : null
}

function questionForCurrentRound() {
  const code = getRoomCode()
  const round = getRoundNumber()
  if (!code || !round || round < 1 || round > 5) return null
  const lastDigit = Number(code.slice(-1)) || 0
  const order = safeOrders[lastDigit % safeOrders.length]
  return complexQuestions[order[round - 1]]
}

function setText(el, text) {
  if (el && el.textContent !== text) el.textContent = text
}

function applyComplexQuestion() {
  const q = questionForCurrentRound()
  if (!q) return

  document.querySelectorAll('.scenario').forEach(scenario => {
    setText(scenario.querySelector('h2'), q.text)
    setText(scenario.querySelector('.rate'), q.rate)
  })

  document.querySelectorAll('.bond-card').forEach(card => {
    const blocks = card.querySelectorAll(':scope > div')
    if (blocks[0]) setText(blocks[0].querySelector('b'), '1,000 บาท')
    if (blocks[1]) setText(blocks[1].querySelector('b'), q.coupon)
    if (blocks[2]) setText(blocks[2].querySelector('b'), '5 ปี')
  })

  document.querySelectorAll('.reveal').forEach(box => {
    const divs = box.querySelectorAll(':scope > div')
    if (divs[0]) setText(divs[0], q.explanation)
  })

  document.querySelectorAll('.student-reveal').forEach(box => {
    const div = box.querySelector(':scope > div')
    if (div) setText(div, q.explanation)
  })
}

setInterval(applyComplexQuestion, 250)
window.addEventListener('hashchange', () => setTimeout(applyComplexQuestion, 50))
setTimeout(applyComplexQuestion, 50)
