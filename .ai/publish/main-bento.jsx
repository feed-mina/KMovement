// publish/main-bento.jsx — MAIN_PAGE bento + new KRIDE entry card prototype

const { useState, useEffect, useRef } = React;

const FONT_KR = "'Pretendard', 'Noto Sans KR', system-ui, sans-serif";
const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace";

// ─────────────────────────────────────────────────────────────
// Existing bento cards — placeholders matching the real V8 structure
// ─────────────────────────────────────────────────────────────
function ExistingAppointmentCard() {
  return (
    <div style={{
      gridColumn: '1 / 3',
      background: '#FFFFFF', border: '1.5px solid #e5e7eb',
      borderRadius: 16, padding: 24, minHeight: 160,
      display: 'flex', flexDirection: 'column', gap: 8,
      fontFamily: FONT_KR,
    }}>
      <div style={{ fontSize: 12, color: '#6b7280', fontFamily: FONT_MONO, letterSpacing: '0.08em' }}>TIME_RECORD_WIDGET</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>오늘의 약속 시간은?</div>
      <div style={{ fontSize: 13, color: '#6b7280' }}>목표 시간 위젯 (기존 컴포넌트)</div>
      <div style={{ marginTop: 'auto', display: 'flex', gap: 6 }}>
        <span style={{ width: 36, height: 24, borderRadius: 6, background: '#f3f4f6' }}/>
        <span style={{ width: 36, height: 24, borderRadius: 6, background: '#f3f4f6' }}/>
      </div>
    </div>
  );
}

function ExistingDiaryCard({ role }) {
  if (role === 'guest') {
    return (
      <div style={{
        background: '#0f766e', color: '#fff',
        borderRadius: 16, padding: 24, minHeight: 160,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        cursor: 'pointer', fontFamily: FONT_KR,
      }}>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 6 }}>로그인 하러가기</div>
          <div style={{ fontSize: '0.82rem', opacity: 0.75 }}>계정이 있으신가요? 지금 바로 시작하세요.</div>
        </div>
        <div style={{ alignSelf: 'flex-end', fontSize: 24, fontWeight: 600 }}>→</div>
      </div>
    );
  }
  return (
    <div style={{
      background: 'linear-gradient(135deg, #166534, #15803d)',
      color: '#fff', borderRadius: 16, padding: 24, minHeight: 160,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      cursor: 'pointer', fontFamily: FONT_KR,
    }}>
      <div>
        <div style={{ fontSize: '1.6rem', marginBottom: 8 }}>📔</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 6 }}>콘텐츠 쓰러가기</div>
        <div style={{ fontSize: '0.82rem', opacity: 0.75 }}>오늘 하루를 기록해보세요.</div>
      </div>
      <div style={{ alignSelf: 'flex-end', fontSize: 24, fontWeight: 600 }}>→</div>
    </div>
  );
}

function ExistingContentCard({ role }) {
  const isGuest = role === 'guest';
  return (
    <div style={{
      gridColumn: '1 / -1',
      background: '#1e293b', color: '#fff',
      borderRadius: 16, padding: 24, minHeight: 160,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      cursor: 'pointer', fontFamily: FONT_KR,
    }}>
      <div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 6 }}>
          {isGuest ? '튜토리얼 보기' : '콘텐츠 보기'}
        </div>
        <div style={{ fontSize: '0.82rem', opacity: 0.75 }}>
          {isGuest ? 'SDUI가 어떻게 동작하는지 살펴보세요.' : '나의 지난 기록들을 확인해보세요.'}
        </div>
      </div>
      <span style={{
        alignSelf: 'flex-start',
        padding: '5px 10px', borderRadius: 999,
        background: 'rgba(255,255,255,0.12)',
        fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
      }}>📖 {isGuest ? '튜토리얼' : '콘텐츠'}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// NEW: KRIDE entry card — 3 visual variants
// ─────────────────────────────────────────────────────────────
function KrideCardCinematic({ onClick }) {
  return (
    <div onClick={onClick} style={{
      gridColumn: '1 / -1',
      background: 'linear-gradient(135deg, #0A0A0A 0%, #1a0a0c 50%, #E50914 200%)',
      color: '#fff', borderRadius: 16, padding: 28, minHeight: 180,
      cursor: 'pointer', fontFamily: FONT_KR,
      position: 'relative', overflow: 'hidden',
      boxShadow: '0 8px 28px rgba(229,9,20,0.18), 0 1px 0 rgba(255,255,255,0.04) inset',
      transition: 'transform 200ms ease, box-shadow 200ms ease',
    }}
    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      {/* film grain */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.18, mixBlendMode: 'overlay',
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`,
        pointerEvents: 'none',
      }}/>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%', gap: 32, minHeight: 140 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            fontFamily: FONT_MONO, fontSize: 10, letterSpacing: '0.24em',
            color: '#E50914', textTransform: 'uppercase',
          }}>NEW · KRIDE TRAVEL</div>
          <div style={{
            fontFamily: 'Anton, "Helvetica Neue", sans-serif',
            fontSize: 38, fontWeight: 800, letterSpacing: '0.02em',
            lineHeight: 1, marginTop: 4,
          }}>K-RIDE 시작하기</div>
          <div style={{
            fontSize: 13.5, opacity: 0.7, marginTop: 6, maxWidth: 480,
            wordBreak: 'keep-all', lineHeight: 1.55,
          }}>좋아하는 아티스트와 지역을 고르면, AI 가 동선과 일정까지 한 번에 짜드려요.</div>
          <button style={{
            alignSelf: 'flex-start', marginTop: 12,
            padding: '10px 18px', borderRadius: 999,
            background: '#E50914', color: '#fff', border: 'none', cursor: 'pointer',
            fontFamily: FONT_KR, fontWeight: 700, fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: '0 6px 16px rgba(229,9,20,0.4)',
          }}>▶ 여행 시작하기</button>
        </div>

        {/* hero wordmark */}
        <div style={{
          flex: '0 0 200px', position: 'relative',
          display: 'none', alignSelf: 'stretch',
          alignItems: 'center', justifyContent: 'center',
        }} className="kride-hero-bigword">
          <div style={{
            fontFamily: 'Anton, sans-serif', fontSize: 88, fontWeight: 800,
            color: '#fff', opacity: 0.08, letterSpacing: '0.02em', lineHeight: 0.9,
            transform: 'rotate(-6deg)', userSelect: 'none', pointerEvents: 'none',
          }}>K-RIDE</div>
        </div>
      </div>
    </div>
  );
}

function KrideCardBold({ onClick }) {
  return (
    <div onClick={onClick} style={{
      gridColumn: '1 / -1',
      background: '#E50914', color: '#fff',
      borderRadius: 16, padding: 28, minHeight: 160,
      cursor: 'pointer', fontFamily: FONT_KR,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
      boxShadow: '0 8px 28px rgba(229,9,20,0.28)',
      transition: 'transform 200ms ease',
    }}
    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.18em', opacity: 0.8, marginBottom: 8 }}>NEW · K-RIDE TRAVEL</div>
        <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 34, fontWeight: 800, letterSpacing: '0.02em', lineHeight: 1 }}>
          K-pop 여행, 지금 시작
        </div>
        <div style={{ fontSize: 13.5, opacity: 0.85, marginTop: 10, maxWidth: 440, wordBreak: 'keep-all', lineHeight: 1.55 }}>
          아티스트 · 지역 · 테마를 고르고 AI 가 짜준 코스로 떠나세요.
        </div>
      </div>
      <div style={{
        flex: '0 0 64px', width: 64, height: 64, borderRadius: 16,
        background: 'rgba(255,255,255,0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28,
      }}>▶</div>
    </div>
  );
}

function KrideCardSide({ onClick }) {
  // Compact 1-column card — sits beside the appointment widget
  return (
    <div onClick={onClick} style={{
      background: 'linear-gradient(160deg, #0A0A0A, #1a0a0c)',
      color: '#fff', borderRadius: 16, padding: 24, minHeight: 160,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      cursor: 'pointer', fontFamily: FONT_KR,
      position: 'relative', overflow: 'hidden',
      transition: 'transform 200ms ease',
    }}
    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      {/* red accent corner */}
      <div style={{
        position: 'absolute', top: -40, right: -40, width: 120, height: 120,
        borderRadius: '50%', background: 'radial-gradient(circle, #E50914, transparent 70%)',
        opacity: 0.6,
      }}/>
      <div style={{ position: 'relative' }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: '0.18em', color: '#E50914' }}>NEW</div>
        <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 28, fontWeight: 800, marginTop: 6, letterSpacing: '0.02em' }}>K-RIDE</div>
        <div style={{ fontSize: 12, opacity: 0.72, marginTop: 6, lineHeight: 1.55, wordBreak: 'keep-all' }}>
          K-pop 테마 여행 AI 추천
        </div>
      </div>
      <div style={{
        alignSelf: 'flex-end', padding: '4px 10px', borderRadius: 999,
        background: '#E50914', fontSize: 11, fontWeight: 700,
      }}>시작하기 →</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// KRIDE_INTRO1 destination mockup — shown after card click
// ─────────────────────────────────────────────────────────────
function KrideIntroMockup() {
  return (
    <div style={{
      width: '100%', height: '100%', background: '#0A0A0A', color: '#fff',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px', boxSizing: 'border-box', fontFamily: FONT_KR,
    }}>
      <div style={{
        fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.24em',
        color: '#E50914', marginBottom: 16,
      }}>STEP 01 / 05 · KRIDE_INTRO1</div>
      <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 72, fontWeight: 800, letterSpacing: '0.02em', lineHeight: 1 }}>
        K-RIDE
      </div>
      <h1 style={{
        marginTop: 40, fontWeight: 800, fontSize: 32, lineHeight: 1.2,
        textAlign: 'center', wordBreak: 'keep-all', letterSpacing: '-0.02em',
      }}>어떤 여행을<br/>떠나실 건가요?</h1>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 10, marginTop: 32,
        width: '100%', maxWidth: 360,
      }}>
        {['당일치기', '1박 2일', '2박 3일'].map((l, i) => (
          <button key={i} style={{
            padding: '14px 20px', borderRadius: 12,
            background: i === 0 ? '#E50914' : 'rgba(255,255,255,0.06)',
            color: '#fff', border: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.12)',
            fontFamily: FONT_KR, fontWeight: 700, fontSize: 15, cursor: 'pointer',
          }}>{l}</button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN_PAGE bento composition — with NEW KRIDE card
// ─────────────────────────────────────────────────────────────
function MainBentoPage({ tweak, onCardClick }) {
  const { krideStyle, krideLayout, role, showOriginal } = tweak;

  let KrideCard = KrideCardCinematic;
  if (krideStyle === 'bold') KrideCard = KrideCardBold;
  if (krideStyle === 'side') KrideCard = KrideCardSide;

  const isSideLayout = krideStyle === 'side' || krideLayout === 'side';

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
      gap: 16, padding: 24, background: '#f0fdf4',
      minHeight: '100%', boxSizing: 'border-box',
    }}>
      {/* NEW KRIDE card — placement controlled by tweak */}
      {!showOriginal && krideLayout === 'top' && !isSideLayout && (
        <KrideCard onClick={onCardClick}/>
      )}

      {/* Side layout: KRIDE 1-col + appointment 2-col */}
      {!showOriginal && isSideLayout ? (
        <>
          <div style={{ gridColumn: '1 / 3' }}><ExistingAppointmentCard /></div>
          <KrideCardSide onClick={onCardClick}/>
        </>
      ) : (
        <ExistingAppointmentCard />
      )}

      <ExistingDiaryCard role={role}/>

      {/* Bottom hero placement */}
      {!showOriginal && krideLayout === 'bottom' && !isSideLayout && (
        <KrideCard onClick={onCardClick}/>
      )}

      <ExistingContentCard role={role}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Browser shell with route transition
// ─────────────────────────────────────────────────────────────
function BrowserShell({ tweak }) {
  const [route, setRoute] = useState('/view/MAIN_PAGE');
  const [transitioning, setTransitioning] = useState(false);

  const navigate = (to) => {
    setTransitioning(true);
    setTimeout(() => {
      setRoute(to);
      setTransitioning(false);
    }, 240);
  };

  return (
    <ChromeWindow
      width={1240} height={780}
      tabs={[{ title: route === '/view/MAIN_PAGE' ? 'K-RIDE | 메인' : 'K-RIDE | INTRO' }]}
      url={`yerin.duckdns.org${route}`}
    >
      <div style={{
        width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
        background: route === '/view/MAIN_PAGE' ? '#f0fdf4' : '#0A0A0A',
        transition: 'background 240ms ease',
      }}>
        <div style={{
          width: '100%', height: '100%',
          opacity: transitioning ? 0 : 1,
          transform: transitioning ? 'scale(0.98)' : 'scale(1)',
          transition: 'opacity 240ms ease, transform 240ms ease',
        }}>
          {route === '/view/MAIN_PAGE' ? (
            <MainBentoPage tweak={tweak} onCardClick={() => navigate('/view/INTRO1')}/>
          ) : (
            <div onClick={() => navigate('/view/MAIN_PAGE')} style={{ width: '100%', height: '100%', cursor: 'pointer' }}>
              <KrideIntroMockup/>
              <div style={{
                position: 'absolute', top: 14, left: 14,
                padding: '6px 10px', borderRadius: 8,
                background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)',
                fontFamily: FONT_MONO, fontSize: 10, cursor: 'pointer',
              }}>← MAIN_PAGE 로 돌아가기 (클릭)</div>
            </div>
          )}
        </div>
      </div>
    </ChromeWindow>
  );
}

// ─────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────
const MAIN_BENTO_DEFAULTS = /*EDITMODE-BEGIN*/{
  "krideStyle": "cinematic",
  "krideLayout": "top",
  "role": "user",
  "showOriginal": false
}/*EDITMODE-END*/;

function useFitScale(refTarget, refContainer, deps = []) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => {
      const c = refContainer.current;
      const t = refTarget.current;
      if (!c || !t) return;
      const panelReserve = c.clientWidth < 1100 ? 300 : 40;
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
  const [tweak, setTweak] = useTweaks(MAIN_BENTO_DEFAULTS);
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const scale = useFitScale(stageRef, containerRef, [tweak.krideStyle, tweak.krideLayout]);

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
        <BrowserShell tweak={tweak}/>
      </div>

      <TweaksPanel title="MAIN_PAGE · KRIDE Entry">
        <TweakSection label="KRIDE 카드 스타일">
          <TweakRadio
            label="Visual"
            value={tweak.krideStyle}
            options={[
              { value: 'cinematic', label: 'Cinematic' },
              { value: 'bold', label: 'Red bold' },
              { value: 'side', label: 'Side' },
            ]}
            onChange={v => setTweak('krideStyle', v)}
          />
        </TweakSection>

        <TweakSection label="배치">
          <TweakRadio
            label="Position"
            value={tweak.krideLayout}
            options={[
              { value: 'top', label: 'Top hero' },
              { value: 'bottom', label: 'Bottom' },
              { value: 'side', label: 'Side col' },
            ]}
            onChange={v => setTweak('krideLayout', v)}
          />
        </TweakSection>

        <TweakSection label="User role">
          <TweakRadio
            label="Role"
            value={tweak.role}
            options={[
              { value: 'user', label: 'ROLE_USER' },
              { value: 'guest', label: 'ROLE_GUEST' },
            ]}
            onChange={v => setTweak('role', v)}
          />
        </TweakSection>

        <TweakSection label="비교">
          <TweakToggle
            label="기존 MAIN_PAGE 보기 (KRIDE 카드 숨김)"
            value={tweak.showOriginal}
            onChange={v => setTweak('showOriginal', v)}
          />
        </TweakSection>

        <TweakSection label="시연">
          <div style={{ fontFamily: FONT_KR, fontSize: 11, color: 'rgba(41,38,27,0.62)', lineHeight: 1.55 }}>
            KRIDE 카드 클릭 → /view/INTRO1 으로 전환 애니메이션.<br/>
            돌아오려면 좌상단 "MAIN_PAGE 로 돌아가기" 클릭.
          </div>
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
