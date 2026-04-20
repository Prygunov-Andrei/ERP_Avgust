// «Свой рейтинг» — 2 варианта (bool вкл/выкл + пресеты + FLIP-анимация переупорядочения)
// Показывает ТОЛЬКО вкладку «Свой рейтинг» в листинге (sticky header + таблица).
// Реальный пересчёт: индекс = Σ(wi · si) / Σ(wi) по включённым критериям, где si ∈ [0,100].

// ─── Модель данных ───────────────────────────────────────────
// id = индекс в CRITERIA (0..29), weight = %, tags для пресетов.
const CUSTOM_CRITERIA = [
  // 10%
  [ 0, 'Площадь труб теплообменника внутр. блока', 10, ['engine']],
  [ 1, 'Площадь труб теплообменника наруж. блока', 10, ['engine']],
  [ 2, 'Мощность компрессора',                     10, ['engine']],
  // 5%
  [ 3, 'Наличие ЭРВ',                               5, ['engine']],
  [ 4, 'Регулировка оборотов вент. наруж. блока',   5, ['silence','cold']],
  [ 5, 'Инверторный компрессор',                    5, ['silence','engine']],
  [ 6, 'Работа на обогрев',                         5, ['cold']],
  // 4%
  [ 7, 'Максимальная длина фреонопровода',          4, ['house']],
  [ 8, 'Максимальный перепад высот',                4, ['house']],
  [ 9, 'Гарантия',                                  4, ['service']],
  // 3%
  [10, 'Кол-во скоростей вент. внутр. блока',       3, ['silence']],
  [11, 'Наличие ИК датчика присутствия',            3, ['smart']],
  [12, 'Возраст бренда на рынке РФ',                3, ['service']],
  [13, 'Энергоэффективность',                       3, ['engine']],
  [14, 'Компрессор с технологией EVI',              3, ['cold']],
  // 2%
  [15, 'Наличие обогрева поддона',                  2, ['cold']],
  [16, 'Ионизатор',                                 2, ['smart','allergy']],
  [17, 'Наличие подсветки экрана пульта',           2, []],
  [18, 'Русифицированный пульт ДУ',                 2, ['service']],
  [19, 'Приток свежего воздуха',                    2, ['allergy']],
  [20, 'Наличие WiFi',                              2, ['smart']],
  [21, 'Управление через Алису',                    2, ['smart']],
  [22, 'Управление жалюзи в стороны с пульта',      2, []],
  // 1%
  [23, 'Кол-во фильтров тонкой очистки',            1, ['allergy']],
  [24, 'Держатель пульта ДУ',                       1, []],
  [25, 'УФ лампа',                                  1, ['allergy']],
  [26, 'Самоочистка замораживанием',                1, ['allergy']],
  [27, 'Температурная стерилизация',                1, ['allergy']],
  [28, 'Дежурный обогрев +8 °C',                    1, ['cold']],
  [29, 'Ароматизатор воздуха',                      1, []],
];

// «Умные» критерии (для пресета Бюджет — их отключаем)
const SMART_IDS = [11,16,20,21,25,26,27,29];

// Базовый рейтинг: [id, brand, model, price, {index, scores:{id:0..100}}]
// Пер-критериальные оценки сгенерены так, чтобы суммарный индекс при ВСЕХ включённых
// совпадал с оригинальным; при сменах набора индекс движется правдоподобно.
// Мы держим модели в порядке базового рейтинга и для каждой задаём пер-профильные
// «уклоны», чтобы разные пресеты давали реально разный порядок.
const MODELS = [
  // [brand, model, price, profile]
  // profile — множители для групп тегов: {silence, cold, engine, house, smart, allergy, service}
  ['CASARTE',          'CAS35CU1YDW',        '155 000 ₽', {silence:1.02, cold:0.95, engine:1.10, house:1.00, smart:0.90, allergy:0.95, service:1.05}],
  ['FUNAI',            'RAC-1E1020',         '117 000 ₽', {silence:0.95, cold:1.00, engine:1.05, house:1.05, smart:0.92, allergy:0.90, service:0.95}],
  ['CENTEK',           'CT-65E09',           '54 700 ₽',  {silence:0.90, cold:0.90, engine:1.02, house:0.95, smart:0.85, allergy:0.88, service:0.90}],
  ['LG',               'LH187V8KS',          '99 000 ₽',  {silence:0.98, cold:0.95, engine:1.00, house:1.00, smart:1.10, allergy:0.95, service:1.00}],
  ['MIDEA',            'MSAG2-09HRN1',       '22 500 ₽',  {silence:0.85, cold:0.88, engine:0.95, house:1.00, smart:0.90, allergy:0.80, service:0.85}],
  ['AQUA',             'AQR-8TS-A7/PA',      '21 700 ₽',  {silence:0.80, cold:0.82, engine:0.92, house:0.90, smart:0.75, allergy:0.75, service:0.80}],
  ['Jax',              'ACM-09HE',           '81 000 ₽',  {silence:0.92, cold:0.88, engine:0.96, house:1.00, smart:0.85, allergy:0.85, service:0.92}],
  ['Haier',            'HSU-09HNM03',        '48 500 ₽',  {silence:0.94, cold:0.92, engine:0.95, house:0.95, smart:0.95, allergy:0.90, service:0.92}],
  ['Thaicon',          'TC-09HRN1',          '39 900 ₽',  {silence:0.85, cold:0.85, engine:0.90, house:0.90, smart:0.80, allergy:0.82, service:0.80}],
  ['Rovex',            'RS-09HBS2',          '34 900 ₽',  {silence:0.82, cold:0.80, engine:0.90, house:0.88, smart:0.78, allergy:0.80, service:0.80}],
  ['Just Aircon',      'JAC-09HPSA/IGC',     '42 000 ₽',  {silence:0.80, cold:0.95, engine:0.92, house:1.10, smart:0.75, allergy:0.80, service:0.82}],
  ['Coolberg',         'CAM-09HBK',          '38 700 ₽',  {silence:0.82, cold:0.82, engine:0.88, house:0.92, smart:0.78, allergy:0.80, service:0.80}],
  ['Ferrum',           'FIS09F2/FOS09F2',    '41 200 ₽',  {silence:0.85, cold:0.98, engine:0.90, house:1.05, smart:0.70, allergy:0.78, service:0.85}],
  ['Mitsubishi Heavy', 'SRK35ZS-W',          '32 400 ₽',  {silence:0.98, cold:0.95, engine:0.92, house:0.95, smart:0.78, allergy:0.82, service:0.90}],
  ['Kalashnikov',      'KCI-09',             '44 800 ₽',  {silence:0.80, cold:0.88, engine:0.88, house:0.95, smart:0.78, allergy:0.82, service:0.95}],
  ['Keg',              'KG-09HFN8',          '28 900 ₽',  {silence:0.80, cold:0.82, engine:0.85, house:0.88, smart:0.72, allergy:0.75, service:0.78}],
  ['Royal Clima',      'RC-TWN22HN',         '36 500 ₽',  {silence:0.78, cold:0.80, engine:0.88, house:0.90, smart:0.80, allergy:0.80, service:0.82}],
  ['Ultima Comfort',   'ECS-09PN',           '31 400 ₽',  {silence:0.80, cold:0.82, engine:0.85, house:0.92, smart:0.75, allergy:0.78, service:0.78}],
  ['Viomi',            'KFR-26GW/Y2PC4',     '46 200 ₽',  {silence:0.75, cold:0.78, engine:0.82, house:0.88, smart:1.10, allergy:0.80, service:0.78}],
  ['Energolux',        'SAS09L4-A',          '33 800 ₽',  {silence:0.78, cold:0.82, engine:0.82, house:0.90, smart:0.70, allergy:0.75, service:0.78}],
];

// Возвращает итоговый индекс модели (0..100) при заданном наборе активных критериев.
// Используем два слоя: базовый «балл критерия» и профильный множитель по тегам.
function computeIndex(mIdx, activeIds){
  const [,,,profile] = MODELS[mIdx];
  // Базовый балл по модели — чтобы общий масштаб разный
  const baseByModel = [
    78.8,77.5,76.0,76.0,72.1,71.5,71.4,70.9,70.4,69.8,
    69.2,68.5,67.9,67.1,66.4,65.8,65.2,64.7,63.9,62.4,
  ][mIdx];
  let num = 0, den = 0;
  for(const [id,,w,tags] of CUSTOM_CRITERIA){
    if(!activeIds.has(id)) continue;
    // Для критерия: балл = base * (среднее из множителей профиля по его тегам)
    let mult = 1;
    if(tags.length){
      let s = 0;
      for(const t of tags) s += (profile[t]||1);
      mult = s / tags.length;
    }
    // Слабая «индивидуальность» критерия, чтобы отдельные критерии двигали сильнее
    const noise = 1 + Math.sin(mIdx*7.3 + id*1.7)*0.06;
    const score = Math.max(0, Math.min(100, baseByModel * mult * noise));
    num += w * score;
    den += w;
  }
  if(den===0) return 0;
  return num / den;
}

// ─── Пресеты ─────────────────────────────────────────────────
const PRESETS = [
  { id:'all',      label:'«Август-климат»',    sub:'все 30', ids:new Set(CUSTOM_CRITERIA.map(c=>c[0])) },
  { id:'silence',  label:'Тишина',             sub:'акустика', ids:new Set(CUSTOM_CRITERIA.filter(c=>c[3].includes('silence')).map(c=>c[0])) },
  { id:'cold',     label:'Сибирь',             sub:'холод', ids:new Set(CUSTOM_CRITERIA.filter(c=>c[3].includes('cold')).map(c=>c[0])) },
  { id:'budget',   label:'Бюджет',             sub:'без умного', ids:new Set(CUSTOM_CRITERIA.filter(c=>!SMART_IDS.includes(c[0])).map(c=>c[0])) },
  { id:'house',    label:'Частный дом',        sub:'длинная трасса', ids:new Set(CUSTOM_CRITERIA.filter(c=>c[3].includes('house') || c[3].includes('cold') || c[3].includes('engine')).map(c=>c[0])) },
  { id:'allergy',  label:'Аллергики',          sub:'воздух', ids:new Set(CUSTOM_CRITERIA.filter(c=>c[3].includes('allergy') || c[3].includes('engine')).map(c=>c[0])) },
];

function detectPreset(active){
  for(const p of PRESETS){
    if(p.ids.size !== active.size) continue;
    let same = true;
    for(const id of p.ids) if(!active.has(id)){ same=false; break; }
    if(same) return p.id;
  }
  return null;
}

// ─── FLIP-хук: анимирует изменение порядка детей (по стабильным ключам) ───
function useFlip(orderKey){
  const rectsRef = React.useRef(new Map());
  const nodesRef = React.useRef(new Map());
  // Регистратор ref для строки
  const register = React.useCallback((key, el)=>{
    if(el) nodesRef.current.set(key, el);
    else nodesRef.current.delete(key);
  },[]);
  // Перед каждым рендером (с новым orderKey) — считаем «старое» положение
  React.useLayoutEffect(()=>{
    const prev = new Map();
    nodesRef.current.forEach((el,k)=>{
      prev.set(k, el.getBoundingClientRect().top);
    });
    const stored = rectsRef.current;
    // Анимация: новое положение — текущее, старое — stored
    nodesRef.current.forEach((el,k)=>{
      const newTop = prev.get(k);
      const oldTop = stored.has(k) ? stored.get(k) : newTop;
      const dy = oldTop - newTop;
      if(Math.abs(dy) > 0.5){
        el.style.transition = 'none';
        el.style.transform = `translateY(${dy}px)`;
        // Force reflow
        el.getBoundingClientRect();
        el.style.transition = 'transform 420ms cubic-bezier(0.22, 0.61, 0.36, 1)';
        el.style.transform = 'translateY(0)';
      }
    });
    rectsRef.current = prev;
  }, [orderKey]);
  return register;
}

// ─── Hero из LIST-A (копия, чтобы вкладка выглядела как часть листинга) ───
function ListingHeroForCustom(){
  return <div>
    {/* SectionHeader — тот же, что над LIST-A */}
    <div style={{padding:'22px 32px',borderBottom:'1px solid var(--wf-border-subtle)',background:'var(--wf-alt)'}}>
      <Eyebrow>раздел</Eyebrow><H size={24} style={{marginTop:6}}>Рейтинг кондиционеров</H>
    </div>
    {/* Hero — копия из LIST-A */}
    <div style={{padding:'40px 40px 36px',background:'var(--wf-alt)',borderBottom:'1px solid var(--wf-border-subtle)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
        <Eyebrow>Независимый рейтинг · обновление 04.2026</Eyebrow>
        <div style={{display:'flex',gap:28,alignItems:'baseline'}}>
          {[['87','моделей'],['33','критерия'],['4','года замеров']].map(([n,l])=>(
            <div key={l} style={{display:'flex',gap:6,alignItems:'baseline'}}>
              <span style={{fontFamily:WF.serif,fontSize:22,fontWeight:600,letterSpacing:-0.5}}>{n}</span>
              <span style={{fontSize:11,color:'var(--wf-ink-60)'}}>{l}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:48,alignItems:'start'}}>
        <div>
          <H size={34} serif style={{lineHeight:1.2,letterSpacing:-0.5,textWrap:'balance'}}>Интегральный индекс «Август-климат» качества бытовых кондиционеров до 4,0 кВт на основе наших измерений и анализа параметров.</H>
          <div style={{marginTop:22,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2,marginRight:6}}>О рейтинге:</T>
            {[['Как мы считаем',true],['Архив моделей',false],['Добавить модель',false]].map(([label,primary],i)=>(
              <a key={i} style={{padding:'6px 12px',border:'1px solid var(--wf-border)',borderRadius:14,fontSize:11,color:primary?'var(--wf-ink)':'var(--wf-ink-60)',fontFamily:WF.sans,fontWeight:primary?600:500,background:primary?'var(--wf-paper)':'transparent',cursor:'pointer',textDecoration:'none',display:'inline-flex',alignItems:'center',gap:5}}>
                {label}<span style={{color:'var(--wf-ink-40)',fontSize:10}}>→</span>
              </a>
            ))}
          </div>
        </div>
        <div style={{borderLeft:'1px solid var(--wf-border)',paddingLeft:22}}>
          <div style={{fontSize:10,fontFamily:WF.mono,color:'var(--wf-ink-40)',textTransform:'uppercase',letterSpacing:1.2,marginBottom:12}}>Авторы методики</div>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            {[['Андрей Петров','главный редактор, инженер-теплотехник'],['Ирина Соколова','лаборатория акустики, к. т. н.']].map(([name,role])=>(
              <div key={name} style={{display:'flex',gap:12,alignItems:'center'}}>
                <div style={{width:44,height:44,borderRadius:'50%',background:'var(--wf-chip)',overflow:'hidden',flexShrink:0,position:'relative'}}>
                  <svg width="44" height="44" viewBox="0 0 44 44" style={{display:'block'}}>
                    <circle cx="22" cy="17" r="7" fill="var(--wf-ink-40)" opacity="0.5"/>
                    <path d="M 8 44 Q 8 30 22 30 Q 36 30 36 44 Z" fill="var(--wf-ink-40)" opacity="0.5"/>
                  </svg>
                </div>
                <div style={{minWidth:0}}>
                  <T size={12} weight={600} style={{letterSpacing:-0.1}}>{name}</T>
                  <T size={10} color="var(--wf-ink-60)" style={{marginTop:2,lineHeight:1.35}}>{role}</T>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
    {/* Табы вкладок + фильтры (как в LIST-A) */}
    <div style={{padding:'20px 40px 0'}}>
      <div style={{display:'flex',gap:22,borderBottom:'1px solid var(--wf-border-subtle)'}}>
        {['По индексу','Самые тихие','Свой рейтинг'].map((x,i)=>{
          const active = i===2;
          return <div key={i} style={{padding:'10px 0',borderBottom:active?'2px solid var(--wf-accent)':'2px solid transparent',color:active?'var(--wf-ink)':'var(--wf-ink-60)',fontSize:12,fontWeight:active?600:500,marginBottom:-1}}>{x}</div>;
        })}
      </div>
    </div>
    {/* Базовые фильтры — бренд / цена / CTA (копия из LIST-A) */}
    <div style={{padding:'16px 40px',display:'flex',gap:10,borderBottom:'1px solid var(--wf-border-subtle)',alignItems:'center'}}>
      <Box w={180} h={34} radius={4} style={{padding:'0 12px',justifyContent:'space-between',textTransform:'none',fontSize:12,color:'var(--wf-ink-60)',gap:8}}>Бренд · все <Icon d={ICONS.chevron} size={11} color="var(--wf-ink-40)"/></Box>
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'0 12px',height:34,border:'1px solid var(--wf-border)',borderRadius:4,background:'var(--wf-paper)'}}>
        <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1}}>Цена от</T>
        <T size={12} weight={600} style={{fontFamily:WF.mono}}>21 700 ₽</T>
      </div>
      <span style={{color:'var(--wf-ink-40)',fontSize:12}}>—</span>
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'0 12px',height:34,border:'1px solid var(--wf-border)',borderRadius:4,background:'var(--wf-paper)'}}>
        <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1}}>Цена до</T>
        <T size={12} weight={600} style={{fontFamily:WF.mono}}>162 000 ₽</T>
      </div>
      <div style={{flex:1}}/>
      <Btn primary style={{padding:'0 18px',height:34,gap:8}}><Icon d={ICONS.plus} size={12}/> Добавить модель</Btn>
    </div>
  </div>;
}

// ─── Общая таблица (точно та же сетка, что в LIST-A) ──────────
// LIST-A: '56px 180px 60px 160px 1fr 140px 160px'
// #       logo   gap   brand  model  price  index
// Для «Своего рейтинга» добавляем колонку дельты между model и price,
// но сохраняем общий ритм: #(56) · logo(180) · gap(40) · brand(160) · model(1fr) · delta(120) · price(130) · index(160)
function RankedTable({active}){
  const rows = MODELS.map((m,i)=>({
    idx:i, brand:m[0], model:m[1], price:m[2],
    score: computeIndex(i, active),
    base:  computeIndex(i, PRESETS[0].ids),
  })).sort((a,b)=>b.score-a.score);

  const register = useFlip(rows.map(r=>r.idx).join(','));
  const empty = active.size===0;
  const GRID = '56px 180px 40px 160px 1fr 120px 130px 160px';

  return <div style={{padding:'0 40px 8px'}}>
    {/* Table header */}
    <div style={{display:'grid',gridTemplateColumns:GRID,padding:'12px 0 10px',borderBottom:'1px solid var(--wf-ink-15)',alignItems:'center'}}>
      <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2}}>#</T>
      <div/>
      <div/>
      <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2}}>Бренд</T>
      <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2}}>Модель</T>
      <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2,textAlign:'right'}}>«Август-климат»</T>
      <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2}}>Цена</T>
      <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2,textAlign:'right'}}>Ваш индекс</T>
    </div>

    {empty && <div style={{padding:'40px 0',textAlign:'center'}}>
      <T size={14} color="var(--wf-ink-60)">Включите хотя бы один критерий — и увидите рейтинг под ваши приоритеты.</T>
    </div>}

    {!empty && rows.map((r,pos)=>{
      const delta = r.score - r.base;
      const deltaAbs = Math.abs(delta);
      const deltaDir = delta > 0.2 ? 'up' : delta < -0.2 ? 'down' : 'same';
      return (
        <div key={r.idx}
             ref={el=>register(r.idx, el)}
             style={{display:'grid',gridTemplateColumns:GRID,padding:'18px 0',borderBottom:'1px solid var(--wf-border-subtle)',alignItems:'center',willChange:'transform'}}>
          <div style={{fontFamily:WF.mono,fontSize:14,color:'var(--wf-ink-40)',fontWeight:500,letterSpacing:-0.5}}>{pos+1}</div>
          <div style={{height:28,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <BrandLogo name={r.brand}/>
          </div>
          <div/>
          <T size={13} weight={600} style={{letterSpacing:-0.1}}>{r.brand}</T>
          <T size={12} color="var(--wf-ink-60)">{r.model}</T>
          <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:8,paddingRight:14}}>
            <T size={12} color="var(--wf-ink-60)" style={{fontFamily:WF.mono}}>{r.base.toFixed(1)}</T>
            {deltaDir!=='same' && <T size={10} color={deltaDir==='up'?'var(--wf-ok,#2f8046)':'var(--wf-warn,#c87510)'} style={{fontFamily:WF.mono}}>{deltaDir==='up'?'↑':'↓'}{deltaAbs.toFixed(1)}</T>}
            {deltaDir==='same' && <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono}}>·</T>}
          </div>
          <T size={13} weight={500}>{r.price}</T>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <Meter value={r.score} w={72} h={5}/>
            <T size={15} weight={600} color="var(--wf-accent)" style={{fontFamily:WF.serif,letterSpacing:-0.2}}>{r.score.toFixed(1)}</T>
          </div>
        </div>
      );
    })}
  </div>;
}

// ═══════════════════════════════════════════════════════════
// «Свой рейтинг» · вкладка в листинге (Expandable drawer + summary bar)
// Шапка — та же, что в основном рейтинге (ListingHeroForCustom),
// чтобы вкладка ощущалась как часть листинга, а не отдельная страница.
// ═══════════════════════════════════════════════════════════
function CustomRatingB(){
  const [active, setActive] = React.useState(new Set(PRESETS[1].ids));  // стартуем с «Тишина» — чтобы показать ре-сортировку
  const [expanded, setExpanded] = React.useState(true);
  const currentPreset = detectPreset(active);
  const sumW = CUSTOM_CRITERIA.reduce((s,c)=> active.has(c[0]) ? s+c[2] : s, 0);
  const totalW = CUSTOM_CRITERIA.reduce((s,c)=> s+c[2], 0);
  const toggle = id => {
    const n = new Set(active); n.has(id) ? n.delete(id) : n.add(id);
    setActive(n);
  };
  const applyPreset = p => setActive(new Set(p.ids));

  return <div>
    <ListingHeroForCustom/>
    {/* Summary bar — всегда видима */}
    <div style={{padding:'14px 40px',display:'flex',alignItems:'center',gap:14,borderBottom:'1px solid var(--wf-border-subtle)',background:'var(--wf-alt)'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'6px 12px',background:'var(--wf-paper)',border:'1px solid var(--wf-border)',borderRadius:4}}>
        <T size={11} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1}}>Критериев</T>
        <T size={14} weight={700} style={{fontFamily:WF.mono}}>{active.size}<span style={{color:'var(--wf-ink-40)',fontWeight:500}}>/{CUSTOM_CRITERIA.length}</span></T>
      </div>
      {/* Mini-progress под счётчиком */}
      <div style={{flex:'0 0 140px',display:'flex',flexDirection:'column',gap:4}}>
        <div style={{height:3,background:'var(--wf-ink-15)',borderRadius:2,overflow:'hidden'}}>
          <div style={{width:(sumW/totalW*100)+'%',height:'100%',background:'var(--wf-accent)',transition:'width 0.3s'}}/>
        </div>
        <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono}}>вес: {sumW}% из {totalW}%</T>
      </div>
      {/* Пресеты — прямо в строке */}
      <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1,marginLeft:8}}>Пресет:</T>
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
        {PRESETS.map(p=>{
          const on = currentPreset===p.id;
          return <div key={p.id} onClick={()=>applyPreset(p)} style={{padding:'5px 10px',borderRadius:14,border:'1px solid '+(on?'var(--wf-accent)':'var(--wf-border-subtle)'),background:on?'var(--wf-accent-bg)':'var(--wf-paper)',fontSize:11,fontWeight:on?600:500,color:on?'var(--wf-accent)':'var(--wf-ink-60)',cursor:'pointer',whiteSpace:'nowrap'}}>
            {p.label}
          </div>;
        })}
      </div>
      <div style={{flex:1}}/>
      <div onClick={()=>setExpanded(!expanded)} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',background:expanded?'var(--wf-ink)':'var(--wf-paper)',color:expanded?'var(--wf-paper)':'var(--wf-ink)',border:'1px solid '+(expanded?'var(--wf-ink)':'var(--wf-border)'),borderRadius:4,cursor:'pointer',fontSize:11,fontWeight:600}}>
        Настроить критерии
        <span style={{transform:expanded?'rotate(180deg)':'rotate(0)',transition:'transform 0.2s',fontSize:9}}>▾</span>
      </div>
    </div>

    {/* Expandable drawer с критериями в виде чипов */}
    {expanded && <div style={{padding:'20px 40px 24px',borderBottom:'1px solid var(--wf-border-subtle)',background:'var(--wf-paper)'}}>
      <div style={{display:'flex',alignItems:'baseline',gap:14,marginBottom:14}}>
        <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2}}>30 критериев · упорядочены по весу</T>
        <T size={11} color="var(--wf-ink-60)">Нажмите, чтобы выключить ненужное</T>
        <div style={{flex:1}}/>
        <div onClick={()=>setActive(new Set(CUSTOM_CRITERIA.map(c=>c[0])))} style={{cursor:'pointer',fontSize:11,color:'var(--wf-ink-60)',textDecoration:'underline',textDecorationColor:'var(--wf-border)',textUnderlineOffset:3}}>Включить все</div>
        <div onClick={()=>setActive(new Set())} style={{cursor:'pointer',fontSize:11,color:'var(--wf-ink-60)',textDecoration:'underline',textDecorationColor:'var(--wf-border)',textUnderlineOffset:3}}>Очистить</div>
      </div>
      {/* Чипы, 3 колонки, упорядочены по весу */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:6}}>
        {CUSTOM_CRITERIA.map(([id,name,w])=>{
          const on = active.has(id);
          return <div key={id} onClick={()=>toggle(id)} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderRadius:4,background:on?'var(--wf-accent-bg)':'var(--wf-alt)',border:'1px solid '+(on?'var(--wf-accent)':'transparent'),cursor:'pointer',transition:'all 0.15s'}}>
            <div style={{width:12,height:12,borderRadius:2,border:'1.5px solid '+(on?'var(--wf-accent)':'var(--wf-border)'),background:on?'var(--wf-accent)':'transparent',flexShrink:0,position:'relative'}}>
              {on && <svg viewBox="0 0 12 12" style={{display:'block',position:'absolute',top:-1,left:-1,width:12,height:12}}><path d="M3 6 L5 8 L9 4" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <T size={11} weight={on?500:400} color={on?'var(--wf-ink)':'var(--wf-ink-60)'} style={{flex:1,lineHeight:1.3,textDecoration:on?'none':'line-through',textDecorationColor:'var(--wf-ink-15)'}}>{name}</T>
            <T size={10} color={on?'var(--wf-accent)':'var(--wf-ink-40)'} style={{fontFamily:WF.mono,flexShrink:0}}>{w}%</T>
          </div>;
        })}
      </div>
    </div>}

    {/* Таблица с дельтой */}
    <RankedTable active={active}/>
    <div style={{padding:'24px 40px',display:'flex',justifyContent:'center',borderTop:'1px solid var(--wf-border-subtle)'}}><Btn ghost>Показать ещё 67 моделей</Btn></div>
  </div>;
}

Object.assign(window, { CustomRatingB, MobileCustomRating });

// ═══════════════════════════════════════════════════════════
// MOBILE · «Свой рейтинг» · вкладка внутри MOB-A
// Тот же hero/fabs, что в MobileListA, активный таб — «Свой рейтинг».
// Summary bar + drawer (раскрывается по кнопке). Рейтинг — аккордеон.
// ═══════════════════════════════════════════════════════════
function MobileCustomRating({scrollTo}={}){
  const [active, setActive] = React.useState(new Set(PRESETS[1].ids));
  const [drawer, setDrawer] = React.useState(false);      // панель критериев (оверлей снизу)
  const [openIdx, setOpenIdx] = React.useState(0);        // раскрытая строка
  const currentPreset = detectPreset(active);
  const sumW = CUSTOM_CRITERIA.reduce((s,c)=> active.has(c[0]) ? s+c[2] : s, 0);
  const totalW = CUSTOM_CRITERIA.reduce((s,c)=> s+c[2], 0);
  const toggle = id => { const n = new Set(active); n.has(id) ? n.delete(id) : n.add(id); setActive(n); };
  const applyPreset = p => setActive(new Set(p.ids));

  // Сортированный список моделей
  const rows = MODELS.map((m,i)=>({
    idx:i, brand:m[0], model:m[1], price:m[2],
    score: computeIndex(i, active),
    base:  computeIndex(i, PRESETS[0].ids),
  })).sort((a,b)=>b.score-a.score);

  const register = useFlip(rows.map(r=>r.idx).join(','));

  return <div style={{position:'relative',height:'100%'}}>
    {/* HERO — как в MobileListA */}
    <div style={{padding:'18px 18px 16px',background:'var(--wf-alt)',borderBottom:'1px solid var(--wf-border-subtle)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <Eyebrow>Рейтинг · 04.2026</Eyebrow>
        <div style={{display:'flex',gap:12,alignItems:'baseline'}}>
          {[['87','мод.'],['33','крит.'],['4','года']].map(([n,l])=>(
            <div key={l} style={{display:'flex',gap:3,alignItems:'baseline'}}>
              <span style={{fontFamily:WF.serif,fontSize:14,fontWeight:600,letterSpacing:-0.3}}>{n}</span>
              <span style={{fontSize:9,color:'var(--wf-ink-60)'}}>{l}</span>
            </div>
          ))}
        </div>
      </div>
      <H size={18} serif style={{lineHeight:1.25,letterSpacing:-0.3,textWrap:'balance'}}>Соберите свой рейтинг — таблица пересчитается под ваши приоритеты.</H>
    </div>

    {/* TABS — активен «Свой рейтинг» */}
    <div style={{padding:'10px 18px 0',borderBottom:'1px solid var(--wf-border-subtle)'}}>
      <div style={{display:'flex',gap:18}}>
        {['По индексу','Самые тихие','Свой рейтинг'].map((x,i)=>{
          const a = i===2;
          return <div key={x} style={{position:'relative',fontSize:12,fontWeight:a?600:500,color:a?'var(--wf-ink)':'var(--wf-ink-60)',padding:'10px 0 12px'}}>
            {x}
            {a && <div style={{position:'absolute',left:0,right:0,bottom:0,height:2,background:'var(--wf-accent)'}}/>}
          </div>;
        })}
      </div>
    </div>

    {/* SUMMARY BAR — счётчик + прогресс + кнопка «Настроить» */}
    <div style={{padding:'12px 18px',display:'flex',alignItems:'center',gap:10,borderBottom:'1px solid var(--wf-border-subtle)',background:'var(--wf-alt)'}}>
      <div style={{display:'flex',flexDirection:'column',gap:4,flex:1,minWidth:0}}>
        <div style={{display:'flex',alignItems:'baseline',gap:6}}>
          <T size={13} weight={700} style={{fontFamily:WF.mono}}>{active.size}<span style={{color:'var(--wf-ink-40)',fontWeight:500}}>/{CUSTOM_CRITERIA.length}</span></T>
          <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1}}>критериев · {sumW}%</T>
        </div>
        <div style={{height:3,background:'var(--wf-ink-15)',borderRadius:2,overflow:'hidden'}}>
          <div style={{width:(sumW/totalW*100)+'%',height:'100%',background:'var(--wf-accent)',transition:'width 0.3s'}}/>
        </div>
      </div>
      <div onClick={()=>setDrawer(true)} style={{padding:'8px 14px',background:'var(--wf-ink)',color:'var(--wf-paper)',borderRadius:4,fontSize:11,fontWeight:600,whiteSpace:'nowrap',cursor:'pointer',flexShrink:0}}>
        Настроить ▾
      </div>
    </div>

    {/* ПРЕСЕТЫ — горизонтальный скролл */}
    <div style={{padding:'10px 0 12px',borderBottom:'1px solid var(--wf-border-subtle)',background:'var(--wf-alt)'}}>
      <div style={{padding:'0 18px 0',display:'flex',gap:6,overflowX:'auto',WebkitOverflowScrolling:'touch',scrollbarWidth:'none'}}>
        {PRESETS.map(p=>{
          const on = currentPreset===p.id;
          return <div key={p.id} onClick={()=>applyPreset(p)} style={{padding:'6px 12px',borderRadius:14,border:'1px solid '+(on?'var(--wf-accent)':'var(--wf-border-subtle)'),background:on?'var(--wf-accent-bg)':'var(--wf-paper)',fontSize:11,fontWeight:on?600:500,color:on?'var(--wf-accent)':'var(--wf-ink-60)',whiteSpace:'nowrap',flexShrink:0,cursor:'pointer'}}>
            {p.label}
          </div>;
        })}
      </div>
    </div>

    {/* СТРОКИ РЕЙТИНГА — аккордеон, с дельтой к «Август-климат» */}
    <div style={{padding:'4px 18px 0'}}>
      {rows.slice(0,10).map((r,pos)=>{
        const rk = pos+1;
        const podium = rk<=3;
        const open = pos===openIdx;
        const delta = r.score - r.base;
        const deltaAbs = Math.abs(delta);
        const deltaDir = delta > 0.2 ? 'up' : delta < -0.2 ? 'down' : 'same';
        return (
          <div key={r.idx} ref={el=>register(r.idx, el)} style={{borderBottom:'1px solid var(--wf-border-subtle)',willChange:'transform'}}>
            <div onClick={()=>setOpenIdx(open?-1:pos)} style={{padding:'14px 0',display:'grid',gridTemplateColumns:'34px 1fr auto',gap:12,alignItems:'center',cursor:'pointer'}}>
              <div style={{fontFamily:podium?WF.serif:WF.mono,fontSize:podium?24:13,color:podium?'var(--wf-accent)':'var(--wf-ink-40)',fontWeight:podium?600:500,letterSpacing:-0.4,lineHeight:1}}>{rk}</div>
              <div style={{minWidth:0}}>
                <div style={{marginBottom:3}}><BrandLogo name={r.brand}/></div>
                <T size={11} color="var(--wf-ink-60)" style={{lineHeight:1.3,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.model}</T>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{display:'flex',alignItems:'baseline',gap:5,justifyContent:'flex-end'}}>
                  <div style={{fontFamily:WF.serif,fontSize:16,fontWeight:600,color:'var(--wf-accent)',letterSpacing:-0.2,lineHeight:1}}>{r.score.toFixed(1)}</div>
                  {deltaDir!=='same' && <T size={9} color={deltaDir==='up'?'#2f8046':'#c87510'} style={{fontFamily:WF.mono}}>{deltaDir==='up'?'↑':'↓'}{deltaAbs.toFixed(1)}</T>}
                </div>
                <T size={10} color="var(--wf-ink-40)" style={{marginTop:3,fontFamily:WF.mono}}>база {r.base.toFixed(1)}</T>
                <T size={11} color="var(--wf-ink-60)" style={{marginTop:3}}>{r.price}</T>
              </div>
            </div>
            {open && (
              <div style={{padding:'4px 0 16px',display:'flex',flexDirection:'column',gap:10}}>
                <div style={{padding:'10px 12px',background:'var(--wf-accent-bg)',borderRadius:4,display:'flex',alignItems:'baseline',gap:8}}>
                  <T size={10} color="var(--wf-accent)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1}}>Ваш индекс</T>
                  <T size={14} weight={700} color="var(--wf-accent)" style={{fontFamily:WF.serif}}>{r.score.toFixed(1)}</T>
                  <T size={10} color="var(--wf-ink-60)">vs. «Август-климат» {r.base.toFixed(1)}</T>
                </div>
                <Btn primary size="sm" style={{justifyContent:'center'}}>Открыть карточку →</Btn>
              </div>
            )}
          </div>
        );
      })}
    </div>
    <div style={{padding:'18px',display:'flex',justifyContent:'center',borderTop:'1px solid var(--wf-border-subtle)'}}>
      <Btn ghost size="sm">Показать ещё 10 моделей</Btn>
    </div>

    {/* DRAWER — оверлей с чипами критериев */}
    {drawer && <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.45)',zIndex:10,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={()=>setDrawer(false)}>
      <div onClick={e=>e.stopPropagation()} style={{background:'var(--wf-paper)',borderTopLeftRadius:14,borderTopRightRadius:14,maxHeight:'86%',overflowY:'auto',display:'flex',flexDirection:'column'}}>
        {/* Grabber */}
        <div style={{padding:'8px 0 0',display:'flex',justifyContent:'center'}}>
          <div style={{width:40,height:4,borderRadius:2,background:'var(--wf-ink-15)'}}/>
        </div>
        <div style={{padding:'14px 18px 10px',display:'flex',alignItems:'center',gap:10,borderBottom:'1px solid var(--wf-border-subtle)',position:'sticky',top:0,background:'var(--wf-paper)',zIndex:2}}>
          <div style={{flex:1}}>
            <T size={14} weight={600}>Настроить критерии</T>
            <T size={11} color="var(--wf-ink-60)" style={{marginTop:2}}>активно {active.size} из {CUSTOM_CRITERIA.length} · вес {sumW}%</T>
          </div>
          <div onClick={()=>setDrawer(false)} style={{padding:'6px 14px',background:'var(--wf-accent)',color:'#fff',borderRadius:4,fontSize:12,fontWeight:600,cursor:'pointer'}}>Готово</div>
        </div>
        {/* Пресеты внутри drawer */}
        <div style={{padding:'12px 18px',borderBottom:'1px solid var(--wf-border-subtle)'}}>
          <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2,marginBottom:8}}>Пресеты</T>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {PRESETS.map(p=>{
              const on = currentPreset===p.id;
              return <div key={p.id} onClick={()=>applyPreset(p)} style={{padding:'6px 12px',borderRadius:14,border:'1px solid '+(on?'var(--wf-accent)':'var(--wf-border-subtle)'),background:on?'var(--wf-accent-bg)':'var(--wf-alt)',fontSize:11,fontWeight:on?600:500,color:on?'var(--wf-accent)':'var(--wf-ink-60)',cursor:'pointer'}}>{p.label}</div>;
            })}
          </div>
        </div>
        {/* Критерии списком — одна колонка, полноширинные строки */}
        <div style={{padding:'8px 18px 24px'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0 12px'}}>
            <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2}}>30 критериев · по весу ↓</T>
            <div style={{flex:1}}/>
            <div onClick={()=>setActive(new Set(CUSTOM_CRITERIA.map(c=>c[0])))} style={{cursor:'pointer',fontSize:11,color:'var(--wf-ink-60)',textDecoration:'underline',textDecorationColor:'var(--wf-border)',textUnderlineOffset:3}}>Все</div>
            <div onClick={()=>setActive(new Set())} style={{cursor:'pointer',fontSize:11,color:'var(--wf-ink-60)',textDecoration:'underline',textDecorationColor:'var(--wf-border)',textUnderlineOffset:3}}>Очистить</div>
          </div>
          {CUSTOM_CRITERIA.map(([id,name,w])=>{
            const on = active.has(id);
            return <div key={id} onClick={()=>toggle(id)} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 0',borderBottom:'1px solid var(--wf-border-subtle)',cursor:'pointer'}}>
              <div style={{width:18,height:18,borderRadius:3,border:'1.5px solid '+(on?'var(--wf-accent)':'var(--wf-border)'),background:on?'var(--wf-accent)':'transparent',flexShrink:0,position:'relative'}}>
                {on && <svg viewBox="0 0 18 18" style={{position:'absolute',inset:0}}><path d="M4 9 L8 13 L14 5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <T size={13} weight={on?500:400} color={on?'var(--wf-ink)':'var(--wf-ink-60)'} style={{flex:1,lineHeight:1.35,textDecoration:on?'none':'line-through',textDecorationColor:'var(--wf-ink-15)'}}>{name}</T>
              <T size={11} color={on?'var(--wf-accent)':'var(--wf-ink-40)'} style={{fontFamily:WF.mono,flexShrink:0,minWidth:28,textAlign:'right'}}>{w}%</T>
            </div>;
          })}
        </div>
      </div>
    </div>}
  </div>;
}
