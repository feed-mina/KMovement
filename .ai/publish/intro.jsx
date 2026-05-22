// KRIDE_INTRO1 — cinematic intro for K-Ride travel itinerary
// Fixes screen-ratio + Korean text overflow issues from the Netflix-inspired original.
// Original brand identity — not derived from Netflix marks.

const { useState, useEffect, useRef } = React;

// ─────────────────────────────────────────────────────────────
// Brand tokens
// ─────────────────────────────────────────────────────────────
const KRIDE_RED = '#E50914';      // your existing red, used sparingly
const KRIDE_BG = '#0A0A0A';
const KRIDE_FG = '#FFFFFF';
const KRIDE_DIM = 'rgba(255,255,255,0.62)';

// ─────────────────────────────────────────────────────────────
// SVG hero — original KRIDE mark (not Netflix-derived)
// A stylised road tracking through Korea's silhouette with the wordmark.
// ─────────────────────────────────────────────────────────────
function KrideHeroArt({ tone = 'red', variant = 'wordmark' }) {
  const accent = tone === 'red' ? '#E50914'
               : tone === 'amber' ? '#F5A524'
               : tone === 'cyan' ? '#5BC0EB'
               : '#FFFFFF';

  if (variant === 'photo') {
    // Striped placeholder for a real photographer's shot
    return (
      <div style={{
        width: '100%', height: '100%', position: 'relative',
        background: `repeating-linear-gradient(135deg, #151515 0 14px, #1c1c1c 14px 28px)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          color: 'rgba(255,255,255,0.45)', fontSize: 11, letterSpacing: '0.12em',
          textTransform: 'uppercase', padding: '6px 12px',
          border: '1px dashed rgba(255,255,255,0.25)', borderRadius: 4,
        }}>hero photo · 16:9</div>
      </div>
    );
  }

  if (variant === 'gradient') {
    return (
      <div style={{
        width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
        background: `radial-gradient(120% 90% at 20% 20%, ${accent}50, transparent 55%),
                     radial-gradient(140% 100% at 90% 90%, #1a1a1a, ${KRIDE_BG} 70%),
                     ${KRIDE_BG}`,
      }}>
        {/* film grain */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.35, mixBlendMode: 'overlay',
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.4 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`,
        }} />
      </div>
    );
  }

  // wordmark — KRIDE letters with a road sweeping through
  return (
    <svg viewBox="0 0 390 280" style={{ width: '100%', height: '100%', display: 'block' }} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#161616"/>
          <stop offset="0.6" stopColor="#0A0A0A"/>
          <stop offset="1" stopColor="#000000"/>
        </linearGradient>
        <linearGradient id="road" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0"/>
          <stop offset="0.5" stopColor={accent} stopOpacity="0.9"/>
          <stop offset="1" stopColor={accent}/>
        </linearGradient>
        <radialGradient id="glow" cx="0.5" cy="0.85" r="0.5">
          <stop offset="0" stopColor={accent} stopOpacity="0.4"/>
          <stop offset="1" stopColor={accent} stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect width="390" height="280" fill="url(#sky)"/>
      <rect width="390" height="280" fill="url(#glow)"/>

      {/* horizon */}
      <line x1="0" y1="210" x2="390" y2="210" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>

      {/* receding road */}
      <path d="M 175 210 L 195 280 L 220 280 L 215 210 Z" fill="url(#road)" opacity="0.85"/>
      <path d="M 195 210 L 195 280 M 200 210 L 205 280" stroke={accent} strokeWidth="0.8" strokeDasharray="4 6" opacity="0.7"/>

      {/* wordmark — K · RIDE */}
      <g transform="translate(195 120)" textAnchor="middle">
        <text style={{ fontFamily: 'Anton, Bebas Neue, "Helvetica Neue", sans-serif', fontWeight: 800, letterSpacing: '0.04em' }}
              fontSize="84" fill="#FFFFFF">K-RIDE</text>
        <text style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', letterSpacing: '0.42em' }}
              fontSize="9" fill={accent} y="22">SEOUL · BUSAN · JEJU</text>
      </g>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Duration button — variants
// ─────────────────────────────────────────────────────────────
function DurationBtn({ label, sub, selected, onClick, style = 'solid' }) {
  const base = {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 20px', borderRadius: 14, cursor: 'pointer',
    fontFamily: 'Pretendard, "Noto Sans KR", system-ui, sans-serif',
    fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em',
    transition: 'all 180ms cubic-bezier(.2,.7,.2,1)',
    border: '1px solid transparent',
  };
  let look;
  if (style === 'solid') {
    look = selected
      ? { background: KRIDE_RED, color: '#fff', boxShadow: `0 8px 24px ${KRIDE_RED}55` }
      : { background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' };
  } else if (style === 'outline') {
    look = selected
      ? { background: KRIDE_RED, color: '#fff', borderColor: KRIDE_RED }
      : { background: 'transparent', color: '#fff', border: `1px solid rgba(255,255,255,0.25)` };
  } else { // ghost / cinema
    look = selected
      ? { background: '#fff', color: '#000' }
      : { background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.18)' };
  }

  return (
    <button onClick={onClick} style={{ ...base, ...look }}>
      <span>{label}</span>
      <span style={{
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        fontSize: 11, fontWeight: 500, letterSpacing: '0.08em',
        opacity: selected ? 0.85 : 0.5,
      }}>{sub}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Layout: Classic — fixed proportions, hero gets a defined slot
// ─────────────────────────────────────────────────────────────
function LayoutClassic({ tweak, duration, setDuration }) {
  const titleSize = tweak.titleSize; // 26 / 28 / 32
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: KRIDE_BG, color: KRIDE_FG,
      padding: '64px 24px 36px',
      boxSizing: 'border-box',
    }}>
      {/* hero — proportional, never overflows */}
      <div style={{
        width: '100%', aspectRatio: '16/10', borderRadius: 18, overflow: 'hidden',
        marginTop: 8,
      }}>
        <KrideHeroArt tone={tweak.tone} variant={tweak.hero}/>
      </div>

      {/* title block */}
      <div style={{ marginTop: 28 }}>
        <div style={{
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase',
          color: tweak.tone === 'red' ? KRIDE_RED : '#fff',
          marginBottom: 12,
        }}>STEP 01 / 05</div>
        <h1 style={{
          margin: 0, fontFamily: 'Pretendard, "Noto Sans KR", system-ui, sans-serif',
          fontWeight: 800, fontSize: titleSize, lineHeight: 1.2, letterSpacing: '-0.02em',
          wordBreak: 'keep-all', // critical for Korean line-breaking
        }}>어떤 여행을<br/>떠나실 건가요?</h1>
        <p style={{
          margin: '10px 0 0', color: KRIDE_DIM, fontSize: 14, lineHeight: 1.5,
          wordBreak: 'keep-all', fontFamily: 'Pretendard, "Noto Sans KR", sans-serif',
        }}>여행 기간을 선택해주세요.</p>
      </div>

      {/* buttons — bottom-anchored */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <DurationBtn label="당일치기" sub="DAY · 1d" selected={duration === 'day'} onClick={() => setDuration('day')} style={tweak.btn}/>
        <DurationBtn label="1박 2일" sub="1N · 2d" selected={duration === '1n2d'} onClick={() => setDuration('1n2d')} style={tweak.btn}/>
        <DurationBtn label="2박 3일" sub="2N · 3d" selected={duration === '2n3d'} onClick={() => setDuration('2n3d')} style={tweak.btn}/>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Layout: Cinematic Split — hero full-bleed top half, content bottom
// ─────────────────────────────────────────────────────────────
function LayoutCinematic({ tweak, duration, setDuration }) {
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: KRIDE_BG, color: KRIDE_FG,
    }}>
      {/* hero — exactly 46% of screen */}
      <div style={{ position: 'relative', flex: '0 0 46%', overflow: 'hidden' }}>
        <KrideHeroArt tone={tweak.tone} variant={tweak.hero}/>
        {/* fade to content */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: 120,
          background: `linear-gradient(to bottom, transparent, ${KRIDE_BG})`,
        }}/>
        {/* step badge sits over hero */}
        <div style={{
          position: 'absolute', top: 64, left: 24,
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase',
          color: '#fff', opacity: 0.7,
        }}>STEP 01 / 05</div>
      </div>

      {/* content */}
      <div style={{
        flex: 1, padding: '0 24px 36px', display: 'flex', flexDirection: 'column',
      }}>
        <h1 style={{
          margin: '-32px 0 0', position: 'relative', zIndex: 2,
          fontFamily: 'Pretendard, "Noto Sans KR", sans-serif',
          fontWeight: 800, fontSize: tweak.titleSize + 2, lineHeight: 1.15, letterSpacing: '-0.025em',
          wordBreak: 'keep-all',
        }}>어떤 여행을<br/>떠나실 건가요?</h1>
        <p style={{
          margin: '12px 0 28px', color: KRIDE_DIM, fontSize: 14.5, lineHeight: 1.55,
          wordBreak: 'keep-all', fontFamily: 'Pretendard, "Noto Sans KR", sans-serif',
        }}>몇 박 며칠로 떠나실지 골라주세요.<br/>이후 좋아하는 아티스트와 지역을 선택하시면 됩니다.</p>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <DurationBtn label="당일치기" sub="DAY · 1d" selected={duration === 'day'} onClick={() => setDuration('day')} style={tweak.btn}/>
          <DurationBtn label="1박 2일" sub="1N · 2d" selected={duration === '1n2d'} onClick={() => setDuration('1n2d')} style={tweak.btn}/>
          <DurationBtn label="2박 3일" sub="2N · 3d" selected={duration === '2n3d'} onClick={() => setDuration('2n3d')} style={tweak.btn}/>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Layout: Letterboxed — intentional 16:9 cinema bars
// ─────────────────────────────────────────────────────────────
function LayoutLetterbox({ tweak, duration, setDuration }) {
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: '#000', color: KRIDE_FG,
    }}>
      {/* top black bar (status area) */}
      <div style={{ height: 60 }}/>

      {/* 16:9 hero */}
      <div style={{ width: '100%', aspectRatio: '16/9', overflow: 'hidden', position: 'relative' }}>
        <KrideHeroArt tone={tweak.tone} variant={tweak.hero}/>
        {/* timecode strip */}
        <div style={{
          position: 'absolute', top: 12, left: 14, right: 14,
          display: 'flex', justifyContent: 'space-between',
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          fontSize: 9.5, letterSpacing: '0.16em',
          color: 'rgba(255,255,255,0.7)',
        }}>
          <span>K-RIDE · S01E01</span>
          <span>● REC · 00:00:01</span>
        </div>
      </div>

      {/* content */}
      <div style={{
        flex: 1, padding: '28px 24px 36px',
        display: 'flex', flexDirection: 'column',
        background: '#000',
      }}>
        <div style={{
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase',
          color: KRIDE_RED, marginBottom: 10,
        }}>EPISODE 01 — DURATION</div>
        <h1 style={{
          margin: 0, fontFamily: 'Pretendard, "Noto Sans KR", sans-serif',
          fontWeight: 800, fontSize: tweak.titleSize, lineHeight: 1.18, letterSpacing: '-0.02em',
          wordBreak: 'keep-all',
        }}>어떤 여행을<br/>떠나실 건가요?</h1>
        <p style={{
          margin: '10px 0 0', color: KRIDE_DIM, fontSize: 13.5, lineHeight: 1.55,
          fontFamily: 'Pretendard, "Noto Sans KR", sans-serif', wordBreak: 'keep-all',
        }}>여행 기간을 선택해주세요.</p>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <DurationBtn label="당일치기" sub="DAY · 1d" selected={duration === 'day'} onClick={() => setDuration('day')} style={tweak.btn}/>
          <DurationBtn label="1박 2일" sub="1N · 2d" selected={duration === '1n2d'} onClick={() => setDuration('1n2d')} style={tweak.btn}/>
          <DurationBtn label="2박 3일" sub="2N · 3d" selected={duration === '2n3d'} onClick={() => setDuration('2n3d')} style={tweak.btn}/>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Layout: Typographic — no hero, massive Korean type
// ─────────────────────────────────────────────────────────────
function LayoutTypographic({ tweak, duration, setDuration }) {
  const accent = tweak.tone === 'red' ? KRIDE_RED : tweak.tone === 'amber' ? '#F5A524' : '#5BC0EB';
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: KRIDE_BG, color: KRIDE_FG,
      padding: '64px 24px 36px', boxSizing: 'border-box',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* subtle accent shape */}
      <div style={{
        position: 'absolute', top: -120, right: -120, width: 320, height: 320, borderRadius: '50%',
        background: `radial-gradient(circle, ${accent}33, transparent 70%)`,
        pointerEvents: 'none',
      }}/>

      <div style={{
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase',
        color: accent, marginTop: 8,
      }}>K-RIDE · STEP 01 / 05</div>

      <h1 style={{
        margin: '24px 0 0', fontFamily: 'Pretendard, "Noto Sans KR", sans-serif',
        fontWeight: 900, fontSize: 44, lineHeight: 1.05, letterSpacing: '-0.035em',
        wordBreak: 'keep-all',
      }}>
        어떤<br/>여행을<br/><span style={{ color: accent }}>떠나실</span><br/>건가요?
      </h1>

      <p style={{
        margin: '24px 0 0', color: KRIDE_DIM, fontSize: 14.5, lineHeight: 1.55, maxWidth: 280,
        fontFamily: 'Pretendard, "Noto Sans KR", sans-serif', wordBreak: 'keep-all',
      }}>먼저 여행 기간을 골라주세요. 다음 화면에서 아티스트와 지역을 선택할 수 있어요.</p>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <DurationBtn label="당일치기" sub="DAY · 1d" selected={duration === 'day'} onClick={() => setDuration('day')} style={tweak.btn}/>
        <DurationBtn label="1박 2일" sub="1N · 2d" selected={duration === '1n2d'} onClick={() => setDuration('1n2d')} style={tweak.btn}/>
        <DurationBtn label="2박 3일" sub="2N · 3d" selected={duration === '2n3d'} onClick={() => setDuration('2n3d')} style={tweak.btn}/>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Layout: Broken (the original, for comparison)
// ─────────────────────────────────────────────────────────────
function LayoutBroken({ duration, setDuration }) {
  return (
    <div style={{
      minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: '#000', color: '#fff', padding: '48px 24px 32px', gap: 24,
    }}>
      {/* oversized hero - max-w-xs h-56 object-contain */}
      <div style={{
        width: '100%', maxWidth: 320, height: 224,
        background: `repeating-linear-gradient(135deg, #151515 0 14px, #1c1c1c 14px 28px)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: 'monospace' }}>kride/intro1_hero.svg</div>
      </div>
      {/* text-3xl font-black, no word-break: keep-all → Korean breaks awkwardly */}
      <div style={{
        fontWeight: 900, fontSize: 30, lineHeight: 1.3, color: '#fff', textAlign: 'center',
        fontFamily: 'Pretendard, "Noto Sans KR", sans-serif',
      }}>어떤 여행을 떠나실 건가요?</div>
      <div style={{ color: '#9ca3af', fontSize: 16, textAlign: 'center', marginBottom: 16 }}>여행 기간을 선택해주세요</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 320, marginTop: 24 }}>
        {[['day', '당일치기'], ['1n2d', '1박 2일'], ['2n3d', '2박 3일']].map(([k, l]) => (
          <button key={k} onClick={() => setDuration(k)} style={{
            padding: '16px 32px', fontSize: 18, fontWeight: 700, borderRadius: 9999,
            border: '2px solid #DC2626', background: duration === k ? '#DC2626' : 'transparent',
            color: duration === k ? '#fff' : '#EF4444', cursor: 'pointer',
          }}>{l}</button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Phone shell — picks layout based on tweak
// ─────────────────────────────────────────────────────────────
function KrideIntroPhone({ tweak, label }) {
  const [duration, setDuration] = useState(null);
  const layouts = {
    classic: LayoutClassic,
    cinematic: LayoutCinematic,
    letterbox: LayoutLetterbox,
    typographic: LayoutTypographic,
    broken: LayoutBroken,
  };
  const L = layouts[tweak.layout] || LayoutClassic;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <IOSDevice width={390} height={844} dark={true}>
        <div style={{ height: '100%', position: 'relative' }}>
          <L tweak={tweak} duration={duration} setDuration={setDuration}/>
          {/* next-button affordance, appears once a duration is picked */}
          {duration && tweak.layout !== 'broken' && (
            <div style={{
              position: 'absolute', bottom: 60, right: 20,
              padding: '10px 18px', borderRadius: 999,
              background: '#fff', color: '#000',
              fontFamily: 'Pretendard, "Noto Sans KR", sans-serif',
              fontWeight: 700, fontSize: 14,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              animation: 'krideFadeUp 240ms ease-out',
            }}>다음 →</div>
          )}
        </div>
      </IOSDevice>
      {label && (
        <div style={{
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.55)',
        }}>{label}</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Root — single phone OR side-by-side comparison
// ─────────────────────────────────────────────────────────────
const KRIDE_DEFAULTS = /*EDITMODE-BEGIN*/{
  "layout": "cinematic",
  "hero": "wordmark",
  "tone": "red",
  "btn": "solid",
  "titleSize": 28,
  "compare": false
}/*EDITMODE-END*/;

// ─────────────────────────────────────────────────────────────
// Auto-scale hook — shrinks the phone down so it fits any viewport.
// ─────────────────────────────────────────────────────────────
function useFitScale(refTarget, refContainer, deps = []) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => {
      const c = refContainer.current;
      const t = refTarget.current;
      if (!c || !t) return;
      // Reserve space on the right for the Tweaks panel (~312px on narrow viewports).
      const panelReserve = c.clientWidth < 900 ? 300 : 40;
      const cw = Math.max(120, c.clientWidth - panelReserve);
      const ch = c.clientHeight - 40;
      const tw = t.scrollWidth;
      const th = t.scrollHeight;
      const s = Math.min(1, cw / tw, ch / th);
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
  const [tweak, setTweak] = useTweaks(KRIDE_DEFAULTS);
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const scale = useFitScale(stageRef, containerRef, [tweak.compare]);

  return (
    <div ref={containerRef} style={{
      minHeight: '100vh', width: '100vw', display: 'flex',
      alignItems: 'center', justifyContent: 'flex-start',
      background: '#1a1a1a', padding: 0, overflow: 'hidden',
    }}>
      <div ref={stageRef} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40,
        transform: `scale(${scale})`, transformOrigin: 'left center',
        marginLeft: 24,
        transition: 'transform 200ms ease',
      }}>
        {tweak.compare ? (
          <>
            <KrideIntroPhone tweak={{ ...tweak, layout: 'broken' }} label="Before · current build"/>
            <KrideIntroPhone tweak={tweak} label={`After · ${tweak.layout}`}/>
          </>
        ) : (
          <KrideIntroPhone tweak={tweak}/>
        )}
      </div>

      <TweaksPanel title="KRIDE Intro · Tweaks">
        <TweakSection label="Layout">
          <TweakSelect
            label="Composition"
            value={tweak.layout}
            options={[
              { value: 'cinematic', label: 'Cinematic split (recommended)' },
              { value: 'classic', label: 'Classic — hero + title + buttons' },
              { value: 'letterbox', label: 'Letterboxed (16:9 cinema bars)' },
              { value: 'typographic', label: 'Typographic (no hero)' },
              { value: 'broken', label: '⚠ Original (for comparison)' },
            ]}
            onChange={v => setTweak('layout', v)}
          />
          <TweakToggle label="Side-by-side compare" value={tweak.compare} onChange={v => setTweak('compare', v)}/>
        </TweakSection>

        <TweakSection label="Hero">
          <TweakRadio
            label="Treatment"
            value={tweak.hero}
            options={[
              { value: 'wordmark', label: 'Wordmark' },
              { value: 'gradient', label: 'Gradient' },
              { value: 'photo', label: 'Photo' },
            ]}
            onChange={v => setTweak('hero', v)}
          />
        </TweakSection>

        <TweakSection label="Tone">
          <TweakRadio
            label="Accent"
            value={tweak.tone}
            options={[
              { value: 'red', label: 'Red' },
              { value: 'amber', label: 'Amber' },
              { value: 'cyan', label: 'Cyan' },
            ]}
            onChange={v => setTweak('tone', v)}
          />
        </TweakSection>

        <TweakSection label="Buttons">
          <TweakRadio
            label="Style"
            value={tweak.btn}
            options={[
              { value: 'solid', label: 'Solid' },
              { value: 'outline', label: 'Outline' },
              { value: 'ghost', label: 'Ghost' },
            ]}
            onChange={v => setTweak('btn', v)}
          />
        </TweakSection>

        <TweakSection label="Typography">
          <TweakSlider
            label="Title size"
            value={tweak.titleSize}
            min={22} max={36} step={1}
            onChange={v => setTweak('titleSize', v)}
            unit="px"
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
