"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { type Lang } from "@/components/LangToggle";
import { 
  Mic, 
  Globe, 
  Volume2, 
  Play, 
  Send, 
  Loader2, 
  User, 
  Bot,
  XCircle,
  MessageCircle,
  AlertCircle
} from "lucide-react";
import SupportModal from "@/components/SupportModal";
import { getGuestChatCount, incrementGuestChatCount, hasGuestChatRemaining } from "@/lib/guestLimit";
import { guestChat } from "@/lib/api";

const SDUI_URLS = {
  en: "https://yerin.duckdns.org/view/AI_ENGLISH_CHAT_PAGE",
  ja: "https://yerin.duckdns.org/view/AI_JAPANESE_CHAT_PAGE",
  ko: "https://yerin.duckdns.org/view/AI_KOREAN_CHAT_PAGE",
};

interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
  translation?: string;
  showTranslation?: boolean;
}

export default function GuestChat({ lang }: { lang: Lang }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentCount = getGuestChatCount();
  const canChat = hasGuestChatRemaining();

  const t = {
    ko: { title: "AI 광화문 가이드", welcome: "안녕하세요! 방탄소년단 광화문 현장 안내 AI입니다. 궁금한 점을 물어보세요! 💜", placeholder: "메시지를 입력하세요...", limit: "게스트 채팅 5회 제한이 적용됩니다", remaining: "잔여 횟수", end: "채팅 종료하기", mic: "General Mic", translate: "번역 보기", listen: "Listen AI", loginReq: "무료 채팅 횟수(5회)를 모두 사용하셨습니다. 정식 서비스에서 더 고도화된 AI를 만나보세요!" },
    en: { title: "AI Gwanghwamun Guide", welcome: "Hello! I'm here to help you at the BTS Gwanghwamun site. Ask me anything! 💜", placeholder: "Type a message...", limit: "5 free guest chats allowed", remaining: "Remaining", end: "End Chat", mic: "General Mic", translate: "Translate", listen: "Listen AI", loginReq: "You've used all 5 free chats. Please log in to the full version for advanced features!" },
    ja: { title: "AI 光化門ガイド", welcome: "こんにちは！BTS光化門イベントの案内AIです。気になることを聞いてください！ 💜", placeholder: "メッセージを入力...", limit: "ゲストチャットは5回まで可能です", remaining: "残り", end: "チャット終了", mic: "General Mic", kr: "KR mode", translate: "翻訳を表示", listen: "Listen AI", loginReq: "無料チャット5回をすべて使用しました。完全版でより高度なAIをご利用ください！" }
  }[lang];

  useEffect(() => {
    if (messages.length > 0) {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  const handleSend = async (manualText?: string) => {
    const textToSend = manualText || input;
    if (!textToSend.trim() || (loading && !manualText)) return;
    
    if (!canChat) {
      setIsRedirecting(true);
      return;
    }

    const userText = textToSend;
    if (!manualText) setInput("");
    const userMsg: Message = { id: Date.now().toString(), role: "user", text: userText };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const reply = await guestChat(userText, lang, sessionId);
      const aiMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: "ai", 
        text: reply,
        translation: lang !== "ko" ? "번역된 내용이 표시됩니다." : undefined // Mock translation for non-KO
      };
      setMessages((prev) => [...prev, aiMsg]);
      
      const newCount = incrementGuestChatCount();
      if (newCount >= 5) {
         // Optionally set a flag to show redirect modal after a small delay
      }
    } catch (err) {
      console.error(err);
      const errorMsg: Message = { 
        id: (Date.now() + 2).toString(), 
        role: "ai", 
        text: "시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요. (Server not responding)" 
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const toggleTranslation = (id: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, showTranslation: !m.showTranslation } : m));
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorder.current?.stop();
      setIsRecording(false);
    } else {
      if (!canChat) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        mediaRecorder.current = recorder;
        audioChunks.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunks.current.push(e.data);
        };

        recorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
          await handleVoiceToText(audioBlob);
          stream.getTracks().forEach(track => track.stop());
        };

        recorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Recording error:", err);
        alert(lang === 'ko' ? "마이크 접근에 실패했습니다. 설정을 확인해 주세요." : "Microphone access failed. Please check settings.");
      }
    }
  };

  const handleVoiceToText = async (blob: Blob) => {
    setLoading(true);
    const formData = new FormData();
    formData.append("audio", blob, "audio.webm");
    formData.append("language", lang);

    try {
      const res = await fetch("/api/ai/stt", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.status === "success" && data.data?.text) {
        // Automatically send the transcribed text
        await handleSend(data.data.text);
      }
    } catch (err) {
      console.error("STT error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEndChat = () => {
    if (confirm("채팅을 종료하시겠습니까? (End chat?)")) {
       setShowSupport(true);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#fdf2f4] relative overflow-hidden font-sans">
      {/* Premium Header */}
      <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-pink-100 shadow-sm z-10">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 rounded-full bg-pink-50 flex items-center justify-center border border-pink-200">
             <Bot size={20} className="text-pink-400" />
           </div>
           <div>
             <h2 className="font-bold text-gray-800 text-lg">{t.title}</h2>
             <div className="flex items-center gap-1.5">
               <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Online · Guest mode</span>
             </div>
           </div>
        </div>
        <div className="bg-pink-50 px-3 py-1 rounded-full border border-pink-100">
           <span className="text-[11px] font-bold text-pink-500 tracking-tight">
             {t.remaining}: {5 - currentCount}/5
           </span>
        </div>
      </div>

      {/* Message Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {messages.length === 0 && (
          <div className="flex flex-col items-center py-10 opacity-70">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg mb-4 text-pink-400">
              <MessageCircle size={32} />
            </div>
            <p className="text-center text-sm font-medium text-pink-600 px-10 leading-relaxed">
              {t.welcome}
            </p>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex items-start gap-3 ${m.role === "user" ? "flex-row-reverse" : "flex-row"} animate-in fade-in slide-in-from-bottom-2`}>
            {/* Avatar */}
            <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm border ${
              m.role === "user" ? "bg-bts-purple-light border-purple-300" : "bg-white border-pink-100"
            }`}>
              {m.role === "user" ? <User size={20} className="text-white" /> : <Bot size={20} className="text-pink-400" />}
            </div>

            {/* Bubble Container */}
            <div className={`flex flex-col gap-2 max-w-[75%] ${m.role === "user" ? "items-end" : "items-start"}`}>
              {/* Bubble */}
              <div className={`p-4 rounded-3xl shadow-sm text-sm leading-relaxed ${
                m.role === "user" 
                  ? "bg-bts-purple text-white rounded-tr-sm" 
                  : "bg-white text-gray-800 rounded-tl-sm border border-pink-50"
              }`}>
                {m.text}
                
                {m.showTranslation && m.translation && (
                  <div className="mt-3 pt-3 border-t border-dashed border-gray-100 text-gray-500 italic">
                    {m.translation}
                  </div>
                )}
              </div>

              {/* AI Message Sub-actions (Matching Screenshot) */}
              {m.role === "ai" && !m.text.includes("오류") && (
                <div className="flex flex-wrap gap-2 px-1">
                  <button className="flex items-center gap-1.5 px-3 py-1 bg-white/80 rounded-full text-[10px] font-bold text-gray-400 border border-gray-100 hover:bg-white hover:text-pink-500 transition-all shadow-sm">
                    <Volume2 size={12} /> {t.listen}
                  </button>
                  {lang !== "ko" && (
                    <button 
                      onClick={() => toggleTranslation(m.id)}
                      className="flex items-center gap-1.5 px-3 py-1 bg-white/80 rounded-full text-[10px] font-bold text-pink-400 border border-pink-50 hover:bg-pink-50 transition-all shadow-sm"
                    >
                      <Globe size={12} /> {m.showTranslation ? "Hide" : t.translate}
                    </button>
                  )}
                  <button className="flex items-center gap-1.5 px-3 py-1 bg-white/80 rounded-full text-[10px] font-bold text-gray-400 border border-gray-100 hover:bg-white transition-all shadow-sm">
                    <Play size={10} fill="currentColor" /> Play My Voice
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1 bg-white/80 rounded-full text-[10px] font-bold text-gray-400 border border-gray-100 hover:bg-white transition-all shadow-sm">
                    <Play size={10} fill="currentColor" /> Play {lang.toUpperCase()} Voice
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-3 animate-pulse">
            <div className="shrink-0 w-10 h-10 rounded-full bg-white border border-pink-100 flex items-center justify-center">
              <Bot size={20} className="text-pink-300" />
            </div>
            <div className="bg-white p-4 rounded-3xl rounded-tl-none border border-pink-50 shadow-sm">
              <Loader2 size={16} className="animate-spin text-pink-300" />
            </div>
          </div>
        )}
        <div ref={scrollRef} className="h-4 w-full" />
      </div>

      {/* Premium Footer Area (Matching Screenshot) */}
      <div className="p-6 bg-white border-t border-pink-50 shadow-[0_-4px_20px_rgba(255,182,193,0.1)]">
         {/* Top buttons in footer */}
         <div className="flex justify-center mb-8">
            <div className="flex flex-col items-center gap-2">
              <button 
                onClick={toggleRecording}
                className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-all active:scale-95 ${
                  isRecording ? 'bg-red-500 animate-pulse ring-4 ring-red-100' : 'bg-pink-500 hover:scale-110'
                }`}
              >
                {isRecording ? <div className="w-4 h-4 bg-white rounded-sm" /> : <Mic size={28} />}
              </button>
              <span className={`text-[11px] font-bold uppercase tracking-tighter ${isRecording ? 'text-red-500' : 'text-gray-400'}`}>
                {isRecording ? (lang === 'ko' ? "녹음 중..." : "Recording...") : t.mic}
              </span>
            </div>
         </div>

         {/* Chat End Link */}
         <div className="flex justify-center mb-6">
            <button 
              onClick={handleEndChat}
              className="text-xs font-bold text-pink-300 hover:text-pink-500 flex items-center gap-1.5 bg-pink-50/50 px-4 py-2 rounded-full border border-pink-100/50 transition-all"
            >
              <XCircle size={14} />
              {t.end}
            </button>
         </div>

         {/* Text Input Row */}
         <div className="relative group">
            <input
              type="text"
              className="w-full pl-6 pr-14 py-4 rounded-3xl bg-gray-50 border border-gray-100 focus:bg-white focus:border-pink-300 focus:ring-4 focus:ring-pink-50 outline-none transition-all text-sm placeholder:text-gray-300 shadow-inner"
              placeholder={canChat ? t.placeholder : t.loginReq}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              disabled={!canChat || loading}
            />
            <button 
              onClick={() => handleSend()}
              disabled={!input.trim() || loading || !canChat}
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full transition-all ${
                input.trim() && !loading && canChat 
                  ? "bg-pink-500 text-white shadow-md hover:scale-105 active:scale-95" 
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              <Send size={18} fill={input.trim() ? "white" : "none"} />
            </button>
         </div>

         {!canChat && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
                <div className="w-20 h-20 bg-pink-100 rounded-full flex items-center justify-center mb-6 text-pink-500">
                  <AlertCircle size={48} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Free Limit Reached 💜</h3>
                <p className="text-sm text-gray-500 mb-8 max-w-xs leading-relaxed">
                  {t.loginReq}
                </p>
                <div className="flex flex-col w-full gap-3">
                  <a 
                    href={SDUI_URLS[lang] || SDUI_URLS.en}
                    className="w-full bg-pink-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-pink-200 hover:bg-pink-600 active:scale-[0.98] transition-all"
                  >
                    Login for Full Experience
                  </a>
                  <button 
                    onClick={() => setIsRedirecting(false)}
                    className="w-full py-3 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Maybe later
                  </button>
                </div>
            </div>
         )}
      </div>

      {/* Floating turn indicator for mobile etc */}
      {messages.length > 0 && canChat && (
        <div className="absolute top-24 right-4 animate-in slide-in-from-right-10">
           <div className="bg-white/80 backdrop-blur px-3 py-1.5 rounded-xl border border-pink-100 shadow-sm flex items-center gap-2">
              <span className="text-[10px] font-black text-pink-400">{5 - currentCount}</span>
              <span className="text-[9px] font-bold text-gray-400 uppercase">Left</span>
           </div>
        </div>
      )}

      {showSupport && (
        <SupportModal 
          lang={lang} 
          onClose={() => {
            setShowSupport(false);
            window.location.href = SDUI_URLS[lang] || SDUI_URLS.en;
          }} 
        />
      )}
    </div>
  );
}
