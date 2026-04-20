// Mid-fi wireframe primitives — real typography, placeholders, 1 accent
const WF = {
  ink: '#141414',
  ink80: 'rgba(20,20,20,0.82)',
  ink60: 'rgba(20,20,20,0.60)',
  ink40: 'rgba(20,20,20,0.40)',
  ink25: 'rgba(20,20,20,0.25)',
  ink15: 'rgba(20,20,20,0.14)',
  ink08: 'rgba(20,20,20,0.07)',
  ink04: 'rgba(20,20,20,0.035)',
  paper: '#fcfbf9',
  paperAlt: '#f3f1ed',
  accent: '#2856cc',
  accentBg: '#e8edfb',
  ok: '#2f8046',
  warn: '#c87510',
  bad: '#b6372a',
  darkBg: '#171717',
  darkPaper: '#1f1f1e',
  darkAlt: '#262625',
  darkInk: '#eeecea',
  darkInk60: 'rgba(238,236,234,0.58)',
  darkInk40: 'rgba(238,236,234,0.35)',
  darkInk15: 'rgba(238,236,234,0.14)',
  sans: 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  serif: '"Source Serif 4", "Georgia", serif',
  mono: '"JetBrains Mono", ui-monospace, Menlo, monospace',
};

function Box({w,h,label,striped,style={},children,radius=3,bg=WF.ink08,border='none',labelColor=WF.ink40}) {
  const stripeBg = `repeating-linear-gradient(135deg, ${WF.ink08} 0 8px, transparent 8px 16px)`;
  return <div style={{width:w,height:h,background:striped?stripeBg:bg,borderRadius:radius,border,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:WF.mono,fontSize:9,color:labelColor,letterSpacing:0.5,textTransform:'uppercase',flexShrink:0,boxSizing:'border-box',...style}}>{label||children}</div>;
}
function Line({w='100%',h=7,color,mb=6,rounded=2,style={}}) {
  return <div style={{width:w,height:h,background:color||'var(--wf-line,rgba(20,20,20,0.12))',borderRadius:rounded,marginBottom:mb,...style}}/>;
}
function TextLines({count=3,h=7,widths,gap=6,color}){
  const w = widths || Array.from({length:count},(_,i)=>i===count-1?55+Math.floor(Math.random()*18):78+Math.floor(Math.random()*20));
  return <div>{w.map((x,i)=><Line key={i} w={`${x}%`} h={h} color={color} mb={gap}/>)}</div>;
}
function Pill({children,active,tone,style={}}){
  const bg = active?'var(--wf-accent, #2856cc)':tone==='accent'?'var(--wf-accent-bg, #e8edfb)':'var(--wf-chip, rgba(20,20,20,0.07))';
  const color = active?'#fff':tone==='accent'?'var(--wf-accent, #2856cc)':'var(--wf-ink-80, rgba(20,20,20,0.82))';
  return <div style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 9px',borderRadius:999,background:bg,color,fontFamily:WF.sans,fontSize:11,fontWeight:500,whiteSpace:'nowrap',...style}}>{children}</div>;
}
function Btn({children,primary,ghost,w,style={},size='md'}){
  const pad = size==='sm'?'4px 10px':'7px 14px';
  const fs = size==='sm'?10:11;
  return <div style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6,padding:pad,borderRadius:4,background:primary?'var(--wf-accent, #2856cc)':ghost?'transparent':'var(--wf-btn, rgba(20,20,20,0.07))',border:ghost?'1px solid var(--wf-border, rgba(20,20,20,0.25))':'none',color:primary?'#fff':'var(--wf-ink-80, rgba(20,20,20,0.82))',fontFamily:WF.sans,fontSize:fs,fontWeight:500,width:w,boxSizing:'border-box',...style}}>{children}</div>;
}
function BrandMark({size=13,dark}){
  // size = intended height in px. Aspect ≈ 3.92:1
  const h = size + 4; // visual tuning — header uses size=13-15, renders ~17-19px tall
  const w = Math.round(h * 3.92);
  return <div className="wf-brand" data-wf-dark={dark?'1':'0'} style={{display:'inline-flex',alignItems:'center',height:h}}>
    <img src="assets/logo.png" alt="АВГУСТ" style={{height:h,width:w,display:'block',objectFit:'contain'}}/>
  </div>;
}

// BrandLogo — lightweight wordmark placeholder for brands in listings.
// Rendered as flat typography (no box). Font family & letter-spacing per brand family
// create enough visual differentiation for a wireframe without importing SVGs.
function BrandLogo({name,h=28}){
  const n = (name||'').toUpperCase();
  // Map of brand → logo asset filename. Missing entries fall back to typographic wordmark.
  const LOGOS = {
    'CASARTE':        'casarte.png',
    'FUNAI':          'funai.webp',
    'CENTEK':         'centek.png',
    'LG':             'lg.webp',
    'MIDEA':          'midea.png',
    'AQUA':           'aqua.png',
    'MITSUBISHI':     'mhi.png',
    'MITSUBISHI HEAVY':'mhi.png',
    'MHI':            'mhi.png',
    'HAIER':          'haier.png',
    'ROYAL CLIMA':    'royal-clima.png',
    'ROVEX':          'rovex.png',
    'JUST AIRCON':    'just-aircon.png',
    'COOLBERG':       'coolberg.png',
    'FERRUM':         'ferrum.png',
    'JAX':            'jax.png',
    'KALASHNIKOV':    'kalashnikov.png',
    'KEG':            'keg.png',
    'THAICON':        'thaicon.png',
    'ULTIMA COMFORT': 'ultimacomfort.png',
    'ULTIMACOMFORT':  'ultimacomfort.png',
    'VIOMI':          'viomi.jpg',
    'ENERGOLUX':      'energolux.png',
  };
  const file = LOGOS[n];
  if(file){
    return <img src={`assets/brands/${file}`} alt={name} style={{height:h,maxWidth:180,width:'auto',objectFit:'contain',display:'block'}}/>;
  }
  // Fallback — typographic wordmark for brands without a logo asset
  const S = {
    'T-MACON':           {font:WF.mono,  w:600, tr:0.3,  fs:10},
    'MDV':               {font:WF.sans,  w:800, tr:-0.2, fs:13},
  };
  const s = S[n] || {font:WF.sans, w:600, tr:0, fs:11};
  return <span style={{fontFamily:s.font,fontWeight:s.w,letterSpacing:s.tr,fontSize:s.fs,color:'var(--wf-ink)',lineHeight:1,textTransform:'none'}}>{n}</span>;
}
function LogoBox({size=26,letter,mono=true}){
  return <div style={{width:size,height:size,borderRadius:4,background:'var(--wf-chip, rgba(20,20,20,0.07))',border:'1px solid var(--wf-border-subtle, rgba(20,20,20,0.14))',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:WF.sans,fontSize:size*0.38,fontWeight:600,color:'var(--wf-ink-60, rgba(20,20,20,0.6))',flexShrink:0}}>{letter}</div>;
}
function Donut({value=78,size=64,stroke=7,color}){
  const r=(size-stroke)/2, c=2*Math.PI*r, o=c-(value/100)*c;
  return <svg width={size} height={size}>
    <circle cx={size/2} cy={size/2} r={r} stroke="var(--wf-chip, rgba(20,20,20,0.07))" strokeWidth={stroke} fill="none"/>
    <circle cx={size/2} cy={size/2} r={r} stroke={color||'var(--wf-accent, #2856cc)'} strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={o} strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}/>
    <text x={size/2} y={size/2+4} textAnchor="middle" fontFamily={WF.sans} fontSize={size*0.27} fontWeight="600" fill={color||'var(--wf-accent, #2856cc)'}>{value}</text>
  </svg>;
}
function Meter({value=78,w='100%',h=5,color,bg,rounded=999,dim=false}){
  return <div style={{width:w,height:h,background:bg||'var(--wf-chip, rgba(20,20,20,0.07))',borderRadius:rounded,overflow:'hidden'}}><div style={{width:`${value}%`,height:'100%',background:dim?'var(--wf-ink-25, rgba(20,20,20,0.25))':(color||'var(--wf-accent, #2856cc)')}}/></div>;
}
function Eyebrow({children,style={}}){
  return <div style={{fontFamily:WF.mono,fontSize:10,fontWeight:500,color:'var(--wf-ink-40, rgba(20,20,20,0.4))',textTransform:'uppercase',letterSpacing:1.4,...style}}>{children}</div>;
}
function H({children,size=22,weight=600,serif,style={}}){
  return <div style={{fontFamily:serif?WF.serif:WF.sans,fontSize:size,fontWeight:weight,letterSpacing:-0.3,lineHeight:1.1,...style}}>{children}</div>;
}
function T({children,size=12,weight=400,color,lh=1.5,style={}}){
  return <div style={{fontFamily:WF.sans,fontSize:size,fontWeight:weight,color:color||'var(--wf-ink-80, rgba(20,20,20,0.82))',lineHeight:lh,...style}}>{children}</div>;
}
function Screen({w,h,bg,dark,children,style={}}){
  const scope = dark===true?'dark':dark===false?'light':'auto';
  const darkMode = dark===true;
  return <div data-wf-scope={scope} style={{width:w,minHeight:h,background:bg||'var(--wf-paper)',color:'var(--wf-ink)',border:`1px solid var(--wf-border-subtle)`,borderRadius:4,fontFamily:WF.sans,position:'relative',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06)',...style}}>{children}</div>;
}
function Icon({d,size=14,color,style={}}){
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style}><path d={d}/></svg>;
}
const ICONS={
  search:'M21 21l-4.3-4.3 M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z',
  chevron:'M6 9l6 6 6-6',
  chevronR:'M9 18l6-6-6-6',
  sun:'M12 3v2 M12 19v2 M5 12H3 M21 12h-2 M5.6 5.6l1.4 1.4 M17 17l1.4 1.4 M5.6 18.4L7 17 M17 7l1.4-1.4 M12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8z',
  moon:'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  menu:'M3 6h18 M3 12h18 M3 18h18',
  close:'M18 6L6 18 M6 6l12 12',
  grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  list:'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  filter:'M3 4h18l-7 9v6l-4 2v-8L3 4z',
  cmd:'M12 4h4a3 3 0 0 1 0 6h-4V4z M12 4H8a3 3 0 0 0 0 6h4V4z M12 14h4a3 3 0 0 1 0 6h-4v-6z M12 14H8a3 3 0 0 0 0 6h4v-6z',
  star:'M12 2l2.9 6.9L22 10l-5.5 4.8L18 22l-6-3.6L6 22l1.5-7.2L2 10l7.1-1.1z',
  arrowR:'M5 12h14 M13 5l7 7-7 7',
  arrowL:'M19 12H5 M12 19l-7-7 7-7',
  check:'M20 6L9 17l-5-5',
  info:'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z M12 8v.01 M12 11v5',
  plus:'M12 5v14 M5 12h14',
  flame:'M12 3c4 4 5 6 5 10a5 5 0 0 1-10 0c0-3 2-5 2-5 0 2 2 3 3 3-1-3 0-6 0-8z',
  thermo:'M10 14V4a2 2 0 1 1 4 0v10 M12 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  mic:'M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z M19 11a7 7 0 0 1-14 0 M12 18v4',
};
function RatingStars({value=5,size=11,color}){
  return <div style={{display:'inline-flex',gap:1,color:color||'#d4a13a'}}>
    {Array.from({length:5}).map((_,i)=><Icon key={i} d={ICONS.star} size={size} style={{opacity:i<value?1:0.22,fill:i<value?'currentColor':'none'}}/>)}
  </div>;
}

Object.assign(window, {WF, Box, Line, TextLines, Pill, Btn, BrandMark, BrandLogo, LogoBox, Donut, Meter, Eyebrow, H, T, Screen, Icon, ICONS, RatingStars});
