// Navigation — ONE flat top header (no dropdowns). Each item is a simple link
// into its own full section. Plus a mobile counterpart (header + drawer).

const NAV_ITEMS = [
  ['Новости','новости'],
  ['Рейтинг','рейтинг'],
  ['ISmeta','оценка смет'],
  ['Мешок Монтажников','биржа монтажников'],
  ['Анализ проектов','аналитика'],
  ['Франшиза','франшиза'],
  ['Ассоциация','сообщество'],
];

function NavFlat({dark, activeIdx=1}) {
  return (
    <div style={{borderBottom:'1px solid var(--wf-border-subtle)',background:'var(--wf-paper)'}}>
      <div style={{display:'flex',alignItems:'center',height:64,padding:'0 28px',gap:28}}>
        <BrandMark size={15} dark={dark}/>
        <div style={{display:'flex',gap:22,flex:1,alignItems:'center'}}>
          {NAV_ITEMS.map(([label],i)=>{
            const active = i===activeIdx;
            return <div key={label} style={{
              position:'relative',
              fontSize:13,
              fontWeight: active?600:500,
              color: active?'var(--wf-ink)':'var(--wf-ink-80)',
              paddingBottom:8,marginBottom:-8,
              letterSpacing:-0.1,
              whiteSpace:'nowrap'
            }}>
              {label}
              {active && <div style={{position:'absolute',left:0,right:0,bottom:0,height:2,background:'var(--wf-accent)',borderRadius:1}}/>}
            </div>;
          })}
        </div>
        <div style={{display:'flex',gap:14,alignItems:'center'}}>
          <Icon d={ICONS.search} size={16} color="var(--wf-ink-60)"/>
          <div style={{width:1,height:14,background:'var(--wf-border)'}}/>
          <T size={11} color="var(--wf-ink-60)">RU</T>
          <Icon d={dark?ICONS.sun:ICONS.moon} size={16} color="var(--wf-ink-60)"/>
          <div style={{padding:'6px 12px',borderRadius:4,border:'1px solid var(--wf-border)',fontSize:11,fontWeight:500,color:'var(--wf-ink-80)'}}>Вход</div>
        </div>
      </div>
    </div>
  );
}

// Same header, used on pages (no active indicator)
function NavFlatNeutral({dark}){ return <NavFlat dark={dark} activeIdx={-1}/>; }

// Mobile — collapsed header bar (hamburger + logo + search)
function NavMobileHeader({dark}){
  return (
    <div style={{height:58,display:'flex',alignItems:'center',padding:'0 18px',justifyContent:'space-between',borderBottom:'1px solid var(--wf-border-subtle)',background:'var(--wf-paper)'}}>
      <div style={{display:'flex',alignItems:'center',gap:14}}>
        <Icon d={ICONS.menu} size={20} color="var(--wf-ink)"/>
        <BrandMark size={13} dark={dark}/>
      </div>
      <div style={{display:'flex',gap:14,alignItems:'center'}}>
        <Icon d={ICONS.search} size={18} color="var(--wf-ink-80)"/>
        <Icon d={dark?ICONS.sun:ICONS.moon} size={16} color="var(--wf-ink-60)"/>
      </div>
    </div>
  );
}

// Mobile drawer open state — flat list, no sub-items (each is a section entry)
function NavMobileDrawer({dark}){
  return (
    <div style={{width:'100%',background:'var(--wf-paper)',minHeight:'100%'}}>
      <div style={{height:58,display:'flex',alignItems:'center',padding:'0 16px',justifyContent:'space-between',borderBottom:'1px solid var(--wf-border-subtle)'}}>
        <Icon d={ICONS.close} size={18}/>
        <BrandMark size={13} dark={dark}/>
        <div style={{width:24}}/>
      </div>
      <div style={{padding:'14px 16px 8px'}}>
        <Box w="100%" h={40} radius={4} bg="var(--wf-chip)" style={{padding:'0 12px',justifyContent:'flex-start',textTransform:'none',fontSize:12,color:'var(--wf-ink-40)',gap:10}}>
          <Icon d={ICONS.search} size={14}/> Поиск по сайту
        </Box>
      </div>
      {NAV_ITEMS.map(([label,hint],i)=>(
        <div key={label} style={{padding:'16px 18px',borderBottom:'1px solid var(--wf-border-subtle)',display:'flex',justifyContent:'space-between',alignItems:'center',background:i===1?'var(--wf-accent-bg)':'transparent'}}>
          <div style={{fontSize:15,fontWeight:i===1?600:500,color:i===1?'var(--wf-accent)':'var(--wf-ink)'}}>{label}</div>
          <Icon d={ICONS.chevronR} size={14} color="var(--wf-ink-40)"/>
        </div>
      ))}
      <div style={{padding:'18px 16px',display:'flex',gap:10,alignItems:'center'}}>
        <Pill>RU</Pill><Pill>EN</Pill>
        <div style={{flex:1}}/>
        <T size={11} color="var(--wf-ink-60)">Вход</T>
      </div>
    </div>
  );
}

Object.assign(window,{NavFlat,NavFlatNeutral,NavMobileHeader,NavMobileDrawer,NAV_ITEMS});
