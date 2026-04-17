import { useState, useEffect, useRef } from "react";

// ── n8n 주소 설정 (Vercel 환경변수에서 읽거나 기본값 사용) ──
const N8N = import.meta.env.VITE_N8N_URL || "https://jeee.app.n8n.cloud";

const CATEGORIES = ["식비","카페/간식","교통","쇼핑","생활용품","문화/여가","의료","통신","구독","경조사","기타"];
const PAYMENTS   = ["신용카드","체크카드","현금","이체"];
const TYPES      = ["지출","수입"];

const CAT_COLORS = {
  "식비":"#ef4444","카페/간식":"#f97316","교통":"#eab308","쇼핑":"#22c55e",
  "생활용품":"#3b82f6","문화/여가":"#a855f7","의료":"#ec4899","통신":"#6b7280",
  "구독":"#92400e","경조사":"#64748b","기타":"#94a3b8"
};

const fmt  = n => (n ?? 0).toLocaleString("ko-KR");
const fmtD = d => {
  if (!d) return "";
  const dt = new Date(d);
  return `${dt.getMonth()+1}/${dt.getDate()} ${String(dt.getHours()).padStart(2,"0")}:${String(dt.getMinutes()).padStart(2,"0")}`;
};

function MiniBar({ data, maxVal }) {
  if (!data.length) return null;
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:80 }}>
      {data.map((d,i) => (
        <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
          <div style={{
            width:"100%", minWidth:8,
            height: maxVal ? Math.max(4, (d.value/maxVal)*70) : 4,
            background: d.color || "#a78bfa", borderRadius:3, transition:"height 0.3s"
          }} />
          <span style={{ fontSize:9, color:"#71717a", whiteSpace:"nowrap" }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function ExpenseDashboard() {
  const [entries,     setEntries]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [tab,         setTab]         = useState("list");
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  });
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0,16), amount:"",
    store:"", category:"식비", payment:"신용카드", type:"지출", memo:""
  });
  const [saveStatus, setSaveStatus] = useState("");
  const fileRef = useRef();

  // ── 노션 데이터 불러오기 (n8n 경유) ──
  const fetchData = async (month) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${N8N}/webhook/get-expenses?month=${month}`);
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (e) {
      setError("데이터를 불러오지 못했습니다. n8n 워크플로우가 활성화되어 있는지 확인해주세요.");
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(filterMonth); }, [filterMonth]);

  // ── 수기 입력 저장 (n8n 경유 → 노션) ──
  const handleAdd = async () => {
    if (!form.amount || !form.store) { alert("금액과 결제처는 필수입니다."); return; }
    setSaveStatus("저장 중...");
    try {
      const res = await fetch(`${N8N}/webhook/add-expense`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: parseInt(form.amount) || 0, source: "수기" })
      });
      if (!res.ok) throw new Error();
      setSaveStatus("✅ 저장 완료!");
      setForm({ date: new Date().toISOString().slice(0,16), amount:"", store:"", category:"식비", payment:"신용카드", type:"지출", memo:"" });
      setTimeout(() => { setSaveStatus(""); setTab("list"); fetchData(filterMonth); }, 1200);
    } catch {
      setSaveStatus("❌ 저장 실패. n8n 연결을 확인해주세요.");
    }
  };

  // ── 통계 계산 ──
  const expense = entries.filter(e=>e.type==="지출").reduce((s,e)=>s+e.amount,0);
  const income  = entries.filter(e=>e.type==="수입").reduce((s,e)=>s+e.amount,0);
  const catBreakdown = {};
  entries.filter(e=>e.type==="지출").forEach(e => {
    catBreakdown[e.category] = (catBreakdown[e.category]||0) + e.amount;
  });
  const catData = Object.entries(catBreakdown).sort((a,b)=>b[1]-a[1])
    .map(([k,v]) => ({ label:k, value:v, color:CAT_COLORS[k] }));
  const maxCat = Math.max(...catData.map(d=>d.value), 1);

  // ── 공통 스타일 ──
  const S = {
    root:    { fontFamily:"'Noto Sans KR',-apple-system,sans-serif", maxWidth:480, margin:"0 auto", minHeight:"100vh", background:"#0a0a0f", color:"#e4e4e7" },
    header:  { padding:"20px 20px 14px", background:"linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%)", borderBottom:"1px solid rgba(139,92,246,0.2)" },
    title:   { fontSize:20, fontWeight:700, color:"#f4f4f5", letterSpacing:-0.5 },
    card:    (accent) => ({ flex:1, padding:"12px 14px", borderRadius:12, background:"rgba(255,255,255,0.04)", border:`1px solid ${accent}33` }),
    nav:     { display:"flex", background:"#111118", borderBottom:"1px solid #27272a" },
    navBtn:  (a) => ({ flex:1, padding:"10px 0", textAlign:"center", fontSize:13, fontWeight:a?600:400, color:a?"#a78bfa":"#71717a", borderBottom:a?"2px solid #a78bfa":"2px solid transparent", background:"none", border:"none", cursor:"pointer" }),
    row:     { display:"flex", alignItems:"center", padding:"14px 20px", borderBottom:"1px solid #1c1c22", gap:12 },
    dot:     (cat) => ({ width:8, height:8, borderRadius:"50%", background:CAT_COLORS[cat]||"#6b7280", flexShrink:0 }),
    input:   { width:"100%", padding:"10px 12px", borderRadius:8, background:"#18181b", border:"1px solid #27272a", color:"#e4e4e7", fontSize:14, outline:"none", boxSizing:"border-box" },
    btn:     { width:"100%", padding:"12px", borderRadius:10, background:"linear-gradient(135deg,#7c3aed,#6d28d9)", color:"#fff", fontSize:15, fontWeight:600, border:"none", cursor:"pointer" },
    label:   { fontSize:12, color:"#a1a1aa", marginBottom:4, display:"block" },
    section: { padding:20 },
  };

  return (
    <div style={S.root}>
      {/* 헤더 */}
      <div style={S.header}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={S.title}>💰 가계부</div>
          <input type="month" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}
            style={{ background:"rgba(255,255,255,0.06)", border:"1px solid #333", borderRadius:8, padding:"4px 10px", color:"#a1a1aa", fontSize:12 }} />
        </div>
        <div style={{ display:"flex", gap:10, marginTop:14 }}>
          <div style={S.card("#ef4444")}>
            <div style={{ fontSize:11, color:"#a1a1aa", marginBottom:4 }}>지출</div>
            <div style={{ fontSize:20, fontWeight:700, color:"#f87171", letterSpacing:-0.5 }}>-{fmt(expense)}</div>
          </div>
          <div style={S.card("#22c55e")}>
            <div style={{ fontSize:11, color:"#a1a1aa", marginBottom:4 }}>수입</div>
            <div style={{ fontSize:20, fontWeight:700, color:"#4ade80", letterSpacing:-0.5 }}>+{fmt(income)}</div>
          </div>
          <div style={S.card("#a78bfa")}>
            <div style={{ fontSize:11, color:"#a1a1aa", marginBottom:4 }}>잔액</div>
            <div style={{ fontSize:20, fontWeight:700, color:income-expense>=0?"#a78bfa":"#f87171", letterSpacing:-0.5 }}>{fmt(income-expense)}</div>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div style={S.nav}>
        {[["list","내역"],["add","기록"],["stats","통계"]].map(([k,v])=>(
          <button key={k} style={S.navBtn(tab===k)} onClick={()=>setTab(k)}>{v}</button>
        ))}
      </div>

      {/* 로딩 / 에러 */}
      {loading && (
        <div style={{ textAlign:"center", padding:40, color:"#71717a" }}>⏳ 불러오는 중...</div>
      )}
      {!loading && error && (
        <div style={{ margin:20, padding:14, borderRadius:10, background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", fontSize:13, color:"#fca5a5", lineHeight:1.6 }}>
          ⚠️ {error}
          <div style={{ marginTop:8 }}>
            <button onClick={()=>fetchData(filterMonth)}
              style={{ padding:"6px 14px", background:"#7c3aed", color:"#fff", border:"none", borderRadius:6, fontSize:12, cursor:"pointer" }}>
              다시 시도
            </button>
          </div>
        </div>
      )}

      {/* 내역 탭 */}
      {!loading && tab==="list" && (
        <div>
          {entries.length===0 && !error && (
            <div style={{ textAlign:"center", padding:40, color:"#52525b" }}>이번 달 내역이 없습니다</div>
          )}
          {[...entries].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(e => (
            <div key={e.id} style={S.row}>
              <div style={S.dot(e.category)} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.store}</div>
                <div style={{ fontSize:11, color:"#71717a", marginTop:2 }}>
                  {fmtD(e.date)} · {e.category} · {e.payment}
                  {e.source==="자동" && <span style={{ marginLeft:4, color:"#6d28d9", fontSize:10 }}>⚡자동</span>}
                  {e.source==="업로드" && <span style={{ marginLeft:4, color:"#0ea5e9", fontSize:10 }}>📤업로드</span>}
                </div>
              </div>
              <div style={{ fontSize:15, fontWeight:600, flexShrink:0, color:e.type==="수입"?"#4ade80":"#f4f4f5" }}>
                {e.type==="수입"?"+":"-"}{fmt(e.amount)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 기록 탭 */}
      {tab==="add" && (
        <div style={S.section}>
          <div style={{ display:"flex", gap:8, marginBottom:16 }}>
            {TYPES.map(t=>(
              <button key={t} onClick={()=>setForm({...form,type:t})}
                style={{ flex:1, padding:"8px", borderRadius:8, fontSize:13, fontWeight:500, cursor:"pointer",
                  background:form.type===t?(t==="지출"?"#7f1d1d":"#14532d"):"#18181b",
                  color:form.type===t?"#fff":"#71717a",
                  border:`1px solid ${form.type===t?(t==="지출"?"#dc2626":"#22c55e"):"#27272a"}` }}>
                {t}
              </button>
            ))}
          </div>
          {[["date","날짜","datetime-local"],["amount","금액 (원)","number"],["store","결제처","text"]].map(([k,l,t])=>(
            <div key={k} style={{ marginBottom:12 }}>
              <label style={S.label}>{l}</label>
              <input type={t} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}
                style={S.input} placeholder={k==="amount"?"예: 12500":""} />
            </div>
          ))}
          <div style={{ display:"flex", gap:8, marginBottom:12 }}>
            <div style={{ flex:1 }}>
              <label style={S.label}>카테고리</label>
              <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={S.input}>
                {CATEGORIES.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ flex:1 }}>
              <label style={S.label}>결제수단</label>
              <select value={form.payment} onChange={e=>setForm({...form,payment:e.target.value})} style={S.input}>
                {PAYMENTS.map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={S.label}>메모</label>
            <input value={form.memo} onChange={e=>setForm({...form,memo:e.target.value})} style={S.input} placeholder="선택사항" />
          </div>
          {saveStatus && (
            <div style={{ marginBottom:12, padding:"10px 14px", borderRadius:8, background:"rgba(139,92,246,0.1)", border:"1px solid rgba(139,92,246,0.3)", fontSize:13, color:"#c4b5fd" }}>
              {saveStatus}
            </div>
          )}
          <button onClick={handleAdd} style={S.btn}>노션에 저장</button>
        </div>
      )}

      {/* 통계 탭 */}
      {tab==="stats" && (
        <div style={S.section}>
          {catData.length===0 ? (
            <div style={{ textAlign:"center", padding:40, color:"#52525b" }}>이번 달 지출 내역이 없습니다</div>
          ) : (
            <>
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:14, fontWeight:600, marginBottom:12 }}>카테고리별 지출</div>
                <MiniBar data={catData} maxVal={maxCat} />
                <div style={{ marginTop:14 }}>
                  {catData.map(d=>(
                    <div key={d.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:"1px solid #1c1c22" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ width:10, height:10, borderRadius:3, background:d.color }} />
                        <span style={{ fontSize:13 }}>{d.label}</span>
                      </div>
                      <div style={{ fontSize:13, fontWeight:600 }}>
                        {fmt(d.value)}원
                        <span style={{ fontSize:11, color:"#71717a", marginLeft:6 }}>
                          {expense ? Math.round(d.value/expense*100) : 0}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding:14, borderRadius:10, background:"#111118", border:"1px solid #1c1c22" }}>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:10, color:"#a1a1aa" }}>결제수단별</div>
                {(() => {
                  const breakdown = {};
                  entries.filter(e=>e.type==="지출").forEach(e=>{
                    breakdown[e.payment]=(breakdown[e.payment]||0)+e.amount;
                  });
                  return Object.entries(breakdown).sort((a,b)=>b[1]-a[1]).map(([k,v])=>(
                    <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", fontSize:13 }}>
                      <span style={{ color:"#a1a1aa" }}>{k}</span>
                      <span>{fmt(v)}원</span>
                    </div>
                  ));
                })()}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
