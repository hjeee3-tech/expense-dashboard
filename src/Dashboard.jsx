import { useState, useEffect, useCallback, useMemo } from 'react'

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
  if (period === 'thisYear') {
    return { start:`${y}-01-01`, end:`${y}-12-31` }
  }
  if (period === 'all') {
    return { start:'2020-01-01', end:`${y+1}-12-31` }
  }
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
    sm++
    if(sm > 12) { sm=1; sy++ }
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

function DonutChart({ data, size=200 }) {
  const total = data.reduce((s,d)=>s+d.value,0)
  if(total===0) return <div style={{textAlign:'center',color:'#aaa',padding:'40px 0'}}>데이터 없음</div>
  let angle = -Math.PI/2
  const cx=size/2, cy=size/2, r=size*0.38, ir=size*0.22
  const slices = data.map(d=>{
    const start=angle, sweep=(d.value/total)*2*Math.PI
    angle+=sweep
    const x1=cx+r*Math.cos(start),y1=cy+r*Math.sin(start)
    const x2=cx+r*Math.cos(start+sweep),y2=cy+r*Math.sin(start+sweep)
    const ix1=cx+ir*Math.cos(start),iy1=cy+ir*Math.sin(start)
    const ix2=cx+ir*Math.cos(start+sweep),iy2=cy+ir*Math.sin(start+sweep)
    const large=sweep>Math.PI?1:0
    return {
      ...d,
      path:`M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${ix2},${iy2} A${ir},${ir} 0 ${large} 0 ${ix1},${iy1} Z`,
      pct: Math.round(d.value/total*100)
    }
  })
  return (
    <div style={{display:'flex',alignItems:'center',gap:'16px',flexWrap:'wrap',justifyContent:'center'}}>
      <svg width={size} height={size} style={{flexShrink:0}}>
        {slices.map((s,i)=><path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth="2"/>)}
        <text x={cx} y={cy-8} textAnchor="middle" fontSize="12" fill="#666">총지출</text>
        <text x={cx} y={cy+12} textAnchor="middle" fontSize="13" fontWeight="bold" fill="#333">{fmtShort(total)}</text>
      </svg>
      <div style={{display:'flex',flexDirection:'column',gap:'6px',minWidth:'120px'}}>
        {slices.filter(s=>s.pct>0).map((s,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px'}}>
            <span style={{width:'10px',height:'10px',borderRadius:'50%',background:s.color,flexShrink:0}}/>
            <span style={{color:'#555',flex:1}}>{s.name}</span>
            <span style={{color:'#333',fontWeight:'600'}}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BarChart({ data, height=160 }) {
  if(!data.length) return <div style={{textAlign:'center',color:'#aaa',padding:'40px 0'}}>데이터 없음</div>
  const maxV = Math.max(...data.map(d=>d.value),1)
  const W = 480, PAD_B = 36, PAD_T = 24
  const barW = Math.floor((W / data.length) * 0.55)
  const gap = W / data.length
  return (
    <div style={{width:'100%',overflowX:'auto'}}>
      <svg width="100%" viewBox={`0 0 ${W} ${height+PAD_T+PAD_B}`}
        preserveAspectRatio="xMidYMid meet" style={{display:'block'}}>
        {data.map((d,i)=>{
          const bh = Math.max((d.value/maxV)*(height-4),4)
          const cx = gap*i + gap/2
          const x = cx - barW/2
          const y = PAD_T + (height - bh)
          const isLast = i===data.length-1
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={bh}
                fill={isLast?'#FFD54F':'#81D4FA'} rx="4"/>
              <text x={cx} y={PAD_T+height+18} textAnchor="middle" fontSize="11" fill="#888">
                {d.label.slice(5)}
              </text>
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

export default function ExpenseDashboard() {
  const todayStr = new Date().toISOString().slice(0,10)
  const todayMonth = todayStr.slice(0,7)

  const [tab, setTab] = useState('dashboard')
  const [period, setPeriod] = useState(()=>localStorage.getItem(PERIOD_KEY)||'thisMonth')
  const [customStart, setCustomStart] = useState(todayMonth+'-01')
  const [customEnd, setCustomEnd] = useState(todayStr)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [budget, setBudget] = useState(()=>{
    try{ return JSON.parse(localStorage.getItem(BUDGET_KEY)||'{}') }catch{ return {} }
  })
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

  const range = useMemo(() => computeRange(period, customStart, customEnd), [period, customStart, customEnd])

  const loadData = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`${N8N}/webhook/get-expenses?start=${range.start}&end=${range.end}`)
      if(!res.ok) throw new Error('fetch fail')
      const data = await res.json()
      setEntries(data.entries || [])
    } catch(e) {
      setError('데이터를 불러오지 못했습니다. n8n 워크플로우를 확인해주세요.')
    }
    setLoading(false)
  }, [range])

  useEffect(()=>{ loadData() }, [loadData])
  useEffect(()=>{ localStorage.setItem(PERIOD_KEY, period) }, [period])
  useEffect(()=>{
    setBudgetInput(Object.fromEntries(DISPLAY_CATS.map(c=>[c, budget[c]||''])))
  }, [budget])

  const expenses = useMemo(() => entries.filter(e=>e.type==='지출'), [entries])
  const incomes  = useMemo(() => entries.filter(e=>e.type==='수입'), [entries])

  const totalExp = useMemo(() => expenses.reduce((s,e)=>s+e.amount,0), [expenses])
  const totalInc = useMemo(() => incomes.reduce((s,e)=>s+e.amount,0), [incomes])

  const catMap  = useMemo(() => {
    const m = {}
    expenses.forEach(e=>{ m[e.category]=(m[e.category]||0)+e.amount })
    return m
  }, [expenses])
  const catList = useMemo(() => Object.entries(catMap).sort((a,b)=>b[1]-a[1]), [catMap])

  const totalBudget = useMemo(() => DISPLAY_CATS.reduce((s,c)=>s+(Number(budget[c])||0),0), [budget])
  const budgetUsed  = totalBudget>0 ? Math.round(totalExp/totalBudget*100) : null

  const donutData = useMemo(() => catList.map(([name,value])=>({name,value,color:CAT_COLORS[name]||'#ddd'})), [catList])

  const monthlyTrend = useMemo(() => {
    const months = getMonthsInRange(range.start, range.end)
    if(months.length <= 1) return []
    return months.map(mo => ({
      label: mo,
      value: expenses.filter(e=>e.date&&e.date.startsWith(mo)).reduce((s,e)=>s+e.amount,0)
    }))
  }, [expenses, range])

  const longDistTrips = useMemo(() => expenses.filter(e=>e.category==='장거리교통'), [expenses])
  const longDistTotal = useMemo(() => longDistTrips.reduce((s,e)=>s+e.amount,0), [longDistTrips])

  const weekdayTotals = useMemo(() => {
    const arr = Array(7).fill(0)
    expenses.forEach(e=>{ if(e.date){ const d=new Date(e.date); arr[d.getDay()]+=e.amount } })
    return arr
  }, [expenses])

  const fixedAmt    = useMemo(() => expenses.filter(e=>FIXED_CATS.includes(e.category)).reduce((s,e)=>s+e.amount,0), [expenses])
  const variableAmt = totalExp - fixedAmt

  const storeMap = useMemo(() => {
    const m = {}
    expenses.forEach(e=>{ m[e.store]=(m[e.store]||0)+e.amount })
    return m
  }, [expenses])
  const top10 = useMemo(() => Object.entries(storeMap).sort((a,b)=>b[1]-a[1]).slice(0,10), [storeMap])

  const impulseAmt   = useMemo(() => expenses.filter(e=>IMPULSE_CATS.includes(e.category)).reduce((s,e)=>s+e.amount,0), [expenses])
  const impulseRatio = totalExp>0 ? Math.round(impulseAmt/totalExp*100) : 0

  const isThisMonth = period==='thisMonth'
  const today2      = new Date()
  const daysPassed  = isThisMonth ? today2.getDate()
    : Math.max(Math.round((new Date(range.end)-new Date(range.start))/86400000)+1, 1)
  const daysInMonth = isThisMonth ? new Date(today2.getFullYear(),today2.getMonth()+1,0).getDate() : daysPassed
  const dailyAvg    = daysPassed>0 ? Math.round(totalExp/daysPassed) : 0
  const forecast    = isThisMonth && daysPassed>0 ? Math.round(dailyAvg*daysInMonth) : 0

  const prevMonthAmt = useMemo(() => {
    if(monthlyTrend.length < 2) return null
    return monthlyTrend[monthlyTrend.length-2]?.value ?? null
  }, [monthlyTrend])
  const momDiff = prevMonthAmt!=null ? totalExp - prevMonthAmt : null
  const momPct  = prevMonthAmt>0 ? Math.round(momDiff/prevMonthAmt*100) : null

  const filteredEntries = useMemo(() => {
    return [...entries]
      .sort((a,b)=>(b.date||'').localeCompare(a.date||''))
      .filter(e => {
        if(histCat && e.category !== histCat) return false
        if(histKeyword && !((e.store||'').includes(histKeyword)||(e.memo||'').includes(histKeyword))) return false
        return true
      })
  }, [entries, histCat, histKeyword])

  const periodLabel = useMemo(() => {
    if(period==='custom') return `${customStart} ~ ${customEnd}`
    return PERIOD_OPTIONS.find(o=>o.key===period)?.label || '이번달'
  }, [period, customStart, customEnd])

  const apply5030 = () => {
    const inc = parseInt(guideIncome.replace(/,/g,'')) || 0
    if(!inc) return
    setGuideSuggest({
      needs: Math.round(inc*0.5),
      wants: Math.round(inc*0.3),
      savings: Math.round(inc*0.2),
    })
  }

  const applyPastAverage = () => {
    const months = getMonthsInRange(range.start, range.end)
    if(months.length < 2) { alert('2개월 이상 데이터가 필요합니다.'); return }
    const avgBudget = {}
    DISPLAY_CATS.forEach(cat => {
      const total = months.reduce((s,mo) =>
        s + expenses.filter(e=>e.date&&e.date.startsWith(mo)&&e.category===cat).reduce((ss,e)=>ss+e.amount,0), 0)
      avgBudget[cat] = Math.round(total / months.length / 1000) * 1000
    })
    setBudgetInput(Object.fromEntries(DISPLAY_CATS.map(c=>[c, avgBudget[c]||''])))
    setGuideSuggest(null)
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if(!form.store||!form.amount){ setSubmitMsg('결제처와 금액을 입력해주세요.'); return }
    setSubmitting(true); setSubmitMsg('')
    try {
      const res = await fetch(`${N8N}/webhook/add-expense`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          date: form.date, store: form.store,
          amount: parseInt(form.amount.replace(/,/g,'')),
          type: form.type, category: form.category,
          payment: form.payment, memo: form.memo
        })
      })
      if(!res.ok) throw new Error()
      setSubmitMsg('저장 완료! ✅')
      setForm(f=>({...f, store:'', amount:'', memo:''}))
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
        .tab{flex:1;padding:10px 4px;border:none;border-radius:10px;cursor:pointer;font-size:13px;font-weight:600;transition:all 0.2s;background:transparent;color:#888}
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
              <button key={o.key} className={`period-btn${period===o.key?' active':''}`}
                onClick={()=>setPeriod(o.key)}>{o.label}</button>
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
          {[['dashboard','📊 대시보드'],['history','📋 내역'],['add','✏️ 기록'],['budgetTab','💰 예산']].map(([k,l])=>(
            <button key={k} className={`tab${tab===k?' active':''}`} onClick={()=>setTab(k)}>{l}</button>
          ))}
        </div>

        {error && <div className="error-banner">⚠️ {error}</div>}
        {loading && <div className="loading-wrap">📊 데이터 불러오는 중...</div>}

        {/* ── 대시보드 탭 ── */}
        {tab==='dashboard' && !loading && (
          <>
            <div className="badges">
              {impulseRatio>30 && <span className="badge badge-red">⚠️ 충동소비 {impulseRatio}%</span>}
              {momPct!=null && <span className={`badge ${momDiff>0?'badge-red':'badge-green'}`}>
                {momDiff>0?'📈':'📉'} 전월 대비 {Math.abs(momPct)}% {momDiff>0?'증가':'감소'}
              </span>}
              {isThisMonth && forecast>0 && <span className="badge badge-blue">📅 이달 예상 {fmtShort(forecast)}</span>}
              {budgetUsed!=null && <span className={`badge ${budgetUsed>90?'badge-red':'badge-green'}`}>💼 예산 {budgetUsed}% 소진</span>}
              {longDistTrips.length>0 && <span className="badge badge-blue">🚅 장거리 {longDistTrips.length}회 {fmtShort(longDistTotal)}</span>}
            </div>

            <div className="grid3" style={{marginBottom:'14px'}}>
              <div className="card">
                <h3>총 지출</h3>
                <div className="big-num">{fmt(totalExp)}</div>
                <div className="sub-text">{expenses.length}건 · {periodLabel}</div>
              </div>
              <div className="card">
                <h3>총 수입</h3>
                <div className="big-num" style={{color:'#2E7D32'}}>{fmt(totalInc)}</div>
                <div className="sub-text">잔액 {fmt(totalInc-totalExp)}</div>
              </div>
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
                    <div className="progress-fill" style={{width:`${Math.min(budgetUsed,100)}%`,
                      background:budgetUsed>90?'#EF5350':budgetUsed>70?'#FFB300':'#81C784'}}/>
                  </div>
                  <div className="sub-text" style={{marginTop:'4px'}}>{fmt(totalExp)} / {fmt(totalBudget)}</div>
                </div>
              )}
            </div>

            {monthlyTrend.length > 1 && (
              <div className="card" style={{marginBottom:'14px'}}>
                <div className="section-title">📊 월별 지출 추이</div>
                <BarChart data={monthlyTrend} height={130}/>
              </div>
            )}

            <div className="grid2" style={{marginBottom:'14px'}}>
              <div className="card">
                <div className="section-title">📅 요일별 지출 패턴</div>
                <WeekdayChart data={weekdayTotals}/>
                <div style={{fontSize:'11px',color:'#bbb',marginTop:'8px',textAlign:'center'}}>요일별 누적 지출</div>
              </div>
              <div className="card">
                <div className="section-title">🚅 장거리 교통</div>
                {longDistTrips.length===0 ? (
                  <div className="empty">장거리 교통 내역 없음</div>
                ) : (
                  <>
                    <div style={{display:'flex',gap:'20px',marginBottom:'12px'}}>
                      <div>
                        <div style={{fontSize:'24px',fontWeight:'800'}}>{longDistTrips.length}회</div>
                        <div style={{fontSize:'12px',color:'#bbb'}}>이용 횟수</div>
                      </div>
                      <div>
                        <div style={{fontSize:'24px',fontWeight:'800',color:'#1565C0'}}>{fmtShort(longDistTotal)}</div>
                        <div style={{fontSize:'12px',color:'#bbb'}}>총 교통비</div>
                      </div>
                    </div>
                    {longDistTrips.slice(0,3).map((t,i)=>(
                      <span key={i} className="trip-chip">
                        {t.date?.slice(5)} · {t.store||'미상'} · {fmt(t.amount)}
                      </span>
                    ))}
                    {longDistTrips.length>3 && <div style={{fontSize:'12px',color:'#bbb',marginTop:'4px'}}>외 {longDistTrips.length-3}건</div>}
                  </>
                )}
              </div>
            </div>

            <div className="grid2" style={{marginBottom:'14px'}}>
              <div className="card">
                <div className="section-title">🍩 카테고리 분포</div>
                <DonutChart data={donutData}/>
              </div>
              <div className="card">
                <div className="section-title">⚖️ 고정비 vs 변동비</div>
                {totalExp>0 ? (
                  <>
                    <div className="ratio-bar">
                      {fixedAmt>0 && (
                        <div className="ratio-item" style={{width:`${Math.round(fixedAmt/totalExp*100)}%`,background:'#81C784',minWidth:'50px'}}>
                          고정 {Math.round(fixedAmt/totalExp*100)}%
                        </div>
                      )}
                      <div className="ratio-item" style={{flex:1,background:'#4FC3F7',minWidth:'50px'}}>
                        변동 {Math.round(variableAmt/totalExp*100)}%
                      </div>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',marginTop:'10px',fontSize:'13px',gap:'8px',flexWrap:'wrap'}}>
                      <span style={{color:'#2E7D32'}}>고정: <strong>{fmt(fixedAmt)}</strong></span>
                      <span style={{color:'#01579B'}}>변동: <strong>{fmt(variableAmt)}</strong></span>
                    </div>
                    <div style={{fontSize:'11px',color:'#bbb',marginTop:'4px'}}>고정비: 주거비·공과금·통신·보험·구독</div>
                  </>
                ) : <div className="empty">데이터 없음</div>}

                <div style={{marginTop:'16px',paddingTop:'14px',borderTop:'1px solid #f5f5f5'}}>
                  <div className="section-title" style={{marginBottom:'8px',fontSize:'13px'}}>⚡ 충동소비</div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:'13px',marginBottom:'6px'}}>
                    <span style={{color:'#666'}}>카페·배달·외식·쇼핑·의류</span>
                    <span style={{fontWeight:'700',color:impulseRatio>30?'#E53935':'#2E7D32'}}>
                      {fmt(impulseAmt)} ({impulseRatio}%)
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{width:`${Math.min(impulseRatio,100)}%`,
                      background:impulseRatio>30?'#EF5350':'#81C784'}}/>
                  </div>
                  {impulseRatio>30 && <div style={{fontSize:'11px',color:'#E53935',marginTop:'5px'}}>⚠️ 충동소비 30% 초과!</div>}
                </div>
              </div>
            </div>

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

            {totalBudget>0 && (
              <div className="card">
                <div className="section-title">💼 카테고리별 예산 현황</div>
                {DISPLAY_CATS.map(cat=>{
                  const spent = catMap[cat]||0
                  const bgt = budget[cat]||0
                  if(!bgt&&!spent) return null
                  const pct = bgt>0 ? Math.round(spent/bgt*100) : null
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
                          {pct!=null && <span style={{marginLeft:'6px',fontSize:'12px',
                            color:pct>100?'#E53935':pct>80?'#FF8F00':'#888'}}>{pct}%</span>}
                        </span>
                      </div>
                      {bgt>0 && (
                        <div className="progress-bar">
                          <div className="progress-fill" style={{width:`${Math.min(pct,100)}%`,
                            background:pct>100?'#EF5350':pct>80?'#FFB300':'#81C784'}}/>
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
                <button className="btn-secondary" style={{padding:'7px 12px'}}
                  onClick={()=>{setHistCat('');setHistKeyword('')}}>초기화</button>
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
                    <div style={{fontWeight:'700',fontSize:'14px',
                      color:e.type==='수입'?'#2E7D32':e.type==='이체'?'#999':'#333'}}>
                      {e.type==='수입'?'+':e.type==='이체'?'↔':'-'}{fmt(e.amount)}
                    </div>
                    {e.type==='이체' && <div style={{fontSize:'10px',color:'#bbb'}}>이체</div>}
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
                <input type="datetime-local" value={form.date}
                  onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>결제처 *</label>
                  <input type="text" placeholder="예: 스타벅스" value={form.store}
                    onChange={e=>setForm(f=>({...f,store:e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label>금액 *</label>
                  <input type="number" placeholder="예: 5000" value={form.amount}
                    onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/>
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
              <button className="btn-primary" type="submit" disabled={submitting}>
                {submitting?'저장 중...':'💾 저장하기'}
              </button>
              {submitMsg && (
                <div style={{marginTop:'12px',textAlign:'center',fontSize:'13px',fontWeight:'600',
                  color:submitMsg.includes('완료')?'#2E7D32':'#E53935'}}>{submitMsg}</div>
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
                <button className="btn-secondary" onClick={()=>setShowGuide(g=>!g)}>
                  {showGuide?'접기':'가이드 보기'}
                </button>
              </div>
              {showGuide && (
                <>
                  <div style={{fontSize:'13px',color:'#666',marginBottom:'14px',lineHeight:'1.6'}}>
                    처음 예산을 세울 때 참고할 수 있는 두 가지 방법이에요.
                  </div>
                  <div className="guide-box">
                    <h4>💡 방법 1. 50/30/20 법칙 (권장)</h4>
                    <div style={{fontSize:'12px',color:'#888',marginBottom:'10px'}}>
                      월 수입의 50%는 필수지출, 30%는 자유지출, 20%는 저축/투자
                    </div>
                    <div style={{display:'flex',gap:'8px',marginBottom:'10px',flexWrap:'wrap'}}>
                      <input style={{flex:1,minWidth:'140px',border:'1.5px solid #FFD54F',borderRadius:'8px',
                        padding:'8px 12px',fontSize:'13px',outline:'none',background:'#FFFDE7',color:'#333'}}
                        type="number" placeholder="월 수입 입력 (원)"
                        value={guideIncome} onChange={e=>setGuideIncome(e.target.value)}/>
                      <button className="btn-secondary" onClick={apply5030}>계산하기</button>
                    </div>
                    {guideSuggest && (
                      <div style={{background:'#fff',borderRadius:'8px',padding:'12px',fontSize:'13px'}}>
                        <div className="guide-row">
                          <span>🏠 필수지출 (50%) — 주거·식비·교통·공과금</span>
                          <strong>{fmt(guideSuggest.needs)}</strong>
                        </div>
                        <div className="guide-row">
                          <span>🎉 자유지출 (30%) — 외식·쇼핑·여가·취미</span>
                          <strong style={{color:'#FF7043'}}>{fmt(guideSuggest.wants)}</strong>
                        </div>
                        <div className="guide-row">
                          <span>💰 저축/투자 (20%)</span>
                          <strong style={{color:'#2E7D32'}}>{fmt(guideSuggest.savings)}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="guide-box" style={{marginBottom:0}}>
                    <h4>📊 방법 2. 과거 지출 평균 기반</h4>
                    <div style={{fontSize:'12px',color:'#888',marginBottom:'10px'}}>
                      현재 조회 기간의 월평균 지출을 예산으로 자동 적용해요. (2개월 이상 필요)
                    </div>
                    <button className="btn-secondary" onClick={applyPastAverage}>평균으로 예산 채우기</button>
                  </div>
                </>
              )}
            </div>

            <div className="card">
              <div className="section-title">💰 카테고리별 월 예산 설정</div>
              <div style={{fontSize:'12px',color:'#bbb',marginBottom:'16px'}}>
                카테고리별 월 예산을 입력하면 대시보드에서 사용률을 확인할 수 있어요.
              </div>
              {DISPLAY_CATS.map(cat=>(
                <div key={cat} className="budget-row">
                  <div className="budget-label">
                    <span className="budget-dot" style={{background:CAT_COLORS[cat]||'#ddd'}}/>
                    {cat}
                  </div>
                  <input className="budget-input" type="number" placeholder="0"
                    value={budgetInput[cat]||''}
                    onChange={e=>setBudgetInput(b=>({...b,[cat]:e.target.value}))}/>
                  <span style={{fontSize:'12px',color:'#bbb'}}>원</span>
                </div>
              ))}
              <div style={{marginTop:'16px',paddingTop:'12px',borderTop:'1px solid #f5f5f5',
                display:'flex',justifyContent:'space-between',fontSize:'13px',color:'#888'}}>
                <span>총 예산</span>
                <strong style={{color:'#333',fontSize:'15px'}}>
                  {fmt(DISPLAY_CATS.reduce((s,c)=>s+(Number(budgetInput[c])||0),0))}
                </strong>
              </div>
              <button className="btn-primary" style={{marginTop:'16px'}} onClick={saveBudget}>
                💾 예산 저장
              </button>
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
