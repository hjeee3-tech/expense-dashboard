import { useState, useEffect, useCallback } from 'react'

const N8N = import.meta.env.VITE_N8N_URL || 'https://jeee.app.n8n.cloud'

const CATEGORIES = ['식비','카페/간식','교통','쇼핑','생활용품','문화/여가','의료','통신','구독','경조사','기타']
const PAYMENTS = ['신용카드','체크카드','현금','이체']
const CAT_COLORS = {
  '식비':'#FFD54F','카페/간식':'#4FC3F7','교통':'#81C784','쇼핑':'#F48FB1',
  '생활용품':'#CE93D8','문화/여가':'#80DEEA','의료':'#FFAB91','통신':'#B0BEC5',
  '구독':'#FFF176','경조사':'#A5D6A7','기타':'#BCAAA4'
}
const BUDGET_KEY = 'keb_budget'

function fmt(n) { return Number(n||0).toLocaleString()+'원' }
function fmtShort(n) { n=Number(n||0); return n>=10000?Math.round(n/10000)+'만':n.toLocaleString() }

function getMonthList(base, count=6) {
  const result=[]
  const [y,m] = base.split('-').map(Number)
  for(let i=count-1;i>=0;i--) {
    let mm=m-i, yy=y
    while(mm<=0){mm+=12;yy--}
    result.push(`${yy}-${String(mm).padStart(2,'0')}`)
  }
  return result
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

function BarChart({ data, height=140 }) {
  if(!data.length) return <div style={{textAlign:'center',color:'#aaa',padding:'40px 0'}}>데이터 없음</div>
  const maxV = Math.max(...data.map(d=>d.value),1)
  const barW = Math.floor(100/data.length)-2
  return (
    <div style={{width:'100%',overflowX:'auto'}}>
      <svg width="100%" height={height+40} viewBox={`0 0 100 ${height+40}`} preserveAspectRatio="none">
        {data.map((d,i)=>{
          const bh=Math.max((d.value/maxV)*(height-10),2)
          const x=i*(100/data.length)+1
          const y=height-bh+5
          const isLast=i===data.length-1
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={bh} fill={isLast?'#FFD54F':'#81D4FA'} rx="1"/>
              <text x={x+barW/2} y={height+16} textAnchor="middle" fontSize="4.5" fill="#888">{d.label.slice(5)}</text>
              <text x={x+barW/2} y={y-2} textAnchor="middle" fontSize="4" fill="#555">{fmtShort(d.value)}</text>
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
  const today = new Date().toISOString().slice(0,7)
  const [tab, setTab] = useState('dashboard')
  const [month, setMonth] = useState(today)
  const [entries, setEntries] = useState([])
  const [trend, setTrend] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [budget, setBudget] = useState(()=>{
    try{ return JSON.parse(localStorage.getItem(BUDGET_KEY)||'{}') }catch{ return {} }
  })
  const [budgetInput, setBudgetInput] = useState({})
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0,16),
    store:'', amount:'', type:'지출', category:'식비', payment:'신용카드', memo:''
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState('')

  const fetchMonth = useCallback(async (m) => {
    const res = await fetch(`${N8N}/webhook/get-expenses?month=${m}`)
    if(!res.ok) throw new Error('fetch fail')
    const data = await res.json()
    return { month: m, entries: data.entries || [] }
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const months = getMonthList(month, 6)
      const results = await Promise.all(months.map(m=>fetchMonth(m)))
      const current = results.find(r=>r.month===month)
      setEntries(current?.entries||[])
      setTrend(results.map(r=>({
        label: r.month,
        value: r.entries.filter(e=>e.type==='지출').reduce((s,e)=>s+e.amount,0)
      })))
    } catch(e) {
      setError('데이터를 불러오지 못했습니다. n8n 워크플로우를 확인해주세요.')
    }
    setLoading(false)
  }, [month, fetchMonth])

  useEffect(()=>{ loadData() }, [loadData])
  useEffect(()=>{
    setBudgetInput(Object.fromEntries(CATEGORIES.map(c=>[c, budget[c]||''])))
  }, [budget])

  const expenses = entries.filter(e=>e.type==='지출')
  const incomes = entries.filter(e=>e.type==='수입')
  const totalExp = expenses.reduce((s,e)=>s+e.amount,0)
  const totalInc = incomes.reduce((s,e)=>s+e.amount,0)
  const totalBudget = CATEGORIES.reduce((s,c)=>s+(Number(budget[c])||0),0)
  const budgetUsed = totalBudget>0 ? Math.round(totalExp/totalBudget*100) : null

  const catMap = {}
  expenses.forEach(e=>{ catMap[e.category]=(catMap[e.category]||0)+e.amount })
  const catList = Object.entries(catMap).sort((a,b)=>b[1]-a[1])
  const topCat = catList[0]?.[0]||'-'

  const today2 = new Date()
  const daysInMonth = new Date(today2.getFullYear(), today2.getMonth()+1, 0).getDate()
  const daysPassed = month===today ? today2.getDate() : daysInMonth
  const dailyAvg = daysPassed>0 ? Math.round(totalExp/daysPassed) : 0
  const forecast = Math.round(dailyAvg*daysInMonth)

  const weekdayTotals = Array(7).fill(0)
  expenses.forEach(e=>{ if(e.date){ const d=new Date(e.date); weekdayTotals[d.getDay()]+=e.amount } })

  const fixedCats = ['통신','구독','의료']
  const fixedAmt = expenses.filter(e=>fixedCats.includes(e.category)).reduce((s,e)=>s+e.amount,0)
  const variableAmt = totalExp - fixedAmt

  const storeMap = {}
  expenses.forEach(e=>{ storeMap[e.store]=(storeMap[e.store]||0)+e.amount })
  const top10 = Object.entries(storeMap).sort((a,b)=>b[1]-a[1]).slice(0,10)

  const impulseCats = ['카페/간식','쇼핑']
  const impulseAmt = expenses.filter(e=>impulseCats.includes(e.category)).reduce((s,e)=>s+e.amount,0)
  const impulseRatio = totalExp>0 ? Math.round(impulseAmt/totalExp*100) : 0

  const prevMonth = trend.length>=2 ? trend[trend.length-2]?.value : null
  const momDiff = prevMonth!=null ? totalExp-prevMonth : null
  const momPct = prevMonth>0 ? Math.round(momDiff/prevMonth*100) : null

  const donutData = catList.map(([name,value])=>({name,value,color:CAT_COLORS[name]||'#ddd'}))

  const handleAdd = async (e) => {
    e.preventDefault()
    if(!form.store||!form.amount){ setSubmitMsg('결제처와 금액을 입력해주세요.'); return }
    setSubmitting(true); setSubmitMsg('')
    try {
      const res = await fetch(`${N8N}/webhook/add-expense`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
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
      if(form.date.slice(0,7)===month) loadData()
    } catch {
      setSubmitMsg('저장 실패. n8n 연결을 확인해주세요.')
    }
    setSubmitting(false)
  }

  const saveBudget = () => {
    const updated = {}
    CATEGORIES.forEach(c=>{ if(budgetInput[c]) updated[c]=Number(budgetInput[c]) })
    setBudget(updated)
    localStorage.setItem(BUDGET_KEY, JSON.stringify(updated))
    alert('예산이 저장되었습니다!')
  }

  const prevM = ()=>{
    const [y,m2]=month.split('-').map(Number)
    let nm=m2-1,ny=y; if(nm===0){nm=12;ny--}
    setMonth(`${ny}-${String(nm).padStart(2,'0')}`)
  }
  const nextM = ()=>{
    const [y,m2]=month.split('-').map(Number)
    let nm=m2+1,ny=y; if(nm===13){nm=1;ny++}
    const next=`${ny}-${String(nm).padStart(2,'0')}`
    if(next<=today) setMonth(next)
  }

  return (
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#F4F7FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR',sans-serif;color:#333}
        .app{max-width:1200px;margin:0 auto;padding:16px}
        .header{background:linear-gradient(135deg,#FFD54F 0%,#4FC3F7 100%);border-radius:16px;padding:20px 24px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
        .header h1{font-size:20px;font-weight:800;color:#333}
        .month-nav{display:flex;align-items:center;gap:12px}
        .month-nav button{background:rgba(255,255,255,0.65);border:none;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:16px;font-weight:700;transition:background 0.2s;color:#333}
        .month-nav button:hover:not(:disabled){background:rgba(255,255,255,0.9)}
        .month-nav button:disabled{opacity:0.3;cursor:default}
        .month-nav span{font-size:15px;font-weight:700;color:#333;min-width:84px;text-align:center}
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
        .card-full{grid-column:1/-1}
        .card h3{font-size:12px;color:#999;font-weight:500;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px}
        .big-num{font-size:26px;font-weight:800;color:#333;line-height:1.1}
        .sub-text{font-size:12px;color:#bbb;margin-top:4px}
        .badges{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
        .badge{display:inline-flex;align-items:center;gap:5px;border-radius:20px;padding:6px 12px;font-size:12px;font-weight:600}
        .badge-yellow{background:#FFFDE7;border:1px solid #FFD54F;color:#6B5900}
        .badge-blue{background:#E1F5FE;border:1px solid #4FC3F7;color:#01579B}
        .badge-green{background:#E8F5E9;border:1px solid #81C784;color:#1B5E20}
        .badge-red{background:#FFF3E0;border:1px solid #FFAB91;color:#BF360C}
        .section-title{font-size:14px;font-weight:700;color:#444;margin-bottom:12px;display:flex;align-items:center;gap:6px}
        .progress-bar{background:#EEEEEE;border-radius:99px;height:8px;overflow:hidden}
        .progress-fill{height:100%;border-radius:99px;transition:width 0.4s ease}
        .list-item{display:flex;justify-content:space-between;align-items:flex-start;padding:10px 0;border-bottom:1px solid #F5F5F5}
        .list-item:last-child{border-bottom:none}
        .tag{background:#F3F4F6;border-radius:6px;padding:2px 7px;font-size:11px;color:#666}
        .form-group{margin-bottom:12px}
        .form-group label{display:block;font-size:12px;color:#888;margin-bottom:4px;font-weight:500}
        .form-group input,.form-group select,.form-group textarea{width:100%;border:1.5px solid #E5E7EB;border-radius:10px;padding:10px 12px;font-size:14px;background:#FAFAFA;transition:border 0.2s;outline:none;color:#333}
        .form-group input:focus,.form-group select:focus,.form-group textarea:focus{border-color:#FFD54F;background:#fff;box-shadow:0 0 0 3px rgba(255,213,79,0.15)}
        .btn-primary{background:#FFD54F;border:none;border-radius:12px;padding:13px 24px;font-size:14px;font-weight:700;cursor:pointer;width:100%;transition:background 0.2s;color:#333;margin-top:4px}
        .btn-primary:hover:not(:disabled){background:#FFC107}
        .btn-primary:disabled{background:#EEE;color:#AAA;cursor:default}
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
      `}</style>
      <div className="app">

        {/* 헤더 */}
        <div className="header">
          <h1>💰 가계부 대시보드</h1>
          <div className="month-nav">
            <button onClick={prevM}>‹</button>
            <span>{month}</span>
            <button onClick={nextM} disabled={month>=today}>›</button>
          </div>
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
            {/* 인사이트 배지 */}
            <div className="badges">
              {impulseRatio>30 && <span className="badge badge-red">⚠️ 충동소비 {impulseRatio}% (카페+쇼핑)</span>}
              {momPct!=null && <span className={`badge ${momDiff>0?'badge-red':'badge-green'}`}>
                {momDiff>0?'📈':'📉'} 전월 대비 {Math.abs(momPct)}% {momDiff>0?'증가':'감소'}
              </span>}
              {month===today && forecast>0 && <span className="badge badge-blue">📅 이달 예상 {fmtShort(forecast)}</span>}
              {budgetUsed!=null && <span className={`badge ${budgetUsed>90?'badge-red':'badge-green'}`}>
                💼 예산 {budgetUsed}% 소진
              </span>}
            </div>

            {/* 요약 카드 */}
            <div className="grid3" style={{marginBottom:'14px'}}>
              <div className="card">
                <h3>이번 달 지출</h3>
                <div className="big-num">{fmt(totalExp)}</div>
                <div className="sub-text">총 {expenses.length}건</div>
              </div>
              <div className="card">
                <h3>이번 달 수입</h3>
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
                <div className="big-num" style={{fontSize:'22px'}}>{topCat}</div>
                <div className="sub-text">{catList[0]?fmt(catList[0][1]):'-'}</div>
              </div>
              <div className="card">
                <h3>월말 예상 지출</h3>
                <div className="big-num" style={{fontSize:'22px'}}>{fmtShort(forecast)}</div>
                <div className="sub-text">현재 일평균 기준</div>
              </div>
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

            {/* 6개월 추이 + 요일 패턴 */}
            <div className="grid2" style={{marginBottom:'14px'}}>
              <div className="card">
                <div className="section-title">📊 6개월 지출 추이</div>
                <BarChart data={trend} height={130}/>
              </div>
              <div className="card">
                <div className="section-title">📅 요일별 지출 패턴</div>
                <WeekdayChart data={weekdayTotals}/>
                <div style={{fontSize:'11px',color:'#bbb',marginTop:'8px',textAlign:'center'}}>평균 지출 기준</div>
              </div>
            </div>

            {/* 카테고리 도넛 + 고정/변동비 */}
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
                        <div className="ratio-item" style={{
                          width:`${Math.round(fixedAmt/totalExp*100)}%`,
                          background:'#81C784',minWidth:'50px'}}>
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
                    <div style={{fontSize:'11px',color:'#bbb',marginTop:'4px'}}>고정비: 통신·구독·의료</div>
                  </>
                ) : <div className="empty">데이터 없음</div>}

                {/* 충동소비 */}
                <div style={{marginTop:'16px',paddingTop:'14px',borderTop:'1px solid #f5f5f5'}}>
                  <div className="section-title" style={{marginBottom:'8px',fontSize:'13px'}}>⚡ 충동소비 분석</div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:'13px',marginBottom:'6px'}}>
                    <span style={{color:'#666'}}>카페/간식 + 쇼핑</span>
                    <span style={{fontWeight:'700',color:impulseRatio>30?'#E53935':'#2E7D32'}}>
                      {fmt(impulseAmt)} ({impulseRatio}%)
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{width:`${Math.min(impulseRatio,100)}%`,
                      background:impulseRatio>30?'#EF5350':'#81C784'}}/>
                  </div>
                  {impulseRatio>30 && (
                    <div style={{fontSize:'11px',color:'#E53935',marginTop:'5px'}}>⚠️ 충동소비 비중 30% 초과!</div>
                  )}
                </div>
              </div>
            </div>

            {/* TOP 10 결제처 */}
            <div className="card" style={{marginBottom:'14px'}}>
              <div className="section-title">🏪 결제처 TOP 10</div>
              {top10.length===0 ? <div className="empty">데이터 없음</div> :
                top10.map(([store,amt],i)=>(
                  <div key={i} className="top10-item">
                    <span className={`rank-badge${i===0?' gold':i===1?' silver':i===2?' bronze':''}`}>{i+1}</span>
                    <span style={{flex:1,fontWeight:i<3?'700':'400',fontSize:i<3?'14px':'13px'}}>{store||'미상'}</span>
                    <div style={{width:'45%'}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px',fontSize:'12px'}}>
                        <span style={{color:'#bbb'}}>{Math.round(amt/totalExp*100)}%</span>
                        <span style={{fontWeight:'600'}}>{fmt(amt)}</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{
                          width:`${Math.round(amt/top10[0][1]*100)}%`,
                          background:i<3?'#4FC3F7':'#FFD54F'}}/>
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
                {CATEGORIES.map(cat=>{
                  const spent = catMap[cat]||0
                  const bgt = budget[cat]||0
                  if(!bgt&&!spent) return null
                  const pct = bgt>0 ? Math.round(spent/bgt*100) : null
                  return (
                    <div key={cat} style={{marginBottom:'14px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:'13px',marginBottom:'5px'}}>
                        <span style={{display:'flex',alignItems:'center',gap:'6px'}}>
                          <span style={{width:'8px',height:'8px',borderRadius:'50%',background:CAT_COLORS[cat],display:'inline-block'}}/>
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
                          <div className="progress-fill" style={{
                            width:`${Math.min(pct,100)}%`,
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
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px'}}>
              <div className="section-title" style={{margin:0}}>거래 내역 ({entries.length}건)</div>
              <div style={{fontSize:'13px',color:'#888'}}>지출 {fmt(totalExp)}</div>
            </div>
            {entries.length===0 ? <div className="empty">거래 내역이 없습니다</div> :
              [...entries].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map((e,i)=>(
                <div key={i} className="list-item">
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'3px',flexWrap:'wrap'}}>
                      <span style={{fontWeight:'600',fontSize:'14px'}}>{e.store||'미상'}</span>
                      <span className="tag" style={{background:(CAT_COLORS[e.category]||'#ddd')+'40'}}>{e.category}</span>
                      <span className="tag">{e.payment}</span>
                    </div>
                    <div style={{fontSize:'11px',color:'#bbb'}}>{e.date} · 출처: {e.source}</div>
                    {e.memo && <div style={{fontSize:'11px',color:'#888',marginTop:'2px'}}>💬 {e.memo}</div>}
                  </div>
                  <div style={{textAlign:'right',flexShrink:0,paddingLeft:'10px'}}>
                    <div style={{fontWeight:'700',color:e.type==='수입'?'#2E7D32':'#333',fontSize:'14px'}}>
                      {e.type==='수입'?'+':'-'}{fmt(e.amount)}
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
                    <option>지출</option><option>수입</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>카테고리</label>
                  <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                    {CATEGORIES.map(c=><option key={c}>{c}</option>)}
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
                  onChange={e=>setForm(f=>({...f,memo:e.target.value}))}
                  style={{resize:'vertical'}}/>
              </div>
              <button className="btn-primary" type="submit" disabled={submitting}>
                {submitting?'저장 중...':'💾 저장하기'}
              </button>
              {submitMsg && (
                <div style={{marginTop:'12px',textAlign:'center',fontSize:'13px',fontWeight:'600',
                  color:submitMsg.includes('완료')?'#2E7D32':'#E53935'}}>
                  {submitMsg}
                </div>
              )}
            </form>
          </div>
        )}

        {/* ── 예산 탭 ── */}
        {tab==='budgetTab' && (
          <div className="card">
            <div className="section-title">💰 월별 카테고리 예산 설정</div>
            <div style={{fontSize:'12px',color:'#bbb',marginBottom:'16px'}}>
              카테고리별 월 예산을 입력하면 대시보드에서 사용률을 확인할 수 있어요.
            </div>
            {CATEGORIES.map(cat=>(
              <div key={cat} className="budget-row">
                <div className="budget-label">
                  <span className="budget-dot" style={{background:CAT_COLORS[cat]}}/>
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
                {fmt(CATEGORIES.reduce((s,c)=>s+(Number(budgetInput[c])||0),0))}
              </strong>
            </div>
            <button className="btn-primary" style={{marginTop:'16px'}} onClick={saveBudget}>
              💾 예산 저장
            </button>
          </div>
        )}

        <div style={{textAlign:'center',fontSize:'11px',color:'#DDD',padding:'24px 0 8px'}}>
          가계부 자동화 대시보드 · Powered by Notion + n8n
        </div>
      </div>
    </>
  )
}
