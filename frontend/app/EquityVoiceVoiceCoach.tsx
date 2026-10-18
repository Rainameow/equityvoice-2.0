
"use client";

import { useRef, useState } from "react";
import {
  ConversationProvider,
  useConversation,
} from "@elevenlabs/react";
import {
  AudioLines,
  Mic,
  PhoneOff,
  ShieldCheck,
  MessageCircle,
} from "lucide-react";

type ChatMessage = {
  id: number;
  role: "user" | "agent";
  text: string;
};

function VoiceCoachInner() {
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const nextId = useRef(0);
  const transcriptEnd = useRef<HTMLDivElement>(null);

  const conversation = useConversation({
    onError: (e) => setError(String(e)),

    onMessage: (message) => {
      const role =
        message.source === "user" ? "user" : "agent";

      const text = message.message;

      if (!text || !text.trim()) return;

      setMessages((previous) => [
        ...previous,
        {
          id: nextId.current++,
          role,
          text,
        },
      ]);

      requestAnimationFrame(() => {
        transcriptEnd.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      });
    },
  });

  const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;
  const active = conversation.status === "connected";
  const connecting =
    starting || conversation.status === "connecting";

  async function start() {
    if (!agentId) {
      setError(
        "Add NEXT_PUBLIC_ELEVENLABS_AGENT_ID to frontend/.env.local and restart Next.js."
      );
      return;
    }

    setError("");
    setStarting(true);
    setMessages([]);

    try {
      await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      await conversation.startSession({ agentId });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to start conversation. Check microphone access and agent settings."
      );
    } finally {
      setStarting(false);
    }
  }

  async function end() {
    try {
      await conversation.endSession();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not end session."
      );
    }
  }

  return (
    <div
      style={{
        border: "1px solid #e8e3ff",
        borderRadius: 20,
        padding: 24,
        background:
          "linear-gradient(145deg,#fbfaff,#f4f0ff)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 48,
            height: 48,
            borderRadius: 16,
            background: "#7865e9",
            color: "white",
          }}
        >
          <AudioLines size={25} />
        </span>

        <div>
          <strong
            style={{
              display: "block",
              fontSize: 17,
            }}
          >
            Live compensation roleplay
          </strong>

          <small style={{ color: "#716c8c" }}>
            Powered by ElevenLabs AI
          </small>
        </div>
      </div>

      <p
        style={{
          color: "#5d5875",
          lineHeight: 1.6,
          marginBottom: 18,
        }}
      >
        Talk with Emma, your AI compensation advisor.
        Explore pay equity findings from your uploaded
        payroll or practice difficult compensation
        conversations in real time.
      </p>

      {/* CONNECTION STATUS */}
      <div
        aria-live="polite"
        style={{
          padding: "12px 14px",
          borderRadius: 12,
          background: "white",
          marginBottom: 16,
          color: "#39314f",
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: active
              ? "#22c55e"
              : connecting
              ? "#f59e0b"
              : "#a9a1c4",
            marginRight: 8,
          }}
        />

        {active
          ? conversation.isSpeaking
            ? "Emma is speaking…"
            : "Connected — your turn to speak"
          : connecting
          ? "Connecting to Emma…"
          : "Ready to talk"}
      </div>

      {/* LIVE TRANSCRIPT */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e8e3ff",
          borderRadius: 14,
          marginBottom: 16,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 14px",
            borderBottom: "1px solid #f0edff",
            color: "#554a86",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          <MessageCircle size={16} />
          Live conversation transcript
        </div>

        <div
          role="log"
          aria-label="Voice conversation transcript"
          aria-live="polite"
          style={{
            height: 250,
            overflowY: "auto",
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {messages.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                color: "#9189a9",
                fontSize: 13,
                lineHeight: 1.7,
                margin: "auto",
              }}
            >
              <MessageCircle
                size={28}
                style={{
                  display: "block",
                  margin: "0 auto 10px",
                  opacity: 0.5,
                }}
              />
              Your conversation will appear here.
              <br />
              Start talking to Emma to begin.
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems:
                    message.role === "user"
                      ? "flex-end"
                      : "flex-start",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#82799c",
                    marginBottom: 5,
                  }}
                >
                  {message.role === "user"
                    ? "You"
                    : "Emma"}
                </span>

                <div
                  style={{
                    maxWidth: "92%",
                    padding: "10px 13px",
                    borderRadius:
                      message.role === "user"
                        ? "14px 14px 4px 14px"
                        : "14px 14px 14px 4px",
                    background:
                      message.role === "user"
                        ? "#7865e9"
                        : "#f1edff",
                    color:
                      message.role === "user"
                        ? "#ffffff"
                        : "#332b52",
                    fontSize: 13,
                    lineHeight: 1.6,
                    overflowWrap: "anywhere",
                  }}
                >
                  {message.text}
                </div>
              </div>
            ))
          )}

          <div ref={transcriptEnd} />
        </div>
      </div>

      {/* CALL CONTROLS */}
      {active ? (
        <button
          type="button"
          onClick={end}
          style={{
            width: "100%",
            padding: 14,
            border: 0,
            borderRadius: 12,
            background: "#27213e",
            color: "white",
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <PhoneOff size={18} />
          End conversation
        </button>
      ) : (
        <button
          type="button"
          onClick={start}
          disabled={connecting}
          style={{
            width: "100%",
            padding: 14,
            border: 0,
            borderRadius: 12,
            background: "#7865e9",
            color: "white",
            fontWeight: 700,
            cursor: connecting
              ? "not-allowed"
              : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            opacity: connecting ? 0.65 : 1,
          }}
        >
          <Mic size={18} />
          {connecting
            ? "Connecting…"
            : "Start voice conversation"}
        </button>
      )}

      {error && (
        <p
          role="alert"
          style={{
            color: "#b42342",
            fontSize: 13,
            marginTop: 12,
          }}
        >
          {error}
        </p>
      )}

      <p
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          color: "#827c99",
          fontSize: 12,
          marginTop: 14,
        }}
      >
        <ShieldCheck size={14} />
        Demo only. Do not share confidential payroll
        or employee information.
      </p>
    </div>
  );
}

export default function EquityVoiceVoiceCoach() {
  return (
    <ConversationProvider>
      <VoiceCoachInner />
    </ConversationProvider>
  );
}
