// Main app — compose all wireframes on a DesignCanvas with explicit row layout

const {useState,useEffect,useRef} = React;

function Label({children,small}){
  return <div style={{position:'absolute',top:-26,left:0,fontFamily:WF.mono,fontSize:small?9:10,textTransform:'uppercase',letterSpacing:1.4,color:'rgba(40,30,20,0.6)',whiteSpace:'nowrap'}}>{children}</div>;
}

// Artboard — self-contained, absolutely positioned, with label
function Board({x=0,y=0,w,h,label,dark,children,scrolling,phone}){
  if(phone){
    return <div style={{position:'absolute',left:x,top:y}}>
      <Label small>{label}</Label>
      <div style={{width:402,height:h,border:`10px solid #1a1a1a`,borderRadius:52,overflow:'hidden',position:'relative',boxShadow:'0 12px 36px rgba(0,0,0,0.22)',background:'#1a1a1a'}}>
        <div data-wf-scope={dark===true?'dark':dark===false?'light':'auto'} style={{width:'100%',height:'100%',background:'var(--wf-paper)',color:'var(--wf-ink)',overflow:'hidden',display:'flex',flexDirection:'column'}}>
          <div style={{height:28,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 22px',fontSize:10,fontWeight:600,position:'relative',flexShrink:0}}>
            <span>9:41</span>
            <div style={{position:'absolute',left:'50%',top:6,transform:'translateX(-50%)',width:78,height:18,background:'#000',borderRadius:14}}/>
            <span style={{opacity:0.7}}>100%</span>
          </div>
          <div style={{flex:1,overflow:scrolling?'auto':'hidden'}}>{children}</div>
        </div>
      </div>
    </div>;
  }
  return <div style={{position:'absolute',left:x,top:y}}>
    <Label>{label}</Label>
    <div data-wf-scope={dark===true?'dark':dark===false?'light':'auto'} style={{width:w,height:h,background:'var(--wf-paper)',color:'var(--wf-ink)',border:'1px solid var(--wf-border-subtle)',borderRadius:4,fontFamily:WF.sans,overflow:scrolling?'auto':'hidden',boxShadow:'0 1px 3px rgba(0,0,0,0.06), 0 10px 30px rgba(0,0,0,0.08)'}}>{children}</div>
  </div>;
}

// Section — title + subtitle on top, then children absolutely positioned underneath.
// Caller declares contentH and we enforce it by setting a min-height wrapper so the
// next section never overlaps.
function Section({title,subtitle,x,y,w,contentH,children}){
  return <div style={{position:'absolute',left:x,top:y,width:w}}>
    <div style={{fontFamily:WF.mono,fontSize:11,letterSpacing:1.4,textTransform:'uppercase',color:'rgba(40,30,20,0.5)'}}>Секция</div>
    <div style={{fontFamily:WF.serif,fontSize:28,fontWeight:600,color:'rgba(20,15,10,0.95)',letterSpacing:-0.4,marginTop:4}}>{title}</div>
    {subtitle && <div style={{fontFamily:WF.sans,fontSize:12,color:'rgba(60,50,40,0.65)',marginTop:8,maxWidth:660,lineHeight:1.55}}>{subtitle}</div>}
    <div style={{position:'relative',marginTop:56,height:contentH}}>{children}</div>
  </div>;
}

function SectionHeader(){
  return <div style={{padding:'22px 32px',borderBottom:'1px solid var(--wf-border-subtle)',background:'var(--wf-alt)'}}>
    <Eyebrow>раздел</Eyebrow><H size={24} style={{marginTop:6}}>Рейтинг кондиционеров</H>
  </div>;
}

// Layout plan: each section has a fixed height and a fixed y-offset.
// GAP between sections = 100px, GAP below title = already in Section (56).
const GAP = 140;          // inter-section vertical padding
const TITLE_H = 110;      // title + subtitle + margin (approx)

// Row positions — computed so nothing collides
const SECTIONS = (()=>{
  const y0 = 280;
  const out = [];
  let y = y0;
  const push = (key,h)=>{ out.push({key,y,h}); y += TITLE_H + h + GAP; };
  push('nav',      900);   // desktop variants (left column) + mobile drawer 874 + principles
  push('listing_d',4700); // LIST-A + CUSTOM tab («Свой рейтинг») справа
  push('listing_m',1000);  // MOB-A only (iPhone 17 Pro height)
  push('detail',   4200);  // DET-A + mobile — lengthened with overview/specs/buy/reviews sections
  push('static',   2600);
  push('footer',   300);
  push('tmpl',     1440);
  push('news',     1040);
  return Object.fromEntries(out.map(s=>[s.key,s]));
})();

function App(){
  const [section,setSection]=useState(window.__wfSection||'all');
  useEffect(()=>{const f=()=>setSection(window.__wfSection||'all');window.addEventListener('wf-section',f);return()=>window.removeEventListener('wf-section',f);},[]);
  const isAll = section==='all';
  const show=s=>isAll||section===s||(section==='listing'&&(s==='listing_d'||s==='listing_m'))||(section==='long'&&(s==='static'||s==='footer'));

  // When a single section is selected, stack visible sections from y=240 sequentially.
  // When 'all' is selected, use the precomputed absolute positions in SECTIONS.
  const ALL = SECTIONS;
  const ORDER = ['nav','listing_d','listing_m','detail','static','footer','tmpl','news'];
  const visible = ORDER.filter(show);
  const Y = {};
  if(isAll){
    ORDER.forEach(k=>{ Y[k] = ALL[k].y; });
  } else {
    let y = 240;
    visible.forEach(k=>{ Y[k] = y; y += TITLE_H + ALL[k].h + GAP; });
  }
  // Guard: any lookup for a hidden section returns {y:0,h:0} — prevents NaN in top.
  const S = k => {
    const h = (ALL[k] && ALL[k].h) || 0;
    const y = (Y[k] != null) ? Y[k] : 0;
    return { y, h };
  };

  return <DesignCanvas>
    {/* Title card */}
    <div style={{position:'absolute',left:0,top:-60,width:1400}}>
      <div style={{fontFamily:WF.mono,fontSize:11,letterSpacing:1.4,textTransform:'uppercase',color:'rgba(40,30,20,0.5)'}}>Август-климат · hvac-info.com · v2</div>
      <div style={{fontFamily:WF.serif,fontSize:56,fontWeight:600,color:'rgba(20,15,10,0.95)',letterSpacing:-1.2,marginTop:4,lineHeight:1.05}}>Вайрфреймы<br/>для редизайна</div>
      <div style={{fontFamily:WF.sans,fontSize:14,color:'rgba(40,30,20,0.55)',marginTop:14,maxWidth:620,lineHeight:1.6}}>Восемь секций: навигация, листинг (desktop + mobile), деталь модели, статические страницы, футеры, шаблоны, новости. Переключите тему / акцент / плотность в панели Tweaks справа внизу.</div>
    </div>

    {/* ───── 1 · NAV ───── */}
    {show('nav') && <Section title="1 · Навигация" subtitle="Единое плоское верхнее меню без выпадающих списков. Каждый пункт — прямой переход в полноценный раздел. Слева — логотип, справа — поиск, язык, тема, вход." x={0} y={S('nav').y} w={2600} contentH={S('nav').h}>
      <Board x={0}    y={0}   w={1280} h={90}  label="NAV · Desktop · активен «Рейтинг»"><NavFlat activeIdx={1}/></Board>
      <Board x={0}    y={130} w={1280} h={90}  label="NAV · Desktop · нейтральный (внутри раздела)"><NavFlatNeutral/></Board>
      <Board x={0}    y={260} w={1280} h={84}  label="NAV · Mobile header (collapsed)"><NavMobileHeader/></Board>
      <Board x={0}    y={384} w={1280} h={300} label="NAV · Desktop · dark theme (превью)" dark><div data-wf-scope="dark" style={{background:'#171717',height:'100%'}}><NavFlat activeIdx={1} dark/><div style={{padding:'28px 32px'}}><Eyebrow>Превью страницы</Eyebrow><H size={24} style={{marginTop:8,color:'#eeecea'}}>Рейтинг кондиционеров</H><T size={13} color="rgba(238,236,234,0.6)" style={{marginTop:10}}>Меню сохраняет плоскую структуру и в тёмной теме.</T></div></div></Board>
      <Board phone x={1380} y={0}  h={874} label="NAV · Mobile drawer (iPhone 17 Pro — открытое меню)" scrolling><NavMobileDrawer/></Board>
      <div style={{position:'absolute',left:1820,top:0,width:720}}>
        <Label small>NAV · Принципы</Label>
        <div data-wf-scope="auto" style={{background:'var(--wf-paper)',border:'1px solid var(--wf-border-subtle)',borderRadius:4,padding:'24px 28px',fontFamily:WF.sans,color:'var(--wf-ink)'}}>
          <Eyebrow>Что отличает это меню</Eyebrow>
          <H size={22} style={{marginTop:8}}>Плоская навигация без dropdown</H>
          <div style={{marginTop:20,display:'flex',flexDirection:'column',gap:14}}>
            {[
              ['Никаких выпадающих панелей','Клик по пункту — переход на страницу раздела. Вся иерархия раскрывается уже внутри.'],
              ['7 равнозначных разделов','Новости · Рейтинг · ISmeta · Мешок Монтажников · Анализ проектов · Франшиза · Ассоциация.'],
              ['Активный пункт — подчёркивание','Акцентная линия снизу + увеличенная жирность. Никаких чипов или заливок.'],
              ['Утилиты справа','Поиск, переключатель языка (RU/EN), светлая/тёмная тема, вход — отделены вертикальной чертой.'],
              ['Моб. версия — drawer','Hamburger открывает полноэкранный список с коротким описанием каждого раздела. Без аккордеонов.'],
            ].map(([t,d],i)=>(
              <div key={i} style={{display:'flex',gap:14}}>
                <div style={{width:22,height:22,borderRadius:11,background:'var(--wf-accent)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:600,flexShrink:0,marginTop:1}}>{i+1}</div>
                <div>
                  <T size={13} weight={600}>{t}</T>
                  <T size={12} color="var(--wf-ink-60)" style={{marginTop:3,lineHeight:1.5}}>{d}</T>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>}

    {/* ───── 2 · LISTING DESKTOP ───── */}
    {show('listing_d') && <Section title="2 · Листинг рейтинга · desktop" subtitle="LIST-A — утверждённый макет (вкладка «По индексу»). Рядом — вкладка «Свой рейтинг»: та же страница с той же шапкой и фильтрами, но вместо фиксированного рейтинга — конструктор с пресетами и анимацией пересортировки." x={0} y={S('listing_d').y} w={2700} contentH={S('listing_d').h}>
      <Board x={0}    y={0} w={1280} h={2600} label="LIST-A · вкладка «Po индексу» · 20 моделей" scrolling><SectionHeader/><RatingListA/></Board>
      <Board x={1380} y={0} w={1280} h={2600} label="LIST-A · вкладка «Свой рейтинг» · пресеты + флип-анимация" scrolling><CustomRatingB/></Board>
    </Section>}

    {/* ───── 3 · MOBILE LISTING ───── */}
    {show('listing_m') && <Section title="3 · Листинг рейтинга · mobile" subtitle="MOB-A — мобильная версия листинга с тем же контентом, что в LIST-A. Третий фрейм — вкладка «Свой рейтинг»: drawer с критериями снизу, пресеты скроллом, пересортировка с FLIP-анимацией." x={0} y={S('listing_m').y} w={1500} contentH={S('listing_m').h}>
      <Board phone x={0}   y={0} h={874} label="MOB-A · Аккордеон · верх" scrolling><MobileListA/></Board>
      <Board phone x={450} y={0} h={874} label="MOB-A · Футер раздела · прокрутка" scrolling><MobileListA scrollTo="footer"/></Board>
      <Board phone x={900} y={0} h={874} label="MOB-A · «Свой рейтинг» · с пресетами и drawer" scrolling><MobileCustomRating/></Board>
    </Section>}

    {/* ───── 4 · DETAIL ───── */}
    {show('detail') && <Section title="4 · Деталь модели" subtitle="DET-A1 — desktop: hero одной колонкой, 30 параметров с переключателем видов (список / радар / сетка), вердикт, цены, сравнение. MOB-DET-A — мобильная версия с тем же набором секций. Второй мобильный фрейм — прокрутка к секции «Оценки»." x={0} y={S('detail').y} w={3150} contentH={S('detail').h}>
      <Board x={0} y={0} w={1280} h={4100} label="DET-A1 · Editorial long-form · все 5 секций ленты" scrolling><DetailA/></Board>
      <Board phone x={1380} y={0} h={874} label="MOB-DET-A · Мобильная деталь — верх" scrolling><MobileDetailA/></Board>
      <Board phone x={1830} y={0} h={874} label="MOB-DET-A · Оценки · прокрутка" scrolling><MobileDetailA scrollTo="criteria"/></Board>
    </Section>}

    {/* ───── 5 · STATIC ───── */}
    {show('static') && <Section title="5 · Статические страницы" subtitle="Методика расчёта индекса, форма заявки на добавление модели, архив моделей (выбывшие из рейтинга), страница 404." x={0} y={S('static').y} w={2600} contentH={S('static').h}>
      <Board x={0}    y={0}    w={1200} h={2000} label="METHODOLOGY · 30 критериев · v1.0" scrolling><Methodology/></Board>
      <Board x={1300} y={0}    w={960}  h={2000} label="SUBMIT FORM · добавить кондиционер" scrolling><Submit/></Board>
      <Board x={0}    y={2080} w={1200} h={440}  label="ARCHIVE · выбывшие из рейтинга модели"><Archive/></Board>
      <Board x={1300} y={2080} w={960}  h={440}  label="404"><NotFound/></Board>
    </Section>}

    {/* ───── 6 · FOOTERS ───── */}
    {show('footer') && <Section title="6 · Футеры" subtitle="A — служебный (на всех страницах кроме главной). B — акцентный с подпиской (на главной и под статьями)." x={0} y={S('footer').y} w={2600} contentH={S('footer').h}>
      <Board x={0}    y={0} w={1200} h={260} label="FOOTER-A · Служебный"><FooterA/></Board>
      <Board x={1300} y={0} w={1200} h={260} label="FOOTER-B · Акцентный с подпиской" dark><FooterB dark/></Board>
    </Section>}

    {/* ───── 7 · TEMPLATES ───── */}
    {show('tmpl') && <Section title="7 · Шаблоны страниц (скелеты)" subtitle="5 переиспользуемых скелетов. Каждый — композиция из блоков по брифу: header, секционный заголовок, контент, футер." x={0} y={S('tmpl').y} w={2600} contentH={S('tmpl').h}>
      <PageTmpl x={0}    y={0} label="T-01 · Листинг рейтинга"    blocks={['HEADER · NAV','PAGE HERO (eyebrow + h1 + stats)','TABS + FILTERS','DATA TABLE (8–20 rows)','LOAD MORE','FOOTER']}/>
      <PageTmpl x={440}  y={0} label="T-02 · Деталь модели"       blocks={['HEADER · NAV','BREADCRUMBS','MODEL HERO (фото · h1 · badges · KPIs)','TABS','CRITERIA BREAKDOWN','SPECS TABLE','EXPERT QUOTE','WHERE-TO-BUY WIDGET','SIMILAR MODELS','FOOTER']}/>
      <PageTmpl x={880}  y={0} label="T-03 · Новость / статья"     blocks={['HEADER · NAV','EYEBROW + H1','LEAD · byline row','HERO IMAGE','ARTICLE BODY','PULL QUOTE','RELATED MODEL CARD','SHARE + NEXT','FOOTER']}/>
      <PageTmpl x={1320} y={0} label="T-04 · Сервисная (форма)"    blocks={['HEADER · NAV','H1 + lead','FORM GROUPS','INLINE VALIDATION','SUBMIT CTA','TRUST ROW','FOOTER']}/>
      <PageTmpl x={1760} y={0} label="T-05 · Главная / hub"        blocks={['HEADER · NAV','BIG HERO (рейтинг-карусель)','SECTION: top-3 models','SECTION: news tile strip','SECTION: calculator widget','SECTION: installer map','SECTION: methodology teaser','FOOTER · B']}/>
    </Section>}

    {/* ───── 8 · NEWS ───── */}
    {show('news') && <Section title="8 · Новости — лента и материал" subtitle="Desktop + mobile версии раздела новостей и материала." x={0} y={S('news').y} w={3600} contentH={S('news').h}>
      <Board x={0}    y={0} w={1200} h={1000} label="NEWS-LIST · Hero + список" scrolling><NewsListA/></Board>
      <Board x={1300} y={0} w={1200} h={1000} label="NEWS-DETAIL · Editorial" scrolling><NewsDetailA/></Board>
      <Board phone x={2600} y={0} h={874} label="MOB-NEWS-LIST · Лента" scrolling><MobileNewsList/></Board>
      <Board phone x={3050} y={0} h={874} label="MOB-NEWS-DETAIL · Материал" scrolling><MobileNewsDetail/></Board>
    </Section>}

    {/* End marker so the canvas has enough extent */}
    <div style={{position:'absolute',left:0,top:S('news').y+TITLE_H+S('news').h+200,width:1,height:1}}/>
  </DesignCanvas>;
}

function PageTmpl({x,y,label,blocks}){
  return <div style={{position:'absolute',left:x,top:y,width:400}}>
    <Label small>{label}</Label>
    <div data-wf-scope="auto" style={{background:'var(--wf-paper)',border:'1px solid var(--wf-border-subtle)',borderRadius:6,padding:14,display:'flex',flexDirection:'column',gap:6,color:'var(--wf-ink)'}}>
      {blocks.map((b,i)=>
        <div key={i} style={{padding:'12px 14px',border:'1px dashed var(--wf-border)',borderRadius:4,fontFamily:WF.mono,fontSize:10,textTransform:'uppercase',letterSpacing:1,color:'var(--wf-ink-60)',background:i===0||b.startsWith('FOOTER')?'var(--wf-alt)':'transparent'}}>{b}</div>
      )}
    </div>
  </div>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
