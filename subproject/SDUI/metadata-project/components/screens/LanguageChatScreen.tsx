'use client';
import {FormEvent,KeyboardEvent,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useAuth} from '@/context/AuthContext';
import {consumeChatStream} from '@/lib/kride/consumeChatStream';
import KrideStatePanel from '@/components/fields/kride/atoms/KrideStatePanel';
import type {ScreenControllerProps} from './types';

type Message={role:'user'|'assistant';content:string};
type Lang='en'|'ja'|'ko';

const NAMES:Record<Lang,string>={en:'영어',ja:'일본어',ko:'한국어'};
/** 첫 화면 추천 질문 칩 (레퍼런스 3/4: ChatGPT·Speak·말해보카). 누르면 그대로 전송한다. */
const SUGGESTIONS:Record<Lang,string[]>={
 en:['How can I order an iced americano?','Where is the nearest subway station?','Can I line up here for the merch booth?'],
 ja:['東京でおすすめの場所は？','コンサート会場までどう行けばいいですか？','このグッズはいくらですか？'],
 ko:['근처 지하철역이 어디예요?','이 굿즈 얼마예요?','콘서트장까지 어떻게 가요?'],
};

/**
 * 언어 채팅 (벤치마킹 G7).
 * 레퍼런스 4/4 공통: AI 좌측 / 나 우측 말풍선 · 입력창 하단 고정 · 전송은 글자 있을 때만 ·
 * Enter 전송 / Shift+Enter 줄바꿈 · 실패한 메시지 옆 "다시 시도"(입력값 보존) · 종료는 확인 단계 ·
 * 첫 화면 추천 질문 칩 · 시험 운영 안내는 상단 배너.
 */
export default function LanguageChatScreen({screenId}:ScreenControllerProps){
 const language:Lang=screenId==='AI_JAPANESE_CHAT_PAGE'?'ja':screenId==='AI_KOREAN_CHAT_PAGE'?'ko':'en';
 const name=NAMES[language];const auth=useAuth();
 const [messages,setMessages]=useState<Message[]>([]),[input,setInput]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[last,setLast]=useState('');
 const [confirmEnd,setConfirmEnd]=useState(false);
 const active=useRef<AbortController|null>(null),generation=useRef(0),live=useRef(messages);live.current=messages;
 const threadEnd=useRef<HTMLDivElement>(null);
 const stop=()=>{generation.current++;active.current?.abort();active.current=null;setBusy(false)};
 useEffect(()=>{stop();setMessages([]);setError('');setLast('');setConfirmEnd(false);return()=>{generation.current++;active.current?.abort()}},[language,auth.user?.userSqno]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{threadEnd.current?.scrollIntoView?.({block:'nearest'})},[messages]);
 const send=async(text:string,retry=false)=>{if(active.current||!text.trim()||!auth.isLoggedIn)return;const controller=new AbortController();active.current=controller;const run=++generation.current;const history=(retry?live.current.slice(0,-2):live.current).filter(m=>m.content).slice(-4);const context=history.length?'Previous conversation:\n'+history.map(m=>m.role+': '+m.content).join('\n').slice(-2000)+'\nCurrent message: ':'';
  setLast(text);setError('');setBusy(true);setConfirmEnd(false);setMessages([...history,{role:'user',content:text},{role:'assistant',content:''}]);
  try{const r=await fetch('/api/kride/chat/stream',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','Accept':'text/event-stream'},body:JSON.stringify({message:context+text,language}),signal:controller.signal});await consumeChatStream(r,controller.signal,chunk=>{if(run===generation.current)setMessages(prev=>[...prev.slice(0,-1),{role:'assistant',content:prev[prev.length-1].content+chunk}])});}
  catch(e){if(run===generation.current&&!controller.signal.aborted)setError((e as Error).message)}finally{if(run===generation.current){setBusy(false);active.current=null}}
 };
 const submit=(e:FormEvent)=>{e.preventDefault();const text=input.trim();if(text){setInput('');void send(text)}};
 const onKey=(e:KeyboardEvent<HTMLTextAreaElement>)=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();const text=input.trim();if(text&&!busy){setInput('');void send(text)}}};
 const endChat=()=>{stop();setMessages([]);setError('');setLast('');setConfirmEnd(false)};
 const hasConversation=messages.length>0;
 return <section className="language-chat">
  <div className="language-chat-head">
   <nav className="language-chat-tabs" aria-label="대화 언어"><Link href="/view/AI_ENGLISH_CHAT_PAGE" aria-current={language==='en'?'page':undefined}>영어 채팅</Link><Link href="/view/AI_JAPANESE_CHAT_PAGE" aria-current={language==='ja'?'page':undefined}>일본어 채팅</Link></nav>
   {auth.isLoggedIn&&hasConversation&&(confirmEnd
    ?<div className="language-chat-end" role="group" aria-label="대화 종료 확인"><span>대화 기록이 사라져요. 종료할까요?</span><button type="button" onClick={()=>setConfirmEnd(false)}>계속하기</button><button type="button" className="is-danger" onClick={endChat}>종료</button></div>
    :<button type="button" className="language-chat-endlink" onClick={()=>setConfirmEnd(true)}>대화 종료</button>)}
  </div>
  <h1>{name} 채팅</h1>
  <p className="language-chat-sub">텍스트로 대화를 연습하세요. AI가 {name} 답변과 짧은 한국어 설명을 제공합니다.</p>
  <p className="language-chat-notice" role="note">시험 운영 중 · 텍스트만 지원하고 음성 녹음은 준비 중이에요.</p>
  {auth.isLoading?<p role="status" className="language-chat-status">로그인을 확인하는 중…</p>
  :!auth.isLoggedIn?<KrideStatePanel kind="forbidden" title="로그인 후 대화를 시작할 수 있어요" description="대화 기록은 계정별로 보관돼요." primaryAction={{label:'로그인하고 시작하기',href:'/view/LOGIN_PAGE?returnTo='+encodeURIComponent('/view/'+screenId)}}/>
  :<>
   <div className="language-thread" role="log" aria-label="대화 내용" aria-busy={busy}>
    {!hasConversation&&<div className="language-thread-empty"><p>무엇이든 물어보세요. 아래 추천 질문을 눌러 바로 시작할 수도 있어요.</p><div className="language-suggestions">{SUGGESTIONS[language].map(q=><button key={q} type="button" className="language-suggestion" onClick={()=>void send(q)} disabled={busy}>{q}</button>)}</div></div>}
    {messages.map((m,i)=>{const pending=m.role==='assistant'&&!m.content;const failed=pending&&!!error&&i===messages.length-1;
     return <div key={i} className={'language-message '+m.role+(failed?' is-failed':'')} data-role={m.role}>
      <span className="language-message__who">{m.role==='user'?'나':'AI'}</span>
      {failed
       ?<div className="language-message__bubble" role="alert"><p>{error}</p><button type="button" disabled={busy} onClick={()=>void send(last,true)}>다시 시도</button></div>
       :<div className="language-message__bubble"><p>{m.content||(busy?'답변을 쓰는 중…':'답변을 기다리는 중…')}</p>{pending&&busy&&<span className="language-typing" aria-hidden="true"><i/><i/><i/></span>}</div>}
     </div>})}
    <div ref={threadEnd}/>
   </div>
   {error&&!(messages.length&&messages[messages.length-1].role==='assistant'&&!messages[messages.length-1].content)&&<div role="alert" className="language-chat-alert"><p>{error}</p><button type="button" disabled={busy} onClick={()=>void send(last,true)}>다시 시도</button></div>}
   <form className="language-composer" onSubmit={submit}>
    <label htmlFor="language-message" className="language-composer__label">{name} 대화 메시지</label>
    <div className="language-composer__row">
     <textarea id="language-message" value={input} maxLength={1500} rows={2} onChange={e=>setInput(e.target.value)} onKeyDown={onKey} placeholder={language==='ja'?'日本語か韓国語で入力…':language==='ko'?'한국어로 입력…':'영어 또는 한국어로 입력…'}/>
     {busy?<button type="button" className="language-composer__stop" onClick={stop}>응답 중단</button>:<button type="submit" className="language-composer__send" disabled={busy||!input.trim()} aria-label="전송">전송</button>}
    </div>
    <p className="language-composer__hint">Enter 전송 · Shift+Enter 줄바꿈</p>
   </form>
  </>}
 </section>;
}
