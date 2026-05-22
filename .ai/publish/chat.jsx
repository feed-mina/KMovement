// KRIDE Chat — 챗봇 UI publisher prototype
// API: POST /api/v1/kride/chat (or /stream for SSE)
//   req:  { message, intent, artists, regions, purposes, duration }
//   resp: { intent, reply, pois, recommendationText, itinerary }

const { useState, useEffect, useRef, useMemo } = React;

// ─────────────────────────────────────────────────────────────
// Brand tokens — KRIDE Intro 와 동일
// ─────────────────────────────────────────────────────────────
const C = {
  red: '#E50914',
  bg: '#0A0A0A',
  bg2: '#141414',
  fg: '#FFFFFF',
  dim: 'rgba(255,255,255,0.62)',
  dim2: 'rgba(255,255,255,0.42)',
  line: 'rgba(255,255,255,0.08)',
  surface: 'rgba(255,255,255,0.05)',
  surfaceStrong: 'rgba(255,255,255,0.08)',
};

const FONT_KR = "'Pretendard', 'Noto Sans KR', system-ui, sans-serif";
const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace";

// ─────────────────────────────────────────────────────────────
// Sample data — generic public Korean POIs (no copyrighted artist info)
// ─────────────────────────────────────────────────────────────
const SAMPLE_USER_CONTEXT = {
  artists: ['아티스트 A', '아티스트 B'],
  regions: ['서울', '제주'],
  purposes: ['kculture'],
  duration: 2,
};

const SAMPLE_POIS = [
  { id: 1, name: '남산서울타워', address: '서울 용산구 남산공원길 105', tag: '랜드마크', distance: '2.3km', lat: 37.551, lng: 126.988 },
  { id: 2, name: '북촌한옥마을', address: '서울 종로구 계동길', tag: '문화', distance: '4.1km', lat: 37.582, lng: 126.985 },
  { id: 3, name: '광장시장', address: '서울 종로구 창경궁로 88', tag: '맛집', distance: '5.6km', lat: 37.570, lng: 126.999 },
];

const SAMPLE_ITINERARY = {
  duration: '1박2일',
  days: [
    {
      day: 1,
      morning: { places: [
        { name: '광장시장', desc: '아침 빈대떡 + 마약김밥' },
        { name: '북촌한옥마을', desc: '한복 대여 + 산책 (도보 10분)' },
      ]},
      afternoon: { places: [
        { name: '경복궁', desc: '수문장 교대식 14:00' },
        { name: '남산서울타워', desc: '석양 포인트' },
      ]},
    },
    {
      day: 2,
      morning: { places: [
        { name: '망원한강공원', desc: '한강뷰 카페 + 자전거' },
      ]},
      afternoon: { places: [
        { name: '연남동', desc: '경의선숲길 + 카페 거리' },
        { name: '홍대 거리', desc: '버스킹 + 저녁식사' },
      ]},
    },
  ],
};

const SAMPLE_SUGGESTIONS = [
  '1박2일 서울 코스 추천',
  '강남 데이트 코스 짜줘',
  '제주 자연 힐링 코스',
  '촬영지 위주로 코스 짜줘',
  '서울 야경 명소',
  '내 일정에 저장',
];

// ─────────────────────────────────────────────────────────────
// Header — title + status indicator + close
// ─────────────────────────────────────────────────────────────
function ChatHeader({ status, onClose, variant }) {
  const isSheet = variant === 'sheet';
  return (
    <div style={{
      flex: '0 0 auto', padding: isSheet ? '14px 18px 12px' : '52px 20px 14px',
      borderBottom: `1px solid ${C.line}`, background: C.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, position: 'relative',
    }}>
      {isSheet && (
        <div style={{
          position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
          width: 36, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.18)',
        }}/>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: `linear-gradient(135deg, ${C.red}, #8B0610)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Anton, sans-serif', fontSize: 14, fontWeight: 800, color: '#fff',
        }}>K</div>
        <div>
          <div style={{ fontFamily: FONT_KR, fontWeight: 700, fontSize: 15, color: C.fg, lineHeight: 1.1 }}>K-RIDE 여행봇</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: status === 'streaming' ? C.red : C.dim2, marginTop: 3, letterSpacing: '0.06em' }}>
            {status === 'streaming' ? '● 답변 생성 중...' : status === 'thinking' ? '○ 분석 중' : 'ONLINE · RAG + Neo4j'}
          </div>
        </div>
      </div>
      <button onClick={onClose} style={{
        width: 34, height: 34, borderRadius: 10, border: `1px solid ${C.line}`,
        background: 'transparent', color: C.dim, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
      }}>✕</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Bubble — user (right) / assistant (left)
// ─────────────────────────────────────────────────────────────
function Bubble({ role, children, streaming }) {
  const isUser = role === 'user';
  return (
    <div style={{
      display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start',
      gap: 8, animation: 'krFadeUp 280ms cubic-bezier(.2,.7,.2,1)',
    }}>
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: 8, flex: '0 0 28px',
          background: `linear-gradient(135deg, ${C.red}, #8B0610)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Anton, sans-serif', fontSize: 12, fontWeight: 800, color: '#fff',
          marginTop: 2,
        }}>K</div>
      )}
      <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{
          fontFamily: FONT_KR, fontSize: 14.5, lineHeight: 1.55,
          padding: '11px 14px', borderRadius: isUser ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
          background: isUser ? '#FFFFFF' : C.surfaceStrong,
          color: isUser ? '#0A0A0A' : C.fg,
          border: isUser ? 'none' : `1px solid ${C.line}`,
          wordBreak: 'keep-all',
        }}>
          {children}
          {streaming && <TypingDots/>}
        </div>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3, marginLeft: 6, verticalAlign: 'middle' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: '50%', background: C.red,
          animation: `krBlink 1.2s ${i * 0.15}s infinite ease-in-out`,
        }}/>
      ))}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// POI card — within an assistant bubble
// ─────────────────────────────────────────────────────────────
function PoiCard({ poi, onView, onAdd }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.line}`,
      borderRadius: 14, overflow: 'hidden', maxWidth: '100%',
    }}>
      {/* image strip — placeholder */}
      <div style={{
        height: 96, position: 'relative',
        background: `repeating-linear-gradient(135deg, #1c1c1c 0 14px, #232323 14px 28px)`,
      }}>
        <div style={{
          position: 'absolute', top: 8, left: 10,
          padding: '3px 7px', borderRadius: 6,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
          fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.08em',
          color: '#fff', textTransform: 'uppercase',
        }}>{poi.tag}</div>
        <div style={{
          position: 'absolute', bottom: 8, right: 10,
          fontFamily: FONT_MONO, fontSize: 10, color: 'rgba(255,255,255,0.7)',
        }}>{poi.distance}</div>
      </div>
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{ fontFamily: FONT_KR, fontWeight: 700, fontSize: 14, color: C.fg, marginBottom: 2 }}>{poi.name}</div>
        <div style={{ fontFamily: FONT_KR, fontSize: 11.5, color: C.dim, marginBottom: 10, wordBreak: 'keep-all' }}>{poi.address}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onView?.(poi)} style={{
            flex: 1, padding: '8px 0', borderRadius: 8,
            background: 'transparent', color: C.fg, border: `1px solid ${C.line}`,
            fontFamily: FONT_KR, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>지도에서 보기</button>
          <button onClick={() => onAdd?.(poi)} style={{
            flex: 1, padding: '8px 0', borderRadius: 8,
            background: C.red, color: '#fff', border: 'none',
            fontFamily: FONT_KR, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>일정에 추가</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Itinerary card — collapsible day breakdown + apply CTA
// ─────────────────────────────────────────────────────────────
function ItineraryCard({ itinerary, onApply }) {
  const [openDay, setOpenDay] = useState(0);
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.line}`,
      borderRadius: 14, overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 14px', borderBottom: `1px solid ${C.line}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.16em', color: C.red, textTransform: 'uppercase' }}>ITINERARY</div>
          <div style={{ fontFamily: FONT_KR, fontWeight: 700, fontSize: 14, color: C.fg, marginTop: 2 }}>{itinerary.duration} 추천 일정</div>
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.dim }}>
          {itinerary.days.length}일 · {itinerary.days.reduce((a, d) => a + d.morning.places.length + d.afternoon.places.length, 0)} 스팟
        </div>
      </div>
      <div style={{ padding: '8px 8px 10px' }}>
        {itinerary.days.map((d, i) => (
          <div key={i} style={{ marginBottom: 4 }}>
            <button onClick={() => setOpenDay(openDay === i ? -1 : i)} style={{
              width: '100%', padding: '8px 10px', borderRadius: 8,
              background: openDay === i ? C.surfaceStrong : 'transparent',
              border: 'none', color: C.fg, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontFamily: FONT_KR, fontSize: 13, fontWeight: 600,
            }}>
              <span>Day {d.day}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.dim }}>
                {openDay === i ? '▾' : '▸'} {d.morning.places.length + d.afternoon.places.length} stops
              </span>
            </button>
            {openDay === i && (
              <div style={{ padding: '6px 10px 8px 16px' }}>
                {[['오전', d.morning], ['오후', d.afternoon]].map(([label, slot]) => (
                  <div key={label} style={{ marginBottom: 6 }}>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.16em', color: C.dim2, marginBottom: 4 }}>{label.toUpperCase()}</div>
                    {slot.places.map((p, j) => (
                      <div key={j} style={{
                        display: 'flex', gap: 8, padding: '5px 0',
                        fontFamily: FONT_KR, fontSize: 12.5,
                      }}>
                        <div style={{
                          width: 4, height: 4, borderRadius: '50%', background: C.red,
                          marginTop: 7, flex: '0 0 4px',
                        }}/>
                        <div>
                          <div style={{ color: C.fg, fontWeight: 600 }}>{p.name}</div>
                          <div style={{ color: C.dim, fontSize: 11.5, marginTop: 1, wordBreak: 'keep-all' }}>{p.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ padding: '0 12px 12px' }}>
        <button onClick={onApply} style={{
          width: '100%', padding: '11px 0', borderRadius: 10,
          background: C.red, color: '#fff', border: 'none',
          fontFamily: FONT_KR, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          boxShadow: `0 8px 20px ${C.red}40`,
        }}>FOCUS 화면으로 적용 →</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Suggestion chips
// ─────────────────────────────────────────────────────────────
function Suggestions({ items, onPick }) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 7,
      padding: '0 16px 12px',
    }}>
      {items.map((s, i) => (
        <button key={i} onClick={() => onPick(s)} style={{
          padding: '7px 12px', borderRadius: 999,
          background: C.surface, border: `1px solid ${C.line}`,
          color: C.fg, fontFamily: FONT_KR, fontSize: 12, fontWeight: 500,
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}>{s}</button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Empty state — shown before any user message
// ─────────────────────────────────────────────────────────────
function EmptyState({ context }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'flex-start', justifyContent: 'center',
      padding: '24px 20px', gap: 14,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: `linear-gradient(135deg, ${C.red}, #8B0610)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Anton, sans-serif', fontSize: 22, fontWeight: 800, color: '#fff',
        boxShadow: `0 12px 30px ${C.red}40`,
      }}>K</div>
      <div>
        <h2 style={{
          margin: 0, fontFamily: FONT_KR, fontWeight: 800, fontSize: 22,
          color: C.fg, lineHeight: 1.25, wordBreak: 'keep-all', letterSpacing: '-0.02em',
        }}>안녕하세요,<br/>어떤 여행을 도와드릴까요?</h2>
        <p style={{
          margin: '10px 0 0', fontFamily: FONT_KR, fontSize: 13, lineHeight: 1.55,
          color: C.dim, wordBreak: 'keep-all',
        }}>아래 추천 질문을 누르거나 직접 입력해 주세요. 일정·POI·이동 동선까지 같이 잡아드려요.</p>
      </div>

      {context && (
        <div style={{
          width: '100%', padding: '10px 12px', borderRadius: 10,
          background: C.surface, border: `1px solid ${C.line}`,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.16em', color: C.dim2 }}>YOUR CONTEXT</div>
          <div style={{ fontFamily: FONT_KR, fontSize: 12, color: C.fg, wordBreak: 'keep-all' }}>
            {context.duration}일 · {context.regions.join(' · ')} · 좋아하는 아티스트 {context.artists.length}명
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Composer — text input + mic + send
// ─────────────────────────────────────────────────────────────
function Composer({ onSend, disabled }) {
  const [val, setVal] = useState('');
  const submit = () => {
    if (!val.trim() || disabled) return;
    onSend(val.trim());
    setVal('');
  };
  return (
    <div style={{
      flex: '0 0 auto', padding: '10px 14px 18px',
      borderTop: `1px solid ${C.line}`, background: C.bg,
      display: 'flex', alignItems: 'flex-end', gap: 8,
    }}>
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 6,
        background: C.surface, border: `1px solid ${C.line}`,
        borderRadius: 22, padding: '4px 4px 4px 14px',
      }}>
        <input
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="어디 가고 싶으세요?"
          disabled={disabled}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: C.fg, fontFamily: FONT_KR, fontSize: 14, padding: '6px 0',
          }}
        />
        <button title="음성 입력" style={{
          width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'transparent', color: C.dim, fontSize: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>🎙</button>
      </div>
      <button onClick={submit} disabled={!val.trim() || disabled} style={{
        width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: val.trim() ? 'pointer' : 'not-allowed',
        background: val.trim() ? C.red : C.surface,
        color: '#fff', fontSize: 18, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 160ms ease',
        boxShadow: val.trim() ? `0 6px 16px ${C.red}55` : 'none',
      }}>↑</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Thread — auto-scrolling message list
// ─────────────────────────────────────────────────────────────
function Thread({ messages, streaming }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [messages, streaming]);
  return (
    <div ref={ref} style={{
      flex: 1, overflow: 'auto', padding: '16px 16px 8px',
      display: 'flex', flexDirection: 'column', gap: 12,
      minHeight: 0,
    }}>
      {messages.map((m, i) => (
        <Bubble key={i} role={m.role} streaming={streaming && i === messages.length - 1 && m.role === 'assistant'}>
          {m.text && <div>{m.text}</div>}
          {m.pois && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: m.text ? 10 : 0 }}>
              {m.pois.map(p => <PoiCard key={p.id} poi={p}/>)}
            </div>
          )}
          {m.itinerary && (
            <div style={{ marginTop: m.text ? 10 : 0 }}>
              <ItineraryCard itinerary={m.itinerary} onApply={() => alert('FOCUS 화면 진입 (mock)')}/>
            </div>
          )}
        </Bubble>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Mock assistant response — emulates SSE token streaming
// ─────────────────────────────────────────────────────────────
function generateMockResponse(userText) {
  const lower = userText.toLowerCase();
  if (lower.includes('일정') || lower.includes('코스') || lower.includes('1박') || lower.includes('2박') || lower.includes('당일')) {
    return {
      text: '입력하신 조건으로 1박2일 코스를 짜봤어요. Day 1은 도심 문화 + 야경, Day 2는 한강 + 핫플 동선입니다.',
      itinerary: SAMPLE_ITINERARY,
    };
  }
  if (lower.includes('맛집') || lower.includes('카페') || lower.includes('야경') || lower.includes('서울') || lower.includes('명소') || lower.includes('스팟')) {
    return {
      text: '추천 스팟 3곳입니다. 동선상 도보 + 지하철로 모두 1시간 이내 이동 가능해요.',
      pois: SAMPLE_POIS,
    };
  }
  if (lower.includes('저장') || lower.includes('내 일정') || lower.includes('마이리스트')) {
    return {
      text: '현재 대화 내용을 마이리스트에 저장하시려면 일정 카드의 "FOCUS 화면으로 적용" 버튼을 눌러주세요. 저장 후에도 언제든 재추천 받을 수 있어요.',
    };
  }
  return {
    text: '네, 알겠습니다. 더 구체적으로 알려주시면 도와드릴게요. 예: 지역 (서울/제주), 기간 (1박2일), 테마 (맛집/야경/K-컬처) 등을 함께 말씀해주세요.',
  };
}

// ─────────────────────────────────────────────────────────────
// Main chat screen — composes header + (empty | thread) + composer
// ─────────────────────────────────────────────────────────────
function ChatScreen({ variant, showContext, onClose }) {
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState('idle');

  const sendMessage = (text) => {
    setMessages(m => [...m, { role: 'user', text }]);
    setStatus('thinking');
    setTimeout(() => {
      setStatus('streaming');
      setStreaming(true);
      const resp = generateMockResponse(text);
      // simulate token-by-token streaming
      let i = 0;
      const txt = resp.text;
      const tick = () => {
        i = Math.min(txt.length, i + Math.max(1, Math.round(Math.random() * 4)));
        setMessages(m => {
          const last = m[m.length - 1];
          if (last?.role === 'assistant') {
            return [...m.slice(0, -1), { ...last, text: txt.slice(0, i) }];
          }
          return [...m, { role: 'assistant', text: txt.slice(0, i) }];
        });
        if (i < txt.length) {
          setTimeout(tick, 28);
        } else {
          // after text done, attach POIs/itinerary if any
          if (resp.pois || resp.itinerary) {
            setMessages(m => {
              const last = m[m.length - 1];
              return [...m.slice(0, -1), { ...last, pois: resp.pois, itinerary: resp.itinerary }];
            });
          }
          setStreaming(false);
          setStatus('idle');
        }
      };
      setTimeout(tick, 100);
    }, 400);
  };

  const isEmpty = messages.length === 0;

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: C.bg, color: C.fg, position: 'relative',
      borderRadius: variant === 'sheet' ? '24px 24px 0 0' : 0,
      overflow: 'hidden',
    }}>
      <ChatHeader status={status} onClose={onClose} variant={variant}/>
      {isEmpty ? (
        <>
          <EmptyState context={showContext ? SAMPLE_USER_CONTEXT : null}/>
          <Suggestions items={SAMPLE_SUGGESTIONS} onPick={sendMessage}/>
        </>
      ) : (
        <Thread messages={messages} streaming={streaming}/>
      )}
      <Composer onSend={sendMessage} disabled={streaming}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Layout shells
// ─────────────────────────────────────────────────────────────
function FullscreenLayout({ tweak }) {
  return (
    <IOSDevice width={390} height={844} dark={true}>
      <ChatScreen variant="full" showContext={tweak.showContext} onClose={() => {}}/>
    </IOSDevice>
  );
}

function SheetLayout({ tweak }) {
  // Bottom sheet over a mocked FOCUS screen (map background)
  return (
    <IOSDevice width={390} height={844} dark={true}>
      <div style={{ height: '100%', position: 'relative', background: '#0A0A0A' }}>
        {/* mocked map background */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `
            radial-gradient(40% 30% at 30% 30%, rgba(229,9,20,0.18), transparent 60%),
            repeating-linear-gradient(45deg, #161616 0 20px, #1a1a1a 20px 40px)
          `,
        }}>
          <div style={{
            position: 'absolute', top: 60, left: 16, padding: '6px 10px', borderRadius: 8,
            background: 'rgba(10,10,10,0.7)', backdropFilter: 'blur(8px)',
            fontFamily: FONT_MONO, fontSize: 10, color: C.dim, letterSpacing: '0.12em',
          }}>FOCUS · MAP VIEW</div>
        </div>
        {/* bottom sheet */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          height: '78%', borderRadius: '24px 24px 0 0', overflow: 'hidden',
          boxShadow: '0 -8px 24px rgba(0,0,0,0.45)',
        }}>
          <ChatScreen variant="sheet" showContext={tweak.showContext} onClose={() => {}}/>
        </div>
      </div>
    </IOSDevice>
  );
}

function FloatingLauncherLayout({ tweak }) {
  // Just shows the launcher button + empty FOCUS background
  return (
    <IOSDevice width={390} height={844} dark={true}>
      <div style={{ height: '100%', position: 'relative', background: '#0A0A0A' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: `
            radial-gradient(40% 30% at 70% 50%, rgba(229,9,20,0.15), transparent 60%),
            repeating-linear-gradient(45deg, #161616 0 20px, #1a1a1a 20px 40px)
          `,
        }}/>
        <div style={{
          position: 'absolute', top: 60, left: 16, padding: '6px 10px', borderRadius: 8,
          background: 'rgba(10,10,10,0.7)', backdropFilter: 'blur(8px)',
          fontFamily: FONT_MONO, fontSize: 10, color: C.dim, letterSpacing: '0.12em',
        }}>FOCUS · 내 일정</div>
        <button style={{
          position: 'absolute', bottom: 80, right: 20,
          padding: '12px 18px 12px 14px', borderRadius: 999, border: 'none',
          background: C.red, color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: FONT_KR, fontSize: 14, fontWeight: 700,
          boxShadow: `0 12px 32px ${C.red}66`,
        }}>
          <span style={{
            width: 24, height: 24, borderRadius: 7,
            background: 'rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Anton, sans-serif', fontSize: 11, fontWeight: 800,
          }}>K</span>
          물어보기
        </button>
      </div>
    </IOSDevice>
  );
}

// ─────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────
const CHAT_DEFAULTS = /*EDITMODE-BEGIN*/{
  "layout": "fullscreen",
  "showContext": true
}/*EDITMODE-END*/;

function useFitScale(refTarget, refContainer, deps = []) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => {
      const c = refContainer.current;
      const t = refTarget.current;
      if (!c || !t) return;
      const panelReserve = c.clientWidth < 900 ? 300 : 40;
      const cw = Math.max(120, c.clientWidth - panelReserve);
      const ch = c.clientHeight - 40;
      const s = Math.min(1, cw / t.scrollWidth, ch / t.scrollHeight);
      setScale(s);
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (refContainer.current) ro.observe(refContainer.current);
    if (refTarget.current) ro.observe(refTarget.current);
    return () => ro.disconnect();
  }, deps);
  return scale;
}

function App() {
  const [tweak, setTweak] = useTweaks(CHAT_DEFAULTS);
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const scale = useFitScale(stageRef, containerRef, [tweak.layout]);

  const Layout = tweak.layout === 'sheet' ? SheetLayout
              : tweak.layout === 'launcher' ? FloatingLauncherLayout
              : FullscreenLayout;

  return (
    <div ref={containerRef} style={{
      minHeight: '100vh', width: '100vw', display: 'flex',
      alignItems: 'center', justifyContent: 'flex-start',
      background: '#1a1a1a', overflow: 'hidden',
    }}>
      <div ref={stageRef} style={{
        marginLeft: 24,
        transform: `scale(${scale})`, transformOrigin: 'left center',
        transition: 'transform 200ms ease',
      }}>
        <Layout tweak={tweak}/>
      </div>

      <TweaksPanel title="KRIDE Chat · Tweaks">
        <TweakSection label="Layout">
          <TweakSelect
            label="Composition"
            value={tweak.layout}
            options={[
              { value: 'fullscreen', label: 'Fullscreen modal' },
              { value: 'sheet', label: 'Bottom sheet (over FOCUS)' },
              { value: 'launcher', label: 'Launcher button (entry)' },
            ]}
            onChange={v => setTweak('layout', v)}
          />
        </TweakSection>
        <TweakSection label="Empty state">
          <TweakToggle label="Show user context" value={tweak.showContext} onChange={v => setTweak('showContext', v)}/>
        </TweakSection>
        <TweakSection label="Try it">
          <div style={{
            fontFamily: FONT_KR, fontSize: 11, color: 'rgba(41,38,27,0.62)', lineHeight: 1.55,
          }}>
            Suggestion chip 또는 직접 입력해보세요:
            <br/>· "1박2일 코스 짜줘"
            <br/>· "서울 야경 명소"
            <br/>· "내 일정에 저장"
          </div>
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
