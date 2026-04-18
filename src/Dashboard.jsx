import { useState, useEffect, useCallback, useMemo, useRef } from 'react'

const N8N = import.meta.env.VITE_N8N_URL || 'https://jeee.app.n8n.cloud'

const CATEGORIES = [
  '식료품','외식','배달','카페/간식',
  '대중교통','장거리교통','택시',
  '주거비','공과금','생활용품',
  '의류/패션','쇼핑','미용',
  '병원','약국/건강',
  '문화/여가','운동','여행',
  '통신','구독','보험','교육',
  '경조사','이체','기타',
  '식비','교통','의료'
]

const DISPLAY_CATS = [
  '식료품','외식','배달','카페/간식',
  '대중교통','장거리교통','택시',
  '주거비','공과금','생활용품',
  '의류/패션','쇼핑','미용',
  '병원','약국/건강',
  '문화/여가','운동','여행',
  '통신','구독','보험','교육',
  '경조사','기타'
]

const PAYMENTS = ['신용카드','체크카드','현금','이체']

const CAT_COLORS = {
  '식료품':'#66BB6A','외식':'#FF7043','배달':'#FFA726','카페/간식':'#26C6DA',
  '대중교통':'#42A5F5','장거리교통':'#1565C0','택시':'#7E57C2',
  '주거비':'#8D6E63','공과금':'#78909C','생활용품':'#AB47BC',
  '의류/패션':'#EC407A','쇼핑':'#F06292','미용':'#FF80AB',
  '병원':'#EF5350','약국/건강':'#FF8A65',
  '문화/여가':'#FFCA28','운동':'#9CCC65','여행':'#26A69A',
  '통신':'#BDBDBD','구독':'#FFF176','보험':'#80CBC4','교육':'#FFD54F',
  '경조사':'#A5D6A7','이체':'#CFD8DC','기타':'#BCAAA4',
  '식비':'#66BB6A','교통':'#42A5F5','의료':'#EF5350'
}

const FIXED_CATS = ['주거비','공과금','통신','보험','구독']
const IMPULSE_CATS = ['카페/간식','배달','외식','의류/패션','쇼핑']
const BUDGET_KEY = 'keb_budget_v2'
const PERIOD_KEY = 'keb_period'
const RUNWAY_KEY = 'keb_runway_cash'
const SAVINGS_KEY = 'keb_savings'
const HOBBY_KEY = 'keb_hobby_budget'
const WISHLIST_KEY = 'keb_wishlist'

const PERIOD_OPTIONS = [
  { key:'thisMonth', label:'이번달' },
  { key:'lastMonth', label:'지난달' },
  { key:'3months',   label:'3개월' },
  { key:'6months',   label:'6개월' },
  { key:'thisYear',  label:'올해' },
  { key:'all',       label:'전체' },
  { key:'custom',    label:'직접설정' },
]

function computeRange(period, customStart, customEnd) {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth()+1
  const pad = n => String(n).padStart(2,'0')
  if (period === 'thisMonth') {
    const last = new Date(y, m, 0).getDate()
    return { start:`${y}-${pad(m)}-01`, end:`${y}-${pad(m)}-${last}` }
  }
  if (period === 'lastMonth') {
    let lm = m-1, ly = y
    if(lm===0){lm=12;ly--}
    const last = new Date(ly, lm, 0).getDate()
    return { start:`${ly}-${pad(lm)}-01`, end:`${ly}-${pad(lm)}-${last}` }
  }
  if (period === '3months') {
    let sm = m-2, sy = y
    while(sm<=0){sm+=12;sy--}
    return { start:`${sy}-${pad(sm)}-01`, end:`${y}-${pad(m)}-${new Date(y,m,0).getDate()}` }
  }
  if (period === '6months') {
    let sm = m-5, sy = y
    while(sm<=0){sm+=12;sy--}
    return { start:`${sy}-${pad(sm)}-01`, end:`${y}-${pad(m)}-${new Date(y,m,0).getDate()}` }
  }
  if (period === 'thisYear') return { start:`${y}-01-01`, end:`${y}-12-31` }
  if (period === 'all') return { start:'2020-01-01', end:`${y+1}-12-31` }
  if (period === 'custom') {
    return { start: customStart||`${y}-${pad(m)}-01`, end: customEnd||`${y}-${pad(m)}-${new Date(y,m,0).getDate()}` }
  }
  return { start:`${y}-${pad(m)}-01`, end:`${y}-${pad(m)}-${new Date(y,m,0).getDate()}` }
}

function getMonthsInRange(start, end) {
  const months = []
  let [sy, sm] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  while(sy < ey || (sy === ey && sm <= em)) {
    months.push(`${sy}-${String(sm).padStart(2,'0')}`)
    sm++; if(sm > 12) { sm=1; sy++ }
  }
  return months
}

function fmt(n) { return Number(n||0).toLocaleString()+'원' }
function fmtShort(n) {
  n = Number(n||0)
  if(n >= 100000000) return Math.round(n/100000000)+'억'
  if(n >= 10000) return Math.round(n/10000)+'만'
  return n.toLocaleString()
}

// ── 밸런스 게이지 ──────────────────────────────────────────────
function GaugeChart({ income, expense }) {
  const ratio = income > 0 ? expense / income : (expense > 0 ? 1.5 : 0)
  const clampedRatio = Math.min(ratio, 1.5)
  const pct = clampedRatio / 1.5
  const cx = 100, cy = 88, r = 68
  const startAngle = -210, sweepAngle = 240

  const polarXY = (deg, radius) => {
    const rad = (deg - 90) * Math.PI / 180
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
  }
  const arcPath = (a1, a2, radius) => {
    const s = polarXY(a1, radius), e = polarXY(a2, radius)
    const large = (a2-a1) > 180 ? 1 : 0
    return `M${s.x},${s.y} A${radius},${radius} 0 ${large} 1 ${e.x},${e.y}`
  }

  const needleAngle = startAngle + pct * sweepAngle
  const needleTip = polarXY(needleAngle, 52)
  const color = ratio < 0.7 ? '#4CAF50' : ratio < 0.9 ? '#FF9800' : ratio < 1.0 ? '#FF5722' : '#F44336'
  const statusLabel = ratio < 0.7 ? '안전' : ratio < 0.9 ? '주의' : ratio < 1.0 ? '경고' : '위험'

  return (
    <div style={{textAlign:'center'}}>
      <svg width="200" height="110" viewBox="0 0 200 110">
        <path d={arcPath(startAngle, startAngle+sweepAngle, r)} fill="none" stroke="#EEE" strokeWidth="14"/>
        <path d={arcPath(startAngle, startAngle+sweepAngle*0.47, r)} fill="none" stroke="#4CAF50" strokeWidth="12" opacity="0.8"/>
        <path d={arcPath(startAngle+sweepAngle*0.47, startAngle+sweepAngle*0.6, r)} fill="none" stroke="#FF9800" strokeWidth="12" opacity="0.8"/>
        <path d={arcPath(startAngle+sweepAngle*0.6, startAngle+sweepAngle*0.73, r)} fill="none" stroke="#FF5722" strokeWidth="12" opacity="0.8"/>
        <path d={arcPath(startAngle+sweepAngle*0.73, startAngle+sweepAngle, r)} fill="none" stroke="#F44336" strokeWidth="12" opacity="0.8"/>
        <line x1={cx} y1={cy} x2={needleTip.x} y2={needleTip.y} stroke="#333" strokeWidth="3" strokeLinecap="round"/>
        <circle cx={cx} cy={cy} r="6" fill="#333"/>
        <circle cx={cx} cy={cy} r="3" fill="#fff"/>
        <text x="22" y="100" fontSize="9" fill="#4CAF50" fontWeight="700">Safe</text>
        <text x="165" y="100" fontSize="9" fill="#F44336" fontWeight="700">Danger</text>
      </svg>
      <div style={{fontSize:'13px',fontWeight:'700',color,marginTop:'-4px'}}>{statusLabel} · {Math.round(ratio*100)}%</div>
      <div style={{fontSize:'11px',color:'#bbb',marginTop:'2px'}}>수입 대비 지출 비율</div>
    </div>
  )
}

// ── 상황별 동적 가이드 문구 ────────────────────────────────────
function StatusMessage({ income, expense, impulseAmt }) {
  const ratio = income > 0 ? expense / income : 0
  const msgs = {
    impulse: { bg:'#FFF3E0', border:'#FFAB91', color:'#BF360C', icon:'🛒',
      text:`잠깐! 충동소비가 ${fmtShort(impulseAmt)}을 넘었어요. 이건 정말 필요해서 산 건가요, 아니면 기분 때문인가요?` },
    danger:  { bg:'#FFEBEE', border:'#EF9A9A', color:'#B71C1C', icon:'🚨',
      text:'비상사태! 미래의 나에게서 돈을 빌려 쓰고 있습니다. 당장 결제창을 닫으세요.' },
    warning: { bg:'#FFF3E0', border:'#FF9800', color:'#E65100', icon:'🔶',
      text:'수입의 90%를 돌파했어요. 이번 주말 외식은 냉장고 파먹기로 대체해보는 건 어떨까요?' },
    caution: { bg:'#FFF8E1', border:'#FFD54F', color:'#6B5900', icon:'⚠️',
      text:'지출 속도가 빨라지고 있어요. 잠시 멈추고 필수 지출인지 확인해보세요.' },
    safe:    { bg:'#E8F5E9', border:'#81C784', color:'#1B5E20', icon:'✅',
      text:`훌륭한 페이스입니다! 수입의 ${Math.round(ratio*100)}%만 쓰고 있어요. 이대로라면 충분히 저축할 수 있어요.` },
  }
  const key = impulseAmt >= 100000 ? 'impulse' : ratio >= 1.0 ? 'danger' : ratio >= 0.9 ? 'warning' : ratio >= 0.7 ? 'caution' : income > 0 ? 'safe' : null
  if(!key) return null
  const m = msgs[key]
  return (
    <div style={{background:m.bg,border:`1px solid ${m.border}`,borderRadius:'12px',padding:'14px 16px',marginBottom:'14px',display:'flex',gap:'10px',alignItems:'flex-start'}}>
      <span style={{fontSize:'20px',flexShrink:0}}>{m.icon}</span>
      <span style={{fontSize:'13px',color:m.color,fontWeight:'500',lineHeight:'1.6'}}>{m.text}</span>
    </div>
  )
}

// ── 트리맵 ────────────────────────────────────────────────────
function TreemapChart({ data }) {
  const W = 340, H = 200
  if(!data.length) return <div style={{textAlign:'center',color:'#aaa',padding:'40px 0'}}>데이터 없음</div>
  const total = data.reduce((s,d)=>s+d.value,0)
  if(!total) return <div style={{textAlign:'center',color:'#aaa',padding:'40px 0'}}>데이터 없음</div>

  const items = [...data].sort((a,b)=>b.value-a.value)
  const rects = []
  let y = 0, remaining = [...items], remH = H

  while(remaining.length > 0 && remH > 4) {
    const rowTotal = remaining.reduce((s,d)=>s+d.value,0)
    let pick = 1
    for(let i=2; i<=Math.min(remaining.length,4); i++) {
      const v = remaining.slice(0,i).reduce((s,d)=>s+d.value,0)
      if(v/rowTotal > 0.55) break
      pick = i
    }
    const rowItems = remaining.slice(0,pick)
    const rowValue = rowItems.reduce((s,d)=>s+d.value,0)
    const rowH = Math.max((rowValue/total)*H, 20)
    let x = 0
    rowItems.forEach(item => {
      const w = (item.value/rowValue)*W
      rects.push({...item, x, y, w, h:rowH})
      x += w
    })
    y += rowH; remH -= rowH
    remaining = remaining.slice(pick)
  }

  return (
    <div style={{width:'100%',overflow:'hidden',borderRadius:'8px'}}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{display:'block'}}>
        {rects.map((r,i)=>(
          <g key={i}>
            <rect x={r.x+1} y={r.y+1} width={Math.max(r.w-2,2)} height={Math.max(r.h-2,2)}
              fill={r.color||'#ddd'} rx="4"/>
            {r.w>45 && r.h>22 && (
              <text x={r.x+r.w/2} y={r.y+r.h/2+(r.h>38?-5:5)} textAnchor="middle" fontSize="11" fill="#fff" fontWeight="700" style={{textShadow:'0 1px 2px rgba(0,0,0,0.4)'}}>
                {r.name}
              </text>
            )}
            {r.w>45 && r.h>40 && (
              <text x={r.x+r.w/2} y={r.y+r.h/2+12} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.9)">
                {Math.round(r.value/total*100)}%
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}

// ── 무지출 데이 히트맵 ──────────────────────────────────────
function CalendarHeatmap({ expenses, year, month }) {
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDay = new Date(year, month-1, 1).getDay()
  const today = new Date()

  const dayMap = {}
  expenses.forEach(e => {
    if(!e.date) return
    const prefix = `${year}-${String(month).padStart(2,'0')}`
    if(e.date.startsWith(prefix)) {
      const day = parseInt(e.date.slice(8,10))
      dayMap[day] = (dayMap[day]||0) + e.amount
    }
  })

  const amounts = Object.values(dayMap).filter(v=>v>0)
  const median = amounts.length ? amounts.sort((a,b)=>a-b)[Math.floor(amounts.length/2)] : 50000

  const getColor = (day) => {
    if(!day) return 'transparent'
    const isToday = day===today.getDate() && month===today.getMonth()+1 && year===today.getFullYear()
    const isPast = new Date(year, month-1, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate())
    if(!isPast && !isToday) return '#F5F5F5'
    const amt = dayMap[day]
    if(!amt) return '#A5D6A7'
    if(amt < median*0.4) return '#C8E6C9'
    if(amt < median) return '#FFF9C4'
    if(amt < median*2) return '#FFCC80'
    return '#EF9A9A'
  }

  const cells = []
  for(let i=0;i<firstDay;i++) cells.push(null)
  for(let d=1;d<=daysInMonth;d++) cells.push(d)

  const isThisToday = (day) => day===today.getDate() && month===today.getMonth()+1 && year===today.getFullYear()

  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'3px',marginBottom:'5px'}}>
        {['일','월','화','수','목','금','토'].map(d=>(
          <div key={d} style={{textAlign:'center',fontSize:'10px',color:'#aaa',fontWeight:'600'}}>{d}</div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'3px'}}>
        {cells.map((day,i)=>(
          <div key={i} title={day?`${day}일: ${dayMap[day]?dayMap[day].toLocaleString()+'원':'무지출 🎉'}`:''} style={{
            aspectRatio:'1',borderRadius:'4px',background:getColor(day),
            display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:'9px',color:'#777',cursor:day?'default':'default',
            outline:isThisToday(day)?'2px solid #333':'none',
            outlineOffset:'1px',
          }}>
            {day}
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:'10px',marginTop:'8px',fontSize:'11px',color:'#888',flexWrap:'wrap',alignItems:'center'}}>
        <span><span style={{color:'#A5D6A7',fontWeight:'700'}}>●</span> 무지출</span>
        <span><span style={{color:'#FFF9C4',fontWeight:'700',textShadow:'0 0 1px #aaa'}}>●</span> 소액</span>
        <span><span style={{color:'#FFCC80',fontWeight:'700'}}>●</span> 보통</span>
        <span><span style={{color:'#EF9A9A',fontWeight:'700'}}>●</span> 과소비</span>
      </div>
    </div>
  )
}

// ── 버닝 차트 ────────────────────────────────────────────────
function BurndownChart({ expenses, totalBudget, year, month }) {
  if(!totalBudget) return (
    <div style={{textAlign:'center',color:'#bbb',padding:'20px 0',fontSize:'13px'}}>
      예산 탭에서 예산을 설정하면 버닝 차트가 표시됩니다
    </div>
  )
  const daysInMonth = new Date(year, month, 0).getDate()
  const today = new Date()
  const todayDay = (today.getMonth()+1===month && today.getFullYear()===year) ? today.getDate() : daysInMonth

  const dailySpend = Array(daysInMonth+1).fill(0)
  expenses.forEach(e => {
    if(!e.date) return
    if(e.date.startsWith(`${year}-${String(month).padStart(2,'0')}`)) {
      const day = parseInt(e.date.slice(8,10))
      if(day>=1 && day<=daysInMonth) dailySpend[day]+=e.amount
    }
  })
  const cumulative = [0]
  for(let d=1;d<=daysInMonth;d++) cumulative.push(cumulative[d-1]+dailySpend[d])

  const W=400, H=130, PL=8, PR=12, PT=20, PB=28
  const iW=W-PL-PR, iH=H-PT-PB
  const xs = d => PL + (d/daysInMonth)*iW
  const ys = v => PT + (1-Math.min(v/(totalBudget*1.1),1))*iH

  const budgetY = ys(totalBudget)
  const idealPts = `${xs(0)},${ys(0)} ${xs(daysInMonth)},${ys(totalBudget)}`
  const actualPts = Array.from({length:todayDay+1},(_,i)=>`${xs(i)},${ys(cumulative[i])}`).join(' ')
  const overBudget = cumulative[todayDay] > totalBudget

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{display:'block'}}>
      <line x1={PL} y1={budgetY} x2={W-PR} y2={budgetY} stroke="#EF5350" strokeWidth="1" strokeDasharray="4,4" opacity="0.7"/>
      <text x={W-PR+2} y={budgetY-3} fontSize="8" fill="#EF5350">예산 {fmtShort(totalBudget)}</text>
      <polyline points={idealPts} fill="none" stroke="#81C784" strokeWidth="1.5" strokeDasharray="6,3" opacity="0.6"/>
      <polyline points={actualPts} fill="none" stroke={overBudget?'#EF5350':'#4FC3F7'} strokeWidth="2.5" strokeLinejoin="round"/>
      {todayDay<=daysInMonth && (
        <circle cx={xs(todayDay)} cy={ys(cumulative[todayDay])} r="4.5" fill={overBudget?'#EF5350':'#4FC3F7'}/>
      )}
      <text x={PL} y={H-4} fontSize="9" fill="#bbb">1일</text>
      <text x={PL+iW/2} y={H-4} fontSize="9" fill="#bbb" textAnchor="middle">{Math.round(daysInMonth/2)}일</text>
      <text x={W-PR} y={H-4} fontSize="9" fill="#bbb" textAnchor="end">{daysInMonth}일</text>
      <line x1={PL} y1={PT-8} x2={PL+18} y2={PT-8} stroke="#81C784" strokeWidth="1.5" strokeDasharray="5,3"/>
      <text x={PL+22} y={PT-4} fontSize="9" fill="#888">권장 속도</text>
      <line x1={PL+80} y1={PT-8} x2={PL+98} y2={PT-8} stroke="#4FC3F7" strokeWidth="2"/>
      <text x={PL+102} y={PT-4} fontSize="9" fill="#888">실제 지출</text>
    </svg>
  )
}

// ── 런웨이 게이지 ────────────────────────────────────────────
function RunwayGauge({ cash, monthlyAvg }) {
  if(!cash || !monthlyAvg) return null
  const months = cash / monthlyAvg
  const days = Math.round(months * 30)
  const pct = Math.min(months / 6, 1)
  const color = months < 1 ? '#F44336' : months < 3 ? '#FF9800' : '#4CAF50'
  const msg = months < 1 ? '⚠️ 위기! 즉시 지출을 줄이세요'
    : months < 3 ? '⚡ 3개월 미만 — 절약이 필요해요'
    : '✅ 안정적인 런웨이'
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:'6px'}}>
        <div>
          <span style={{fontSize:'28px',fontWeight:'800',color}}>{days}일</span>
          <span style={{fontSize:'12px',color:'#aaa',marginLeft:'6px'}}>({months.toFixed(1)}개월)</span>
        </div>
        <span style={{fontSize:'11px',color:'#bbb'}}>목표 90일+</span>
      </div>
      <div style={{background:'#EEE',borderRadius:'99px',height:'10px',overflow:'hidden',marginBottom:'6px'}}>
        <div style={{width:`${pct*100}%`,height:'100%',background:color,borderRadius:'99px',transition:'width 0.4s'}}/>
      </div>
      <div style={{fontSize:'12px',color:color,fontWeight:'500'}}>{msg}</div>
    </div>
  )
}

// ── 배터리 차트 ──────────────────────────────────────────────
function BatteryBar({ used, total, label, color }) {
  const pct = total > 0 ? Math.min(Math.round(used/total*100), 100) : 0
  const c = color || (pct > 80 ? '#F44336' : pct > 50 ? '#FF9800' : '#4CAF50')
  return (
    <div style={{marginBottom:'12px'}}>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:'12px',marginBottom:'5px'}}>
        <span style={{color:'#555',fontWeight:'500'}}>{label}</span>
        <span style={{fontWeight:'700',color:c}}>{pct}%</span>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:'3px'}}>
        <div style={{flex:1,background:'#EEE',borderRadius:'4px 0 0 4px',height:'22px',overflow:'hidden',border:'1.5px solid #DDD',borderRight:'none'}}>
          <div style={{width:`${pct}%`,height:'100%',background:c,transition:'width 0.5s',
            backgroundImage:pct<20?'none':'repeating-linear-gradient(90deg,transparent,transparent 8px,rgba(255,255,255,0.15) 8px,rgba(255,255,255,0.15) 9px)'
          }}/>
        </div>
        <div style={{width:'7px',height:'12px',background:'#CCC',borderRadius:'0 3px 3px 0',flexShrink:0}}/>
      </div>
      <div style={{fontSize:'11px',color:'#aaa',marginTop:'3px',textAlign:'right'}}>
        {fmtShort(used)} / {fmtShort(total)}
      </div>
    </div>
  )
}

// ── 목돈 프로그레스 바 ────────────────────────────────────────
function SavingsGoal({ current, target, label }) {
  if(!target) return null
  const pct = Math.min(Math.round(current/target*100), 100)
  const color = pct >= 100 ? '#4CAF50' : pct >= 50 ? '#FF9800' : '#4FC3F7'
  const steps = 10
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:'8px'}}>
        <span style={{fontSize:'13px',fontWeight:'600',color:'#444'}}>{label}</span>
        <span style={{fontSize:'13px',fontWeight:'700',color}}>{pct}%</span>
      </div>
      <div style={{display:'flex',gap:'3px',marginBottom:'6px'}}>
        {Array.from({length:steps},(_,i)=>(
          <div key={i} style={{flex:1,height:'24px',borderRadius:'3px',
            background: i < Math.floor(pct/10) ? color : i === Math.floor(pct/10) && pct%10>0 ? color+'99' : '#EEE',
            transition:'background 0.3s',display:'flex',alignItems:'center',justifyContent:'center'}}>
            {i < Math.floor(pct/10) && <span style={{fontSize:'10px'}}>🟡</span>}
          </div>
        ))}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:'12px',color:'#aaa'}}>
        <span>{fmtShort(current)}원 모임</span>
        <span>목표 {fmtShort(target)}원</span>
      </div>
    </div>
  )
}

// ── 24시간 위시리스트 타이머 ──────────────────────────────────
function WishlistWidget({ wishlist, setWishlist }) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick(t=>t+1), 60000)
    return () => clearInterval(id)
  }, [])

  const add = () => {
    if(!name.trim()) return
    const item = { id: Date.now(), name: name.trim(), price: parseInt(price)||0, addedAt: Date.now() }
    const next = [item, ...wishlist]
    setWishlist(next)
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(next))
    setName(''); setPrice('')
  }

  const remove = (id, bought) => {
    const next = wishlist.filter(w=>w.id!==id)
    setWishlist(next)
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(next))
    if(bought) alert('✅ 24시간 버텼습니다! 정말 필요하다면 구매하세요.')
  }

  const remaining = (addedAt) => {
    const diff = 86400000 - (Date.now() - addedAt)
    if(diff <= 0) return null
    const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000)
    return `${h}시간 ${m}분`
  }

  return (
    <div>
      <div style={{display:'flex',gap:'6px',marginBottom:'12px',flexWrap:'wrap'}}>
        <input placeholder="사고 싶은 것" value={name} onChange={e=>setName(e.target.value)}
          style={{flex:2,minWidth:'120px',border:'1.5px solid #E5E7EB',borderRadius:'8px',padding:'8px 10px',fontSize:'13px',outline:'none'}}
          onKeyDown={e=>e.key==='Enter'&&add()}/>
        <input placeholder="금액" type="number" value={price} onChange={e=>setPrice(e.target.value)}
          style={{flex:1,minWidth:'80px',border:'1.5px solid #E5E7EB',borderRadius:'8px',padding:'8px 10px',fontSize:'13px',outline:'none'}}/>
        <button onClick={add} style={{background:'#333',color:'#fff',border:'none',borderRadius:'8px',padding:'8px 14px',fontSize:'13px',cursor:'pointer',fontWeight:'600'}}>추가</button>
      </div>
      {wishlist.length===0 ? (
        <div style={{textAlign:'center',color:'#ccc',padding:'20px 0',fontSize:'13px'}}>
          사고 싶은 것을 추가하면 24시간 타이머가 시작됩니다
        </div>
      ) : wishlist.map(w => {
        const rem = remaining(w.addedAt)
        const expired = !rem
        return (
          <div key={w.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 0',borderBottom:'1px solid #F5F5F5'}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:'600',fontSize:'13px'}}>{w.name}</div>
              {w.price>0 && <div style={{fontSize:'11px',color:'#aaa'}}>{w.price.toLocaleString()}원</div>}
            </div>
            <div style={{textAlign:'center',minWidth:'80px'}}>
              {expired ? (
                <div style={{fontSize:'11px',color:'#4CAF50',fontWeight:'700'}}>⏰ 24시간 완료!</div>
              ) : (
                <>
                  <div style={{fontSize:'11px',color:'#FF9800',fontWeight:'700'}}>{rem}</div>
                  <div style={{fontSize:'10px',color:'#bbb'}}>남음</div>
                </>
              )}
            </div>
            <div style={{display:'flex',gap:'4px'}}>
              {expired && (
                <button onClick={()=>remove(w.id,true)} style={{background:'#E8F5E9',border:'none',borderRadius:'6px',padding:'5px 8px',fontSize:'11px',cursor:'pointer',color:'#2E7D32'}}>구매</button>
              )}
              <button onClick={()=>remove(w.id,false)} style={{background:'#F5F5F5',border:'none',borderRadius:'6px',padding:'5px 8px',fontSize:'11px',cursor:'pointer',color:'#999'}}>삭제</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── 기존 차트 ────────────────────────────────────────────────
function BarChart({ data, height=160 }) {
  if(!data.length) return <div style={{textAlign:'center',color:'#aaa',padding:'40px 0'}}>데이터 없음</div>
  const maxV = Math.max(...data.map(d=>d.value),1)
  const W=480, PAD_B=36, PAD_T=24
  const barW=Math.floor((W/data.length)*0.55), gap=W/data.length
  return (
    <div style={{width:'100%',overflowX:'auto'}}>
      <svg width="100%" viewBox={`0 0 ${W} ${height+PAD_T+PAD_B}`} preserveAspectRatio="xMidYMid meet" style={{display:'block'}}>
        {data.map((d,i)=>{
          const bh=Math.max((d.value/maxV)*(height-4),4)
          const cx=gap*i+gap/2, x=cx-barW/2, y=PAD_T+(height-bh)
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={bh} fill={i===data.length-1?'#FFD54F':'#81D4FA'} rx="4"/>
              <text x={cx} y={PAD_T+height+18} textAnchor="middle" fontSize="11" fill="#888">{d.label.slice(5)}</text>
              <text x={cx} y={y-6} textAnchor="middle" fontSize="11" fill="#555">{fmtShort(d.value)}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function WeekdayChart({ data }) {
  const days=['일','월','화','수','목','금','토']
  const max=Math.max(...data,1)
  return (
    <div style={{display:'flex',gap:'6px',alignItems:'flex-end',height:'90px',padding:'0 4px'}}>
      {data.map((v,i)=>(
        <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:'4px'}}>
          <div style={{fontSize:'10px',color:'#888'}}>{fmtShort(v)}</div>
          <div style={{width:'100%',background:i===0||i===6?'#FFD54F':'#81D4FA',borderRadius:'4px 4px 0 0',
            height:`${Math.max((v/max)*50,2)}px`,transition:'height 0.3s'}}/>
          <div style={{fontSize:'11px',color:'#666',fontWeight:i===0||i===6?'700':'400'}}>{days[i]}</div>
        </div>
      ))}
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function ExpenseDashboard() {
  const todayStr = new Date().toISOString().slice(0,10)
  const todayMonth = todayStr.slice(0,7)
  const nowY = new Date().getFullYear()
  const nowM = new Date().getMonth()+1

  const [tab, setTab] = useState('dashboard')
  const [period, setPeriod] = useState(()=>localStorage.getItem(PERIOD_KEY)||'thisMonth')
  const [customStart, setCustomStart] = useState(todayMonth+'-01')
  const [customEnd, setCustomEnd] = useState(todayStr)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [budget, setBudget] = useState(()=>{ try{ return JSON.parse(localStorage.getItem(BUDGET_KEY)||'{}') }catch{ return {} } })
  const [budgetInput, setBudgetInput] = useState({})
  const [showGuide, setShowGuide] = useState(false)
  const [guideIncome, setGuideIncome] = useState('')
  const [guideSuggest, setGuideSuggest] = useState(null)

  const [histCat, setHistCat] = useState('')
  const [histKeyword, setHistKeyword] = useState('')

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0,16),
    store:'', amount:'', type:'지출', category:'식료품', payment:'신용카드', memo:''
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState('')

  // 새 기능 state
  const [runwayCash, setRunwayCash] = useState(()=>Number(localStorage.getItem(RUNWAY_KEY)||0))
  const [runwayInput, setRunwayInput] = useState(()=>localStorage.getItem(RUNWAY_KEY)||'')
  const [savings, setSavings] = useState(()=>{ try{ return JSON.parse(localStorage.getItem(SAVINGS_KEY)||'{"current":0,"target":0,"label":"비상금 목표"}') }catch{return {current:0,target:0,label:'비상금 목표'}} })
  const [savingsInput, setSavingsInput] = useState({current:'',target:'',label:''})
  const [hobbyBudget, setHobbyBudget] = useState(()=>Number(localStorage.getItem(HOBBY_KEY)||0))
  const [hobbyInput, setHobbyInput] = useState(()=>localStorage.getItem(HOBBY_KEY)||'')
  const [wishlist, setWishlist] = useState(()=>{ try{ return JSON.parse(localStorage.getItem(WISHLIST_KEY)||'[]') }catch{return []} })

  const range = useMemo(() => computeRange(period, customStart, customEnd), [period, customStart, customEnd])

  const loadData = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`${N8N}/webhook/get-expenses?start=${range.start}&end=${range.end}`)
      if(!res.ok) throw new Error()
      const data = await res.json()
      setEntries(data.entries || [])
    } catch { setError('데이터를 불러오지 못했습니다. n8n 워크플로우를 확인해주세요.') }
    setLoading(false)
  }, [range])

  useEffect(()=>{ loadData() }, [loadData])
  useEffect(()=>{ localStorage.setItem(PERIOD_KEY, period) }, [period])
  useEffect(()=>{ setBudgetInput(Object.fromEntries(DISPLAY_CATS.map(c=>[c, budget[c]||'']))) }, [budget])
  useEffect(()=>{ setSavingsInput({current:savings.current||'',target:savings.target||'',label:savings.label||''}) }, [savings])

  const expenses = useMemo(() => entries.filter(e=>e.type==='지출'), [entries])
  const incomes  = useMemo(() => entries.filter(e=>e.type==='수입'), [entries])
  const totalExp = useMemo(() => expenses.reduce((s,e)=>s+e.amount,0), [expenses])
  const totalInc = useMemo(() => incomes.reduce((s,e)=>s+e.amount,0), [incomes])

  const catMap  = useMemo(() => { const m={}; expenses.forEach(e=>{ m[e.category]=(m[e.category]||0)+e.amount }); return m }, [expenses])
  const catList = useMemo(() => Object.entries(catMap).sort((a,b)=>b[1]-a[1]), [catMap])

  const totalBudget = useMemo(() => DISPLAY_CATS.reduce((s,c)=>s+(Number(budget[c])||0),0), [budget])
  const budgetUsed  = totalBudget>0 ? Math.round(totalExp/totalBudget*100) : null

  const treemapData = useMemo(() => catList.map(([name,value])=>({name,value,color:CAT_COLORS[name]||'#ddd'})), [catList])

  const monthlyTrend = useMemo(() => {
    const months = getMonthsInRange(range.start, range.end)
    if(months.length <= 1) return []
    return months.map(mo => ({ label:mo, value:expenses.filter(e=>e.date&&e.date.startsWith(mo)).reduce((s,e)=>s+e.amount,0) }))
  }, [expenses, range])

  const longDistTrips = useMemo(() => expenses.filter(e=>e.category==='장거리교통'), [expenses])
  const longDistTotal = useMemo(() => longDistTrips.reduce((s,e)=>s+e.amount,0), [longDistTrips])

  const weekdayTotals = useMemo(() => {
    const arr=Array(7).fill(0)
    expenses.forEach(e=>{ if(e.date){ const d=new Date(e.date); arr[d.getDay()]+=e.amount } })
    return arr
  }, [expenses])

  const fixedAmt    = useMemo(() => expenses.filter(e=>FIXED_CATS.includes(e.category)).reduce((s,e)=>s+e.amount,0), [expenses])
  const variableAmt = totalExp - fixedAmt

  const storeMap = useMemo(() => { const m={}; expenses.forEach(e=>{ m[e.store]=(m[e.store]||0)+e.amount }); return m }, [expenses])
  const top10    = useMemo(() => Object.entries(storeMap).sort((a,b)=>b[1]-a[1]).slice(0,10), [storeMap])

  const impulseAmt   = useMemo(() => expenses.filter(e=>IMPULSE_CATS.includes(e.category)).reduce((s,e)=>s+e.amount,0), [expenses])
  const impulseRatio = totalExp>0 ? Math.round(impulseAmt/totalExp*100) : 0

  const isThisMonth = period==='thisMonth'
  const today2      = new Date()
  const daysPassed  = isThisMonth ? today2.getDate() : Math.max(Math.round((new Date(range.end)-new Date(range.start))/86400000)+1,1)
  const daysInMonth = isThisMonth ? new Date(today2.getFullYear(),today2.getMonth()+1,0).getDate() : daysPassed
  const dailyAvg    = daysPassed>0 ? Math.round(totalExp/daysPassed) : 0
  const forecast    = isThisMonth && daysPassed>0 ? Math.round(dailyAvg*daysInMonth) : 0

  const prevMonthAmt = useMemo(() => monthlyTrend.length<2 ? null : monthlyTrend[monthlyTrend.length-2]?.value??null, [monthlyTrend])
  const momDiff = prevMonthAmt!=null ? totalExp-prevMonthAmt : null
  const momPct  = prevMonthAmt>0 ? Math.round(momDiff/prevMonthAmt*100) : null

  const filteredEntries = useMemo(() => [...entries]
    .sort((a,b)=>(b.date||'').localeCompare(a.date||''))
    .filter(e => {
      if(histCat && e.category!==histCat) return false
      if(histKeyword && !((e.store||'').includes(histKeyword)||(e.memo||'').includes(histKeyword))) return false
      return true
    }), [entries, histCat, histKeyword])

  const periodLabel = useMemo(() => {
    if(period==='custom') return `${customStart} ~ ${customEnd}`
    return PERIOD_OPTIONS.find(o=>o.key===period)?.label||'이번달'
  }, [period, customStart, customEnd])

  // 3개월 평균 지출 (런웨이 계산용)
  const monthlyAvgForRunway = useMemo(() => {
    if(monthlyTrend.length>=2) {
      const vals = monthlyTrend.map(m=>m.value).filter(v=>v>0)
      return vals.length ? Math.round(vals.reduce((s,v)=>s+v,0)/vals.length) : dailyAvg*30
    }
    return dailyAvg*30
  }, [monthlyTrend, dailyAvg])

  // 취향(충동) 예산 소진율
  const hobbySpent = useMemo(() => expenses.filter(e=>IMPULSE_CATS.includes(e.category)).reduce((s,e)=>s+e.amount,0), [expenses])

  const apply5030 = () => {
    const inc = parseInt(guideIncome.replace(/,/g,''))||0
    if(!inc) return
    setGuideSuggest({ needs:Math.round(inc*0.5), wants:Math.round(inc*0.3), savings:Math.round(inc*0.2) })
  }

  const applyPastAverage = () => {
    const months = getMonthsInRange(range.start, range.end)
    if(months.length<2){ alert('2개월 이상 데이터가 필요합니다.'); return }
    const avgBudget = {}
    DISPLAY_CATS.forEach(cat => {
      const total = months.reduce((s,mo)=>s+expenses.filter(e=>e.date&&e.date.startsWith(mo)&&e.category===cat).reduce((ss,e)=>ss+e.amount,0),0)
      avgBudget[cat] = Math.round(total/months.length/1000)*1000
    })
    setBudgetInput(Object.fromEntries(DISPLAY_CATS.map(c=>[c,avgBudget[c]||''])))
    setGuideSuggest(null)
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if(!form.store||!form.amount){ setSubmitMsg('결제처와 금액을 입력해주세요.'); return }
    setSubmitting(true); setSubmitMsg('')
    try {
      const res = await fetch(`${N8N}/webhook/add-expense`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ date:form.date, store:form.store, amount:parseInt(form.amount.replace(/,/g,'')), type:form.type, category:form.category, payment:form.payment, memo:form.memo })
      })
      if(!res.ok) throw new Error()
      setSubmitMsg('저장 완료! ✅')
      setForm(f=>({...f,store:'',amount:'',memo:''}))
      loadData()
    } catch { setSubmitMsg('저장 실패. n8n 연결을 확인해주세요.') }
    setSubmitting(false)
  }

  const saveBudget = () => {
    const updated = {}
    DISPLAY_CATS.forEach(c=>{ if(budgetInput[c]) updated[c]=Number(budgetInput[c]) })
    setBudget(updated)
    localStorage.setItem(BUDGET_KEY, JSON.stringify(updated))
    alert('예산이 저장되었습니다!')
  }

  const saveGoals = () => {
    const rc = parseInt(String(runwayInput).replace(/,/g,''))||0
    setRunwayCash(rc)
    localStorage.setItem(RUNWAY_KEY, String(rc))
    const hb = parseInt(String(hobbyInput).replace(/,/g,''))||0
    setHobbyBudget(hb)
    localStorage.setItem(HOBBY_KEY, String(hb))
    const s = { current:parseInt(String(savingsInput.current).replace(/,/g,''))||0, target:parseInt(String(savingsInput.target).replace(/,/g,''))||0, label:savingsInput.label||'비상금 목표' }
    setSavings(s)
    localStorage.setItem(SAVINGS_KEY, JSON.stringify(s))
    alert('저장되었습니다!')
  }

  // 이번달 기준으로 히트맵 표시
  const heatmapYear  = isThisMonth ? today2.getFullYear() : nowY
  const heatmapMonth = isThisMonth ? today2.getMonth()+1 : nowM

  return (
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#F4F7FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR',sans-serif;color:#333;font-size:15px}
        .app{max-width:1200px;margin:0 auto;padding:16px}
        .header{background:linear-gradient(135deg,#FFD54F 0%,#4FC3F7 100%);border-radius:16px;padding:20px 24px;margin-bottom:12px}
        .header-top{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px}
        .header h1{font-size:20px;font-weight:800;color:#333}
        .period-btns{display:flex;gap:4px;flex-wrap:wrap}
        .period-btn{background:rgba(255,255,255,0.55);border:none;border-radius:8px;padding:5px 10px;cursor:pointer;font-size:12px;font-weight:600;color:#333;transition:background 0.2s}
        .period-btn.active{background:rgba(255,255,255,0.92);box-shadow:0 2px 6px rgba(0,0,0,0.12)}
        .period-btn:hover:not(.active){background:rgba(255,255,255,0.75)}
        .custom-range{display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap}
        .custom-range input{background:rgba(255,255,255,0.85);border:none;border-radius:8px;padding:5px 10px;font-size:12px;outline:none;color:#333}
        .custom-range button{background:#fff;border:none;border-radius:8px;padding:5px 14px;cursor:pointer;font-size:12px;font-weight:700;color:#333}
        .period-label{font-size:13px;color:rgba(0,0,0,0.5);font-weight:500}
        .tabs{display:flex;gap:6px;margin-bottom:16px;background:#fff;border-radius:14px;padding:6px;box-shadow:0 2px 8px rgba(0,0,0,0.06)}
        .tab{flex:1;padding:10px 4px;border:none;border-radius:10px;cursor:pointer;font-size:12px;font-weight:600;transition:all 0.2s;background:transparent;color:#888}
        .tab.active{background:#FFD54F;color:#333;box-shadow:0 2px 8px rgba(255,213,79,0.35)}
        .tab:hover:not(.active){background:#F9F9F9}
        .grid3{display:grid;gap:12px;grid-template-columns:1fr}
        @media(min-width:600px){.grid3{grid-template-columns:1fr 1fr}}
        @media(min-width:960px){.grid3{grid-template-columns:1fr 1fr 1fr}}
        .grid2{display:grid;gap:12px;grid-template-columns:1fr}
        @media(min-width:600px){.grid2{grid-template-columns:1fr 1fr}}
        .card{background:#fff;border-radius:14px;padding:18px;box-shadow:0 2px 10px rgba(0,0,0,0.06)}
        .card h3{font-size:13px;color:#999;font-weight:500;margin-bottom:10px;letter-spacing:0.3px}
        .big-num{font-size:26px;font-weight:800;color:#333;line-height:1.1}
        .sub-text{font-size:13px;color:#bbb;margin-top:4px}
        .badges{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
        .badge{display:inline-flex;align-items:center;gap:5px;border-radius:20px;padding:7px 14px;font-size:13px;font-weight:600}
        .badge-yellow{background:#FFFDE7;border:1px solid #FFD54F;color:#6B5900}
        .badge-blue{background:#E1F5FE;border:1px solid #4FC3F7;color:#01579B}
        .badge-green{background:#E8F5E9;border:1px solid #81C784;color:#1B5E20}
        .badge-red{background:#FFF3E0;border:1px solid #FFAB91;color:#BF360C}
        .section-title{font-size:14px;font-weight:700;color:#444;margin-bottom:12px;display:flex;align-items:center;gap:6px}
        .progress-bar{background:#EEEEEE;border-radius:99px;height:8px;overflow:hidden}
        .progress-fill{height:100%;border-radius:99px;transition:width 0.4s ease}
        .list-item{display:flex;justify-content:space-between;align-items:flex-start;padding:12px 0;border-bottom:1px solid #F5F5F5}
        .list-item:last-child{border-bottom:none}
        .tag{background:#F3F4F6;border-radius:6px;padding:2px 7px;font-size:11px;color:#666}
        .form-group{margin-bottom:12px}
        .form-group label{display:block;font-size:12px;color:#888;margin-bottom:4px;font-weight:500}
        .form-group input,.form-group select,.form-group textarea{width:100%;border:1.5px solid #E5E7EB;border-radius:10px;padding:10px 12px;font-size:14px;background:#FAFAFA;transition:border 0.2s;outline:none;color:#333}
        .form-group input:focus,.form-group select:focus,.form-group textarea:focus{border-color:#FFD54F;background:#fff;box-shadow:0 0 0 3px rgba(255,213,79,0.15)}
        .btn-primary{background:#FFD54F;border:none;border-radius:12px;padding:13px 24px;font-size:14px;font-weight:700;cursor:pointer;width:100%;transition:background 0.2s;color:#333;margin-top:4px}
        .btn-primary:hover:not(:disabled){background:#FFC107}
        .btn-primary:disabled{background:#EEE;color:#AAA;cursor:default}
        .btn-secondary{background:#F5F5F5;border:none;border-radius:10px;padding:10px 18px;font-size:13px;font-weight:600;cursor:pointer;transition:background 0.2s;color:#555}
        .btn-secondary:hover{background:#EEE}
        .empty{text-align:center;color:#CCC;padding:40px 0;font-size:14px}
        .top10-item{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #F5F5F5;font-size:13px}
        .top10-item:last-child{border-bottom:none}
        .rank-badge{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;background:#E0E0E0;color:#555}
        .rank-badge.gold{background:#FFD54F;color:#5D4037}
        .rank-badge.silver{background:#81D4FA;color:#01579B}
        .rank-badge.bronze{background:#A5D6A7;color:#1B5E20}
        .ratio-bar{display:flex;height:26px;border-radius:8px;overflow:hidden;margin-top:8px}
        .ratio-item{display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:#fff}
        .budget-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #F5F5F5}
        .budget-row:last-child{border-bottom:none}
        .budget-label{min-width:90px;display:flex;align-items:center;gap:6px;font-size:13px}
        .budget-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
        .budget-input{flex:1;border:1.5px solid #E5E7EB;border-radius:8px;padding:7px 10px;font-size:13px;outline:none;text-align:right;color:#333}
        .budget-input:focus{border-color:#FFD54F}
        .form-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        @media(max-width:380px){.form-row{grid-template-columns:1fr}}
        .error-banner{background:#FFF3F3;border:1px solid #FFCDD2;border-radius:12px;padding:14px;color:#C62828;font-size:13px;margin-bottom:14px;text-align:center}
        .loading-wrap{text-align:center;color:#BBB;padding:60px 0;font-size:14px}
        .guide-box{background:#FFFDE7;border:1px solid #FFD54F;border-radius:12px;padding:16px;margin-bottom:12px}
        .guide-box h4{font-size:13px;font-weight:700;color:#6B5900;margin-bottom:8px}
        .guide-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed #FFD54F;font-size:13px}
        .guide-row:last-child{border-bottom:none}
        .trip-chip{background:#E3F2FD;border-radius:8px;padding:6px 10px;font-size:12px;color:#1565C0;margin-bottom:4px;display:block}
        .hist-filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;align-items:center}
        .hist-filters select,.hist-filters input{border:1.5px solid #E5E7EB;border-radius:8px;padding:7px 10px;font-size:13px;outline:none;background:#FAFAFA;color:#333}
        .hist-filters select:focus,.hist-filters input:focus{border-color:#FFD54F}
        .goal-input{width:100%;border:1.5px solid #E5E7EB;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;color:#333;background:#FAFAFA}
        .goal-input:focus{border-color:#FFD54F}
        .divider{height:1px;background:#F5F5F5;margin:16px 0}
      `}</style>
      <div className="app">

        {/* 헤더 */}
        <div className="header">
          <div className="header-top">
            <h1>💰 가계부 대시보드</h1>
            <span className="period-label">{periodLabel} · {entries.length}건</span>
          </div>
          <div className="period-btns">
            {PERIOD_OPTIONS.map(o=>(
              <button key={o.key} className={`period-btn${period===o.key?' active':''}`} onClick={()=>setPeriod(o.key)}>{o.label}</button>
            ))}
          </div>
          {period==='custom' && (
            <div className="custom-range">
              <input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)}/>
              <span style={{color:'rgba(0,0,0,0.45)'}}>~</span>
              <input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)}/>
              <button onClick={loadData}>조회</button>
            </div>
          )}
        </div>

        {/* 탭 */}
        <div className="tabs">
          {[['dashboard','📊 대시보드'],['history','📋 내역'],['add','✏️ 기록'],['budgetTab','💰 예산'],['goals','🎯 목표']].map(([k,l])=>(
            <button key={k} className={`tab${tab===k?' active':''}`} onClick={()=>setTab(k)}>{l}</button>
          ))}
        </div>

        {error && <div className="error-banner">⚠️ {error}</div>}
        {loading && <div className="loading-wrap">📊 데이터 불러오는 중...</div>}

        {/* ── 대시보드 탭 ── */}
        {tab==='dashboard' && !loading && (
          <>
            {/* 동적 가이드 문구 */}
            <StatusMessage income={totalInc} expense={totalExp} impulseAmt={impulseAmt}/>

            {/* 배지 */}
            <div className="badges">
              {impulseRatio>30 && <span className="badge badge-red">⚠️ 충동소비 {impulseRatio}%</span>}
              {momPct!=null && <span className={`badge ${momDiff>0?'badge-red':'badge-green'}`}>{momDiff>0?'📈':'📉'} 전월 대비 {Math.abs(momPct)}% {momDiff>0?'증가':'감소'}</span>}
              {isThisMonth && forecast>0 && <span className="badge badge-blue">📅 이달 예상 {fmtShort(forecast)}</span>}
              {budgetUsed!=null && <span className={`badge ${budgetUsed>90?'badge-red':'badge-green'}`}>💼 예산 {budgetUsed}% 소진</span>}
              {longDistTrips.length>0 && <span className="badge badge-blue">🚅 장거리 {longDistTrips.length}회 {fmtShort(longDistTotal)}</span>}
            </div>

            {/* 밸런스 게이지 + 런웨이 */}
            <div className="grid2" style={{marginBottom:'14px'}}>
              <div className="card" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                <div className="section-title" style={{justifyContent:'center'}}>⚖️ 수입/지출 밸런스</div>
                <GaugeChart income={totalInc} expense={totalExp}/>
                <div style={{display:'flex',gap:'24px',marginTop:'10px',fontSize:'13px'}}>
                  <div style={{textAlign:'center'}}><div style={{color:'#2E7D32',fontWeight:'700'}}>{fmtShort(totalInc)}</div><div style={{color:'#bbb',fontSize:'11px'}}>수입</div></div>
                  <div style={{textAlign:'center'}}><div style={{color:'#E53935',fontWeight:'700'}}>{fmtShort(totalExp)}</div><div style={{color:'#bbb',fontSize:'11px'}}>지출</div></div>
                  <div style={{textAlign:'center'}}><div style={{color:totalInc-totalExp>=0?'#2E7D32':'#E53935',fontWeight:'700'}}>{fmtShort(Math.abs(totalInc-totalExp))}</div><div style={{color:'#bbb',fontSize:'11px'}}>{totalInc-totalExp>=0?'잔액':'적자'}</div></div>
                </div>
              </div>

              {runwayCash>0 && monthlyAvgForRunway>0 ? (
                <div className="card">
                  <div className="section-title">✈️ 런웨이 (생존 가능 기간)</div>
                  <RunwayGauge cash={runwayCash} monthlyAvg={monthlyAvgForRunway}/>
                  <div style={{fontSize:'11px',color:'#bbb',marginTop:'8px'}}>현재 자산 {fmtShort(runwayCash)} / 월평균 지출 {fmtShort(monthlyAvgForRunway)}</div>
                </div>
              ) : (
                <div className="card">
                  <div className="section-title">✈️ 런웨이</div>
                  <div style={{textAlign:'center',color:'#bbb',padding:'16px 0',fontSize:'13px'}}>
                    목표 탭에서 현재 자산을 입력하면<br/>생존 가능 기간을 계산해드려요
                  </div>
                  <button className="btn-secondary" style={{width:'100%',marginTop:'8px'}} onClick={()=>setTab('goals')}>설정하러 가기 →</button>
                </div>
              )}
            </div>

            {/* 핵심 지표 카드 */}
            <div className="grid3" style={{marginBottom:'14px'}}>
              <div className="card">
                <h3>일평균 지출</h3>
                <div className="big-num">{fmt(dailyAvg)}</div>
                <div className="sub-text">{daysPassed}일 기준</div>
              </div>
              <div className="card">
                <h3>최다 지출 카테고리</h3>
                <div className="big-num" style={{fontSize:'22px'}}>{catList[0]?.[0]||'-'}</div>
                <div className="sub-text">{catList[0]?fmt(catList[0][1]):'-'}</div>
              </div>
              {isThisMonth && forecast>0 && (
                <div className="card">
                  <h3>월말 예상 지출</h3>
                  <div className="big-num" style={{fontSize:'22px'}}>{fmtShort(forecast)}</div>
                  <div className="sub-text">현재 일평균 기준</div>
                </div>
              )}
              {totalBudget>0 && (
                <div className="card">
                  <h3>예산 소진율</h3>
                  <div className="big-num" style={{fontSize:'22px',color:budgetUsed>90?'#E53935':'#333'}}>{budgetUsed}%</div>
                  <div className="progress-bar" style={{marginTop:'8px'}}>
                    <div className="progress-fill" style={{width:`${Math.min(budgetUsed,100)}%`,background:budgetUsed>90?'#EF5350':budgetUsed>70?'#FFB300':'#81C784'}}/>
                  </div>
                  <div className="sub-text" style={{marginTop:'4px'}}>{fmt(totalExp)} / {fmt(totalBudget)}</div>
                </div>
              )}
            </div>

            {/* 버닝 차트 */}
            {isThisMonth && (
              <div className="card" style={{marginBottom:'14px'}}>
                <div className="section-title">🔥 예산 버닝 차트 (이번달)</div>
                <BurndownChart expenses={expenses} totalBudget={totalBudget} year={today2.getFullYear()} month={today2.getMonth()+1}/>
              </div>
            )}

            {/* 무지출 히트맵 */}
            <div className="card" style={{marginBottom:'14px'}}>
              <div className="section-title">🌱 무지출 데이 히트맵</div>
              <CalendarHeatmap expenses={expenses} year={heatmapYear} month={heatmapMonth}/>
            </div>

            {/* 트리맵 + 취향 예산 배터리 */}
            <div className="grid2" style={{marginBottom:'14px'}}>
              <div className="card">
                <div className="section-title">🗺 카테고리 트리맵</div>
                <TreemapChart data={treemapData}/>
                <div style={{fontSize:'11px',color:'#bbb',marginTop:'8px',textAlign:'center'}}>면적이 클수록 지출이 많은 카테고리</div>
              </div>
              <div className="card">
                <div className="section-title">🔋 취향/충동 예산 배터리</div>
                {hobbyBudget>0 ? (
                  <BatteryBar used={hobbySpent} total={hobbyBudget} label="이번달 취향 예산"/>
                ) : (
                  <div style={{textAlign:'center',color:'#bbb',padding:'16px 0',fontSize:'13px'}}>
                    목표 탭에서 취향 예산을 설정하면<br/>배터리 차트가 표시됩니다
                  </div>
                )}
                <div className="divider"/>
                <div className="section-title" style={{marginBottom:'8px',fontSize:'13px'}}>⚡ 충동소비</div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'13px',marginBottom:'6px'}}>
                  <span style={{color:'#666'}}>카페·배달·외식·쇼핑·의류</span>
                  <span style={{fontWeight:'700',color:impulseRatio>30?'#E53935':'#2E7D32'}}>{fmt(impulseAmt)} ({impulseRatio}%)</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{width:`${Math.min(impulseRatio,100)}%`,background:impulseRatio>30?'#EF5350':'#81C784'}}/>
                </div>
              </div>
            </div>

            {/* 목돈 목표 */}
            {savings.target>0 && (
              <div className="card" style={{marginBottom:'14px'}}>
                <div className="section-title">🪙 {savings.label}</div>
                <SavingsGoal current={savings.current} target={savings.target} label={savings.label}/>
              </div>
            )}

            {/* 월별 추이 */}
            {monthlyTrend.length > 1 && (
              <div className="card" style={{marginBottom:'14px'}}>
                <div className="section-title">📊 월별 지출 추이</div>
                <BarChart data={monthlyTrend} height={130}/>
              </div>
            )}

            {/* 요일 패턴 + 장거리 교통 */}
            <div className="grid2" style={{marginBottom:'14px'}}>
              <div className="card">
                <div className="section-title">📅 요일별 지출 패턴</div>
                <WeekdayChart data={weekdayTotals}/>
                <div style={{fontSize:'11px',color:'#bbb',marginTop:'8px',textAlign:'center'}}>요일별 누적 지출</div>
              </div>
              <div className="card">
                <div className="section-title">⚖️ 고정비 vs 변동비</div>
                {totalExp>0 ? (
                  <>
                    <div className="ratio-bar">
                      {fixedAmt>0 && <div className="ratio-item" style={{width:`${Math.round(fixedAmt/totalExp*100)}%`,background:'#81C784',minWidth:'50px'}}>고정 {Math.round(fixedAmt/totalExp*100)}%</div>}
                      <div className="ratio-item" style={{flex:1,background:'#4FC3F7',minWidth:'50px'}}>변동 {Math.round(variableAmt/totalExp*100)}%</div>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',marginTop:'10px',fontSize:'13px',gap:'8px',flexWrap:'wrap'}}>
                      <span style={{color:'#2E7D32'}}>고정: <strong>{fmt(fixedAmt)}</strong></span>
                      <span style={{color:'#01579B'}}>변동: <strong>{fmt(variableAmt)}</strong></span>
                    </div>
                    <div style={{fontSize:'11px',color:'#bbb',marginTop:'4px'}}>고정비: 주거비·공과금·통신·보험·구독</div>
                  </>
                ) : <div className="empty">데이터 없음</div>}
              </div>
            </div>

            {/* 결제처 TOP 10 */}
            <div className="card" style={{marginBottom:'14px'}}>
              <div className="section-title">🏪 결제처 TOP 10</div>
              {top10.length===0 ? <div className="empty">데이터 없음</div> :
                top10.map(([store,amt],i)=>(
                  <div key={i} className="top10-item">
                    <span className={`rank-badge${i===0?' gold':i===1?' silver':i===2?' bronze':''}`}>{i+1}</span>
                    <span style={{flex:1,fontWeight:i<3?'700':'400'}}>{store||'미상'}</span>
                    <div style={{width:'45%'}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px',fontSize:'12px'}}>
                        <span style={{color:'#bbb'}}>{Math.round(amt/totalExp*100)}%</span>
                        <span style={{fontWeight:'600'}}>{fmt(amt)}</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{width:`${Math.round(amt/top10[0][1]*100)}%`,background:i<3?'#4FC3F7':'#FFD54F'}}/>
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>

            {/* 카테고리별 예산 현황 */}
            {totalBudget>0 && (
              <div className="card">
                <div className="section-title">💼 카테고리별 예산 현황</div>
                {DISPLAY_CATS.map(cat=>{
                  const spent=catMap[cat]||0, bgt=budget[cat]||0
                  if(!bgt&&!spent) return null
                  const pct=bgt>0?Math.round(spent/bgt*100):null
                  return (
                    <div key={cat} style={{marginBottom:'14px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:'13px',marginBottom:'5px'}}>
                        <span style={{display:'flex',alignItems:'center',gap:'6px'}}>
                          <span style={{width:'8px',height:'8px',borderRadius:'50%',background:CAT_COLORS[cat]||'#ddd',display:'inline-block'}}/>
                          {cat}
                        </span>
                        <span>
                          <strong>{fmt(spent)}</strong>
                          {bgt>0 && <span style={{color:'#bbb'}}> / {fmt(bgt)}</span>}
                          {pct!=null && <span style={{marginLeft:'6px',fontSize:'12px',color:pct>100?'#E53935':pct>80?'#FF8F00':'#888'}}>{pct}%</span>}
                        </span>
                      </div>
                      {bgt>0 && (
                        <div className="progress-bar">
                          <div className="progress-fill" style={{width:`${Math.min(pct,100)}%`,background:pct>100?'#EF5350':pct>80?'#FFB300':'#81C784'}}/>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── 내역 탭 ── */}
        {tab==='history' && !loading && (
          <div className="card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px',flexWrap:'wrap',gap:'8px'}}>
              <div className="section-title" style={{margin:0}}>거래 내역 ({filteredEntries.length}건)</div>
              <div style={{fontSize:'13px',color:'#888'}}>지출 {fmt(totalExp)}</div>
            </div>
            <div className="hist-filters">
              <select value={histCat} onChange={e=>setHistCat(e.target.value)}>
                <option value="">전체 카테고리</option>
                {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              <input type="text" placeholder="결제처/메모 검색" value={histKeyword}
                onChange={e=>setHistKeyword(e.target.value)} style={{flex:1,minWidth:'120px'}}/>
              {(histCat||histKeyword) && (
                <button className="btn-secondary" style={{padding:'7px 12px'}} onClick={()=>{setHistCat('');setHistKeyword('')}}>초기화</button>
              )}
            </div>
            {filteredEntries.length===0 ? <div className="empty">거래 내역이 없습니다</div> :
              filteredEntries.map((e,i)=>(
                <div key={i} className="list-item">
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'3px',flexWrap:'wrap'}}>
                      <span style={{fontWeight:'600',fontSize:'14px'}}>{e.store||'미상'}</span>
                      <span className="tag" style={{background:(CAT_COLORS[e.category]||'#ddd')+'40'}}>{e.category}</span>
                      {e.payment && <span className="tag">{e.payment}</span>}
                    </div>
                    <div style={{fontSize:'11px',color:'#bbb'}}>{e.date} · 출처: {e.source}</div>
                    {e.memo && <div style={{fontSize:'11px',color:'#888',marginTop:'2px'}}>💬 {e.memo}</div>}
                  </div>
                  <div style={{textAlign:'right',flexShrink:0,paddingLeft:'10px'}}>
                    <div style={{fontWeight:'700',fontSize:'14px',color:e.type==='수입'?'#2E7D32':e.type==='이체'?'#999':'#333'}}>
                      {e.type==='수입'?'+':e.type==='이체'?'↔':'-'}{fmt(e.amount)}
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* ── 기록 탭 ── */}
        {tab==='add' && (
          <div className="card">
            <div className="section-title">✏️ 거래 직접 입력</div>
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label>날짜 및 시간</label>
                <input type="datetime-local" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>결제처 *</label>
                  <input type="text" placeholder="예: 스타벅스" value={form.store} onChange={e=>setForm(f=>({...f,store:e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label>금액 *</label>
                  <input type="number" placeholder="예: 5000" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>입출금</label>
                  <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                    <option>지출</option><option>수입</option><option>이체</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>카테고리</label>
                  <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                    {DISPLAY_CATS.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>결제수단</label>
                <select value={form.payment} onChange={e=>setForm(f=>({...f,payment:e.target.value}))}>
                  {PAYMENTS.map(p=><option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>메모 (선택)</label>
                <textarea rows="2" placeholder="메모를 입력하세요" value={form.memo}
                  onChange={e=>setForm(f=>({...f,memo:e.target.value}))} style={{resize:'vertical'}}/>
              </div>
              <button className="btn-primary" type="submit" disabled={submitting}>{submitting?'저장 중...':'💾 저장하기'}</button>
              {submitMsg && (
                <div style={{marginTop:'12px',textAlign:'center',fontSize:'13px',fontWeight:'600',color:submitMsg.includes('완료')?'#2E7D32':'#E53935'}}>{submitMsg}</div>
              )}
            </form>
          </div>
        )}

        {/* ── 예산 탭 ── */}
        {tab==='budgetTab' && (
          <>
            <div className="card" style={{marginBottom:'14px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
                <div className="section-title" style={{margin:0}}>📐 예산 가이드</div>
                <button className="btn-secondary" onClick={()=>setShowGuide(g=>!g)}>{showGuide?'접기':'가이드 보기'}</button>
              </div>
              {showGuide && (
                <>
                  <div style={{fontSize:'13px',color:'#666',marginBottom:'14px',lineHeight:'1.6'}}>처음 예산을 세울 때 참고할 수 있는 두 가지 방법이에요.</div>
                  <div className="guide-box">
                    <h4>💡 방법 1. 50/30/20 법칙 (권장)</h4>
                    <div style={{fontSize:'12px',color:'#888',marginBottom:'10px'}}>월 수입의 50%는 필수지출, 30%는 자유지출, 20%는 저축/투자</div>
                    <div style={{display:'flex',gap:'8px',marginBottom:'10px',flexWrap:'wrap'}}>
                      <input style={{flex:1,minWidth:'140px',border:'1.5px solid #FFD54F',borderRadius:'8px',padding:'8px 12px',fontSize:'13px',outline:'none',background:'#FFFDE7',color:'#333'}}
                        type="number" placeholder="월 수입 입력 (원)" value={guideIncome} onChange={e=>setGuideIncome(e.target.value)}/>
                      <button className="btn-secondary" onClick={apply5030}>계산하기</button>
                    </div>
                    {guideSuggest && (
                      <div style={{background:'#fff',borderRadius:'8px',padding:'12px',fontSize:'13px'}}>
                        <div className="guide-row"><span>🏠 필수지출 (50%)</span><strong>{fmt(guideSuggest.needs)}</strong></div>
                        <div className="guide-row"><span>🎉 자유지출 (30%)</span><strong style={{color:'#FF7043'}}>{fmt(guideSuggest.wants)}</strong></div>
                        <div className="guide-row"><span>💰 저축/투자 (20%)</span><strong style={{color:'#2E7D32'}}>{fmt(guideSuggest.savings)}</strong></div>
                      </div>
                    )}
                  </div>
                  <div className="guide-box" style={{marginBottom:0}}>
                    <h4>📊 방법 2. 과거 지출 평균 기반</h4>
                    <div style={{fontSize:'12px',color:'#888',marginBottom:'10px'}}>현재 조회 기간의 월평균 지출을 예산으로 자동 적용해요.</div>
                    <button className="btn-secondary" onClick={applyPastAverage}>평균으로 예산 채우기</button>
                  </div>
                </>
              )}
            </div>
            <div className="card">
              <div className="section-title">💰 카테고리별 월 예산 설정</div>
              <div style={{fontSize:'12px',color:'#bbb',marginBottom:'16px'}}>카테고리별 월 예산을 입력하면 대시보드에서 사용률을 확인할 수 있어요.</div>
              {DISPLAY_CATS.map(cat=>(
                <div key={cat} className="budget-row">
                  <div className="budget-label">
                    <span className="budget-dot" style={{background:CAT_COLORS[cat]||'#ddd'}}/>{cat}
                  </div>
                  <input className="budget-input" type="number" placeholder="0" value={budgetInput[cat]||''} onChange={e=>setBudgetInput(b=>({...b,[cat]:e.target.value}))}/>
                  <span style={{fontSize:'12px',color:'#bbb'}}>원</span>
                </div>
              ))}
              <div style={{marginTop:'16px',paddingTop:'12px',borderTop:'1px solid #f5f5f5',display:'flex',justifyContent:'space-between',fontSize:'13px',color:'#888'}}>
                <span>총 예산</span>
                <strong style={{color:'#333',fontSize:'15px'}}>{fmt(DISPLAY_CATS.reduce((s,c)=>s+(Number(budgetInput[c])||0),0))}</strong>
              </div>
              <button className="btn-primary" style={{marginTop:'16px'}} onClick={saveBudget}>💾 예산 저장</button>
            </div>
          </>
        )}

        {/* ── 목표 탭 ── */}
        {tab==='goals' && (
          <>
            {/* 런웨이 */}
            <div className="card" style={{marginBottom:'14px'}}>
              <div className="section-title">✈️ 런웨이 설정</div>
              <div style={{fontSize:'13px',color:'#666',lineHeight:'1.6',marginBottom:'14px'}}>
                현재 가용 가능한 현금을 입력하면 월평균 지출 기준으로 <strong>생존 가능 기간</strong>을 계산해드려요.
                목표는 최소 90일(3개월)입니다.
              </div>
              <div className="form-group">
                <label>현재 보유 현금/예금 (원)</label>
                <input className="goal-input" type="number" placeholder="예: 500000" value={runwayInput} onChange={e=>setRunwayInput(e.target.value)}/>
              </div>
              {runwayCash>0 && monthlyAvgForRunway>0 && (
                <div style={{background:'#F5F5F5',borderRadius:'10px',padding:'14px',marginTop:'8px'}}>
                  <RunwayGauge cash={runwayCash} monthlyAvg={monthlyAvgForRunway}/>
                </div>
              )}
            </div>

            {/* 목돈 목표 */}
            <div className="card" style={{marginBottom:'14px'}}>
              <div className="section-title">🪙 목돈 만들기</div>
              <div style={{fontSize:'13px',color:'#666',lineHeight:'1.6',marginBottom:'14px'}}>
                비상금, 이사 자금 등 목표 금액을 설정하고 진행률을 확인하세요.
              </div>
              <div className="form-group">
                <label>목표 이름</label>
                <input className="goal-input" placeholder="예: 비상금 300만원" value={savingsInput.label} onChange={e=>setSavingsInput(s=>({...s,label:e.target.value}))}/>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>현재 모인 금액 (원)</label>
                  <input className="goal-input" type="number" placeholder="0" value={savingsInput.current} onChange={e=>setSavingsInput(s=>({...s,current:e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label>목표 금액 (원)</label>
                  <input className="goal-input" type="number" placeholder="3000000" value={savingsInput.target} onChange={e=>setSavingsInput(s=>({...s,target:e.target.value}))}/>
                </div>
              </div>
              {savings.target>0 && (
                <div style={{background:'#F5F5F5',borderRadius:'10px',padding:'14px',marginTop:'8px'}}>
                  <SavingsGoal current={savings.current} target={savings.target} label={savings.label}/>
                </div>
              )}
            </div>

            {/* 취향 예산 배터리 */}
            <div className="card" style={{marginBottom:'14px'}}>
              <div className="section-title">🔋 취향 예산 배터리</div>
              <div style={{fontSize:'13px',color:'#666',lineHeight:'1.6',marginBottom:'14px'}}>
                스트레스 해소용 소비(카페·외식·쇼핑 등)에 한도를 설정해 배터리처럼 시각화합니다.
                배터리가 닳는 것을 보면 자연스럽게 소비를 멈추게 돼요.
              </div>
              <div className="form-group">
                <label>이번달 취향 예산 (원)</label>
                <input className="goal-input" type="number" placeholder="예: 200000" value={hobbyInput} onChange={e=>setHobbyInput(e.target.value)}/>
              </div>
              {hobbyBudget>0 && (
                <div style={{background:'#F5F5F5',borderRadius:'10px',padding:'14px',marginTop:'8px'}}>
                  <BatteryBar used={hobbySpent} total={hobbyBudget} label="취향/충동 지출"/>
                </div>
              )}
            </div>

            <button className="btn-primary" onClick={saveGoals}>💾 목표 저장</button>

            {/* 위시리스트 */}
            <div className="card" style={{marginTop:'14px'}}>
              <div className="section-title">⏳ 24시간 위시리스트</div>
              <div style={{fontSize:'13px',color:'#666',lineHeight:'1.6',marginBottom:'14px'}}>
                사고 싶은 것을 추가하면 24시간 타이머가 시작됩니다.
                타이머가 끝날 때까지 기다렸다가 여전히 원한다면 구매하세요. 충동소비의 70%는 24시간 안에 사라집니다.
              </div>
              <WishlistWidget wishlist={wishlist} setWishlist={setWishlist}/>
            </div>
          </>
        )}

        <div style={{textAlign:'center',fontSize:'11px',color:'#DDD',padding:'24px 0 8px'}}>
          가계부 자동화 대시보드 · Powered by Notion + n8n
        </div>
      </div>
    </>
  )
}
