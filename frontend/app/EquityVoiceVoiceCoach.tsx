"use client";

import { useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { AudioLines, Mic, PhoneOff, ShieldCheck } from "lucide-react";

function VoiceCoachInner() {
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const conversation = useConversation({ onError: (e) => setError(String(e)) });
  const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;
  const active = conversation.status === "connected";

  async function start() {
    if (!agentId) { setError("Add NEXT_PUBLIC_ELEVENLABS_AGENT_ID to frontend/.env.local and restart Next.js."); return; }
    setError("");
    setStarting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({ agentId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to start conversation. Check microphone access and agent settings.");
    } finally { setStarting(false); }
  }

  async function end() {
    try { await conversation.endSession(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not end session."); }
  }

  return (
    <div style={{border:"1px solid #e8e3ff",borderRadius:20,padding:24,background:"linear-gradient(145deg,#fbfaff,#f4f0ff)"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
        <span style={{display:"grid",placeItems:"center",width:48,height:48,borderRadius:16,background:"#7865e9",color:"white"}}><AudioLines size={25}/></span>
        <div><strong style={{display:"block",fontSize:17}}>Live compensation roleplay</strong><small style={{color:"#716c8c"}}>ElevenLabs voice agent</small></div>
      </div>
      <p style={{color:"#5d5875",lineHeight:1.6,marginBottom:18}}>Practice responding to an employee who believes their compensation is unfair. Speak naturally, listen, and practice a respectful response.</p>
      <div aria-live="polite" style={{padding:"12px 14px",borderRadius:12,background:"white",marginBottom:16,color:"#39314f"}}>
        <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:active?"#22c55e":"#a9a1c4",marginRight:8}} />
        {active ? (conversation.isSpeaking ? "Employee is speaking…" : "Connected — your turn to speak") : conversation.status === "connecting" ? "Connecting…" : "Ready to practice"}
      </div>
      {active ? <button type="button" onClick={end} style={{width:"100%",padding:14,border:0,borderRadius:12,background:"#27213e",color:"white",fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}><PhoneOff size={18}/> End conversation</button>
        : <button type="button" onClick={start} disabled={starting || conversation.status === "connecting"} style={{width:"100%",padding:14,border:0,borderRadius:12,background:"#7865e9",color:"white",fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,opacity:starting ? 0.65 : 1}}><Mic size={18}/> {starting ? "Connecting…" : "Start voice conversation"}</button>}
      {error && <p role="alert" style={{color:"#b42342",fontSize:13,marginTop:12}}>{error}</p>}
      <p style={{display:"flex",alignItems:"center",gap:6,color:"#827c99",fontSize:12,marginTop:14}}><ShieldCheck size={14}/> Demo only. Do not share confidential payroll or employee information.</p>
    </div>
  );
}

export default function EquityVoiceVoiceCoach() {
  return <ConversationProvider><VoiceCoachInner /></ConversationProvider>;
}
