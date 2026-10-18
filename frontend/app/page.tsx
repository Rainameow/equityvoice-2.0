"use client";

import EquityVoiceVoiceCoach from "./EquityVoiceVoiceCoach";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {Activity,ArrowDownRight,ArrowRight,ArrowUpRight,AudioLines,BarChart3,Bot,CheckCircle2,ChevronDown,FileUp,HeartHandshake,LayoutDashboard,LockKeyhole,Menu,MessageSquare,RefreshCw,ShieldCheck,Sparkles,TrendingUp,Users,Wallet, X} from "lucide-react";
import {ResponsiveContainer,BarChart,Bar,XAxis,YAxis,Tooltip,CartesianGrid,Cell} from "recharts";

type Summary={headcount:number;women_count:number;men_count:number;average_salary:number|null;average_women_salary:number|null;average_men_salary:number|null;unadjusted_women_gap:number|null};
type Gaps={headcount:number;women_gap:number|null;disability_gap:number|null;by_level:Record<string,number|null>};
type Breakdown={headcount:number;breakdown:{level:string;headcount:number;female_count:number;male_count:number;women_gap:number|null}[]};
type EquityDetails={headcount:number;minimum_group_size:number;race:{available:boolean;groups:{race:string;headcount:number;average_salary:number}[];note?:string;reason?:string|null};intersectional:{available:boolean;by_race_and_level:{race:string;level:string;women_count:number;men_count:number;pay_gap_percent:number}[];note?:string;reason?:string|null};disability?:{with_disability_count:number;without_disability_count:number;pay_gap_percent:number|null;note?:string}};
type Preview={id:string;accepted:number;rejected:number;can_confirm:boolean;rejected_sample?:{row:number;error:string}[]};
type Tab="dashboard"|"explore"|"scenario"|"cases"|"admin"|"coach";
type ReviewCase={id:string;level:string;gap:number;women:number;men:number;status:"Open"|"In review"|"Resolved";note:string;created:string;title?:string;owner?:string;priority?:"High"|"Medium"|"Low";steps?:boolean[];resolution?:string};
type InsightTab="gender"|"race"|"disability"|"intersectional";
const nav=[{id:"dashboard",label:"Overview",icon:LayoutDashboard},{id:"explore",label:"Explore gaps",icon:BarChart3},{id:"scenario",label:"Scenario studio",icon:TrendingUp},{id:"cases",label:"Investigation center",icon:CheckCircle2},{id:"coach",label:"Emma AI coach",icon:AudioLines},{id:"admin",label:"Payroll",icon:FileUp}] as const;
const money=(v:number|null|undefined)=>v==null?"—":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(v);
const pct=(v:number|null|undefined)=>v==null?"—":`${Math.abs(v).toFixed(1)}%`;
async function api<T>(path:string,init?:RequestInit):Promise<T>{const res=await fetch("/api/backend/"+path,{cache:"no-store",...init});const json=await res.json().catch(()=>({}));if(!res.ok)throw new Error(json.detail||`Request failed (${res.status})`);return json as T;}
export default function Home(){
 const [tab,setTab]=useState<Tab>("dashboard"),[summary,setSummary]=useState<Summary|null>(null),[gaps,setGaps]=useState<Gaps|null>(null),[breakdown,setBreakdown]=useState<Breakdown|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[status,setStatus]=useState(""),[preview,setPreview]=useState<Preview|null>(null),[file,setFile]=useState<File|null>(null),[mobile,setMobile]=useState(false);
 const [equity,setEquity]=useState<EquityDetails|null>(null),[equityError,setEquityError]=useState("");
 const [role,setRole]=useState(""),[team,setTeam]=useState(""),[min,setMin]=useState(""),[max,setMax]=useState(""),[consent,setConsent]=useState(false),[shareMsg,setShareMsg]=useState("");
 const [insightTab,setInsightTab]=useState<InsightTab>("gender"),[dark,setDark]=useState(false);
 const [scenarioLevel,setScenarioLevel]=useState("");
 const [raisePercent,setRaisePercent]=useState(3);
 const [cases,setCases]=useState<ReviewCase[]>([]);
 const [caseMessage,setCaseMessage]=useState("");
 const [showNewCase,setShowNewCase]=useState(false),[newCaseLevel,setNewCaseLevel]=useState(""),[newCaseTitle,setNewCaseTitle]=useState(""),[newCaseOwner,setNewCaseOwner]=useState(""),[newCasePriority,setNewCasePriority]=useState<"High"|"Medium"|"Low">("Medium"),[caseFilter,setCaseFilter]=useState("All");
 const toggleTheme=()=>setDark(v=>!v);
 useEffect(()=>{try{const saved=localStorage.getItem("equityvoice-demo-cases-v1");if(saved){const parsed=JSON.parse(saved);if(Array.isArray(parsed))setCases(parsed);}}catch{}},[]);
 function saveCases(next:ReviewCase[]){setCases(next);try{localStorage.setItem("equityvoice-demo-cases-v1",JSON.stringify(next));}catch{}}
 function createCase(level:string){const row=breakdown?.breakdown.find(r=>r.level===level);if(!row||row.women_gap==null)return;const item:ReviewCase={id:`EV-${Date.now().toString().slice(-8)}`,level,gap:row.women_gap,women:row.female_count,men:row.male_count,status:"Open",note:"Review like-for-like roles, tenure, location, and relevant pay factors. No finding of discrimination has been made.",created:new Date().toLocaleDateString()};saveCases([item,...cases]);setCaseMessage(`Opened review for ${level}. Stored only in this browser.`);setTab("cases");}
 function updateCase(id:string,changes:Partial<ReviewCase>){saveCases(cases.map(c=>c.id===id?{...c,...changes}:c));}
 function addCustomCase(){const row=breakdown?.breakdown.find(r=>r.level===newCaseLevel)||breakdown?.breakdown[0];const level=newCaseLevel||row?.level||"General";const item:ReviewCase={id:`EV-${Date.now().toString().slice(-8)}`,title:newCaseTitle.trim()||`${level} compensation review`,level,gap:row?.women_gap??0,women:row?.female_count??0,men:row?.male_count??0,status:"Open",priority:newCasePriority,owner:newCaseOwner.trim()||"Unassigned",steps:[false,false,false,false],note:"",created:new Date().toLocaleDateString()};saveCases([item,...cases]);setShowNewCase(false);setNewCaseTitle("");setNewCaseOwner("");setCaseMessage("Investigation created. Demo record saved in this browser.");}
 function exportCase(c:ReviewCase){const steps=["Confirm data quality and sample sizes","Compare equivalent roles, tenure and locations","Review possible explanations and consult stakeholders","Document findings, next steps and follow-up"];const report=["EQUITYVOICE | INVESTIGATION REPORT",`Case: ${c.id}`,`Title: ${c.title||c.level+" pay-gap review"}`,`Created: ${c.created}`,`Status: ${c.status}`,`Priority: ${c.priority||"Medium"}`,`Owner: ${c.owner||"Unassigned"}`,`Level: ${c.level}`,`Observed group pay gap: ${c.gap.toFixed(1)}%`,`Sample: ${c.women} women / ${c.men} men`,"", "CHECKLIST",...steps.map((step,i)=>`${c.steps?.[i]?"[x]":"[ ]"} ${step}`),"","NOTES",c.note||"No notes yet.","","OUTCOME",c.resolution||"Not documented.","","Methodology: descriptive group averages only; not a determination of discrimination. Demo-only local case record."].join("\n");const blob=new Blob([report],{type:"text/plain;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`${c.id}-investigation.txt`;a.click();URL.revokeObjectURL(url);}
 const investigationSteps=["Confirm data quality and sample sizes","Compare equivalent roles, tenure and locations","Review possible explanations and consult stakeholders","Document findings, next steps and follow-up"];

  const [question,setQuestion]=useState(""),[answer,setAnswer]=useState("");
 const refresh=useCallback(async()=>{setError("");try{const [s,g,b]=await Promise.all([api<Summary>("summary"),api<Gaps>("gaps"),api<Breakdown>("breakdown")]);setSummary(s);setGaps(g);setBreakdown(b);try{const details=await api<EquityDetails>("equity-details");setEquity(details);setEquityError("");}catch(e){setEquity(null);setEquityError((e as Error).message);}}catch(e){setError((e as Error).message);}},[]);
 useEffect(()=>{refresh()},[refresh]);
 async function analyze(){if(!file)return;setBusy(true);setError("");setStatus("");setPreview(null);try{const body=new FormData();body.append("file",file);const p=await api<Preview>("upload",{method:"POST",body});setPreview(p);setStatus(`Validated ${p.accepted.toLocaleString()} rows; ${p.rejected.toLocaleString()} rejected.`)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function confirm(){if(!preview)return;setBusy(true);setError("");try{const result=await api<{employees:number}>(`confirm/${preview.id}`,{method:"POST"});setStatus(`${result.employees.toLocaleString()} employees loaded. Dashboard refreshed.`);setPreview(null);await refresh();setTab("dashboard")}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function submitPay(e:React.FormEvent){e.preventDefault();setBusy(true);setShareMsg("");try{await api("submit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({position:role,team,salary_min:Number(min),salary_max:Number(max),consent})});setShareMsg("Your range was submitted. Aggregate results are only shown when enough people participate.");setMin("");setMax("");setConsent(false)}catch(e){setShareMsg((e as Error).message)}finally{setBusy(false)}}
 function coach(){const q=question.trim();if(!q)return;const s=summary,g=gaps;if(!s||!g){setAnswer("Load a payroll dataset first so I can discuss actual findings.");return;}const salary=s.average_salary!=null?`Average annual salary is ${money(s.average_salary)}.`:"Average salary is unavailable.";const gap=g.women_gap!=null?`The level-weighted women-to-men gap is ${pct(g.women_gap)}; a positive value means women earn less on average in this comparison.`:"The level-weighted gender gap cannot be calculated for this dataset.";const levels=Object.entries(g.by_level||{}).filter(([,v])=>v!=null).sort((a,b)=>(b[1]||0)-(a[1]||0));const biggest=levels.length?`The largest reported level gap is ${levels[0][0]} (${pct(levels[0][1])}).`:"No level-level comparison is available.";setAnswer(`${s.headcount.toLocaleString()} employee records are currently loaded. ${salary} ${gap} ${biggest} These are descriptive differences, not proof of discrimination. For a compensation conversation, acknowledge the concern, explain the review process, compare like-for-like roles and levels, and commit to a transparent follow-up. This written guidance summarizes live backend statistics; for a real-time AI conversation, use Emma in the voice coach.`)}
 const bars=(breakdown?.breakdown||[]).map(r=>({name:r.level,gap:r.women_gap,count:r.headcount}));
  return <div className={`shell newShell ${dark?"darkMode":""}`}>
  <header className="newHeader">
    <div className="headerInner">
      <button className="newBrand" onClick={()=>setTab("dashboard")} aria-label="EquityVoice home"><span className="newBrandIcon"><AudioLines size={21}/></span><span>equityvoice<span className="brandPeriod">.</span></span></button>
      <nav className={`newNav ${mobile?"navOpen":""}`} aria-label="Main navigation">{nav.map(n=>{const Icon=n.icon;return <button key={n.id} className={`newNavItem ${tab===n.id?"selected":""}`} onClick={()=>{setTab(n.id);setMobile(false)}}><Icon size={16}/>{n.label}</button>})}</nav>
      <div className="headerActions"><span className="liveChip"><span className="pulse"/> LIVE DATA</span><button className="iconBtn" title="Refresh analytics" aria-label="Refresh analytics" onClick={refresh}><RefreshCw size={17}/></button><button className="iconBtn themeToggle" title={dark?"Switch to light mode":"Switch to dark mode"} aria-label="Toggle color theme" onClick={toggleTheme}>{dark?<Sparkles size={18}/>:<span className="themeMoon">◐</span>}</button><button className="mobileMenu" aria-label="Toggle navigation" onClick={()=>setMobile(v=>!v)}>{mobile?<X size={20}/>:<Menu size={20}/>}</button></div>
    </div>
  </header>
  <div className="insightTicker" aria-hidden="true"><div className="tickerTrack">{Array.from({length:2},(_,i)=><span key={i}>MAKE PAY FAIRER <b>✳</b> TURN DATA INTO ACTION <b>✳</b> EVERY VOICE MATTERS <b>✳</b> TRANSPARENCY BUILDS TRUST <b>✳</b> </span>)}</div></div>
  <main className="main">
 <div className="content">
 {tab==="dashboard"&&<><div className="eyebrow"><span className="eyebrowLine"/> THE BIGGER PICTURE</div><div className="pageTitle"><div><h1>Fair pay starts <em>with clarity.</em></h1><p>Understand your workforce, spot meaningful patterns, and turn insight into action.</p></div><button className="primary" onClick={()=>setTab("admin")}>Analyze payroll <ArrowRight size={17}/></button></div>
 {error&&<div className="alert">{error} <button onClick={refresh}>Retry</button></div>}
 {!summary?<div className="empty"><BarChart3 size={36}/><h3>No live payroll analysis yet</h3><p>Connect your Python backend or upload a dataset in Payroll studio. No fictional metrics will be displayed.</p><button className="primary" onClick={()=>setTab("admin")}>Open payroll studio <ArrowRight size={16}/></button></div>:<>
 <div className="metricGrid"><Metric icon={<Users size={19}/>} label="EMPLOYEES ANALYZED" value={summary.headcount.toLocaleString()} foot="Records in current payroll"/><Metric icon={<Activity size={19}/>} label="LEVEL-ADJUSTED GENDER GAP" value={pct(gaps?.women_gap)} foot="Women compared with men" accent/><Metric icon={<Wallet size={19}/>} label="AVERAGE ANNUAL SALARY" value={money(summary.average_salary)} foot="Across all loaded employees"/><Metric icon={<TrendingUp size={19}/>} label="UNADJUSTED GENDER GAP" value={pct(summary.unadjusted_women_gap)} foot="Before controlling for job level"/></div>
 <div className="chartGrid"><section className="panel chartPanel"><div className="panelHeading"><div><span className="kicker">COMPENSATION DISTRIBUTION</span><h2>Gender pay gap by level</h2><p>Positive percentages indicate lower average pay for women.</p></div><span className="panelTag">LIVE DATA</span></div><div className="chartArea">{bars.some(b=>b.gap!=null)?<ResponsiveContainer width="100%" height="100%"><BarChart data={bars} margin={{top:12,right:12,left:-22,bottom:0}}><CartesianGrid stroke="#e9e2e3" vertical={false}/><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{fill:"#756e79",fontSize:12}}/><YAxis tickLine={false} axisLine={false} tick={{fill:"#756e79",fontSize:12}} tickFormatter={v=>`${v}%`}/><Tooltip formatter={(v)=>[`${Number(v).toFixed(1)}%`,"Gap"]} contentStyle={{borderRadius:14,border:"1px solid #e8e8f0"}}/><Bar dataKey="gap" radius={[7,7,0,0]} maxBarSize={44}>{bars.map((b,i)=><Cell key={i} fill={i%2===0?"#b27092":"#87baab"}/>)}</Bar></BarChart></ResponsiveContainer>:<p className="noData">Not enough comparable data to calculate a level gap.</p>}</div></section>
 <section className="panel insightPanel"><div className="panelHeading"><div><span className="kicker">WORKFORCE SNAPSHOT</span><h2>At a glance</h2></div><div className="miniIcon"><Sparkles size={17}/></div></div><div className="donutWrap"><div className="donut" style={{background:`conic-gradient(#b27092 0 ${summary.headcount?100*summary.women_count/summary.headcount:0}%, #512d38 0 ${summary.headcount?100*(summary.women_count+summary.men_count)/summary.headcount:0}%, #c8dcd5 0)`}}><div><strong>{summary.headcount.toLocaleString()}</strong><small>employees</small></div></div></div><div className="legend"><div><span className="legendDot purple"/> Women <strong>{summary.women_count.toLocaleString()}</strong></div><div><span className="legendDot navy"/> Men <strong>{summary.men_count.toLocaleString()}</strong></div><div><span className="legendDot pale"/> Other / undisclosed <strong>{Math.max(0,summary.headcount-summary.women_count-summary.men_count).toLocaleString()}</strong></div></div></section></div>
 <section className="overviewBottom"><div className="overviewIntro"><span className="kicker">YOUR NEXT STEP</span><h2>Go beyond the headline.</h2><p>Explore pay differences across roles, race and ethnicity, disability, and intersecting identities—one clear view at a time.</p><button className="primary" onClick={()=>setTab("explore")}>Explore all insights <ArrowRight size={17}/></button></div><div className="emmaPromo"><div className="emmaPromoIcon"><AudioLines size={28}/></div><span className="kicker">MEET YOUR AI ADVISOR</span><h2>Numbers tell a story. Emma helps you talk about it.</h2><p>Ask questions about your payroll data or practice a difficult compensation conversation out loud.</p><button onClick={()=>setTab("coach")}>Talk to Emma <ArrowUpRight size={17}/></button></div></section>
 </>}</>}
  {tab==="explore"&&<><div className="eyebrow"><span className="eyebrowLine"/> DEEPER INSIGHTS</div><div className="pageTitle"><div><h1>Explore the <em>whole picture.</em></h1><p>Focused, data-grounded views of pay equity across your workforce.</p></div><button className="outlineButton" onClick={()=>setTab("coach")}><AudioLines size={17}/> Ask Emma</button></div>
  <div className="insightTabs" role="tablist" aria-label="Pay equity analysis">{([{id:"gender",label:"Gender"},{id:"race",label:"Race & ethnicity"},{id:"disability",label:"Disability"},{id:"intersectional",label:"Intersectional"}] as const).map(n=><button key={n.id} role="tab" aria-selected={insightTab===n.id} className={insightTab===n.id?"current":""} onClick={()=>setInsightTab(n.id)}>{n.label}</button>)}</div>
  {error&&<div className="alert">{error}<button onClick={refresh}>Retry</button></div>}
  {insightTab==="gender"&&<><div className="sectionIntro"><h2>Gender pay equity</h2><p>Compare employees within the same job level. A positive gap means women earn less on average in that group.</p></div> <section className="panel tablePanel"><div className="panelHeading"><div><span className="kicker">DEEPER INSIGHTS</span><h2>Breakdown by job level</h2><p>Comparisons use the actual records in the current dataset.</p></div><button className="textButton" onClick={()=>setTab("coach")}>Discuss findings <ArrowRight size={15}/></button></div><div className="tableScroll"><table><thead><tr><th>Job level</th><th>Employees</th><th>Women</th><th>Men</th><th>Pay gap</th><th>Next step</th></tr></thead><tbody>{bars.map((r,i)=><tr key={r.name}><td><span className="levelIcon">{i+1}</span>{r.name}</td><td>{r.count.toLocaleString()}</td><td>{breakdown?.breakdown[i]?.female_count.toLocaleString()}</td><td>{breakdown?.breakdown[i]?.male_count.toLocaleString()}</td><td><span className="gapPill">{pct(r.gap)}</span></td><td><button className="textButton" disabled={r.gap==null} onClick={()=>createCase(r.name)}>Investigate <ArrowRight size={13}/></button></td></tr>)}</tbody></table></div></section>
 </>}
  {insightTab==="race"&&<><div className="sectionIntro"><h2>Race & ethnicity</h2><p>Unadjusted salary averages across reported demographic groups.</p></div> <section className="panel padded" style={{marginTop:22}}><div className="panelHeading"><div><span className="kicker">RACIAL PAY ANALYSIS</span><h2>Average annual salary by race / ethnicity</h2><p>Unadjusted group averages from the uploaded payroll. These differences do not establish causation.</p></div><span className="panelTag">LIVE DATA</span></div>
  {equity?.race.available&&equity.race.groups.length?<><div style={{height:330,width:"100%"}}><ResponsiveContainer width="100%" height="100%"><BarChart data={equity.race.groups} layout="vertical" margin={{top:8,right:35,left:38,bottom:8}}><CartesianGrid stroke="#e9e2e3" horizontal={false}/><XAxis type="number" tickFormatter={v=>`$${Math.round(Number(v)/1000)}k`} tick={{fill:"#756e79",fontSize:11}}/><YAxis dataKey="race" type="category" width={110} tick={{fill:"#756e79",fontSize:11}} tickLine={false} axisLine={false}/><Tooltip formatter={(v)=>[money(Number(v)),"Average salary"]} contentStyle={{borderRadius:14,border:"1px solid #e8e8f0"}}/><Bar dataKey="average_salary" radius={[0,6,6,0]} maxBarSize={23}>{equity.race.groups.map((r,i)=><Cell key={r.race} fill={i%2===0?"#b27092":"#87baab"}/>)}</Bar></BarChart></ResponsiveContainer></div><p className="muted">Minimum displayed group: {equity.minimum_group_size} employees. Hover over bars for exact averages.</p></>:<p className="muted">{equity?.race.reason||equityError||"Race/ethnicity analysis is unavailable for this payroll."}</p>}</section>
 </>}
  {insightTab==="intersectional"&&<><div className="sectionIntro"><h2>Intersectional insights</h2><p>Compare women and men within the same race and job level; smaller groups require extra caution.</p></div> <section className="panel tablePanel" style={{marginTop:22}}><div className="panelHeading"><div><span className="kicker">INTERSECTIONAL INSIGHTS</span><h2>Gender pay gaps within race and job level</h2><p>Women-versus-men mean salary gaps in comparable race and job-level groups. Positive values mean lower average pay for women; negative values mean higher average pay.</p></div></div>
  {equity?.intersectional.available&&equity.intersectional.by_race_and_level.length?<><div className="tableScroll"><table><thead><tr><th>Race / ethnicity</th><th>Job level</th><th>Women</th><th>Men</th><th>Pay gap</th></tr></thead><tbody>{equity.intersectional.by_race_and_level.map((r,i)=><tr key={`${r.race}-${r.level}-${i}`}><td>{r.race}</td><td>{r.level}</td><td>{r.women_count.toLocaleString()}</td><td>{r.men_count.toLocaleString()}</td><td><span className="gapPill">{r.pay_gap_percent.toFixed(1)}%</span></td></tr>)}</tbody></table></div><p className="muted" style={{padding:"8px 22px 20px"}}>Groups are displayed only when at least {equity.minimum_group_size} women and {equity.minimum_group_size} men are present in that race and job level.</p></>:<p className="muted" style={{padding:"0 22px 22px"}}>{equity?.intersectional.reason||equityError||"Intersectional analysis is unavailable for this payroll."}</p>}</section>
 </>}
  {insightTab==="disability"&&<><div className="sectionIntro"><h2>Disability pay comparison</h2><p>Unadjusted salary comparisons across employees with and without a recorded disability.</p></div> {equity?.disability&&<section className="panel padded" style={{marginTop:22}}><span className="kicker">DISABILITY PAY ANALYSIS</span><h2>Disability pay comparison</h2><p><strong>{equity.disability.pay_gap_percent==null?"Not available":`${equity.disability.pay_gap_percent.toFixed(1)}%`}</strong> overall unadjusted pay gap</p><p className="muted">{equity.disability.with_disability_count.toLocaleString()} employees with a recorded disability; {equity.disability.without_disability_count.toLocaleString()} without. {equity.disability.note||""}</p></section>}
{!equity?.disability&&<section className="panel padded"><h2>Not enough data yet</h2><p className="muted">Disability pay analysis is unavailable for this payroll.</p></section>}</>}
  <p className="methodNote"><ShieldCheck size={17}/> These are descriptive statistics, not proof of discrimination. Interpret differences alongside job roles, sample sizes and other relevant factors.</p>
  </>}

 {tab==="scenario"&&<>
 <div className="eyebrow"><span className="eyebrowLine"/> PLAN RESPONSIBLY</div>
 <div className="pageTitle"><div><h1>Scenario <em>studio.</em></h1><p>Explore a hypothetical pay adjustment using live group-level gaps. No payroll records are changed.</p></div></div>
 {!breakdown?.breakdown?.length?<div className="empty">Upload a payroll dataset first in Payroll studio.</div>:<div className="twoCol">
 <section className="panel padded"><span className="kicker">01 / CHOOSE A COMPARISON</span><h2>Model a possible adjustment</h2>
 <label className="labLabel">Job level<select value={scenarioLevel||breakdown.breakdown.find(r=>r.women_gap!=null)?.level||""} onChange={e=>setScenarioLevel(e.target.value)}>{breakdown.breakdown.filter(r=>r.women_gap!=null).map(r=><option key={r.level} value={r.level}>{r.level}</option>)}</select></label>
 {(()=>{const row=breakdown.breakdown.find(r=>r.level===(scenarioLevel||breakdown.breakdown.find(r=>r.women_gap!=null)?.level));if(!row||row.women_gap==null)return <p>Insufficient data for this comparison.</p>;const gap=row.women_gap;const projected=100*(1-(1-gap/100)*(1+raisePercent/100));const proxyWomenMean=summary?.average_salary!=null?summary.average_salary*(1-gap/100):null;const proxyCost=proxyWomenMean==null?null:proxyWomenMean*(raisePercent/100)*row.female_count;return <>
 <div className="labStats"><div><span>Observed group gap</span><strong>{gap.toFixed(1)}%</strong></div><div><span>Women / men in level</span><strong>{row.female_count} / {row.male_count}</strong></div></div>
 <div className="labRange"><div className="labRangeTitle"><strong>Hypothetical raise to women's group average</strong><strong>{raisePercent.toFixed(1)}%</strong></div><input aria-label="Hypothetical percentage increase" type="range" min="0" max="15" step="0.5" value={raisePercent} onChange={e=>setRaisePercent(Number(e.target.value))}/></div>
 <div className="labResult"><span>Illustrative remaining gap</span><strong>{projected.toFixed(2)}%</strong><small>Formula: 1 − (1 − current gap) × (1 + proposed raise). Negative means the adjusted group mean exceeds the comparison mean.</small></div>
 <p className="muted labCaution">{proxyCost==null?"Annual cost estimate unavailable.":`Very rough annual budget proxy: ${money(proxyCost)}. This uses the company-wide mean salary as a stand-in for the comparison group's salary and is NOT a payroll-based cost estimate.`}</p>
 <button className="primary full" onClick={()=>createCase(row.level)}>Open a review case <ArrowRight size={16}/></button>
 </>})()}
 </section>
 <section className="panel padded infoPanel"><span className="kicker">02 / INTERPRET WITH CARE</span><h2>A scenario, not a pay recommendation.</h2><p>We use the actual uploaded job-level gap and group counts, but the backend does not currently expose the individual salary data needed to calculate exact raise costs or recommend employee-specific corrections.</p><div className="steps"><div><b>01</b><span><strong>Check comparability</strong><small>Investigate roles, experience, tenure, and location.</small></span></div><div><b>02</b><span><strong>Explore alternatives</strong><small>Test assumptions; do not equate statistical differences with discrimination.</small></span></div><div><b>03</b><span><strong>Document a review</strong><small>Create a case with next steps for human decision-makers.</small></span></div></div><button className="textButton" onClick={()=>setTab("coach")}>Discuss with Emma <ArrowRight size={16}/></button></section>
 </div>}
 </>}
  {tab==="cases"&&<>
  <div className="eyebrow"><span className="eyebrowLine"/> EVIDENCE TO ACTION</div>
  <div className="pageTitle"><div><h1>Investigation <em>center.</em></h1><p>Turn observed pay differences into structured, documented human reviews.</p></div><button className="primary" onClick={()=>setShowNewCase(v=>!v)}>{showNewCase?"Close form":"+ New investigation"} <ArrowRight size={16}/></button></div>
  <p className="methodNote"><ShieldCheck size={17}/> Demo only. Records stay in this browser, are not shared with a team, and are not secured on the backend. Use synthetic data only. Statistical gaps are not findings of discrimination.</p>
  {caseMessage&&<div className="notice">{caseMessage}</div>}
  <div className="investigationStats"><div><span>Total investigations</span><strong>{cases.length}</strong></div><div><span>Open</span><strong>{cases.filter(c=>c.status==="Open").length}</strong></div><div><span>In review</span><strong>{cases.filter(c=>c.status==="In review").length}</strong></div><div><span>Resolved</span><strong>{cases.filter(c=>c.status==="Resolved").length}</strong></div></div>
  {showNewCase&&<section className="panel padded investigationForm"><span className="kicker">NEW INVESTIGATION</span><h2>Open a compensation review</h2><p className="muted">Start from a specific job level or create a general review. The figures below are descriptive, not conclusions.</p><div className="investigationFields"><label className="labLabel">Investigation title<input value={newCaseTitle} maxLength={100} placeholder="e.g. Management compensation review" onChange={e=>setNewCaseTitle(e.target.value)}/></label><label className="labLabel">Job level<select value={newCaseLevel} onChange={e=>setNewCaseLevel(e.target.value)}><option value="">{breakdown?.breakdown.length?"Select a level (defaults to first)":"General review"}</option>{breakdown?.breakdown.map(r=><option key={r.level} value={r.level}>{r.level}</option>)}</select></label><label className="labLabel">Review owner<input value={newCaseOwner} maxLength={80} placeholder="e.g. People Operations" onChange={e=>setNewCaseOwner(e.target.value)}/></label><label className="labLabel">Priority<select value={newCasePriority} onChange={e=>setNewCasePriority(e.target.value as "High"|"Medium"|"Low")}><option>High</option><option>Medium</option><option>Low</option></select></label></div><button className="primary" onClick={addCustomCase}>Create investigation <ArrowRight size={16}/></button></section>}
  <div className="investigationToolbar"><strong>Case workspace</strong><label>Filter <select value={caseFilter} onChange={e=>setCaseFilter(e.target.value)}><option>All</option><option>Open</option><option>In review</option><option>Resolved</option></select></label></div>
  {!cases.length?<div className="empty"><h3>No investigations yet</h3><p>Create a case here, or start in Scenario studio and open a review based on a real payroll comparison.</p><button className="primary" onClick={()=>setShowNewCase(true)}>Create your first case <ArrowRight size={16}/></button></div>:<div className="caseList">{cases.filter(c=>caseFilter==="All"||c.status===caseFilter).map(c=><section className="panel padded investigationCase" key={c.id}><div className="caseTop"><div><span className="kicker">{c.id} · {c.created}</span><h2>{c.title||`${c.level} pay-gap review`}</h2><p className="muted">{c.level} · Observed women–men gap: {c.gap.toFixed(1)}% · {c.women} women / {c.men} men</p></div><label className="caseStatusLabel">Status<select aria-label={`Status for ${c.id}`} value={c.status} onChange={e=>updateCase(c.id,{status:e.target.value as ReviewCase["status"]})}><option>Open</option><option>In review</option><option>Resolved</option></select></label></div><div className="investigationFields"><label className="labLabel">Assigned owner<input value={c.owner||""} placeholder="Unassigned" onChange={e=>updateCase(c.id,{owner:e.target.value})}/></label><label className="labLabel">Priority<select value={c.priority||"Medium"} onChange={e=>updateCase(c.id,{priority:e.target.value as "High"|"Medium"|"Low"})}><option>High</option><option>Medium</option><option>Low</option></select></label></div><div className="investigationChecklist"><div className="panelHeading"><div><span className="kicker">REVIEW PLAYBOOK</span><h2>Investigation checklist</h2></div><span className="panelTag">{(c.steps||[]).filter(Boolean).length} / 4 COMPLETE</span></div>{investigationSteps.map((step,i)=><label className="investigationStep" key={step}><input type="checkbox" checked={!!c.steps?.[i]} onChange={e=>{const next=[...(c.steps||[false,false,false,false])];next[i]=e.target.checked;updateCase(c.id,{steps:next});}}/><span>{step}</span></label>)}</div><label className="labLabel">Evidence, observations and next steps<textarea rows={4} placeholder="What was checked? What still needs review?" value={c.note} onChange={e=>updateCase(c.id,{note:e.target.value})}/></label><label className="labLabel">Outcome / decision rationale<textarea rows={2} placeholder="Document the conclusion and follow-up. Do not infer discrimination from a gap alone." value={c.resolution||""} onChange={e=>updateCase(c.id,{resolution:e.target.value})}/></label><div className="caseActions"><button className="textButton" onClick={()=>setTab("coach")}>Discuss with Emma <ArrowRight size={15}/></button><div className="caseActionGroup"><button className="outlineButton" onClick={()=>exportCase(c)}>Export report</button><button className="textButton" onClick={()=>{if(window.confirm("Delete this local demo case?"))saveCases(cases.filter(item=>item.id!==c.id));}}>Delete</button></div></div></section>)}{cases.length>0&&!cases.some(c=>caseFilter==="All"||c.status===caseFilter)&&<div className="empty"><h3>No {caseFilter.toLowerCase()} cases</h3><p>Try another status filter.</p></div>}</div>}
  </>}
 {tab==="admin"&&<><div className="eyebrow"><span className="eyebrowLine"/> DATA WORKSPACE</div><div className="pageTitle"><div><h1>Payroll <em>studio.</em></h1><p>Upload, validate, and publish a new payroll dataset to your live dashboard.</p></div></div><div className="twoCol"><section className="panel padded"><span className="kicker">STEP 01 / UPLOAD</span><h2>Import payroll data</h2><p className="muted">CSV and Excel files, up to 10 MB. Only upload synthetic or authorized payroll data.</p><label className="dropzone"><FileUp size={30}/><strong>{file?file.name:"Choose a payroll file"}</strong><span>Click to browse · CSV, XLSX, XLSM</span><input type="file" accept=".csv,.xlsx,.xlsm" onChange={e=>{setFile(e.target.files?.[0]||null);setPreview(null);setStatus("")}}/></label><button className="primary full" disabled={!file||busy} onClick={analyze}>{busy?"Processing…":"Analyze file"} <ArrowRight size={17}/></button>{error&&<div className="alert">{error}</div>}{status&&<div className="notice">{status}</div>}{preview&&<div className="preview"><h3>Validation results</h3><div className="previewNumbers"><div><strong>{preview.accepted.toLocaleString()}</strong><small>Accepted</small></div><div><strong>{preview.rejected.toLocaleString()}</strong><small>Rejected</small></div></div>{preview.rejected_sample?.length? <p className="muted">First error: {preview.rejected_sample[0].error}</p>:null}<button className="primary full" disabled={!preview.can_confirm||busy} onClick={confirm}>Confirm and update dashboard <CheckCircle2 size={17}/></button>{!preview.can_confirm&&<p className="muted">Confirmation is disabled until validation passes.</p>}</div>}</section><section className="panel padded infoPanel"><div className="miniIcon"><ShieldCheck size={22}/></div><span className="kicker">HOW IT WORKS</span><h2>From raw data to clarity.</h2><div className="steps"><div><b>01</b><span><strong>Import</strong><small>Upload a payroll spreadsheet or CSV.</small></span></div><div><b>02</b><span><strong>Validate</strong><small>Review accepted and rejected rows.</small></span></div><div><b>03</b><span><strong>Publish</strong><small>Confirm to refresh the live analytics.</small></span></div></div><p className="muted">Your backend currently stores the confirmed payroll in SQLite. Production persistence and authentication still need strengthening before using sensitive employer data.</p></section></div></>}
{tab==="coach"&&<>
  <div className="eyebrow">
    <span className="eyebrowLine"/>
    COMPENSATION CONVERSATIONS
  </div>

  <div className="pageTitle">
    <div>
      <h1>Better conversations, <em>fairer outcomes.</em></h1>
      <p>Explore real pay equity insights and practice meaningful compensation conversations with AI.</p>
    </div>
  </div>

  <div className="twoCol">
    <section className="panel padded">
      <div className="coachHead">
        <div className="coachOrb">
          <AudioLines size={30}/>
        </div>
        <div>
          <span className="kicker">CONVERSATION COACH</span>
          <h2>Ask about pay equity</h2>
        </div>
      </div>

      <p className="muted">
        Get data-grounded answers using your uploaded payroll analytics.
        Explore compensation disparities, understand potential causes,
        and discover practical steps toward fairer pay.
      </p>

      <div className="suggestions">
        <button onClick={()=>setQuestion("What are the largest pay gaps in our dataset?")}>
          What are our biggest pay gaps?
        </button>
        <button onClick={()=>setQuestion("How should a manager discuss compensation fairly?")}>
          How should a manager respond?
        </button>
      </div>

      <textarea
        rows={4}
        value={question}
        onChange={e=>setQuestion(e.target.value)}
        placeholder="Ask about the uploaded payroll or practice a compensation conversation…"
      />

      <button className="primary full" onClick={coach}>
        Get data-grounded guidance <ArrowRight size={16}/>
      </button>

      {answer&&
        <div className="coachAnswer">
          <span className="kicker">ANALYSIS-BASED RESPONSE</span>
          <p>{answer}</p>
        </div>
      }
    </section>

    <section className="panel padded infoPanel">
      <div className="miniIcon">
        <HeartHandshake size={23}/>
      </div>

      <span className="kicker">THE HACKATHON TWIST</span>
      <h2>ElevenLabs voice simulator</h2>

      <p>
        Meet Emma, your AI compensation advisor. Have real-time voice
        conversations about pay equity, explore insights from your
        uploaded payroll data, or roleplay challenging workplace
        compensation scenarios.
      </p>

      <EquityVoiceVoiceCoach/>
    </section>
  </div>
</>}

 <footer>EquityVoice <span>•</span> Data for Change <span>•</span> Built for thoughtful, evidence-led decisions</footer></div></main></div>
}
function Metric({icon,label,value,foot,accent=false}:{icon:React.ReactNode,label:string,value:string,foot:string,accent?:boolean}){return <div className={`metric ${accent?"accent":""}`}><div className="metricTop"><span>{label}</span><div className="metricIcon">{icon}</div></div><strong>{value}</strong><div className="metricFoot"><span className="tinyLine"/>{foot}</div></div>}
