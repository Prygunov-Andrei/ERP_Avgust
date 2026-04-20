// Remaining screens: detail, news, cards, index viz, static, footer, mobile listings, templates

// ───────── Detail (model page) × 4 ─────────

function DetailA({variant='side'}={}){ // editorial long-form
  const stacked = variant==='stacked';
  const [critView, setCritView] = React.useState('list');
  const [reviewMode, setReviewMode] = React.useState('read'); // 'read' | 'write'
  const [activeCity, setActiveCity] = React.useState('Москва');
  const rootRef = React.useRef(null);
  const [activeTab, setActiveTab] = React.useState('overview');
  // Find the nearest scrollable ancestor (the Board).
  const getScroller = ()=>{
    let el = rootRef.current;
    while(el && el!==document.body){
      const s = getComputedStyle(el).overflowY;
      if(s==='auto'||s==='scroll') return el;
      el = el.parentElement;
    }
    return null;
  };
  const scrollToAnchor = (id)=>{
    const sc = getScroller();
    const target = rootRef.current && rootRef.current.querySelector(`[data-anchor="${id}"]`);
    if(sc && target){
      const scRect = sc.getBoundingClientRect();
      const tRect = target.getBoundingClientRect();
      sc.scrollTo({top: sc.scrollTop + (tRect.top - scRect.top) - 52, behavior:'smooth'});
    }
    setActiveTab(id);
  };
  // Track active section on scroll.
  React.useEffect(()=>{
    const sc = getScroller();
    if(!sc || !rootRef.current) return;
    const ids = ['overview','criteria','specs','buy','reviews'];
    const onScroll = ()=>{
      const scTop = sc.scrollTop;
      let cur = ids[0];
      for(const id of ids){
        const el = rootRef.current.querySelector(`[data-anchor="${id}"]`);
        if(el && el.offsetTop - 80 <= scTop) cur = id;
      }
      setActiveTab(cur);
    };
    sc.addEventListener('scroll', onScroll, {passive:true});
    onScroll();
    return ()=>sc.removeEventListener('scroll', onScroll);
  },[]);
  // 30 параметров рейтинга — плоский список, без групп.
  // [название, значение-чип, вклад, значение (0–100), тикер?]
  const CRITERIA = [
    ['Есть замер минимального уровня шума', '31.1 дБ(А)', 0.00, 69.0, null],
    ['Площадь труб теплообменника внутр. блока', '0.52 кв.м', 10.00, 100.0, 'выше эталона'],
    ['Площадь труб теплообменника наруж. блока', '1.1 кв.м', 9.40, 94.0, 'выше эталона'],
    ['Мощность компрессора', '— Вт', 7.00, 70.0, null],
    ['Наличие ЭРВ', 'Есть', 5.00, 100.0, null],
    ['Регулировка оборотов вентилятора наруж. блока', 'Есть', 5.00, 100.0, null],
    ['Инверторный компрессор', 'Есть', 5.00, 100.0, null],
    ['Работа на обогрев', '−30 °C', 5.00, 100.0, 'выше эталона'],
    ['Максимальный перепад высот', '15 м', 4.00, 100.0, null],
    ['Гарантия', '7 лет', 4.00, 100.0, 'выше эталона'],
    ['Максимальная длина фреонопровода', '30 м', 3.20, 80.0, null],
    ['Энергоэффективность', 'A+++', 3.00, 100.0, null],
    ['Класс энергоэффективности (обогрев)', 'A++', 2.50, 90.0, null],
    ['Хладагент', 'R32', 2.00, 100.0, null],
    ['Wi-Fi управление', 'Есть', 2.00, 100.0, null],
    ['Голосовой ассистент', 'Алиса', 1.50, 75.0, null],
    ['Ночной режим', 'Есть', 1.20, 100.0, null],
    ['Самодиагностика', 'Есть', 1.20, 100.0, null],
    ['Ароматизатор воздуха', 'Есть', 1.00, 100.0, null],
    ['Приток свежего воздуха', 'Приток без подогрева', 1.00, 50.0, null],
    ['Возраст бренда на рынке РФ', '2018 год', 0.75, 25.0, 'ниже эталона'],
    ['Кол-во фильтров тонкой очистки', '1 шт.', 0.50, 50.0, null],
    ['УФ лампа', 'Мелкие светодиоды', 0.50, 50.0, null],
    ['Вибрация наружного блока', '0.17 мм', 0.00, 40.0, null],
    ['Ионизатор', '—', 0.00, 0.0, null],
    ['Русифицированный пульт ДУ', 'Нет', 0.00, 0.0, null],
    ['Наличие ИК датчика присутствия человека', 'Нет', 0.00, 0.0, null],
    ['Функция дежурного обогрева +8 °C', 'Нет', 0.00, 0.0, null],
    ['Автоматический рестарт', 'Есть', 0.00, 100.0, null],
    ['Защита от замерзания', 'Есть', 0.00, 100.0, null],
  ];
  return <div ref={rootRef}>
    {/* Back to rating */}
    <div style={{padding:'14px 40px',borderBottom:'1px solid var(--wf-border-subtle)',display:'flex',alignItems:'center',gap:8,fontSize:12,color:'var(--wf-ink-60)'}}>
      <Icon d="M15 18 L9 12 L15 6" size={12}/>
      <span>Вернуться в рейтинг · <span style={{color:'var(--wf-ink)',fontWeight:500}}>Кондиционеры 2026</span></span>
    </div>

    {/* HERO — 2 columns: text left, vertical metrics right */}
    <div style={{padding:'44px 40px 40px',background:'var(--wf-alt)',borderBottom:'1px solid var(--wf-border-subtle)'}}>
      <div style={{display:'grid',gridTemplateColumns:'1.45fr 1fr',gap:56,alignItems:'start'}}>
        {/* Left: brand, series, title, indoor+outdoor, lead */}
        <div>
          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16}}>
            <BrandLogo name="CASARTE"/>
            <span style={{width:1,height:18,background:'var(--wf-border)'}}/>
            <div>
              <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1,lineHeight:1}}>Серия</T>
              <T size={13} weight={600} style={{marginTop:3}}>Cube Pro · 2025</T>
            </div>
            <span style={{width:1,height:18,background:'var(--wf-border)'}}/>
            <div>
              <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1,lineHeight:1}}>Мощность охлаждения</T>
              <div style={{display:'flex',alignItems:'center',gap:6,marginTop:3}}>
                <T size={13} weight={600}>2 800 Вт</T>
                <span title="Номинальная мощность охлаждения по ISO 5151 при 27°C в помещении и 35°C снаружи" style={{width:14,height:14,borderRadius:'50%',border:'1px solid var(--wf-ink-40)',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'var(--wf-ink-40)',fontWeight:600,cursor:'help',lineHeight:1}}>?</span>
              </div>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginTop:10}}>
            <div style={{padding:'18px 20px',border:'1px solid var(--wf-border-subtle)',borderRadius:6,background:'var(--wf-paper)'}}>
              <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1}}>Внутренний блок</T>
              <div style={{fontFamily:WF.mono,fontSize:24,fontWeight:600,letterSpacing:-0.3,marginTop:8,lineHeight:1.1}}>CAS-35HI/R3</div>
              <T size={11} color="var(--wf-ink-60)" style={{marginTop:10}}>850 × 295 × 189 мм · 10 кг</T>
            </div>
            <div style={{padding:'18px 20px',border:'1px solid var(--wf-border-subtle)',borderRadius:6,background:'var(--wf-paper)'}}>
              <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1}}>Наружный блок</T>
              <div style={{fontFamily:WF.mono,fontSize:24,fontWeight:600,letterSpacing:-0.3,marginTop:8,lineHeight:1.1}}>CAS-35HO/R3</div>
              <T size={11} color="var(--wf-ink-60)" style={{marginTop:10}}>780 × 540 × 290 мм · 42 кг</T>
            </div>
          </div>

          <T size={15} color="var(--wf-ink-60)" style={{marginTop:24,maxWidth:560,lineHeight:1.55,textWrap:'pretty'}}>Флагман суббренда Haier. Самый высокий индекс в рейтинге 2026 года. Максимальные оценки по 9 из 11 групп критериев, рекордно низкий шум и самая большая площадь теплообменника среди протестированных моделей.</T>
        </div>

        {/* Right: vertical metrics stack, Rank №1 visually emphasized */}
        <div style={{display:'flex',flexDirection:'column',gap:4,paddingLeft:28,borderLeft:'1px solid var(--wf-border-subtle)'}}>
          {/* Rank — hero metric */}
          <div style={{padding:'4px 0 20px'}}>
            <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1}}>Позиция в рейтинге</T>
            <div style={{display:'flex',alignItems:'baseline',gap:10,marginTop:6}}>
              <span style={{fontFamily:WF.serif,fontSize:72,fontWeight:600,lineHeight:0.9,letterSpacing:-3,color:'var(--wf-accent)'}}>№&nbsp;1</span>
              <span style={{fontSize:13,color:'var(--wf-ink-60)'}}>из 87 моделей</span>
            </div>
            <div style={{height:3,width:64,background:'var(--wf-accent)',marginTop:12}}/>
          </div>

          {/* Index */}
          <div style={{padding:'16px 0',borderTop:'1px solid var(--wf-border-subtle)'}}>
            <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1}}>Индекс 2026</T>
            <div style={{display:'flex',alignItems:'baseline',gap:10,marginTop:6}}>
              <span style={{fontFamily:WF.serif,fontSize:36,fontWeight:600,lineHeight:1,letterSpacing:-0.8}}>78.8</span>
              <span style={{fontSize:12,color:'var(--wf-ink-60)'}}>/ 100 · медиана 68.2</span>
            </div>
          </div>

          {/* Price */}
          <div style={{padding:'16px 0',borderTop:'1px solid var(--wf-border-subtle)'}}>
            <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1}}>Рекомендованная цена</T>
            <div style={{display:'flex',alignItems:'baseline',gap:10,marginTop:6}}>
              <span style={{fontFamily:WF.serif,fontSize:30,fontWeight:600,lineHeight:1,letterSpacing:-0.5}}>155 000 ₽</span>
            </div>
            <T size={11} color="var(--wf-ink-60)" style={{marginTop:6}}>розница от 149 000 ₽ · 8 магазинов</T>
          </div>
        </div>
      </div>
    </div>

    {/* MEDIA — layout varies by variant */}
    <div style={{padding:'28px 40px 36px',borderBottom:'1px solid var(--wf-border-subtle)'}}>
      <div style={{display:stacked?'block':'grid',gridTemplateColumns:stacked?undefined:'1.05fr 1fr',gap:24}}>
        {/* Photo block */}
        <div style={{marginBottom:stacked?32:0}}>
          <div style={{position:'relative',aspectRatio:'3 / 2'}}>
            <Box w="100%" h="100%" striped radius={6} label="главное фото · сплит-система"/>
            <div style={{position:'absolute',left:14,top:14,padding:'5px 12px',background:'rgba(255,255,255,0.92)',borderRadius:3,fontFamily:WF.mono,fontSize:10,letterSpacing:1,textTransform:'uppercase',color:'var(--wf-ink)'}}>Фото · галерея</div>
            <div style={{position:'absolute',right:14,bottom:14,padding:'5px 10px',background:'rgba(0,0,0,0.7)',borderRadius:3,fontFamily:WF.mono,fontSize:11,color:'white'}}>1 / 12</div>
            {/* nav arrows */}
            <div style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,0.9)',display:'flex',alignItems:'center',justifyContent:'center'}}><Icon d="M15 18 L9 12 L15 6" size={14}/></div>
            <div style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,0.9)',display:'flex',alignItems:'center',justifyContent:'center'}}><Icon d={ICONS.chevronR} size={14}/></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:stacked?'repeat(8,1fr)':'repeat(6,1fr)',gap:8,marginTop:10}}>
            {(stacked?[1,2,3,4,5,6,7,8]:[1,2,3,4,5,6]).map(i=><Box key={i} w="100%" h={stacked?96:74} striped radius={4} label={`фото ${i}`}/>)}
          </div>
          <div style={{display:'grid',gridTemplateColumns:stacked?'repeat(8,1fr)':'repeat(6,1fr)',gap:8,marginTop:8}}>
            {(stacked?[9,10,11,12,13,14,15,16]:[7,8,9,10,11,12]).map(i=><Box key={i} w="100%" h={stacked?96:74} striped radius={4} label={`фото ${i}`}/>)}
          </div>
        </div>

        {/* Video block */}
        <div>
          <div style={{position:'relative',width:'100%',aspectRatio:'16 / 9',background:'var(--wf-ink)',borderRadius:6,overflow:'hidden'}}>
            <svg width="100%" height="100%" viewBox="0 0 400 225" preserveAspectRatio="none" style={{position:'absolute',inset:0,opacity:0.25}}>
              <defs>
                <pattern id="vstripe2" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="white" strokeWidth="1" opacity="0.6"/></pattern>
              </defs>
              <rect width="400" height="225" fill="url(#vstripe2)"/>
            </svg>
            <div style={{position:'absolute',left:'50%',top:'50%',transform:'translate(-50%,-50%)',width:84,height:84,borderRadius:'50%',background:'rgba(255,255,255,0.92)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 6px 24px rgba(0,0,0,0.3)'}}>
              <svg width="28" height="30" viewBox="0 0 22 24"><polygon points="2,2 22,12 2,22" fill="var(--wf-ink)"/></svg>
            </div>
            <div style={{position:'absolute',left:14,top:14,padding:'5px 12px',background:'rgba(255,255,255,0.92)',borderRadius:3,fontFamily:WF.mono,fontSize:10,letterSpacing:1,textTransform:'uppercase',color:'var(--wf-ink)'}}>Видео-обзор</div>
            <div style={{position:'absolute',right:14,bottom:22,padding:'5px 10px',background:'rgba(0,0,0,0.7)',borderRadius:3,fontFamily:WF.mono,fontSize:11,color:'white'}}>08:42</div>
            <div style={{position:'absolute',left:0,right:0,bottom:0,height:4,background:'rgba(255,255,255,0.2)'}}><div style={{width:'32%',height:'100%',background:'var(--wf-accent)'}}/></div>
          </div>
          <div style={{marginTop:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:10}}>
              <T size={11} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1}}>Смотреть на платформах</T>
              <T size={11} color="var(--wf-ink-60)">4 площадки · 08:42</T>
            </div>
            <div style={{display:'grid',gridTemplateColumns:stacked?'repeat(4,1fr)':'1fr 1fr',gap:10}}>
              {[
                ['YouTube','YT','1.2M просмотров'],
                ['ВКонтакте','ВК','340K просмотров'],
                ['RUTUBE','RU','180K просмотров'],
                ['Дзен','Д','96K просмотров'],
              ].map(([name,mark,views])=>(
                <div key={name} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',border:'1px solid var(--wf-border-subtle)',borderRadius:6,background:'var(--wf-paper)'}}>
                  <div style={{width:32,height:32,borderRadius:6,background:'var(--wf-chip)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:WF.mono,fontSize:11,fontWeight:700,color:'var(--wf-ink-60)',flexShrink:0}}>{mark}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <T size={13} weight={600}>{name}</T>
                    <T size={11} color="var(--wf-ink-60)" style={{marginTop:2}}>{views}</T>
                  </div>
                  <Icon d={ICONS.chevronR} size={11} color="var(--wf-ink-40)"/>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Sticky-ish якорная навигация по странице */}
    <div style={{padding:'0 40px',borderBottom:'1px solid var(--wf-border-subtle)',display:'flex',gap:28,background:'var(--wf-paper)',position:'sticky',top:0,zIndex:5}}>
      {[
        ['Обзор','overview'],
        ['Оценки по критериям','criteria'],
        ['Характеристики','specs'],
        ['Где купить (8)','buy'],
        ['Отзывы (47)','reviews'],
      ].map(([t,id])=>{
        const active = activeTab===id;
        return (
        <div key={id} onClick={()=>scrollToAnchor(id)} style={{position:'relative',padding:'16px 0',fontSize:13,fontWeight:active?600:500,color:active?'var(--wf-ink)':'var(--wf-ink-60)',cursor:'pointer',userSelect:'none'}}>
          {t}
          {active && <div style={{position:'absolute',left:0,right:0,bottom:0,height:2,background:'var(--wf-accent)'}}/>}
        </div>
      );})}
    </div>

    {/* ═══ OVERVIEW ═══ */}
    <div data-anchor="overview" style={{padding:'40px 40px 36px',borderBottom:'1px solid var(--wf-border-subtle)'}}>
      <div style={{maxWidth:780,margin:'0 auto'}}>
        <Eyebrow>Обзор редакции</Eyebrow>
        <H size={30} serif style={{marginTop:6,marginBottom:22,letterSpacing:-0.3,lineHeight:1.15,textWrap:'balance'}}>Флагман Casarte, где за бренд заплатили инженеры, а не маркетологи.</H>
        {/* Lede */}
        <T size={16} style={{lineHeight:1.6,fontFamily:WF.serif,marginBottom:22,letterSpacing:-0.1}}>CAS35CU1YDW — старшая инверторная сплит-система Casarte на 3,5 кВт холода. Внутри — компрессор Panasonic DC Twin, электронный регулирующий вентиль, теплообменник на 15% крупнее класса, и честный ночной режим с падением шума до 24 дБ. Всё это в узком корпусе 85 × 29 см — тот случай, когда премиум-начинка упакована без премиальной вычурности.</T>

        {/* Главное фото статьи */}
        <figure style={{margin:'0 0 22px'}}>
          <Box w="100%" h={380} striped radius={4} label="Внутренний блок · студия"/>
          <T size={11} color="var(--wf-ink-40)" style={{marginTop:8,fontStyle:'italic',lineHeight:1.5}}>Фото редакции. 5 апреля 2026, лаборатория «Август-климат».</T>
        </figure>

        <T size={14} color="var(--wf-ink)" style={{lineHeight:1.7,marginBottom:16}}>Мы гоняли модель четыре недели в трёхкомнатной квартире на 62 м² в Москве, с марта по апрель. Утренние −8 °C, дневные +4 °C, ночные заморозки — всё, на чём климат-техника обычно «сыпется». Casarte держала режим без заметных провалов: компрессор не стучал на переходах, внешний блок работал тише соседского Samsung 2019 года.</T>
        <T size={14} color="var(--wf-ink)" style={{lineHeight:1.7,marginBottom:16}}>Отдельно порадовала теплая сторона. Производитель заявляет работу на обогрев до −30 °C — мы проверили до −15 °C (дальше погода не дала), и модель действительно не уходила в «защиту», как это делают китайские сплиты среднего класса. На −10 °C COP по нашим замерам — 2,7, что для такого ценника уже очень хороший результат.</T>

        {/* Цитата-выноска */}
        <div style={{margin:'28px 0',padding:'24px 28px',borderLeft:'3px solid var(--wf-accent)',background:'var(--wf-alt)'}}>
          <T size={18} style={{fontFamily:WF.serif,fontStyle:'italic',lineHeight:1.5,letterSpacing:-0.1}}>«Это первый кондиционер за последние три года, где я не поймал ни одного щелчка при переключении режимов. Инвертор здесь — не на бумаге.»</T>
          <T size={11} color="var(--wf-ink-60)" style={{marginTop:12,fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1}}>— А. Петров, главред</T>
        </div>

        <T size={14} color="var(--wf-ink)" style={{lineHeight:1.7,marginBottom:16}}>К минусам — цена. 155 000 ₽ за 09-ю модель — это на 30–40% выше среднего класса и на уровне Daikin серии Perfera. За эти деньги вы получаете не «чуть лучшую железку», а другой подход: у Casarte длина трассы 30 м, перепад высот 15 м, и возможность ставить внутренний блок там, куда бытовую сплит-систему не дотянешь физически.</T>
        <T size={14} color="var(--wf-ink)" style={{lineHeight:1.7}}>Второй минус — Wi-Fi. Приложение hOn работает, но «забывает» сеть раз в 2-3 недели, лечится пере-добавлением устройства. Голосовое управление через Алису настраивается, но только через SmartThings-шлюз — то есть, нужен ещё один гаджет в квартире. Для модели этого уровня — мелочь, но заметная.</T>
      </div>
    </div>

    {/* ═══ CRITERIA BREAKDOWN — grouped 33 criteria ═══ */}
    <div data-anchor="criteria" style={{padding:'40px 40px 32px'}}>
      <div style={{display:'grid',gridTemplateColumns:'1.35fr 1fr',gap:48}}>
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:22,gap:24}}>
            <div>
              <Eyebrow>Оценки по критериям</Eyebrow>
              <H size={26} serif style={{marginTop:8,letterSpacing:-0.3}}>30 параметров рейтинга</H>
            </div>
            {/* View switcher */}
            <div style={{display:'inline-flex',border:'1px solid var(--wf-border-subtle)',borderRadius:6,background:'var(--wf-paper)',padding:3}}>
              {[
                ['list','Список', 'M3 5h14M3 10h14M3 15h14'],
                ['radar','Паутинка', 'M10 2 L18 8 L15 17 L5 17 L2 8 Z M10 2 L10 17 M2 8 L18 8 M5 17 L15 17'],
                ['grid','Сетка', 'M3 3h6v6H3z M11 3h6v6h-6z M3 11h6v6H3z M11 11h6v6h-6z'],
              ].map(([k,label,icon])=>{
                const active = critView===k;
                return (
                  <button key={k} onClick={()=>setCritView(k)} style={{display:'flex',alignItems:'center',gap:7,padding:'7px 12px',border:0,borderRadius:4,background:active?'var(--wf-ink)':'transparent',color:active?'var(--wf-paper)':'var(--wf-ink-60)',fontSize:12,fontWeight:500,cursor:'pointer'}}>
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={icon}/></svg>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* VIEW · LIST — 30 параметров */}
          {critView==='list' && <div style={{display:'flex',flexDirection:'column'}}>
            {CRITERIA.map(([name, chip, contrib, val, ticker],i)=>{
              const zero = contrib === 0 && val === 0;
              const tickerColor = ticker === 'выше эталона' ? '#1f8f4c' : ticker === 'ниже эталона' ? '#b24a3b' : null;
              const featured = /минимального уровня шума/i.test(name);
              return (
                <div key={i} style={{padding:featured?'18px 20px':'16px 0',borderBottom:'1px solid var(--wf-border-subtle)',background:featured?'var(--wf-accent-bg)':'transparent',border:featured?'1px solid var(--wf-accent)':undefined,borderRadius:featured?6:0,margin:featured?'4px 0 10px':0,position:'relative'}}>
                  {featured && <div style={{position:'absolute',top:-9,left:16,padding:'2px 8px',background:'var(--wf-accent)',color:'var(--wf-paper)',fontSize:9,fontWeight:700,fontFamily:WF.mono,letterSpacing:1.5,textTransform:'uppercase',borderRadius:2}}>Ключевой замер</div>}
                  {/* Row 1: name + chip + ticker */}
                  <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                    <T size={featured?14:13} weight={featured?700:600} style={{flexShrink:0,color:featured?'var(--wf-accent)':undefined}}>{name}:</T>
                    <span style={{display:'inline-flex',alignItems:'center',padding:'3px 10px',background:'var(--wf-accent-bg)',color:'var(--wf-accent)',borderRadius:4,fontSize:12,fontWeight:600,fontFamily:WF.mono,letterSpacing:-0.1}}>{chip}</span>
                    <span title={`Методика: как считается «${name}»`} style={{width:14,height:14,borderRadius:'50%',border:'1px solid var(--wf-ink-40)',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'var(--wf-ink-40)',fontWeight:600,cursor:'help',lineHeight:1,flexShrink:0}}>?</span>
                    <div style={{flex:1}}/>
                    {ticker && <span style={{fontSize:11,fontWeight:600,color:tickerColor,fontFamily:WF.mono,letterSpacing:0.2}}>{ticker}</span>}
                  </div>
                  {/* Row 2: bar */}
                  <div style={{marginTop:10}}><Meter value={val} h={4} dim={zero}/></div>
                  {/* Row 3: contribution + score */}
                  <div style={{marginTop:7,display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                    <T size={11} color="var(--wf-ink-60)" style={{fontFamily:WF.mono}}>
                      Вклад в индекс: <span style={{color:'var(--wf-ink)',fontWeight:600}}>{contrib.toFixed(2)}</span>
                    </T>
                    <div style={{fontFamily:WF.mono,fontSize:12}}>
                      <span style={{color:'var(--wf-ink)',fontWeight:700,fontSize:14}}>{val.toFixed(1)}</span>
                      <span style={{color:'var(--wf-ink-40)'}}> / 100</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>}

          {/* VIEW · RADAR — 30 осей */}
          {critView==='radar' && (()=>{
            const N = CRITERIA.length;
            const cx=280, cy=280, R=210;
            const pt = (i,r)=>{
              const a = -Math.PI/2 + (i/N)*Math.PI*2;
              return [cx + r*Math.cos(a), cy + r*Math.sin(a)];
            };
            const polygon = CRITERIA.map(([,,,v],i)=>pt(i,(v/100)*R).join(',')).join(' ');
            const rings = [20,40,60,80,100];
            return (
              <div style={{padding:'12px 0 20px'}}>
                <svg width="100%" viewBox="0 0 560 620" style={{maxWidth:560}}>
                  {rings.map(p=>(
                    <polygon key={p} points={CRITERIA.map((_,i)=>pt(i,(p/100)*R).join(',')).join(' ')} fill="none" stroke="currentColor" strokeOpacity="0.12"/>
                  ))}
                  {CRITERIA.map(([name],i)=>{
                    const [x,y] = pt(i,R);
                    const [lx,ly] = pt(i,R+16);
                    const a = -Math.PI/2 + (i/N)*Math.PI*2;
                    const anchor = Math.cos(a) > 0.15 ? 'start' : Math.cos(a) < -0.15 ? 'end' : 'middle';
                    const short = name.length > 22 ? name.slice(0,20)+'…' : name;
                    return (
                      <g key={i}>
                        <line x1={cx} y1={cy} x2={x} y2={y} stroke="currentColor" strokeOpacity="0.1"/>
                        <text x={lx} y={ly} fontSize="8.5" fill="currentColor" opacity="0.75" textAnchor={anchor} dominantBaseline="middle" fontFamily="ui-sans-serif, system-ui">{short}</text>
                      </g>
                    );
                  })}
                  <polygon points={polygon} fill="var(--wf-accent)" fillOpacity="0.18" stroke="var(--wf-accent)" strokeWidth="1.3"/>
                  {CRITERIA.map(([,,,v],i)=>{
                    const [x,y] = pt(i,(v/100)*R);
                    return <circle key={i} cx={x} cy={y} r="2.8" fill="var(--wf-accent)"/>;
                  })}
                  {rings.map(p=>(
                    <text key={p} x={cx+4} y={cy - (p/100)*R - 2} fontSize="9" fill="currentColor" opacity="0.35" fontFamily="ui-monospace, monospace">{p}</text>
                  ))}
                </svg>
                <T size={11} color="var(--wf-ink-60)" style={{marginTop:10}}>
                  Площадь заполнения — <span style={{color:'var(--wf-ink)',fontWeight:600}}>78.8 / 100</span>. Чем ближе фигура к внешнему контуру, тем выше итоговый индекс модели.
                </T>
              </div>
            );
          })()}

          {/* VIEW · GRID — 30 карточек 3×10 */}
          {critView==='grid' && (
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
              {CRITERIA.map(([name,chip,contrib,val,ticker],i)=>{
                const zero = contrib === 0 && val === 0;
                const tickerColor = ticker === 'выше эталона' ? '#1f8f4c' : ticker === 'ниже эталона' ? '#b24a3b' : null;
                return (
                  <div key={i} style={{padding:'12px 14px',border:'1px solid var(--wf-border-subtle)',borderRadius:6,background:'var(--wf-paper)',display:'flex',flexDirection:'column'}}>
                    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:6}}>
                      <T size={11} weight={600} style={{flex:1,lineHeight:1.3}}>{name}</T>
                      <span style={{width:13,height:13,borderRadius:'50%',border:'1px solid var(--wf-ink-40)',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:8,color:'var(--wf-ink-40)',fontWeight:600,cursor:'help',lineHeight:1,flexShrink:0,marginTop:2}}>?</span>
                    </div>
                    <div style={{marginTop:8,display:'flex',alignItems:'center',justifyContent:'space-between',gap:6}}>
                      <span style={{display:'inline-flex',padding:'2px 8px',background:'var(--wf-accent-bg)',color:'var(--wf-accent)',borderRadius:3,fontSize:11,fontWeight:600,fontFamily:WF.mono}}>{chip}</span>
                      {ticker && <span style={{fontSize:9,fontWeight:600,color:tickerColor,fontFamily:WF.mono}}>{ticker}</span>}
                    </div>
                    <div style={{marginTop:10}}><Meter value={val} h={3} dim={zero}/></div>
                    <div style={{marginTop:7,display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                      <T size={9} color="var(--wf-ink-60)" style={{fontFamily:WF.mono}}>Вклад {contrib.toFixed(2)}</T>
                      <div style={{fontFamily:WF.mono,fontSize:10}}>
                        <span style={{color:'var(--wf-ink)',fontWeight:700,fontSize:12}}>{val.toFixed(1)}</span>
                        <span style={{color:'var(--wf-ink-40)'}}> / 100</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <T size={11} color="var(--wf-ink-40)" style={{marginTop:16,fontStyle:'italic'}}>Раскрыть методологию замеров →</T>
        </div>

        <div>
          {/* Verdict card */}
          <div style={{background:'var(--wf-alt)',padding:'28px 28px',borderRadius:8,marginBottom:24}}>
            <Eyebrow>Вердикт редакции</Eyebrow>
            <div style={{fontFamily:WF.serif,fontSize:19,lineHeight:1.45,marginTop:14,color:'var(--wf-ink)',textWrap:'pretty'}}>
              Один из двух кондиционеров в рейтинге с настоящим инверторным компрессором Panasonic. Низкий шум подтверждён двумя сериями замеров — в офисе и в эхо-камере. Цена высокая, но за семь лет реальная разница со средним классом окупится экономией на электричестве.
            </div>
            <div style={{display:'flex',gap:12,marginTop:20,alignItems:'center',paddingTop:18,borderTop:'1px solid var(--wf-border-subtle)'}}>
              <div style={{display:'flex'}}>
                {[0,1].map(i=>(
                  <div key={i} style={{width:36,height:36,borderRadius:'50%',background:'var(--wf-chip)',overflow:'hidden',flexShrink:0,marginLeft:i===0?0:-10,border:'2px solid var(--wf-alt)',position:'relative'}}>
                    <svg width="32" height="32" viewBox="0 0 36 36"><circle cx="18" cy="14" r="6" fill="var(--wf-ink-40)" opacity="0.55"/><path d="M 6 36 Q 6 24 18 24 Q 30 24 30 36 Z" fill="var(--wf-ink-40)" opacity="0.55"/></svg>
                  </div>
                ))}
              </div>
              <div>
                <T size={12} weight={600}>Андрей Петров · Ирина Соколова</T>
                <T size={11} color="var(--wf-ink-60)" style={{marginTop:2}}>редакция · апрель 2026</T>
              </div>
            </div>
          </div>

          {/* Pros / cons */}
          {/* Pros / cons — colored eyebrows + divider */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1px 1fr',gap:24,alignItems:'stretch'}}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
                <span style={{width:6,height:6,borderRadius:'50%',background:'var(--wf-pos, #1f8f4c)'}}/>
                <span style={{fontFamily:WF.mono,fontSize:10,textTransform:'uppercase',letterSpacing:1.2,fontWeight:600,color:'var(--wf-pos, #1f8f4c)'}}>Плюсы · 4</span>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                {[
                  ['Низкий шум (24 дБ)','не мешает спать даже на максимуме'],
                  ['Большой теплообменник','устойчивая работа зимой'],
                  ['Честный инвертор Panasonic','плавные режимы'],
                  ['7 лет гарантии','лидер по сроку'],
                ].map(([a,b],i)=>(
                  <div key={i}><T size={13} weight={600}>{a}</T><T size={11} color="var(--wf-ink-60)" style={{marginTop:3,lineHeight:1.4}}>{b}</T></div>
                ))}
              </div>
            </div>
            <div style={{background:'var(--wf-border-subtle)'}}/>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
                <span style={{width:6,height:6,borderRadius:'50%',background:'var(--wf-neg, #b24a3b)'}}/>
                <span style={{fontFamily:WF.mono,fontSize:10,textTransform:'uppercase',letterSpacing:1.2,fontWeight:600,color:'var(--wf-neg, #b24a3b)'}}>Минусы · 4</span>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                {[
                  ['Цена 155 000 ₽','+30–40% к среднему классу'],
                  ['Нестабильный Wi-Fi','приложение «забывает» сеть'],
                  ['Тяжёлый внешний блок','42 кг, сложный монтаж'],
                  ['Ограниченная сеть сервисов','в регионах — только Москва+СПб'],
                ].map(([a,b],i)=>(
                  <div key={i}><T size={13} weight={600}>{a}</T><T size={11} color="var(--wf-ink-60)" style={{marginTop:3,lineHeight:1.4}}>{b}</T></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* INDEX VISUALIZATION — horizontal distribution strip */}
    <div style={{padding:'32px 40px 40px',borderTop:'1px solid var(--wf-border-subtle)',background:'var(--wf-alt)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:18}}>
        <div>
          <Eyebrow>Где эта модель на шкале индекса</Eyebrow>
          <H size={24} serif style={{marginTop:6,letterSpacing:-0.3}}>78.8 — лидер среди 87 моделей 2026 года</H>
        </div>
        <T size={11} color="var(--wf-ink-60)">шкала 0–100 · медиана 68.2</T>
      </div>
      {/* Simple bar strip with marker */}
      <div style={{position:'relative',height:64,marginTop:8}}>
        <svg width="100%" height="64" viewBox="0 0 1200 64" preserveAspectRatio="none">
          {/* Distribution dots */}
          {Array.from({length:87}).map((_,i)=>{
            const v = 40+Math.sin(i*0.9)*20+Math.cos(i*0.3)*8+(i/87)*20;
            const x = 40 + (v/100)*1120;
            const y = 46;
            return <circle key={i} cx={x} cy={y} r="2.5" fill="currentColor" opacity={v>76?"0.2":"0.12"}/>;
          })}
          {/* Axis */}
          <line x1="40" y1="58" x2="1160" y2="58" stroke="currentColor" strokeOpacity="0.15"/>
          {[0,25,50,75,100].map(t=>{
            const x = 40 + (t/100)*1120;
            return <g key={t}><line x1={x} y1="54" x2={x} y2="62" stroke="currentColor" strokeOpacity="0.25"/><text x={x} y="18" fontSize="10" fill="currentColor" opacity="0.5" textAnchor="middle" fontFamily="ui-monospace, monospace">{t}</text></g>;
          })}
          {/* Median marker */}
          <line x1={40+(68.2/100)*1120} y1="30" x2={40+(68.2/100)*1120} y2="58" stroke="currentColor" strokeOpacity="0.3" strokeDasharray="3 3"/>
          {/* This model marker */}
          <g>
            <circle cx={40+(78.8/100)*1120} cy="46" r="8" fill="var(--wf-accent)"/>
            <text x={40+(78.8/100)*1120} y="30" fontSize="12" fill="var(--wf-accent)" fontWeight="600" textAnchor="middle" fontFamily="ui-serif, Georgia, serif">78.8</text>
          </g>
        </svg>
      </div>
    </div>

    {/* ═══ SPECS TABLE — grouped & editorial ═══ */}
    <div data-anchor="specs" style={{padding:'40px 40px 36px',borderTop:'1px solid var(--wf-border-subtle)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:26,gap:24}}>
        <div>
          <Eyebrow>Технические характеристики</Eyebrow>
          <H size={26} serif style={{marginTop:6,letterSpacing:-0.3}}>Паспорт модели · 42 параметра в 5 группах</H>
        </div>
        <div style={{display:'flex',gap:16,alignItems:'center'}}>
          <T size={11} color="var(--wf-ink-60)" style={{fontFamily:WF.mono}}>Источник: официальный паспорт Casarte · апрель 2026</T>
          <div style={{display:'flex',gap:6}}>
            {['PDF','CSV','Копировать'].map(x=>(
              <a key={x} style={{padding:'6px 10px',border:'1px solid var(--wf-border)',borderRadius:4,fontSize:11,color:'var(--wf-ink-60)',fontFamily:WF.mono,cursor:'pointer',textDecoration:'none'}}>↓ {x}</a>
            ))}
          </div>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:28}}>
        {[
          ['Климатический блок', [
            ['Мощность охлаждения','3.5 кВт',null],
            ['Мощность обогрева','3.8 кВт',null],
            ['Энергокласс (охлаждение)','A+++','выше эталона'],
            ['Энергокласс (обогрев)','A++',null],
            ['SEER','6.5','выше эталона'],
            ['SCOP','5.1',null],
            ['Хладагент','R32',null],
            ['Объём хладагента','650 г',null],
            ['Рабочий диапазон (охл)','−5 … +50 °C',null],
            ['Рабочий диапазон (тепло)','−25 … +24 °C','выше эталона'],
            ['Дежурный обогрев +8 °C','нет','ниже эталона'],
          ]],
          ['Компрессор и контур', [
            ['Тип компрессора','DC-инвертор',null],
            ['Производитель','Panasonic',null],
            ['Длина трассы (max)','30 м','выше эталона'],
            ['Перепад высот (max)','15 м','выше эталона'],
            ['ЭРВ (электронный регулятор)','есть',null],
            ['Автоматический рестарт','есть',null],
            ['Защита от замерзания','есть',null],
            ['Площадь теплообм. внутр.','0.52 м²','выше эталона'],
            ['Площадь теплообм. внешн.','1.1 м²','выше эталона'],
          ]],
          ['Акустика', [
            ['Шум внутр. блока (мин)','24 дБ(А)',null],
            ['Шум внутр. блока (макс)','38 дБ(А)',null],
            ['Шум внешн. блока (ном)','48 дБ(А)',null],
            ['Вибрация внешн. блока','0.17 мм',null],
            ['Ночной режим','есть',null],
          ]],
          ['Управление и датчики', [
            ['Wi-Fi','встроен (hOn)',null],
            ['Голосовой ассистент','Алиса, SmartThings',null],
            ['ИК-датчик присутствия','нет','ниже эталона'],
            ['Русифицированный пульт','нет','ниже эталона'],
            ['Самодиагностика','есть',null],
            ['Ионизатор','нет',null],
            ['УФ-лампа','светодиоды',null],
            ['Приток свежего воздуха','без подогрева',null],
            ['Ароматизатор','есть',null],
          ]],
          ['Габариты и комплектация', [
            ['Внутренний блок','850 × 295 × 189 мм',null],
            ['Вес внутр. блока','10 кг',null],
            ['Внешний блок','820 × 620 × 290 мм',null],
            ['Вес внешн. блока','42 кг','ниже эталона'],
            ['Гарантия','7 лет','выше эталона'],
            ['Страна сборки','Китай',null],
            ['В продаже с','март 2025',null],
            ['Фильтры тонкой очистки','1 шт.',null],
          ]],
        ].map(([group,rows])=>(
          <div key={group} style={{breakInside:'avoid',border:'1px solid var(--wf-border-subtle)',borderRadius:6,overflow:'hidden',background:'var(--wf-paper)'}}>
            <div style={{padding:'12px 16px',background:'var(--wf-alt)',borderBottom:'1px solid var(--wf-border-subtle)',display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
              <T size={12} weight={600} style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2}}>{group}</T>
              <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono}}>{rows.length} парам.</T>
            </div>
            <div>
              {rows.map(([k,v,flag],i)=>(
                <div key={k} style={{padding:'11px 16px',borderBottom:i<rows.length-1?'1px solid var(--wf-border-subtle)':0,display:'grid',gridTemplateColumns:'1fr auto',gap:12,alignItems:'baseline'}}>
                  <T size={12} color="var(--wf-ink-60)">{k}</T>
                  <div style={{textAlign:'right',display:'flex',alignItems:'baseline',justifyContent:'flex-end',gap:6}}>
                    {flag && <span style={{fontSize:9,fontFamily:WF.mono,color:flag.startsWith('выше')?'#1f8f4c':'#b24a3b',letterSpacing:0.3}}>{flag.startsWith('выше')?'▲':'▼'}</span>}
                    <T size={12} weight={600} style={{fontFamily:/^[\d.\s−+−…]+/.test(String(v))||/кВт|мм|кг|дБ|м²|%|°C|мин|г|мес|лет|год|м$/.test(String(v))?WF.mono:WF.sans}}>{v}</T>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <T size={11} color="var(--wf-ink-40)" style={{marginTop:18,fontStyle:'italic',lineHeight:1.5}}>
        <span style={{color:'#1f8f4c'}}>▲</span> — параметр лучше эталона класса,&nbsp;
        <span style={{color:'#b24a3b'}}>▼</span> — хуже. Эталон рассчитан по медиане 87 моделей рейтинга 04.2026.
      </T>
    </div>

    {/* ═══ WHERE TO BUY ═══ */}
    <div data-anchor="buy" style={{padding:'40px 40px 40px',borderTop:'1px solid var(--wf-border-subtle)',background:'var(--wf-alt)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:24,gap:24}}>
        <div>
          <Eyebrow>Где купить</Eyebrow>
          <H size={26} serif style={{marginTop:6,letterSpacing:-0.3,textWrap:'balance',maxWidth:640}}>12 магазинов в 5 городах · цены актуальны на 12.04.2026</H>
        </div>
        <T size={11} color="var(--wf-ink-60)" style={{fontFamily:WF.mono}}>автопарсинг · обновлено 6 часов назад</T>
      </div>

      {/* Цена-статбар */}
      <div style={{padding:'20px 24px',background:'var(--wf-paper)',border:'1px solid var(--wf-border-subtle)',borderRadius:6,marginBottom:24,display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:0}}>
        {[
          ['Минимум','149 900 ₽','М-Видео, Москва'],
          ['Медиана','155 500 ₽','по 12 предложениям'],
          ['Средняя','156 200 ₽',null],
          ['Максимум','162 000 ₽','Техпорт, СПб'],
        ].map(([label,price,meta],i,arr)=>(
          <div key={label} style={{padding:'0 20px',borderRight:i<arr.length-1?'1px solid var(--wf-border-subtle)':0}}>
            <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2}}>{label}</T>
            <div style={{fontFamily:WF.serif,fontSize:24,fontWeight:600,letterSpacing:-0.4,marginTop:4,lineHeight:1}}>{price}</div>
            {meta && <T size={10} color="var(--wf-ink-60)" style={{marginTop:6,lineHeight:1.4}}>{meta}</T>}
          </div>
        ))}
      </div>

      {/* Гистограмма разброса цен */}
      <div style={{marginBottom:24,padding:'16px 24px',background:'var(--wf-paper)',border:'1px solid var(--wf-border-subtle)',borderRadius:6}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:12}}>
          <T size={11} color="var(--wf-ink-60)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1}}>Разброс предложений</T>
          <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono}}>149 900 → 162 000 ₽</T>
        </div>
        <div style={{position:'relative',height:36}}>
          {/* ось */}
          <div style={{position:'absolute',left:0,right:0,top:'50%',height:1,background:'var(--wf-border-subtle)'}}/>
          {/* точки предложений */}
          {[149900,151500,152000,153200,154500,155000,155000,156700,157300,158000,160000,162000].map((p,i)=>{
            const pct = ((p-149900)/(162000-149900))*100;
            return <div key={i} style={{position:'absolute',left:`${pct}%`,top:'50%',width:10,height:10,background:'var(--wf-accent)',borderRadius:'50%',transform:'translate(-50%,-50%)',border:'2px solid var(--wf-paper)',opacity:0.85}}/>;
          })}
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:6}}>
          <T size={9} color="var(--wf-ink-40)" style={{fontFamily:WF.mono}}>149.9k</T>
          <T size={9} color="var(--wf-ink-40)" style={{fontFamily:WF.mono}}>156k ◆ медиана</T>
          <T size={9} color="var(--wf-ink-40)" style={{fontFamily:WF.mono}}>162k</T>
        </div>
      </div>

      {/* Фильтры-чипы */}
      <div style={{display:'flex',gap:14,alignItems:'center',marginBottom:18,flexWrap:'wrap'}}>
        <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2,marginRight:4}}>Город:</T>
        {[['Москва',6],['Санкт-Петербург',3],['Екатеринбург',1],['Новосибирск',1],['Казань',1]].map(([city,n])=>{
          const active = city==='Москва';
          return (
            <a key={city} style={{padding:'6px 12px',border:'1px solid '+(active?'var(--wf-ink)':'var(--wf-border)'),borderRadius:14,fontSize:11,color:active?'var(--wf-paper)':'var(--wf-ink-60)',fontFamily:WF.sans,fontWeight:active?600:500,background:active?'var(--wf-ink)':'transparent',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:6}}>
              {city} <span style={{opacity:0.7,fontSize:10}}>{n}</span>
            </a>
          );
        })}
        <div style={{flex:1}}/>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2}}>Сортировка:</T>
          {['Цена','Рейтинг магазина','Доставка'].map((s,i)=>(
            <span key={s} style={{fontSize:11,color:i===0?'var(--wf-ink)':'var(--wf-ink-60)',fontWeight:i===0?600:500,cursor:'pointer',borderBottom:i===0?'1px solid var(--wf-ink)':'none'}}>{s}</span>
          ))}
        </div>
      </div>

      {/* Список магазинов — таблица */}
      <div style={{background:'var(--wf-paper)',border:'1px solid var(--wf-border-subtle)',borderRadius:6,overflow:'hidden'}}>
        <div style={{display:'grid',gridTemplateColumns:'3fr 1.3fr 1.6fr 1fr 100px 50px',padding:'10px 20px',background:'var(--wf-alt)',borderBottom:'1px solid var(--wf-border-subtle)',gap:14}}>
          {['Магазин','Цена','Доставка','Наличие','Рейтинг',''].map(h=><T key={h} size={9} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2}}>{h}</T>)}
        </div>
        {[
          ['М-Видео','149 900 ₽','с монтажом · 2 дня','в наличии','green',4.6,'Москва'],
          ['DNS','152 000 ₽','самовывоз · завтра','в наличии','green',4.4,'Москва'],
          ['Ситилинк','154 500 ₽','кредит 0% · 3 дня','в наличии','green',4.2,'Москва'],
          ['Эльдорадо','155 000 ₽','гарантия +2 года','в наличии','green',4.1,'Москва'],
          ['Онлайн-трейд','156 700 ₽','бесплатная · 4 дня','2 шт.','amber',4.7,'Москва'],
          ['Холодильник.ру','158 000 ₽','монтаж от 9 000 ₽','1 шт.','amber',4.8,'Москва'],
        ].map(([shop,price,note,stock,dot,rating,city],i,arr)=>{
          const dotColor = dot==='green'?'#1f8f4c':dot==='amber'?'#c9821c':'#b24a3b';
          return (
            <div key={shop} style={{display:'grid',gridTemplateColumns:'3fr 1.3fr 1.6fr 1fr 100px 50px',padding:'15px 20px',borderBottom:i<arr.length-1?'1px solid var(--wf-border-subtle)':0,gap:14,alignItems:'center',cursor:'pointer'}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:32,height:32,background:'var(--wf-chip)',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:WF.mono,fontSize:10,fontWeight:600,color:'var(--wf-ink-60)',flexShrink:0}}>{shop.charAt(0)}</div>
                <div style={{minWidth:0}}>
                  <T size={13} weight={600}>{shop}</T>
                  <T size={10} color="var(--wf-ink-40)" style={{marginTop:2}}>{city}</T>
                </div>
              </div>
              <span style={{fontFamily:WF.serif,fontSize:16,fontWeight:600,letterSpacing:-0.2}}>{price}</span>
              <T size={11} color="var(--wf-ink-60)" style={{lineHeight:1.4}}>{note}</T>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span style={{width:7,height:7,borderRadius:'50%',background:dotColor,flexShrink:0}}/>
                <T size={11}>{stock}</T>
              </div>
              <div style={{display:'flex',alignItems:'baseline',gap:4}}>
                <span style={{fontFamily:WF.serif,fontSize:13,fontWeight:600,color:'var(--wf-accent)'}}>{rating}</span>
                <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono}}>/5</T>
              </div>
              <Icon d={ICONS.chevronR} size={12} color="var(--wf-ink-40)"/>
            </div>
          );
        })}
      </div>
      <div style={{marginTop:14,display:'flex',justifyContent:'center'}}>
        <T size={11} color="var(--wf-ink-60)" style={{cursor:'pointer',borderBottom:'1px solid var(--wf-ink-40)'}}>Показать ещё 6 предложений в других городах →</T>
      </div>
    </div>

    {/* ═══ REVIEWS ═══ */}
    <div data-anchor="reviews" style={{padding:'40px 40px 40px',borderTop:'1px solid var(--wf-border-subtle)'}}>
      <div style={{display:'grid',gridTemplateColumns:'1.1fr 1fr',gap:56,marginBottom:28,alignItems:'start'}}>
        {/* Сводка */}
        <div>
          <Eyebrow>Отзывы покупателей</Eyebrow>
          <H size={26} serif style={{marginTop:6,letterSpacing:-0.3}}>47 отзывов · средняя оценка</H>
          <div style={{marginTop:22,display:'flex',gap:28,alignItems:'flex-end'}}>
            <div>
              <div style={{fontFamily:WF.serif,fontSize:72,fontWeight:600,lineHeight:0.9,color:'var(--wf-accent)',letterSpacing:-2}}>4.4</div>
              <div style={{display:'flex',gap:2,marginTop:8}}>
                {[1,2,3,4,5].map(s=>(
                  <svg key={s} width="16" height="16" viewBox="0 0 20 20" fill={s<=4?'var(--wf-accent)':'var(--wf-border)'} stroke={s===5?'var(--wf-accent)':'none'} strokeWidth="1"><path d="M10 1 L12.5 7 L19 7.5 L14 12 L15.5 18.5 L10 15 L4.5 18.5 L6 12 L1 7.5 L7.5 7 Z"/></svg>
                ))}
              </div>
              <T size={11} color="var(--wf-ink-60)" style={{marginTop:10,fontFamily:WF.mono}}>из 47 отзывов</T>
            </div>
            <div style={{flex:1,display:'flex',flexDirection:'column',gap:6}}>
              {[[5,31,'66%'],[4,9,'19%'],[3,4,'9%'],[2,2,'4%'],[1,1,'2%']].map(([s,n,pct])=>(
                <div key={s} style={{display:'grid',gridTemplateColumns:'24px 1fr 60px',gap:10,alignItems:'center'}}>
                  <T size={11} style={{fontFamily:WF.mono}}>{s}★</T>
                  <div style={{height:6,background:'var(--wf-border-subtle)',borderRadius:3,overflow:'hidden'}}>
                    <div style={{width:pct,height:'100%',background:s>=4?'var(--wf-accent)':s===3?'var(--wf-ink-40)':'#b24a3b'}}/>
                  </div>
                  <T size={10} color="var(--wf-ink-60)" style={{fontFamily:WF.mono,textAlign:'right'}}>{n} · {pct}</T>
                </div>
              ))}
            </div>
          </div>
          {/* Фильтры + сортировка */}
          <div style={{marginTop:22,display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',paddingTop:18,borderTop:'1px solid var(--wf-border-subtle)'}}>
            <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2,marginRight:4}}>Фильтр:</T>
            {[['С фото',true],['С видео',false],['Проверенные покупки',true],['Только 2026',false]].map(([label,active])=>(
              <a key={label} style={{padding:'5px 10px',border:'1px solid '+(active?'var(--wf-ink)':'var(--wf-border)'),borderRadius:12,fontSize:10,color:active?'var(--wf-paper)':'var(--wf-ink-60)',fontFamily:WF.sans,fontWeight:active?600:500,background:active?'var(--wf-ink)':'transparent',cursor:'pointer'}}>{label}</a>
            ))}
          </div>
        </div>

        {/* Tabs: read vs write */}
        <div style={{padding:'22px 26px',border:'1px solid var(--wf-border-subtle)',borderRadius:6,background:'var(--wf-alt)'}}>
          <div style={{display:'flex',gap:0,marginBottom:20,borderBottom:'1px solid var(--wf-border-subtle)'}}>
            {[['read','Читать отзывы'],['write','Оставить свой']].map(([k,label])=>(
              <button key={k} onClick={()=>setReviewMode(k)} style={{padding:'10px 16px',border:0,background:'transparent',borderBottom:reviewMode===k?'2px solid var(--wf-accent)':'2px solid transparent',marginBottom:-1,fontSize:12,fontWeight:reviewMode===k?600:500,color:reviewMode===k?'var(--wf-ink)':'var(--wf-ink-60)',cursor:'pointer',fontFamily:WF.sans}}>{label}</button>
            ))}
          </div>
          {reviewMode==='read' && (
            <div>
              <T size={11} color="var(--wf-ink-60)" style={{lineHeight:1.55,marginBottom:14}}>Сортировка: <span style={{color:'var(--wf-ink)',fontWeight:600,borderBottom:'1px solid var(--wf-ink)',cursor:'pointer'}}>Полезные</span> · <span style={{cursor:'pointer'}}>Новые</span> · <span style={{cursor:'pointer'}}>По оценке ↓</span> · <span style={{cursor:'pointer'}}>По оценке ↑</span></T>
              <T size={11} color="var(--wf-ink-40)" style={{lineHeight:1.55,fontStyle:'italic'}}>Отзывы отсортированы по полезности за последние 30 дней. Верификация покупки — через чек ОФД.</T>
            </div>
          )}
          {reviewMode==='write' && (
            <div>
              <T size={11} color="var(--wf-ink-60)" style={{lineHeight:1.55,marginBottom:16}}>Вы авторизованы как <span style={{color:'var(--wf-ink)',fontWeight:600}}>dmitry@example.com</span>. Добавьте чек ОФД — отзыв получит отметку «Проверенная покупка».</T>
              <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2,marginBottom:8}}>Ваша оценка</T>
              <div style={{display:'flex',gap:4,marginBottom:18}}>
                {[1,2,3,4,5].map(s=>(
                  <svg key={s} width="28" height="28" viewBox="0 0 20 20" fill={s<=4?'var(--wf-accent)':'none'} stroke="var(--wf-accent)" strokeWidth="1" style={{cursor:'pointer'}}><path d="M10 1 L12.5 7 L19 7.5 L14 12 L15.5 18.5 L10 15 L4.5 18.5 L6 12 L1 7.5 L7.5 7 Z"/></svg>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
                <div>
                  <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2,marginBottom:6}}>Плюсы</T>
                  <div style={{border:'1px solid var(--wf-border)',borderRadius:4,padding:'10px 12px',minHeight:64,background:'var(--wf-paper)'}}>
                    <T size={12} color="var(--wf-ink-40)" style={{fontStyle:'italic'}}>Тихий, быстро греет, удобный пульт…</T>
                  </div>
                </div>
                <div>
                  <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2,marginBottom:6}}>Минусы</T>
                  <div style={{border:'1px solid var(--wf-border)',borderRadius:4,padding:'10px 12px',minHeight:64,background:'var(--wf-paper)'}}>
                    <T size={12} color="var(--wf-ink-40)" style={{fontStyle:'italic'}}>Цена, Wi-Fi «забывает» сеть…</T>
                  </div>
                </div>
              </div>
              <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2,marginBottom:6}}>Комментарий</T>
              <div style={{border:'1px solid var(--wf-border)',borderRadius:4,padding:'10px 12px',minHeight:80,background:'var(--wf-paper)',marginBottom:14}}>
                <T size={12} color="var(--wf-ink-40)" style={{fontStyle:'italic'}}>Расскажите, как модель показала себя в вашем доме: как быстро выходит на режим, как ведёт в холода, нет ли странных звуков…</T>
              </div>
              <div style={{display:'flex',gap:10,alignItems:'center'}}>
                <a style={{padding:'8px 14px',border:'1px dashed var(--wf-border)',borderRadius:4,fontSize:11,color:'var(--wf-ink-60)',cursor:'pointer'}}>+ фото / видео</a>
                <a style={{padding:'8px 14px',border:'1px dashed var(--wf-border)',borderRadius:4,fontSize:11,color:'var(--wf-ink-60)',cursor:'pointer'}}>+ чек ОФД</a>
                <div style={{flex:1}}/>
                <button style={{padding:'9px 20px',background:'var(--wf-accent)',color:'#fff',border:0,borderRadius:4,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:WF.sans}}>Опубликовать отзыв</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Карточки отзывов */}
      {reviewMode==='read' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
          {[
            ['Дмитрий К.','15.03.2026',5,'Проверенная покупка · М-Видео',['Очень тихий на ночном','Греет быстро, даже в −18 °C','Удобное приложение, когда работает'],['Wi-Fi раз в 2 недели отваливается','Цена кусается'],'Купил после того, как старый Samsung сдох на морозе. Casarte держит комнату 25 м² стабильно, ночью вообще не слышно — даже жена, которая в прошлой квартире жаловалась на фон, ничего не заметила. Минус один — приложение hOn периодически «забывает» устройство, приходится заново добавлять. Для премиум-модели странно.',24],
            ['Анастасия М.','02.03.2026',5,'Проверенная покупка · DNS',['Красивый дизайн','Реально экономит электричество','Гарантия 7 лет'],['Тяжёлый внешний блок — монтажники ругались'],'Стоит вторую зиму, счёт за электричество по сравнению с прошлым кондиционером упал примерно на 20%. Внешний блок очень тихий, соседи сверху не жалуются (а с предыдущим жаловались). Монтаж обошёлся в 18 000 ₽ — из-за веса и высоты этажа.',18],
            ['Игорь П.','28.02.2026',4,'Проверенная покупка · Ситилинк',['Приятная панель','Быстрый обогрев','Пульт в комплекте хороший'],['Нет русификации на пульте','Приток воздуха без подогрева — слабый плюс'],'В целом доволен, но за эти деньги ожидал больше «фишек» из коробки. Русификации пульта нет, это странно для модели за 155 тысяч. Приток свежего воздуха заявлен, но холодный — зимой им не воспользуешься.',11],
            ['Сергей В.','19.02.2026',5,'Проверенная покупка · Эльдорадо',['7 лет гарантии','Panasonic inverter — слышно, что честный','Тихо, красиво, работает'],['Цена'],'Второй Casarte в семье — первый стоит у родителей уже 3 года, ни одного вопроса. Поэтому когда менял сплит в новой квартире, даже не рассматривал альтернативы. За качество нужно платить, 155 000 — это честная цена.',9],
          ].map(([name,date,stars,verified,pros,cons,body,helpful],i)=>(
            <div key={i} style={{padding:'22px 24px',border:'1px solid var(--wf-border-subtle)',borderRadius:6,background:'var(--wf-paper)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10,gap:12}}>
                <div>
                  <T size={13} weight={600}>{name}</T>
                  <T size={10} color="var(--wf-ink-40)" style={{marginTop:3,fontFamily:WF.mono}}>{date} · {verified}</T>
                </div>
                <div style={{display:'flex',gap:2}}>
                  {[1,2,3,4,5].map(s=>(
                    <svg key={s} width="13" height="13" viewBox="0 0 20 20" fill={s<=stars?'var(--wf-accent)':'var(--wf-border)'}><path d="M10 1 L12.5 7 L19 7.5 L14 12 L15.5 18.5 L10 15 L4.5 18.5 L6 12 L1 7.5 L7.5 7 Z"/></svg>
                  ))}
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14,marginTop:14}}>
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                    <span style={{width:5,height:5,borderRadius:'50%',background:'#1f8f4c'}}/>
                    <T size={10} color="#1f8f4c" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1,fontWeight:600}}>Плюсы</T>
                  </div>
                  {pros.map((p,j)=><T key={j} size={11} style={{lineHeight:1.45,marginTop:j?4:0}}>· {p}</T>)}
                </div>
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                    <span style={{width:5,height:5,borderRadius:'50%',background:'#b24a3b'}}/>
                    <T size={10} color="#b24a3b" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1,fontWeight:600}}>Минусы</T>
                  </div>
                  {cons.map((p,j)=><T key={j} size={11} style={{lineHeight:1.45,marginTop:j?4:0}}>· {p}</T>)}
                </div>
              </div>
              <T size={12} color="var(--wf-ink)" style={{lineHeight:1.6,marginBottom:14}}>{body}</T>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:12,borderTop:'1px solid var(--wf-border-subtle)'}}>
                <a style={{fontSize:11,color:'var(--wf-ink-60)',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:6}}>
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 8 V17 H3 V8 Z M6 8 L10 2 Q12 1 12 4 L11 8 H16 Q18 8 17.5 10 L16 16 Q15.5 17 14 17 H6"/></svg>
                  Полезно · {helpful}
                </a>
                <a style={{fontSize:11,color:'var(--wf-ink-40)',cursor:'pointer'}}>Пожаловаться</a>
              </div>
            </div>
          ))}
        </div>
      )}
      {reviewMode==='read' && (
        <div style={{marginTop:24,display:'flex',justifyContent:'center'}}>
          <T size={12} color="var(--wf-ink-60)" style={{cursor:'pointer',borderBottom:'1px solid var(--wf-ink-40)',padding:'4px 0'}}>Показать ещё 43 отзыва →</T>
        </div>
      )}
    </div>

    {/* RELATED / COMPARE */}
    <div style={{padding:'36px 40px 48px',borderTop:'1px solid var(--wf-border-subtle)',background:'var(--wf-alt)'}}>
      <Eyebrow>Сравнить с конкурентами</Eyebrow>
      <H size={24} serif style={{marginTop:6,marginBottom:20,letterSpacing:-0.3}}>Что ещё смотрят рядом с CAS35CU1YDW</H>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
        {[
          [2,'FUNAI','RAC-1E1020 INDIVIO',77.5,'117 000 ₽'],
          [3,'T-MACON','T-MACON-18',76.0,'54 700 ₽'],
          [4,'LG','LH187V8KS',76.0,'99 000 ₽'],
          [7,'Mitsubishi Heavy','SRK35ZS-W',71.4,'81 000 ₽'],
        ].map(([rk,brand,model,idx,price])=>(
          <div key={model} style={{padding:'18px 18px',background:'var(--wf-paper)',borderRadius:6,border:'1px solid var(--wf-border-subtle)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:10}}>
              <span style={{fontFamily:WF.mono,fontSize:11,color:'var(--wf-ink-40)'}}>№ {rk}</span>
              <span style={{fontFamily:WF.serif,fontSize:18,fontWeight:600,color:'var(--wf-accent)',letterSpacing:-0.2}}>{idx}</span>
            </div>
            <div style={{height:24,display:'flex',alignItems:'center',marginBottom:6}}><BrandLogo name={brand.toUpperCase()}/></div>
            <T size={12} color="var(--wf-ink-60)">{model}</T>
            <Box w="100%" h={92} striped radius={4} label="фото" style={{marginTop:12}}/>
            <div style={{marginTop:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:13,fontWeight:500}}>{price}</span>
              <T size={11} color="var(--wf-accent)" weight={500}>Сравнить →</T>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>;
}

function DetailB(){ // sticky sidebar w/ quick facts
  return <div style={{display:'grid',gridTemplateColumns:'1fr 280px'}}>
    <div style={{padding:'24px 32px',borderRight:'1px solid var(--wf-border-subtle)'}}>
      <Eyebrow>Casarte · модель 2025</Eyebrow>
      <H size={30} style={{marginTop:6}}>CAS35CU1YDW</H>
      <div style={{display:'flex',gap:6,marginTop:10}}><Pill tone="accent">№ 1 в рейтинге</Pill><Pill>78.8</Pill><Pill>24 дБ</Pill></div>
      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:12,marginTop:20}}>
        <Box w="100%" h={220} striped radius={4} label="фронт"/>
        <div style={{display:'grid',gridTemplateRows:'1fr 1fr',gap:12}}><Box w="100%" h="100%" striped radius={4} label="пульт"/><Box w="100%" h="100%" striped radius={4} label="внутр.блок"/></div>
      </div>
      <H size={20} style={{marginTop:28,marginBottom:12}}>Технические характеристики</H>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',border:'1px solid var(--wf-border-subtle)',borderRadius:4}}>
        {[['Мощность охлаждения','3.5 кВт'],['Мощность обогрева','3.8 кВт'],['Энергокласс (охл)','A+++'],['SEER','6.5'],['Шум внутр. блока','24 дБ'],['Шум внешн.','48 дБ'],['Хладагент','R32'],['Гарантия','7 лет'],['Рабочий диап. (охл)','–5…+50°C'],['Рабочий диап. (тепло)','–25…+24°C'],['Wi-Fi','есть'],['Инвертор','DC'],].map(([k,v],i)=>
          <div key={k} style={{padding:'10px 12px',borderBottom:i<10?'1px solid var(--wf-border-subtle)':'none',borderRight:i%2===0?'1px solid var(--wf-border-subtle)':'none',display:'flex',justifyContent:'space-between'}}>
            <T size={11} color="var(--wf-ink-60)">{k}</T><T size={11} weight={500}>{v}</T>
          </div>
        )}
      </div>
    </div>
    <div style={{padding:'24px 22px',background:'var(--wf-alt)',position:'sticky',top:0,height:'100%'}}>
      <Box w="100%" h={140} striped radius={4} label="фото"/>
      <div style={{display:'flex',alignItems:'center',gap:10,marginTop:16}}>
        <Donut value={78.8} size={56} stroke={6}/>
        <div><T size={10} color="var(--wf-ink-40)">Индекс 2026</T><H size={16}>№ 1 из 87</H></div>
      </div>
      <div style={{padding:'14px 0',borderTop:'1px solid var(--wf-border-subtle)',marginTop:16}}>
        <T size={10} color="var(--wf-ink-40)">Средняя цена</T>
        <H size={22} style={{marginTop:2}}>155 000 ₽</H>
        <T size={11} color="var(--wf-ink-60)" style={{marginTop:4}}>8 магазинов · 149–162 тыс.</T>
      </div>
      <Btn primary w="100%" style={{marginTop:10}}>Где купить →</Btn>
      <Btn ghost w="100%" style={{marginTop:8}}>Добавить в сравнение</Btn>
      <Btn ghost w="100%" style={{marginTop:8}}>Рассчитать смету</Btn>
      <div style={{marginTop:20,paddingTop:16,borderTop:'1px solid var(--wf-border-subtle)'}}>
        <Eyebrow>Похожие</Eyebrow>
        {['FUNAI RAC-1E1020','T-MACON T-18','LG LH187V8KS'].map(m=><div key={m} style={{padding:'8px 0',borderBottom:'1px solid var(--wf-border-subtle)',display:'flex',justifyContent:'space-between',alignItems:'center'}}><T size={11}>{m}</T><Icon d={ICONS.chevronR} size={10} color="var(--wf-ink-40)"/></div>)}
      </div>
    </div>
  </div>;
}

function DetailC(){ // comparison-first
  const rows = [
    ['Индекс','78.8','77.5','76.0'],
    ['Шум внутр','24 дБ','26 дБ','27 дБ'],
    ['SEER','6.5','6.2','6.1'],
    ['Мощность','3.5 кВт','3.5 кВт','3.2 кВт'],
    ['Зимний пакет','да','да','нет'],
    ['Wi-Fi','есть','есть','есть'],
    ['Гарантия','7 лет','5 лет','7 лет'],
    ['Цена','155 000 ₽','117 000 ₽','99 000 ₽'],
  ];
  return <div style={{padding:'24px 32px'}}>
    <Eyebrow>Сравнение моделей</Eyebrow>
    <H size={26} style={{marginTop:6}}>CAS35CU1YDW vs 2 аналога</H>
    <div style={{display:'grid',gridTemplateColumns:'180px 1fr 1fr 1fr',marginTop:20,border:'1px solid var(--wf-border-subtle)',borderRadius:6,overflow:'hidden'}}>
      <div style={{background:'var(--wf-alt)',padding:18,borderRight:'1px solid var(--wf-border-subtle)',display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
        <Eyebrow>Параметр</Eyebrow>
      </div>
      {[['C','CASARTE','CAS35CU1YDW',true],['F','FUNAI','RAC-1E1020',false],['L','LG','LH187V8KS',false]].map(([l,b,m,hero])=>
        <div key={m} style={{padding:18,borderRight:'1px solid var(--wf-border-subtle)',background:hero?'var(--wf-accent-bg)':'transparent',position:'relative'}}>
          {hero && <Pill tone="accent" style={{position:'absolute',top:10,right:10,fontSize:9}}>Эта модель</Pill>}
          <LogoBox size={28} letter={l}/>
          <T size={10} color="var(--wf-ink-60)" style={{marginTop:8}}>{b}</T>
          <T size={14} weight={600} style={{marginTop:2}}>{m}</T>
          <Box w="100%" h={72} striped radius={3} style={{marginTop:10}} label="фото"/>
        </div>
      )}
      {rows.map(([k,a,b,c],i)=>
        <React.Fragment key={k}>
          <div style={{padding:'12px 18px',borderTop:'1px solid var(--wf-border-subtle)',borderRight:'1px solid var(--wf-border-subtle)',background:'var(--wf-alt)'}}><T size={11} color="var(--wf-ink-60)">{k}</T></div>
          {[a,b,c].map((v,j)=><div key={j} style={{padding:'12px 18px',borderTop:'1px solid var(--wf-border-subtle)',borderRight:j<2?'1px solid var(--wf-border-subtle)':'none',background:j===0?'var(--wf-accent-bg)':'transparent'}}><T size={12} weight={k==='Индекс'||k==='Цена'?600:500}>{v}</T></div>)}
        </React.Fragment>
      )}
    </div>
    <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}><Btn ghost>Добавить ещё модель</Btn><Btn primary>Открыть детали CAS35</Btn></div>
  </div>;
}

function DetailD(){ // tabs-heavy, sticky header
  return <div>
    <div style={{position:'sticky',top:0,background:'var(--wf-paper)',borderBottom:'1px solid var(--wf-border-subtle)',padding:'12px 24px',display:'flex',alignItems:'center',gap:14,zIndex:2}}>
      <LogoBox size={32} letter="C"/>
      <div style={{flex:1}}>
        <T size={10} color="var(--wf-ink-40)">CASARTE</T>
        <T size={14} weight={600}>CAS35CU1YDW</T>
      </div>
      <Donut value={78.8} size={40} stroke={5}/>
      <T size={11} color="var(--wf-ink-60)">155 000 ₽</T>
      <Btn size="sm" primary>Где купить</Btn>
    </div>
    <div style={{display:'flex',padding:'0 24px',gap:20,borderBottom:'1px solid var(--wf-border-subtle)'}}>
      {['Обзор','Характеристики','Оценки','Шум','Цены (8)','Отзывы (47)','Монтаж'].map((t,i)=>
        <T key={t} size={11} weight={i===3?600:500} color={i===3?'var(--wf-ink)':'var(--wf-ink-60)'} style={{padding:'12px 0',borderBottom:i===3?'2px solid var(--wf-accent)':'none',marginBottom:-1}}>{t}</T>
      )}
    </div>
    <div style={{padding:'24px'}}>
      <H size={20}>Акустические измерения</H>
      <T size={12} color="var(--wf-ink-60)" style={{marginTop:6,maxWidth:520}}>Замеры проведены 4 раза: в камере 1.5×1.5м и в офисе с фоновым шумом 32 дБ.</T>
      <div style={{marginTop:18,padding:18,border:'1px solid var(--wf-border-subtle)',borderRadius:6}}>
        <Eyebrow>Шум внутреннего блока · дБ</Eyebrow>
        <svg viewBox="0 0 700 200" style={{width:'100%',height:200,marginTop:12}}>
          {[0,1,2,3,4].map(i=><line key={i} x1={0} x2={700} y1={40*i+10} y2={40*i+10} stroke="currentColor" strokeOpacity="0.08"/>)}
          {['Тихий','Нижн','Средн','Высок','Турбо'].map((m,i)=>{
            const vals=[22,24,30,38,45];
            const h=vals[i]*3;
            return <g key={m}>
              <rect x={60+i*130} y={200-h} width={80} height={h} fill="var(--wf-accent,#2856cc)" opacity={i===1?1:0.6}/>
              <text x={100+i*130} y={200-h-8} fontSize="14" fontWeight="600" fill="var(--wf-ink,#141414)" textAnchor="middle">{vals[i]}</text>
              <text x={100+i*130} y={196} fontSize="11" fill="var(--wf-ink-60,rgba(20,20,20,0.6))" textAnchor="middle">{m}</text>
            </g>;
          })}
        </svg>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14,marginTop:16}}>
        {[['24 дБ','минимум'],['32 дБ','средний режим'],['48 дБ','внешний блок']].map(([n,l])=><div key={l} style={{padding:14,border:'1px solid var(--wf-border-subtle)',borderRadius:4}}><H size={20}>{n}</H><T size={10} color="var(--wf-ink-40)" style={{marginTop:4}}>{l}</T></div>)}
      </div>
    </div>
  </div>;
}

// ───────── News listing/detail × 2 each ─────────
function NewsListA(){
  const items = [
    ['04.04.2026','Haier объявила об IPO азиатского подразделения','Деловые','hero'],
    ['03.04.2026','Midea представит три новые линейки на Хайсе-2026','Индустрия'],
    ['02.04.2026','Росстат: продажи кондиционеров в РФ −12% YoY','Рынок'],
    ['31.03.2026','Ассоциация АПИК: новые требования к монтажу','Регулирование'],
    ['29.03.2026','Обзор: 5 моделей с зимним пакетом до 70 тысяч','Обзор'],
    ['27.03.2026','Как выбрать кондиционер для серверной: 3 критерия','Гайд'],
  ];
  return <div style={{padding:'28px 40px'}}>
    <Eyebrow>Новости отрасли</Eyebrow>
    <H size={30} serif style={{marginTop:6,marginBottom:22}}>Сегодня, 04 апреля 2026</H>
    <div style={{display:'grid',gridTemplateColumns:'1.5fr 1fr',gap:32,paddingBottom:28,borderBottom:'1px solid var(--wf-border-subtle)'}}>
      <div>
        <Box w="100%" h={240} striped radius={4} label="hero image · HAIER на IPO"/>
        <Pill tone="accent" style={{marginTop:16}}>Деловые · 04.04.2026</Pill>
        <H size={26} serif style={{marginTop:10}}>Haier объявила об IPO азиатского подразделения — что это значит для российских покупателей</H>
        <T size={13} color="var(--wf-ink-60)" style={{marginTop:10,maxWidth:520}}>Крупнейший китайский производитель бытовой техники, владелец бренда Casarte, может выйти на биржу до конца года. Эксперты обсуждают возможные последствия.</T>
      </div>
      <div>
        <Eyebrow>Рядом</Eyebrow>
        {items.slice(1,4).map(([d,t,c])=><div key={t} style={{padding:'14px 0',borderBottom:'1px solid var(--wf-border-subtle)'}}>
          <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono}}>{d} · {c}</T>
          <T size={14} weight={500} style={{marginTop:6,lineHeight:1.35}}>{t}</T>
        </div>)}
      </div>
    </div>
    <H size={18} style={{marginTop:28,marginBottom:14}}>Ещё</H>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:18}}>
      {items.slice(3).map(([d,t,c])=><div key={t} style={{border:'1px solid var(--wf-border-subtle)',borderRadius:4,padding:16}}>
        <Box w="100%" h={110} striped radius={3}/>
        <T size={10} color="var(--wf-ink-40)" style={{marginTop:10,fontFamily:WF.mono}}>{d} · {c}</T>
        <T size={13} weight={500} style={{marginTop:6,lineHeight:1.3}}>{t}</T>
      </div>)}
    </div>
  </div>;
}

function NewsDetailA(){
  return <div style={{padding:'20px 40px 28px',maxWidth:760,margin:'0 auto'}}>
    {/* Breadcrumbs + back */}
    <div style={{display:'flex',alignItems:'center',gap:8,paddingBottom:18,borderBottom:'1px solid var(--wf-border-subtle)'}}>
      <T size={11} color="var(--wf-accent)" style={{fontFamily:WF.mono,letterSpacing:0.5,cursor:'pointer'}}>← Все новости</T>
      <T size={11} color="var(--wf-ink-25)">·</T>
      <T size={11} color="var(--wf-ink-40)" style={{fontFamily:WF.mono}}>Главная</T>
      <T size={11} color="var(--wf-ink-25)">/</T>
      <T size={11} color="var(--wf-accent)" style={{fontFamily:WF.mono,cursor:'pointer'}}>Новости</T>
      <T size={11} color="var(--wf-ink-25)">/</T>
      <T size={11} color="var(--wf-ink-60)" style={{fontFamily:WF.mono}}>Деловые</T>
    </div>
    <div style={{marginTop:24}}>
      <Eyebrow>Деловые · 04.04.2026 · 6 мин чтения</Eyebrow>
    </div>
    <H size={40} serif style={{marginTop:14,letterSpacing:-0.8}}>Haier объявила об IPO азиатского подразделения — что это значит для российских покупателей</H>
    <T size={15} color="var(--wf-ink-60)" style={{marginTop:16,lineHeight:1.55,fontFamily:WF.serif}}>Крупнейший китайский производитель бытовой техники, владелец бренда Casarte, может выйти на биржу до конца года.</T>
    <div style={{display:'flex',alignItems:'center',gap:10,marginTop:18,paddingTop:18,borderTop:'1px solid var(--wf-border-subtle)',borderBottom:'1px solid var(--wf-border-subtle)',paddingBottom:12}}>
      <Box w={28} h={28} radius={999} bg="var(--wf-chip)"/>
      <T size={11} weight={600}>Евгений Лаврентьев</T>
      <T size={10} color="var(--wf-ink-40)">Редактор отраслевой ленты</T>
      <div style={{flex:1}}/>
      <Pill>Поделиться</Pill><Pill>Сохранить</Pill>
    </div>
    <Box w="100%" h={340} striped radius={4} style={{marginTop:24}} label="hero image"/>
    <T size={10} color="var(--wf-ink-40)" style={{marginTop:6,fontStyle:'italic'}}>Фото: пресс-служба Haier</T>
    <TextLines count={6} h={6} gap={8} widths={[98,95,92,97,94,60]} style={{marginTop:24}}/>
    <H size={22} serif style={{marginTop:28,marginBottom:10}}>Что будет с ценами</H>
    <TextLines count={4} h={6} gap={8} widths={[97,94,98,70]}/>
    <div style={{margin:'28px 0',padding:'20px 24px',borderLeft:'3px solid var(--wf-accent)',background:'var(--wf-alt)'}}>
      <T size={15} color="var(--wf-ink-80)" lh={1.6} style={{fontFamily:WF.serif,fontStyle:'italic'}}>«На российский рынок напрямую выход сделки не повлияет, но косвенно может ускорить локализацию премиальных моделей.»</T>
      <T size={11} color="var(--wf-ink-60)" style={{marginTop:10}}>— Сергей П., представитель АПИК</T>
    </div>
    <TextLines count={5} h={6} gap={8} widths={[96,98,93,95,54]}/>
    <div style={{marginTop:28,padding:18,border:'1px solid var(--wf-border-subtle)',borderRadius:6,display:'flex',gap:14,alignItems:'center'}}>
      <Box w={80} h={80} striped radius={3}/>
      <div><T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono}}>Упомянутая модель</T><T size={14} weight={600} style={{marginTop:4}}>CASARTE CAS35CU1YDW</T><T size={11} color="var(--wf-ink-60)" style={{marginTop:4}}>Индекс 78.8 · 155 000 ₽</T></div>
      <div style={{flex:1}}/><Btn ghost size="sm">Открыть →</Btn>
    </div>

    {/* Навигация по ленте */}
    <div style={{marginTop:32,paddingTop:22,borderTop:'1px solid var(--wf-ink-15)',display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
      <div style={{padding:'14px 16px',border:'1px solid var(--wf-border-subtle)',borderRadius:4,cursor:'pointer'}}>
        <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2}}>← Предыдущая</T>
        <T size={13} weight={500} style={{marginTop:6,lineHeight:1.35}}>Итоги акустических замеров: пять моделей получили обновлённые индексы</T>
      </div>
      <div style={{padding:'14px 16px',border:'1px solid var(--wf-border-subtle)',borderRadius:4,cursor:'pointer',textAlign:'right'}}>
        <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2}}>Следующая →</T>
        <T size={13} weight={500} style={{marginTop:6,lineHeight:1.35}}>Gree представила инверторную серию с компрессором EVI — ждём на полках к маю</T>
      </div>
    </div>

    {/* Финальная ссылка на ленту */}
    <div style={{marginTop:22,display:'flex',justifyContent:'center'}}>
      <Btn ghost size="md" style={{padding:'10px 20px'}}>← Вернуться ко всем новостям</Btn>
    </div>
  </div>;
}

// ───────── Mobile News ─────────
function MobileNewsList(){
  const items = [
    ['03.04.2026','Midea представит три новые линейки на Хайсе-2026','Индустрия'],
    ['02.04.2026','Росстат: продажи кондиционеров в РФ −12% YoY','Рынок'],
    ['31.03.2026','Ассоциация АПИК: новые требования к монтажу','Регулирование'],
    ['29.03.2026','Обзор: 5 моделей с зимним пакетом до 70 тысяч','Обзор'],
    ['27.03.2026','Как выбрать кондиционер для серверной: 3 критерия','Гайд'],
    ['25.03.2026','Toshiba продлила гарантию до 5 лет на всю линейку','Бренды'],
  ];
  return <div style={{background:'var(--wf-paper)',minHeight:'100%'}}>
    {/* Mobile header reuse */}
    <NavMobileHeader/>
    {/* Page title */}
    <div style={{padding:'20px 18px 14px'}}>
      <Eyebrow>Новости отрасли</Eyebrow>
      <H size={24} serif style={{marginTop:6,letterSpacing:-0.4}}>Сегодня, 04 апр. 2026</H>
    </div>

    {/* Horizontal filter chips */}
    <div style={{padding:'0 18px 14px',display:'flex',gap:6,overflowX:'auto',whiteSpace:'nowrap'}}>
      <Pill active>Все</Pill>
      <Pill>Деловые</Pill>
      <Pill>Индустрия</Pill>
      <Pill>Рынок</Pill>
      <Pill>Обзор</Pill>
      <Pill>Гайд</Pill>
    </div>

    {/* HERO */}
    <div style={{padding:'0 18px 18px',borderBottom:'1px solid var(--wf-border-subtle)'}}>
      <Box w="100%" h={200} striped radius={4} label="hero · HAIER на IPO"/>
      <Pill tone="accent" style={{marginTop:14}}>Деловые · 04.04.2026</Pill>
      <H size={20} serif style={{marginTop:10,letterSpacing:-0.3,lineHeight:1.2}}>Haier объявила об IPO азиатского подразделения — что это значит для российских покупателей</H>
      <T size={12} color="var(--wf-ink-60)" lh={1.55} style={{marginTop:8}}>Крупнейший китайский производитель бытовой техники, владелец бренда Casarte, может выйти на биржу до конца года.</T>
      <T size={10} color="var(--wf-ink-40)" style={{marginTop:10,fontFamily:WF.mono}}>6 мин чтения · Евг. Лаврентьев</T>
    </div>

    {/* Feed — compact list with thumb */}
    <div style={{padding:'6px 18px 20px'}}>
      {items.map(([d,t,c],i)=>
        <div key={i} style={{display:'flex',gap:12,padding:'16px 0',borderBottom:i<items.length-1?'1px solid var(--wf-border-subtle)':0}}>
          <Box w={72} h={72} striped radius={3} style={{flexShrink:0}}/>
          <div style={{flex:1,minWidth:0}}>
            <T size={9} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,letterSpacing:0.8}}>{d} · {c.toUpperCase()}</T>
            <T size={13} weight={500} lh={1.35} style={{marginTop:5}}>{t}</T>
          </div>
        </div>
      )}
    </div>

    {/* Load more */}
    <div style={{padding:'0 18px 24px',display:'flex',justifyContent:'center'}}>
      <Btn ghost size="md" style={{padding:'10px 18px'}}>Показать ещё</Btn>
    </div>
  </div>;
}

function MobileNewsDetail(){
  return <div style={{background:'var(--wf-paper)',minHeight:'100%'}}>
    <NavMobileHeader/>
    {/* Back + breadcrumbs */}
    <div style={{padding:'14px 18px 10px',borderBottom:'1px solid var(--wf-border-subtle)',display:'flex',alignItems:'center',gap:10}}>
      <T size={11} color="var(--wf-accent)" style={{fontFamily:WF.mono,letterSpacing:0.5,cursor:'pointer'}}>← Все новости</T>
      <div style={{flex:1}}/>
      <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono}}>Деловые</T>
    </div>

    {/* Article body */}
    <div style={{padding:'20px 18px 0'}}>
      <Eyebrow>Деловые · 04.04.2026 · 6 мин</Eyebrow>
      <H size={26} serif style={{marginTop:10,letterSpacing:-0.5,lineHeight:1.15}}>Haier объявила об IPO азиатского подразделения — что это значит для российских покупателей</H>
      <T size={14} color="var(--wf-ink-60)" lh={1.5} style={{marginTop:12,fontFamily:WF.serif}}>Крупнейший китайский производитель бытовой техники, владелец бренда Casarte, может выйти на биржу до конца года.</T>

      {/* byline */}
      <div style={{display:'flex',alignItems:'center',gap:10,marginTop:16,paddingTop:14,borderTop:'1px solid var(--wf-border-subtle)',paddingBottom:12,borderBottom:'1px solid var(--wf-border-subtle)'}}>
        <Box w={28} h={28} radius={999} bg="var(--wf-chip)"/>
        <div style={{flex:1,minWidth:0}}>
          <T size={11} weight={600}>Евгений Лаврентьев</T>
          <T size={9} color="var(--wf-ink-40)">Редактор отраслевой ленты</T>
        </div>
        <Pill>↗</Pill>
      </div>

      {/* hero image */}
      <Box w="100%" h={200} striped radius={4} style={{marginTop:20}} label="hero image"/>
      <T size={10} color="var(--wf-ink-40)" style={{marginTop:6,fontStyle:'italic'}}>Фото: пресс-служба Haier</T>

      {/* body */}
      <TextLines count={5} h={6} gap={8} widths={[98,95,92,97,60]} style={{marginTop:20}}/>
      <H size={18} serif style={{marginTop:22,marginBottom:10,letterSpacing:-0.3}}>Что будет с ценами</H>
      <TextLines count={4} h={6} gap={8} widths={[97,94,98,70]}/>

      {/* pull quote */}
      <div style={{margin:'22px 0',padding:'16px 18px',borderLeft:'3px solid var(--wf-accent)',background:'var(--wf-alt)'}}>
        <T size={13} color="var(--wf-ink-80)" lh={1.6} style={{fontFamily:WF.serif,fontStyle:'italic'}}>«На российский рынок напрямую выход сделки не повлияет, но косвенно может ускорить локализацию премиальных моделей.»</T>
        <T size={10} color="var(--wf-ink-60)" style={{marginTop:8}}>— Сергей П., представитель АПИК</T>
      </div>
      <TextLines count={4} h={6} gap={8} widths={[96,93,95,54]}/>

      {/* related model */}
      <div style={{marginTop:22,padding:14,border:'1px solid var(--wf-border-subtle)',borderRadius:4,display:'flex',gap:12,alignItems:'center'}}>
        <Box w={60} h={60} striped radius={3}/>
        <div style={{flex:1,minWidth:0}}>
          <T size={9} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,letterSpacing:0.8}}>УПОМЯНУТАЯ МОДЕЛЬ</T>
          <T size={12} weight={600} style={{marginTop:3}}>CASARTE CAS35CU1YDW</T>
          <T size={10} color="var(--wf-ink-60)" style={{marginTop:2}}>Индекс 78.8 · 155 000 ₽</T>
        </div>
        <T size={12} color="var(--wf-accent)">→</T>
      </div>
    </div>

    {/* Prev/Next */}
    <div style={{marginTop:24,padding:'18px 18px 0',borderTop:'1px solid var(--wf-ink-15)',display:'flex',flexDirection:'column',gap:10}}>
      <div style={{padding:'12px 14px',border:'1px solid var(--wf-border-subtle)',borderRadius:4}}>
        <T size={9} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,letterSpacing:0.8}}>← ПРЕДЫДУЩАЯ</T>
        <T size={12} weight={500} lh={1.35} style={{marginTop:5}}>Итоги акустических замеров: пять моделей получили обновлённые индексы</T>
      </div>
      <div style={{padding:'12px 14px',border:'1px solid var(--wf-border-subtle)',borderRadius:4}}>
        <T size={9} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,letterSpacing:0.8}}>СЛЕДУЮЩАЯ →</T>
        <T size={12} weight={500} lh={1.35} style={{marginTop:5}}>Gree представила инверторную серию с компрессором EVI — ждём на полках к маю</T>
      </div>
    </div>

    {/* All news CTA */}
    <div style={{padding:'22px 18px 28px',display:'flex',justifyContent:'center'}}>
      <Btn ghost size="md" style={{padding:'10px 18px'}}>← Ко всем новостям</Btn>
    </div>
  </div>;
}

// ───────── Cards family ─────────
function CardFamily(){
  return <div style={{padding:'24px',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:18}}>
    <Card variant="model"/>
    <Card variant="news"/>
    <Card variant="installer"/>
    <Card variant="smeta"/>
    <Card variant="article"/>
    <Card variant="brand"/>
  </div>;
}
function Card({variant}){
  const base={border:'1px solid var(--wf-border-subtle)',borderRadius:6,padding:16,background:'var(--wf-paper)',display:'flex',flexDirection:'column',gap:10};
  if(variant==='model') return <div style={base}>
    <div style={{display:'flex',justifyContent:'space-between'}}><Pill tone="accent" style={{fontSize:9}}>MODEL</Pill><Donut value={78.8} size={40} stroke={5}/></div>
    <Box w="100%" h={100} striped radius={3} label="фото"/>
    <div><T size={10} color="var(--wf-ink-40)">CASARTE</T><T size={14} weight={600}>CAS35CU1YDW</T></div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:10,borderTop:'1px solid var(--wf-border-subtle)'}}><T size={13} weight={600}>155 000 ₽</T><Icon d={ICONS.chevronR} size={12} color="var(--wf-ink-40)"/></div>
  </div>;
  if(variant==='news') return <div style={base}>
    <Pill style={{fontSize:9}}>NEWS</Pill>
    <Box w="100%" h={110} striped radius={3}/>
    <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono}}>04.04.2026 · Деловые</T>
    <T size={13} weight={500} lh={1.3}>Haier объявила об IPO азиатского подразделения</T>
  </div>;
  if(variant==='installer') return <div style={base}>
    <Pill style={{fontSize:9}}>МОНТАЖНИК</Pill>
    <div style={{display:'flex',gap:10,alignItems:'center'}}><Box w={42} h={42} radius={999} bg="var(--wf-chip)"/><div><T size={13} weight={600}>ООО Климат-Про</T><T size={10} color="var(--wf-ink-40)">Москва, ЮАО</T></div></div>
    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}><Pill>сертифицирован</Pill><Pill>4 бригады</Pill></div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:8,borderTop:'1px solid var(--wf-border-subtle)'}}>
      <RatingStars value={5}/><T size={11} color="var(--wf-ink-60)">47 отзывов</T>
    </div>
  </div>;
  if(variant==='smeta') return <div style={base}>
    <Pill style={{fontSize:9}} tone="accent">СМЕТА</Pill>
    <T size={11} color="var(--wf-ink-40)">№ 1892 · 04.04.2026</T>
    <T size={13} weight={500}>2-к квартира, 54 м² · Москва</T>
    <TextLines count={2} h={6} gap={4} widths={[90,70]}/>
    <div style={{display:'flex',justifyContent:'space-between',paddingTop:8,borderTop:'1px solid var(--wf-border-subtle)'}}><T size={10} color="var(--wf-ink-40)">Стоимость</T><T size={13} weight={600}>87 400 ₽</T></div>
  </div>;
  if(variant==='article') return <div style={base}>
    <Pill style={{fontSize:9}}>ГАЙД</Pill>
    <H size={16} serif>Как выбрать кондиционер для серверной</H>
    <TextLines count={3} h={5} gap={4} widths={[96,94,62]}/>
    <T size={10} color="var(--wf-ink-40)" style={{marginTop:2}}>8 мин · Техника</T>
  </div>;
  return <div style={base}>
    <Pill style={{fontSize:9}}>БРЕНД</Pill>
    <Box w={56} h={56} radius={8} bg="var(--wf-chip)" style={{alignSelf:'flex-start'}}><T size={22} weight={700} color="var(--wf-ink-60)">C</T></Box>
    <T size={15} weight={600}>Casarte</T>
    <T size={11} color="var(--wf-ink-60)">7 моделей · средний индекс 74.2</T>
    <Meter value={74}/>
  </div>;
}

// ───────── Index viz (5) ─────────
function IndexViz(){
  return <div style={{padding:24,display:'grid',gridTemplateColumns:'1fr 1fr',gap:22}}>
    <IndexBig/><IndexSpec/><IndexRadar/><IndexScatter/>
    <div style={{gridColumn:'1/-1'}}><IndexTable/></div>
  </div>;
}
function IndexBig(){
  return <div style={{padding:18,border:'1px solid var(--wf-border-subtle)',borderRadius:6}}>
    <Eyebrow>Индекс Август-климат</Eyebrow>
    <div style={{display:'flex',alignItems:'center',gap:24,marginTop:14}}>
      <Donut value={78.8} size={130} stroke={14}/>
      <div>
        <H size={40}>78.8</H>
        <T size={11} color="var(--wf-ink-40)" style={{fontFamily:WF.mono}}>/ 100</T>
        <Pill tone="accent" style={{marginTop:8}}>№ 1 из 87</Pill>
      </div>
    </div>
    <T size={11} color="var(--wf-ink-60)" style={{marginTop:14}}>Выше на 1.3 пункта, чем №2 (FUNAI, 77.5). Разрыв — максимальный за 4 года измерений.</T>
  </div>;
}
function IndexSpec(){
  const groups = [['Энергоэфф.',92],['Теплообм.',88],['Акустика',85],['Электр.',79],['Зимний',82],['Wi-Fi',72],['Фильтр',70],['Надёжн.',76]];
  return <div style={{padding:18,border:'1px solid var(--wf-border-subtle)',borderRadius:6}}>
    <Eyebrow>Разложение по 11 группам</Eyebrow>
    <div style={{display:'flex',gap:4,alignItems:'flex-end',height:120,marginTop:14}}>
      {groups.map(([g,v])=><div key={g} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
        <T size={9} weight={600} color="var(--wf-accent)">{v}</T>
        <div style={{width:'100%',background:'var(--wf-accent)',height:v*1.1,opacity:v/100}}/>
        <T size={8} color="var(--wf-ink-40)" style={{transform:'rotate(-30deg) translate(-6px, 4px)',whiteSpace:'nowrap'}}>{g}</T>
      </div>)}
    </div>
  </div>;
}
function IndexRadar(){
  const vals=[92,88,85,79,82,72,70,76];
  const cx=110,cy=110,r=80;
  const pts=vals.map((v,i)=>{const a=(i/vals.length)*Math.PI*2-Math.PI/2;return [cx+Math.cos(a)*r*v/100,cy+Math.sin(a)*r*v/100]});
  return <div style={{padding:18,border:'1px solid var(--wf-border-subtle)',borderRadius:6}}>
    <Eyebrow>Радар профиля</Eyebrow>
    <svg width="100%" height={230} viewBox="0 0 220 220" style={{marginTop:8}}>
      {[25,50,75,100].map(p=><circle key={p} cx={cx} cy={cy} r={r*p/100} stroke="currentColor" strokeOpacity="0.1" fill="none"/>)}
      {Array.from({length:8}).map((_,i)=>{const a=(i/8)*Math.PI*2-Math.PI/2;return <line key={i} x1={cx} y1={cy} x2={cx+Math.cos(a)*r} y2={cy+Math.sin(a)*r} stroke="currentColor" strokeOpacity="0.1"/>})}
      <polygon points={pts.map(p=>p.join(',')).join(' ')} fill="var(--wf-accent)" fillOpacity="0.18" stroke="var(--wf-accent)" strokeWidth="1.5"/>
      {pts.map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r="3" fill="var(--wf-accent)"/>)}
    </svg>
  </div>;
}
function IndexScatter(){
  const dots=[[22000,71,'MDV'],[55000,76,'T-Macon'],[99000,76,'LG'],[117000,77.5,'Funai'],[81000,71,'Mitsubishi'],[155000,78.8,'Casarte'],[25000,69,'Haier'],[42000,74,'Midea'],[68000,73,'Gree']];
  return <div style={{padding:18,border:'1px solid var(--wf-border-subtle)',borderRadius:6}}>
    <Eyebrow>Индекс × цена</Eyebrow>
    <svg width="100%" height={200} viewBox="0 0 400 200" style={{marginTop:8}}>
      <line x1={40} y1={10} x2={40} y2={170} stroke="currentColor" strokeOpacity="0.2"/>
      <line x1={40} y1={170} x2={390} y2={170} stroke="currentColor" strokeOpacity="0.2"/>
      {dots.map(([p,idx,n],i)=>{
        const x=40+((p/160000)*340),y=170-((idx-65)/15)*150;
        return <g key={i}>
          <circle cx={x} cy={y} r={n==='Casarte'?8:5} fill="var(--wf-accent)" opacity={n==='Casarte'?1:0.35}/>
          {n==='Casarte'&&<text x={x+12} y={y+3} fontSize="10" fontWeight="600" fill="var(--wf-accent)">Casarte · 78.8</text>}
        </g>;
      })}
      <text x={40} y={188} fontSize="9" fill="currentColor" fillOpacity="0.5">0₽</text>
      <text x={370} y={188} fontSize="9" fill="currentColor" fillOpacity="0.5">160к₽</text>
      <text x={14} y={20} fontSize="9" fill="currentColor" fillOpacity="0.5">80</text>
      <text x={14} y={172} fontSize="9" fill="currentColor" fillOpacity="0.5">65</text>
    </svg>
  </div>;
}
function IndexTable(){
  return <div style={{padding:18,border:'1px solid var(--wf-border-subtle)',borderRadius:6}}>
    <Eyebrow>Расчёт индекса · CAS35CU1YDW</Eyebrow>
    <div style={{display:'grid',gridTemplateColumns:'2fr 80px 80px 80px 1fr',gap:8,marginTop:14,fontSize:10,color:'var(--wf-ink-40)',textTransform:'uppercase',letterSpacing:1,fontFamily:WF.mono,paddingBottom:8,borderBottom:'1px solid var(--wf-border-subtle)'}}>
      <div>Критерий</div><div>Вес</div><div>Оценка</div><div>Вклад</div><div>Детали</div>
    </div>
    {[['Шум (24 дБ)',12,95,11.4],['SEER (6.5)',15,92,13.8],['Мощность',10,85,8.5],['Зимний пакет',8,90,7.2],['Теплообменник',10,88,8.8],['Надёжность',8,76,6.1],['Wi-Fi / управление',6,72,4.3],['Гарантия (7 лет)',6,95,5.7]].map(([k,w,v,c])=>
      <div key={k} style={{display:'grid',gridTemplateColumns:'2fr 80px 80px 80px 1fr',gap:8,padding:'9px 0',borderBottom:'1px solid var(--wf-border-subtle)',alignItems:'center'}}>
        <T size={12}>{k}</T>
        <T size={11} color="var(--wf-ink-60)" style={{fontFamily:WF.mono}}>{w}%</T>
        <T size={11} weight={500}>{v}</T>
        <T size={11} weight={600} color="var(--wf-accent)" style={{fontFamily:WF.mono}}>+{c}</T>
        <Meter value={v} h={4}/>
      </div>
    )}
  </div>;
}

// ───────── Static pages ─────────
function Methodology(){
  // 30 критериев по реальной методике v1.0 (сумма весов = 100%)
  const CRITERIA = [
    ['Площадь труб теплообменника внутр. блока',10,'num','кв.м','Суммарная площадь медных труб теплообменника внутреннего блока. Чем больше площадь, тем эффективнее теплообмен между хладагентом и воздухом в помещении.','0.1 — 0.5, медиана 0.21'],
    ['Площадь труб теплообменника наруж. блока',10,'num','кв.м','Суммарная площадь медных труб теплообменника наружного блока. Больший теплообменник эффективнее отводит тепло на улицу.','0.15 — 1.2, медиана 0.31'],
    ['Мощность компрессора',10,'fallback','Вт','Оценивается отношение мощности компрессора к номинальной холодопроизводительности модели. Чем выше соотношение, тем лучше справляется с нагрузкой.','Расчёт по формуле'],
    ['Наличие ЭРВ',5,'bin',null,'Электронный расширительный вентиль (ЭРВ) обеспечивает точное дозирование хладагента в зависимости от текущей нагрузки.','Есть / Нет'],
    ['Регулировка оборотов вент. наруж. блока',5,'bin',null,'Возможность регулировки оборотов вентилятора наружного блока. Снижает шум на улице и позволяет работать при низких температурах.','Есть / Нет'],
    ['Инверторный компрессор',5,'bin',null,'Инверторная технология позволяет плавно регулировать мощность, снижая энергопотребление и шум.','Есть / Нет'],
    ['Работа на обогрев',5,'cat','°C','Минимальная температура наружного воздуха, при которой кондиционер работает в режиме обогрева. Чем ниже порог, тем дольше в году можно использовать.','Индивидуальная шкала'],
    ['Максимальная длина фреонопровода',4,'num','м','Максимально допустимая длина фреонопровода между внутренним и наружным блоками. Больше — свобода выбора места установки.','5 — 40, медиана 15'],
    ['Максимальный перепад высот',4,'num','м','Максимально допустимый перепад высот между внутренним и наружным блоками. Важен в многоэтажных зданиях.','3 — 15, медиана 5'],
    ['Гарантия',4,'num','лет','Срок гарантии производителя. Более длительная гарантия свидетельствует об уверенности в надёжности продукции.','1 — 7, медиана 3'],
    ['Кол-во скоростей вент. внутр. блока',3,'cat','шт.','Больше скоростей — точнее настройка баланса между интенсивностью обдува и уровнем шума.','Индивидуальная шкала'],
    ['Наличие ИК датчика присутствия',3,'cat',null,'Инфракрасный датчик присутствия человека. Позволяет автоматически регулировать мощность или направление потока.','Индивидуальная шкала'],
    ['Возраст бренда на рынке РФ',3,'age','год','Год начала продаж бренда в России. Более длительная история обычно означает лучшую сервисную сеть и доступность запчастей.','1995 — 2026, медиана 2010'],
    ['Энергоэффективность',3,'cat',null,'Класс энергоэффективности. Более высокий класс — меньшее потребление при равной холодопроизводительности.','Индивидуальная шкала'],
    ['Компрессор с технологией EVI',3,'bin',null,'EVI (Enhanced Vapor Injection) — технология повышения эффективности компрессора в мороз. Лучше работает на обогрев при низких температурах.','Есть / Нет'],
    ['Наличие обогрева поддона',2,'cat',null,'Обогрев поддона наружного блока предотвращает замерзание конденсата при обогреве зимой.','Индивидуальная шкала'],
    ['Ионизатор',2,'cat',null,'Тип ионизатора воздуха. Ионизация помогает очищать воздух от пыли, аллергенов и запахов.','Индивидуальная шкала'],
    ['Наличие подсветки экрана пульта',2,'bin',null,'Подсветка дисплея на пульте ДУ. Позволяет управлять в темноте.','Есть / Нет'],
    ['Русифицированный пульт ДУ',2,'cat',null,'Наличие русского языка на дисплее и кнопках пульта.','Индивидуальная шкала'],
    ['Приток свежего воздуха',2,'cat',null,'Функция вентиляции помещения без необходимости открывать окна.','Индивидуальная шкала'],
    ['Наличие WiFi',2,'cat',null,'Модуль Wi-Fi для удалённого управления через приложение.','Индивидуальная шкала'],
    ['Управление через Алису',2,'cat',null,'Совместимость с голосовым ассистентом «Алиса» от Яндекса.','Индивидуальная шкала'],
    ['Управление жалюзи в стороны с пульта',2,'bin',null,'Управление горизонтальными жалюзи (вправо-влево) с пульта ДУ.','Есть / Нет'],
    ['Кол-во фильтров тонкой очистки',1,'cat','шт.','Дополнительные фильтры улавливают мелкие частицы пыли, бактерии и аллергены.','Индивидуальная шкала'],
    ['Держатель пульта ДУ',1,'bin',null,'Настенный держатель для пульта в комплекте.','Есть / Нет'],
    ['УФ лампа',1,'cat',null,'Ультрафиолетовая лампа для обеззараживания воздуха и теплообменника.','Индивидуальная шкала'],
    ['Самоочистка замораживанием',1,'bin',null,'Конденсат замораживается и оттаивает, смывая пыль с теплообменника.','Есть / Нет'],
    ['Температурная стерилизация',1,'bin',null,'Высокотемпературный нагрев уничтожает бактерии и плесень внутри.','Есть / Нет'],
    ['Дежурный обогрев +8 °C',1,'bin',null,'Поддержание минимальной температуры в отсутствие людей.','Есть / Нет'],
    ['Ароматизатор воздуха',1,'bin',null,'Встроенный ароматизатор для наполнения помещения запахом.','Есть / Нет'],
  ];
  const TYPE_META = {
    num:      {label:'Числовой',          dot:'var(--wf-accent)',        bg:'var(--wf-accent-bg)'},
    bin:      {label:'Бинарный',          dot:'var(--wf-ink-60)',        bg:'var(--wf-chip)'},
    cat:      {label:'Категориальный',    dot:'#c87510',                 bg:'rgba(200,117,16,0.10)'},
    fallback: {label:'С fallback',        dot:'#2f8046',                 bg:'rgba(47,128,70,0.10)'},
    age:      {label:'Возраст бренда',    dot:'#8a3ea8',                 bg:'rgba(138,62,168,0.10)'},
  };
  const SUM = CRITERIA.reduce((a,c)=>a+c[1],0);
  const counts = CRITERIA.reduce((a,c)=>{a[c[2]]=(a[c[2]]||0)+1;return a;},{});
  const [open, setOpen] = React.useState(new Set([0,3,6]));
  const toggle = i => {
    const n = new Set(open); n.has(i)?n.delete(i):n.add(i); setOpen(n);
  };
  const MAX_W = Math.max(...CRITERIA.map(c=>c[1]));

  return <div style={{padding:'40px 56px'}}>
    {/* HERO */}
    <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:48,alignItems:'end',borderBottom:'1px solid var(--wf-border-subtle)',paddingBottom:28}}>
      <div>
        <Eyebrow>Методика рейтинга · v1.0</Eyebrow>
        <H size={42} serif style={{marginTop:10,letterSpacing:-0.8,textWrap:'balance',maxWidth:640}}>Как мы считаем индекс «Август-климат»</H>
        <T size={14} color="var(--wf-ink-60)" lh={1.65} style={{marginTop:14,fontFamily:WF.serif,maxWidth:620}}>Интегральный индекс — взвешенная сумма 30 параметров. Каждый параметр оценивается по своей шкале (числовой с границами, бинарной «есть/нет» или категориальной). Сумма весов — ровно 100%.</T>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {[['Критериев',CRITERIA.length],['Сумма весов',SUM+'%'],['Версия','1.0']].map(([k,v])=>
          <div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',paddingBottom:8,borderBottom:'1px solid var(--wf-border-subtle)'}}>
            <T size={11} color="var(--wf-ink-60)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2}}>{k}</T>
            <T size={22} weight={600} style={{fontFamily:WF.serif,letterSpacing:-0.5}}>{v}</T>
          </div>)}
      </div>
    </div>

    {/* Легенда типов шкал */}
    <div style={{marginTop:28,display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
      <T size={11} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2,marginRight:4}}>Типы шкал</T>
      {Object.entries(TYPE_META).map(([k,m])=>
        <div key={k} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'5px 10px',background:m.bg,borderRadius:3}}>
          <div style={{width:6,height:6,borderRadius:3,background:m.dot}}/>
          <T size={11} weight={500}>{m.label}</T>
          <T size={11} color="var(--wf-ink-40)" style={{fontFamily:WF.mono}}>{counts[k]||0}</T>
        </div>)}
    </div>

    {/* Таблица 30 критериев */}
    <div style={{marginTop:32}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 150px 100px 200px 24px',padding:'0 0 10px',borderBottom:'1px solid var(--wf-ink-15)',gap:12}}>
        <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2}}>Критерий</T>
        <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2}}>Тип шкалы</T>
        <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2,textAlign:'right'}}>Вес</T>
        <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2}}>Шкала</T>
        <div/>
      </div>
      {CRITERIA.map(([name,w,type,unit,desc,scale],i)=>{
        const m = TYPE_META[type];
        const isOpen = open.has(i);
        return <div key={i}>
          <div onClick={()=>toggle(i)} style={{display:'grid',gridTemplateColumns:'1fr 150px 100px 200px 24px',padding:'14px 0',borderBottom:'1px solid var(--wf-border-subtle)',gap:12,alignItems:'center',cursor:'pointer'}}>
            <div>
              <div style={{display:'flex',alignItems:'baseline',gap:10}}>
                <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,width:24}}>{String(i+1).padStart(2,'0')}</T>
                <T size={13} weight={500}>{name}</T>
                {unit && <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono}}>{unit}</T>}
              </div>
            </div>
            <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'3px 9px',background:m.bg,borderRadius:3,width:'fit-content'}}>
              <div style={{width:6,height:6,borderRadius:3,background:m.dot}}/>
              <T size={11}>{m.label}</T>
            </div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:10}}>
              <T size={13} weight={600} color="var(--wf-accent)" style={{fontFamily:WF.mono}}>{w}%</T>
              <div style={{width:60,height:4,background:'var(--wf-ink-08)',borderRadius:2,overflow:'hidden'}}>
                <div style={{width:(w/MAX_W*100)+'%',height:'100%',background:'var(--wf-accent)'}}/>
              </div>
            </div>
            <T size={11} color="var(--wf-ink-60)">{scale}</T>
            <T size={14} color="var(--wf-ink-40)" style={{textAlign:'center',transform:isOpen?'rotate(45deg)':'none',transition:'transform 0.15s'}}>+</T>
          </div>
          {isOpen && <div style={{padding:'14px 0 22px 34px',borderBottom:'1px solid var(--wf-border-subtle)',display:'grid',gridTemplateColumns:'1fr 240px',gap:32}}>
            <T size={13} color="var(--wf-ink-80)" lh={1.65} style={{fontFamily:WF.serif,maxWidth:560}}>{desc}</T>
            <div style={{background:'var(--wf-alt)',padding:14,borderRadius:4}}>
              <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2}}>Как оценивается</T>
              <T size={12} style={{marginTop:6}}>{scale}</T>
              {unit && <T size={11} color="var(--wf-ink-60)" style={{marginTop:8,fontFamily:WF.mono}}>Ед. изм.: {unit}</T>}
            </div>
          </div>}
        </div>;
      })}
    </div>

    {/* Футер методики */}
    <div style={{marginTop:40,padding:'24px 0 8px',borderTop:'1px solid var(--wf-border-subtle)',display:'flex',gap:24,alignItems:'center'}}>
      <T size={12} color="var(--wf-ink-60)">Методика утверждена 2022 · актуальная версия v1.0</T>
      <div style={{flex:1}}/>
      <Btn ghost>Скачать PDF</Btn>
      <Btn primary>Предложить модель →</Btn>
    </div>
  </div>;
}

function Submit(){
  const [brand, setBrand] = React.useState('');
  const [agreed, setAgreed] = React.useState(false);

  // Section helper + fields
  const Section = ({num,title,children}) => (
    <div style={{marginTop:28,paddingTop:22,borderTop:'1px solid var(--wf-border-subtle)'}}>
      <div style={{display:'flex',alignItems:'baseline',gap:10,marginBottom:18}}>
        <T size={10} color="var(--wf-accent)" style={{fontFamily:WF.mono,fontWeight:600,letterSpacing:1.2}}>{num}</T>
        <H size={18} weight={600}>{title}</H>
      </div>
      {children}
    </div>
  );
  const Tip = ({children}) => (
    <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:14,height:14,borderRadius:7,border:'1px solid var(--wf-ink-25)',fontSize:9,color:'var(--wf-ink-60)',fontFamily:WF.mono,marginLeft:6,cursor:'help',title:children}} title={children}>?</span>
  );
  const Label = ({children,required,tip}) => (
    <div style={{display:'flex',alignItems:'center',marginBottom:6}}>
      <T size={11} color="var(--wf-ink-80)" style={{fontFamily:WF.sans,fontWeight:500}}>{children}{required && <span style={{color:'var(--wf-accent)',marginLeft:2}}>*</span>}</T>
      {tip && <Tip>{tip}</Tip>}
    </div>
  );
  const Input = ({placeholder,unit,w='100%',type='text'}) => (
    <div style={{position:'relative',width:w}}>
      <div style={{height:38,background:'var(--wf-paper)',border:'1px solid var(--wf-border)',borderRadius:3,display:'flex',alignItems:'center',padding:'0 12px'}}>
        <T size={12} color="var(--wf-ink-40)">{placeholder}</T>
        <div style={{flex:1}}/>
        {unit && <T size={11} color="var(--wf-ink-40)" style={{fontFamily:WF.mono}}>{unit}</T>}
      </div>
    </div>
  );
  const Select = ({placeholder,w='100%'}) => (
    <div style={{width:w,height:38,background:'var(--wf-paper)',border:'1px solid var(--wf-border)',borderRadius:3,display:'flex',alignItems:'center',padding:'0 12px',gap:8}}>
      <T size={12} color="var(--wf-ink-40)" style={{flex:1}}>{placeholder}</T>
      <Icon d={ICONS.chevron} size={12} color="var(--wf-ink-40)"/>
    </div>
  );
  const Radio = ({opts=['Нет','Есть'], active=0}) => (
    <div style={{display:'flex',gap:0,border:'1px solid var(--wf-border)',borderRadius:3,overflow:'hidden',width:'fit-content'}}>
      {opts.map((o,i)=>
        <div key={o} style={{padding:'9px 16px',background:i===active?'var(--wf-ink)':'var(--wf-paper)',color:i===active?'var(--wf-paper)':'var(--wf-ink-80)',fontFamily:WF.sans,fontSize:12,fontWeight:i===active?500:400,borderLeft:i>0?'1px solid var(--wf-border)':0}}>{o}</div>)}
    </div>
  );
  const Row = ({cols='1fr 1fr',gap=14,children}) => (
    <div style={{display:'grid',gridTemplateColumns:cols,gap}}>{children}</div>
  );
  const Field = ({label,required,tip,children}) => (
    <div>
      <Label required={required} tip={tip}>{label}</Label>
      {children}
    </div>
  );

  return <div style={{padding:'40px 40px 60px'}}>
    {/* HERO */}
    <Eyebrow>Заявка</Eyebrow>
    <H size={30} serif style={{marginTop:8,letterSpacing:-0.5,textWrap:'balance'}}>Добавить новый кондиционер в рейтинг</H>
    <T size={13} color="var(--wf-ink-60)" lh={1.65} style={{marginTop:12,fontFamily:WF.serif}}>Хотите, чтобы ваш кондиционер попал в независимый рейтинг «Август-климат»? Вы можете самостоятельно выполнить объективные замеры комплектующих и функционала и прислать их нам.</T>

    {/* Как это работает */}
    <div style={{marginTop:22,padding:'18px 20px',background:'var(--wf-alt)',borderRadius:4}}>
      <T size={11} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2,marginBottom:10}}>Как это работает</T>
      {[
        'Заполните форму ниже — укажите бренд, модель и контактные данные.',
        'Подтвердите результаты измерений фото- или видеоматериалами.',
        'При необходимости мы свяжемся с вами для уточнения деталей.',
        'После проверки результаты появятся в рейтинге — с измерениями и итоговым индексом.',
      ].map((t,i)=>
        <div key={i} style={{display:'flex',gap:10,padding:'6px 0'}}>
          <T size={11} color="var(--wf-accent)" style={{fontFamily:WF.mono,fontWeight:600,width:18}}>{i+1}.</T>
          <T size={12} color="var(--wf-ink-80)" lh={1.55}>{t}</T>
        </div>
      )}
    </div>

    {/* Доп. блок «Самые тихие» */}
    <div style={{marginTop:14,padding:'14px 16px',borderLeft:'3px solid var(--wf-accent)',background:'var(--wf-accent-bg)'}}>
      <T size={11} color="var(--wf-accent)" weight={600} style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2}}>Раздел «Самые тихие» — отдельно</T>
      <T size={12} color="var(--wf-ink-80)" lh={1.6} style={{marginTop:6}}>Чтобы кондиционер попал в рейтинг «Самые тихие», необходимо привезти его в лабораторию «Август-климат» для замера уровня шума. Оставить заявку можно по e-mail: <span style={{fontFamily:WF.mono}}>7883903@gmail.com</span>.</T>
    </div>

    {/* Прогресс секций */}
    <div style={{marginTop:28,display:'flex',gap:8,flexWrap:'wrap'}}>
      {[['01','Модель'],['02','Характеристики'],['03','Теплообменник внутр.'],['04','Теплообменник наруж.'],['05','Подтверждение']].map(([n,t],i)=>
        <div key={n} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'5px 10px',border:'1px solid var(--wf-border-subtle)',borderRadius:3,background:i===0?'var(--wf-ink)':'transparent',color:i===0?'var(--wf-paper)':'var(--wf-ink-60)'}}>
          <T size={10} color="inherit" style={{fontFamily:WF.mono,letterSpacing:1}}>{n}</T>
          <T size={11} color="inherit">{t}</T>
        </div>
      )}
    </div>

    {/* ── 01 МОДЕЛЬ ── */}
    <Section num="01" title="Модель кондиционера">
      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        <Row cols="1fr 1fr">
          <Field label="Бренд" required tip="Выберите бренд из списка. Если вашего бренда нет — «Другой».">
            <Select placeholder="Выберите бренд…"/>
          </Field>
          <Field label="Серия" tip="Необязательное поле. Например «ZOOM» или «AURORA».">
            <Input placeholder="—"/>
          </Field>
        </Row>
        <Row cols="1fr 1fr">
          <Field label="Модель внутреннего блока" required tip="Указана на шильдике внутреннего блока. Например: MSAG1-09HRN1.">
            <Input placeholder="Например: MSAG1-09HRN1"/>
          </Field>
          <Field label="Модель наружного блока" required tip="Указана на шильдике наружного блока.">
            <Input placeholder="Например: MSAG1-09HRN1-O"/>
          </Field>
        </Row>
        <Row cols="1fr 1fr 1fr">
          <Field label="Модель компрессора" required tip="Указана на шильдике компрессора наружного блока. Например: QXC-19K.">
            <Input placeholder="Например: QXC-19K"/>
          </Field>
          <Field label="Холодопроизводительность" required tip="Указана в характеристиках. Типичные значения: 2050, 2640, 3520, 5280, 7030 Вт.">
            <Input placeholder="2640" unit="Вт"/>
          </Field>
          <Field label="Цена" tip="Рекомендованная розничная цена в рублях (необязательно).">
            <Input placeholder="—" unit="₽"/>
          </Field>
        </Row>
      </div>
    </Section>

    {/* ── 02 ХАРАКТЕРИСТИКИ ── */}
    <Section num="02" title="Характеристики">
      <div style={{display:'flex',flexDirection:'column',gap:18}}>
        {[
          ['Обогрев поддона',true,'Наличие нагревательного элемента в поддоне наружного блока.'],
          ['Наличие ЭРВ',false,'Электронный расширительный вентиль — более точное управление потоком хладагента.'],
          ['Регулировка оборотов вент. наруж. блока',false,'Наличие или отсутствие регулировки оборотов.'],
          ['Подсветка экрана пульта',false,'Наличие подсветки дисплея на пульте ДУ.'],
        ].map(([l,req,tip])=>
          <Row key={l} cols="1fr 1fr" gap={20}>
            <Label required={req} tip={tip}>{l}</Label>
            <Radio/>
          </Row>
        )}
        <Row cols="1fr 1fr" gap={20}>
          <Field label="Кол-во скоростей вент. внутр. блока" required tip="Количество скоростей (без автоматического режима).">
            <Input placeholder="3" unit="шт."/>
          </Field>
          <Field label="Фильтры тонкой очистки" required tip="Количество фильтров тонкой очистки (помимо основного сетчатого).">
            <Radio opts={['0','1','2']} active={1}/>
          </Field>
        </Row>
        <Row cols="1fr 1fr" gap={20}>
          <Field label="Ионизатор" required tip="Тип ионизатора воздуха. Если нет — «Нет».">
            <Select placeholder="Нет"/>
          </Field>
          <Field label="Русифицированный пульт" required tip="Наличие русского языка на пульте ДУ: корпус кнопок и/или экран.">
            <Select placeholder="Нет"/>
          </Field>
        </Row>
        <Row cols="1fr 1fr" gap={20}>
          <Field label="УФ-лампа" required tip="Наличие ультрафиолетовой лампы для обеззараживания воздуха.">
            <Select placeholder="Нет"/>
          </Field>
          <div/>
        </Row>
      </div>
    </Section>

    {/* ── 03 ТЕПЛООБМЕННИК ВНУТР. ── */}
    <Section num="03" title="Теплообменник внутреннего блока">
      <Row cols="1fr 1fr 1fr">
        <Field label="Длина" required tip="Длина теплообменника внутреннего блока. Измеряется рулеткой по длинной стороне.">
          <Input placeholder="780" unit="мм"/>
        </Field>
        <Field label="Кол-во трубок" required tip="Количество медных трубок в теплообменнике. Считается по торцу.">
          <Input placeholder="16" unit="шт."/>
        </Field>
        <Field label="Диаметр трубок" required tip="Наружный диаметр медных трубок. Типичные значения: 5, 7, 9 мм. Штангенциркуль.">
          <Input placeholder="7" unit="мм"/>
        </Field>
      </Row>
    </Section>

    {/* ── 04 ТЕПЛООБМЕННИК НАРУЖ. ── */}
    <Section num="04" title="Теплообменник наружного блока">
      <Row cols="1fr 1fr">
        <Field label="Длина" required tip="Длина теплообменника наружного блока.">
          <Input placeholder="820" unit="мм"/>
        </Field>
        <Field label="Кол-во трубок" required tip="Количество медных трубок в теплообменнике наружного блока.">
          <Input placeholder="22" unit="шт."/>
        </Field>
      </Row>
      <div style={{marginTop:14}}>
        <Row cols="1fr 1fr">
          <Field label="Диаметр трубок" required tip="Наружный диаметр трубок. Типичные значения: 5, 7, 9 мм.">
            <Input placeholder="7" unit="мм"/>
          </Field>
          <Field label="Толщина" required tip="Толщина теплообменника — глубина пакета ламелей.">
            <Input placeholder="28" unit="мм"/>
          </Field>
        </Row>
      </div>
    </Section>

    {/* ── 05 ПОДТВЕРЖДЕНИЕ + ССЫЛКИ + КОНТАКТ ── */}
    <Section num="05" title="Подтверждение замеров">
      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        <Field label="Фото измерений" required tip="Фотографии с результатами ваших измерений: шильдики, замеры рулеткой/штангенциркулем. От 1 до 20 фото.">
          <div style={{border:'1.5px dashed var(--wf-border)',borderRadius:4,padding:'22px 16px',display:'flex',alignItems:'center',gap:14,background:'var(--wf-paper)'}}>
            <div style={{width:40,height:40,borderRadius:20,background:'var(--wf-chip)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Icon d={ICONS.upload || ICONS.plus || 'M8 1v14M1 8h14'} size={14} color="var(--wf-ink-60)"/>
            </div>
            <div>
              <T size={12} weight={500}>Перетащите файлы или нажмите, чтобы выбрать</T>
              <T size={11} color="var(--wf-ink-60)" style={{marginTop:3}}>JPG, PNG до 10 МБ каждый · максимум 20 файлов</T>
            </div>
            <div style={{flex:1}}/>
            <Btn ghost size="sm">Выбрать файлы</Btn>
          </div>
        </Field>
        <Field label="Ссылка на видео измерений" tip="Ссылка на видео (YouTube, RuTube и т.д.), где вы демонстрируете процесс.">
          <Input placeholder="https://…"/>
        </Field>
      </div>
      <div style={{marginTop:22}}>
        <div style={{display:'flex',alignItems:'baseline',gap:10,marginBottom:12}}>
          <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2}}>Ссылки</T>
        </div>
        <Row cols="1fr 1fr">
          <Field label="Где купить" tip="Ссылка на страницу товара в интернет-магазине.">
            <Input placeholder="https://…"/>
          </Field>
          <Field label="Сайт поставщика" tip="Официальный сайт производителя или дистрибьютора.">
            <Input placeholder="https://…"/>
          </Field>
        </Row>
      </div>
      <div style={{marginTop:22}}>
        <div style={{display:'flex',alignItems:'baseline',gap:10,marginBottom:12}}>
          <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2}}>Контакт</T>
        </div>
        <Field label="E-mail" required tip="На этот адрес вы получите уведомление о результате рассмотрения заявки.">
          <Input placeholder="you@example.com"/>
        </Field>
      </div>
    </Section>

    {/* Согласие + отправить */}
    <div style={{marginTop:32,padding:'22px 24px',background:'var(--wf-alt)',borderRadius:4}}>
      <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
        <div style={{width:18,height:18,borderRadius:3,border:'1.5px solid var(--wf-accent)',background:'var(--wf-accent)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>
          <Icon d={ICONS.check} size={10} color="#fff"/>
        </div>
        <T size={12} color="var(--wf-ink-80)" lh={1.55}>Я даю согласие на обработку персональных данных в соответствии с Федеральным законом №152-ФЗ «О персональных данных». <span style={{color:'var(--wf-accent)'}}>*</span></T>
      </div>
      <T size={11} color="var(--wf-ink-60)" style={{marginTop:10,marginLeft:30,fontStyle:'italic'}}>Заявка рассматривается администратором перед добавлением в рейтинг.</T>
      <div style={{marginTop:16,marginLeft:30,display:'flex',gap:10,alignItems:'center'}}>
        <Btn primary size="md" style={{padding:'11px 22px',fontSize:13}}>Отправить заявку →</Btn>
        <Btn ghost size="md" style={{padding:'11px 18px'}}>Сохранить черновик</Btn>
      </div>
    </div>
  </div>;
}

function Archive(){
  const ROWS = [
    ['CASARTE',     'CAS35CU1YDR',       2024, 77.9, 'Снята с производства'],
    ['HAIER',       'HSU-09HNE03/R2',    2023, 72.4, 'Нет в продаже в РФ'],
    ['GREE',        'GWH09AAB-K3DNA4A',  2023, 69.8, 'Замена модельного ряда'],
    ['TOSHIBA',     'RAS-07BKVG-EE',     2022, 74.1, 'Уход бренда с рынка РФ'],
    ['DAIKIN',      'FTXB25C',           2022, 76.0, 'Уход бренда с рынка РФ'],
    ['MITSUBISHI H.','SRK20ZS-W',        2022, 75.3, 'Нет в продаже в РФ'],
    ['HITACHI',     'RAS-10PH1',         2021, 70.2, 'Снята с производства'],
    ['PANASONIC',   'CS-TZ25TKEW',       2021, 73.5, 'Уход бренда с рынка РФ'],
  ];
  const REASON_STYLE = {
    'Снята с производства':     {dot:'var(--wf-ink-60)',    bg:'var(--wf-chip)'},
    'Нет в продаже в РФ':       {dot:'#c87510',             bg:'rgba(200,117,16,0.10)'},
    'Уход бренда с рынка РФ':   {dot:'#b6372a',             bg:'rgba(182,55,42,0.10)'},
    'Замена модельного ряда':   {dot:'var(--wf-accent)',    bg:'var(--wf-accent-bg)'},
  };
  return <div style={{padding:'28px 40px'}}>
    <div style={{display:'flex',alignItems:'baseline',gap:24,borderBottom:'1px solid var(--wf-border-subtle)',paddingBottom:18}}>
      <div>
        <Eyebrow>Архив моделей</Eyebrow>
        <H size={26} serif style={{marginTop:6,letterSpacing:-0.4}}>Модели, выбывшие из рейтинга</H>
      </div>
      <T size={12} color="var(--wf-ink-60)" lh={1.55} style={{maxWidth:480,fontFamily:WF.serif}}>Здесь — кондиционеры, которые раньше участвовали в рейтинге, но были исключены. Причины: снятие с производства, уход бренда с рынка РФ, отсутствие в продаже. Карточки сохраняются со всеми замерами и последним индексом.</T>
      <div style={{flex:1}}/>
      <div style={{display:'flex',alignItems:'baseline',gap:6}}>
        <T size={28} weight={700} style={{fontFamily:WF.serif,letterSpacing:-0.6}}>{ROWS.length}</T>
        <T size={11} color="var(--wf-ink-60)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2}}>моделей<br/>в архиве</T>
      </div>
    </div>
    {/* filter chips */}
    <div style={{marginTop:14,display:'flex',gap:6,alignItems:'center'}}>
      <T size={11} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2,marginRight:6}}>Причина</T>
      <Pill active>Все</Pill><Pill>Снято с производства</Pill><Pill>Нет в продаже</Pill><Pill>Уход бренда</Pill><Pill>Замена ряда</Pill>
      <div style={{flex:1}}/>
      <T size={11} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2}}>Сортировка:</T>
      <Pill>По году ↓</Pill><Pill>По индексу ↓</Pill>
    </div>
    {/* table */}
    <div style={{marginTop:12}}>
      <div style={{display:'grid',gridTemplateColumns:'1.4fr 2fr 70px 80px 1.4fr 30px',padding:'8px 0',borderBottom:'1px solid var(--wf-ink-15)',gap:12}}>
        {['Бренд','Модель','Выбыл','Инд.','Причина',''].map(h=>
          <T key={h} size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2}}>{h}</T>)}
      </div>
      {ROWS.map(([brand,model,year,idx,reason],i)=>{
        const r = REASON_STYLE[reason];
        return <div key={i} style={{display:'grid',gridTemplateColumns:'1.4fr 2fr 70px 80px 1.4fr 30px',padding:'12px 0',borderBottom:i<ROWS.length-1?'1px solid var(--wf-border-subtle)':0,gap:12,alignItems:'center'}}>
          <T size={12} weight={600} style={{fontFamily:WF.mono,letterSpacing:0.5}}>{brand}</T>
          <T size={12}>{model}</T>
          <T size={12} color="var(--wf-ink-60)" style={{fontFamily:WF.mono}}>{year}</T>
          <T size={12} weight={600} color="var(--wf-ink-40)" style={{fontFamily:WF.mono}}>{idx.toFixed(1)}</T>
          <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'3px 9px',background:r.bg,borderRadius:3,width:'fit-content'}}>
            <div style={{width:6,height:6,borderRadius:3,background:r.dot}}/>
            <T size={11}>{reason}</T>
          </div>
          <T size={14} color="var(--wf-ink-40)" style={{textAlign:'center'}}>→</T>
        </div>;
      })}
    </div>
  </div>;
}

function NotFound(){
  return <div style={{padding:'80px 40px',textAlign:'center'}}>
    <H size={90} serif weight={700} style={{letterSpacing:-2}}>404</H>
    <T size={16} color="var(--wf-ink-60)" style={{marginTop:10}}>Страница не найдена. Или устарела. Или никогда и не была.</T>
    <div style={{display:'flex',gap:10,justifyContent:'center',marginTop:22}}><Btn primary>На главную</Btn><Btn ghost>В рейтинг</Btn></div>
    <div style={{marginTop:40,display:'flex',gap:14,justifyContent:'center',flexWrap:'wrap'}}>
      {['Рейтинг','Новости','ISmeta','Методика','Мешок Монтажников'].map(x=><Pill key={x}>{x}</Pill>)}
    </div>
  </div>;
}

// ───────── Footers ─────────
function FooterA(){
  return <div style={{padding:'32px 40px',borderTop:'1px solid var(--wf-border-subtle)',background:'var(--wf-alt)'}}>
    <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr',gap:32}}>
      <div>
        <BrandMark size={14}/>
        <T size={11} color="var(--wf-ink-60)" style={{marginTop:10,maxWidth:280,lineHeight:1.5}}>Независимое издание о кондиционерах и климатической технике. С 2016 года.</T>
      </div>
      {[['Разделы',['Новости','Рейтинг','ISmeta','Мешок Монтажников','Анализ проектов']],['Рейтинг',['Все модели','Самые тихие','Методика','Архив']],['О проекте',['Франшиза','Ассоциация','Редакция','Реклама']],['Помощь',['Контакты','Правовое','API','FAQ']]].map(([h,items])=>
        <div key={h}><Eyebrow>{h}</Eyebrow><div style={{marginTop:10,display:'flex',flexDirection:'column',gap:6}}>{items.map(i=><T key={i} size={11} color="var(--wf-ink-60)">{i}</T>)}</div></div>)}
    </div>
    <div style={{marginTop:28,paddingTop:16,borderTop:'1px solid var(--wf-border-subtle)',display:'flex',justifyContent:'space-between'}}>
      <T size={10} color="var(--wf-ink-40)">© 2016–2026 Август-климат · все права защищены</T>
      <div style={{display:'flex',gap:14}}>{['RU','EN','Tg','VK','RSS'].map(x=><T key={x} size={10} color="var(--wf-ink-40)">{x}</T>)}</div>
    </div>
  </div>;
}

function FooterB({dark}){
  return <div style={{padding:'28px 40px',borderTop:`1px solid var(--wf-border-subtle)`,background:dark?'#0f0f0f':'var(--wf-ink)',color:'#eeecea'}}>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:40}}>
      <div>
        <div style={{display:'flex',alignItems:'center',gap:7}}>
          <div style={{width:16,height:16,borderRadius:3,background:'#fff',color:'var(--wf-ink)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700}}>А</div>
          <T size={14} weight={600} color="#eeecea">Август-климат</T>
        </div>
        <H size={28} serif style={{marginTop:14,color:'#eeecea',maxWidth:380}}>Дайджест рейтинга — раз в полгода, когда выходит новый выпуск.</H>
        <div style={{marginTop:16,display:'flex',gap:8,alignItems:'center',background:'rgba(255,255,255,0.08)',padding:'4px 4px 4px 14px',borderRadius:4,maxWidth:380}}>
          <T size={12} color="rgba(238,236,234,0.5)">your.email@example.ru</T>
          <div style={{flex:1}}/>
          <div style={{padding:'6px 14px',borderRadius:3,background:'var(--wf-accent)',fontSize:11,fontWeight:500}}>Подписаться</div>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:20}}>
        {[['Индекс',['Рейтинг','Методика','Архив']],['Сервисы',['ISmeta','Мешок Монтажников','Франшиза']],['Связаться',['редакция@','партнёры@','+7 495 000-00-00']]].map(([h,items])=>
          <div key={h}><div style={{fontSize:10,fontFamily:WF.mono,opacity:0.5,letterSpacing:1.2,textTransform:'uppercase'}}>{h}</div><div style={{marginTop:10,display:'flex',flexDirection:'column',gap:6}}>{items.map(i=><div key={i} style={{fontSize:11,opacity:0.7}}>{i}</div>)}</div></div>)}
      </div>
    </div>
  </div>;
}

// ───────── Mobile listings (accordion focus) × 4 ─────────
function MobileListA({scrollTo}={}){ // Accordion per model — aligned with approved desktop LIST-A
  const [openIdx, setOpenIdx] = React.useState(0);
  const rootRef = React.useRef(null);
  React.useEffect(()=>{
    if(scrollTo==='footer' && rootRef.current){
      const el = rootRef.current.querySelector('[data-section="footer"]');
      if(el){
        const container = rootRef.current.parentElement;
        if(container) container.scrollTop = el.offsetTop - 4;
      }
    }
  },[scrollTo]);
  const models = [
    ['CASARTE','CAS35CU1YDW','155 000 ₽',78.8],
    ['FUNAI','RAC-1E1020 INDIVIO','117 000 ₽',77.5],
    ['T-MACON','T-MACON-18','54 700 ₽',76.0],
    ['LG','LH187V8KS','99 000 ₽',76.0],
    ['MDV','MDGAF-09HRFN8','22 500 ₽',72.1],
    ['AQUA','AQR-8TS-A7/PA','21 700 ₽',71.5],
  ];
  return <div ref={rootRef}>
    {/* HERO — compact version of desktop hero */}
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
      <H size={18} serif style={{lineHeight:1.25,letterSpacing:-0.3,textWrap:'balance'}}>Интегральный индекс «Август-климат» качества кондиционеров до 4,0 кВт.</H>
      <div style={{display:'flex',gap:10,marginTop:12,alignItems:'center',paddingTop:12,borderTop:'1px solid var(--wf-border-subtle)'}}>
        <div style={{display:'flex'}}>
          {[0,1].map(i=>(
            <div key={i} style={{width:28,height:28,borderRadius:'50%',background:'var(--wf-chip)',overflow:'hidden',flexShrink:0,marginLeft:i===0?0:-8,border:'2px solid var(--wf-alt)',position:'relative'}}>
              <svg width="24" height="24" viewBox="0 0 28 28" style={{display:'block'}}><circle cx="14" cy="11" r="4.5" fill="var(--wf-ink-40)" opacity="0.55"/><path d="M 5 28 Q 5 19 14 19 Q 23 19 23 28 Z" fill="var(--wf-ink-40)" opacity="0.55"/></svg>
            </div>
          ))}
        </div>
        <T size={11} color="var(--wf-ink-60)" style={{lineHeight:1.4,marginLeft:4}}><span style={{fontWeight:600,color:'var(--wf-ink)'}}>Андрей Петров</span> · <span style={{fontWeight:600,color:'var(--wf-ink)'}}>Ирина Соколова</span></T>
      </div>
    </div>
    {/* TABS + FILTERS */}
    <div style={{padding:'10px 18px 0',borderBottom:'1px solid var(--wf-border-subtle)'}}>
      <div style={{display:'flex',gap:18}}>
        {['По индексу','Самые тихие','Свой рейтинг'].map((x,i)=>(
          <div key={x} style={{position:'relative',fontSize:12,fontWeight:i===0?600:500,color:i===0?'var(--wf-ink)':'var(--wf-ink-60)',padding:'10px 0 12px'}}>
            {x}
            {i===0 && <div style={{position:'absolute',left:0,right:0,bottom:0,height:2,background:'var(--wf-accent)'}}/>}
          </div>
        ))}
      </div>
    </div>
    <div style={{padding:'10px 18px',display:'flex',gap:8,borderBottom:'1px solid var(--wf-border-subtle)',alignItems:'center'}}>
      <Box w={108} h={32} radius={4} style={{padding:'0 10px',justifyContent:'space-between',textTransform:'none',fontSize:11,color:'var(--wf-ink-60)'}}>Бренд · все <Icon d={ICONS.chevron} size={10} color="var(--wf-ink-40)"/></Box>
      <Box w={96} h={32} radius={4} style={{padding:'0 10px',justifyContent:'space-between',textTransform:'none',fontSize:11,color:'var(--wf-ink-60)'}}>Цена <Icon d={ICONS.chevron} size={10} color="var(--wf-ink-40)"/></Box>
      <div style={{flex:1}}/>
      <T size={10} color="var(--wf-ink-60)">27 мод.</T>
    </div>
    {/* ROWS — same semantics as desktop: rank | floating logo | brand | model + price + index */}
    <div style={{padding:'4px 18px 0'}}>
      {models.map(([brand,model,price,idx],i)=>{
        const rk = i+1;
        const podium = rk<=3;
        const open = i===openIdx;
        return (
          <div key={model} style={{borderBottom:'1px solid var(--wf-border-subtle)'}}>
            <div onClick={()=>setOpenIdx(open?-1:i)} style={{padding:'14px 0',display:'grid',gridTemplateColumns:'34px 1fr auto',gap:12,alignItems:'center',cursor:'pointer'}}>
              <div style={{fontFamily:podium?WF.serif:WF.mono,fontSize:podium?24:13,color:podium?'var(--wf-accent)':'var(--wf-ink-40)',fontWeight:podium?600:500,letterSpacing:-0.4,lineHeight:1}}>{rk}</div>
              <div style={{minWidth:0}}>
                <div style={{marginBottom:3}}><BrandLogo name={brand}/></div>
                <T size={11} color="var(--wf-ink-60)" style={{lineHeight:1.3,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{model}</T>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontFamily:WF.serif,fontSize:16,fontWeight:600,color:'var(--wf-accent)',letterSpacing:-0.2,lineHeight:1}}>{idx}</div>
                <T size={11} color="var(--wf-ink-60)" style={{marginTop:4}}>{price}</T>
              </div>
            </div>
            {open && (
              <div style={{padding:'4px 0 18px'}}>
                {/* Swipeable photo gallery — the peeking card on the right communicates "swipe for more" */}
                <div style={{position:'relative',height:180,overflow:'hidden',borderRadius:4}}>
                  <div style={{display:'flex',gap:8,height:'100%'}}>
                    <Box w="100%" h={180} striped radius={4} label={`${brand} · фото 1 из 5`} style={{flexShrink:0,flex:'0 0 100%'}}/>
                    <Box w={40} h={180} striped radius={4} style={{flexShrink:0,flex:'0 0 40px',opacity:0.6}}/>
                  </div>
                  {/* Pagination dots */}
                  <div style={{position:'absolute',left:0,right:0,bottom:10,display:'flex',justifyContent:'center',gap:5}}>
                    {[0,1,2,3,4].map(d=>(
                      <div key={d} style={{width:d===0?16:5,height:5,borderRadius:3,background:d===0?'#fff':'rgba(255,255,255,0.55)',transition:'all .2s'}}/>
                    ))}
                  </div>
                  {/* Swipe hint */}
                  <div style={{position:'absolute',right:52,top:'50%',transform:'translateY(-50%)',display:'flex',alignItems:'center',gap:4,background:'rgba(0,0,0,0.5)',color:'#fff',padding:'4px 8px',borderRadius:10,fontSize:10,letterSpacing:0.2,pointerEvents:'none'}}>
                    <span>свайп</span><Icon d={ICONS.chevronR} size={10} color="#fff"/>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
    <div style={{padding:'18px',display:'flex',justifyContent:'center'}}>
      <Btn ghost size="sm">Показать ещё 20 моделей</Btn>
    </div>
    {/* Футер раздела — служебная навигация с группировкой */}
    <div data-section="footer" style={{padding:'24px 18px 28px',borderTop:'1px solid var(--wf-border-subtle)',background:'var(--wf-alt)'}}>
      <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2,marginBottom:14}}>О рейтинге</T>
      <div style={{display:'flex',flexDirection:'column',gap:20}}>
        {[
          ['Прозрачность',['Методика рейтинга','Веса критериев','История изменений']],
          ['Участие',['Предложить модель','Сообщить о замерах','Для производителей']],
          ['Архив',['Модели 2023','Модели 2022','Снятые с производства']],
        ].map(([group,links])=>(
          <div key={group}>
            <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>{group}</T>
            <div style={{display:'flex',flexDirection:'column'}}>
              {links.map((l,i,arr)=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:i<arr.length-1?'1px solid var(--wf-border-subtle)':0}}>
                  <T size={13}>{l}</T>
                  <span style={{color:'var(--wf-ink-40)',fontSize:12}}>→</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>;
}

function MobileListB(){ // Collapsible filters at top + compact rows
  return <div>
    <div style={{padding:'14px 16px',borderBottom:'1px solid var(--wf-border-subtle)',display:'flex',gap:10,alignItems:'center'}}>
      <Icon d={ICONS.filter} size={14}/><T size={12} weight={500}>Фильтры</T>
      <Pill tone="accent" style={{fontSize:9}}>3</Pill>
      <div style={{flex:1}}/>
      <T size={11} color="var(--wf-accent)">По индексу ↓</T>
    </div>
    <div style={{padding:'10px 16px',borderBottom:'1px solid var(--wf-border-subtle)',display:'flex',gap:6,overflow:'hidden'}}>
      <Pill active style={{fontSize:9}}>Mitsubishi ×</Pill><Pill active style={{fontSize:9}}>&lt;70к ×</Pill><Pill active style={{fontSize:9}}>тише 28дБ ×</Pill>
    </div>
    {[[1,'C','CASARTE','CAS35','155к₽',78.8,'24дБ'],[2,'F','FUNAI','RAC-1E','117к₽',77.5,'26дБ'],[3,'T','T-MACON','TMC-18','54.7к₽',76,'28дБ'],[4,'L','LG','LH187','99к₽',76,'27дБ'],[5,'M','MDV','09HRFN8','22.5к₽',72.1,'30дБ'],[6,'M','Mitsubishi H','SRK35','81к₽',71.4,'25дБ'],[7,'H','Haier','A2SE12','24.9к₽',69.5,'26дБ']].map(([rk,l,b,m,p,idx,n])=>
      <div key={rk} style={{padding:'12px 16px',borderBottom:'1px solid var(--wf-border-subtle)',display:'grid',gridTemplateColumns:'20px 30px 1fr 40px 44px',gap:10,alignItems:'center'}}>
        <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono}}>{rk}</T>
        <LogoBox size={26} letter={l}/>
        <div><T size={12} weight={500}>{b}</T><T size={10} color="var(--wf-ink-60)">{m} · {n}</T></div>
        <T size={13} weight={600} color="var(--wf-accent)" style={{textAlign:'right'}}>{idx}</T>
        <T size={10} color="var(--wf-ink-60)" style={{textAlign:'right'}}>{p}</T>
      </div>)}
  </div>;
}

function MobileListC(){ // Card-based swipeable feed
  return <div>
    <div style={{padding:'14px 16px',borderBottom:'1px solid var(--wf-border-subtle)'}}>
      <Eyebrow>топ-3 редакции</Eyebrow>
      <H size={18} style={{marginTop:4}}>Лучшее в 2026</H>
    </div>
    {[['CASARTE','CAS35CU1YDW',78.8,'155к','C',1,true],['FUNAI','RAC-1E1020',77.5,'117к','F',2],['T-MACON','TMC-18',76,'54.7к','T',3]].map(([b,m,idx,p,l,rk,hot])=>
      <div key={m} style={{margin:'12px 16px',padding:14,border:'1px solid var(--wf-border-subtle)',borderRadius:6,background:'var(--wf-paper)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <Pill tone="accent" style={{fontSize:9}}>№ {rk}{hot&&' · лидер'}</Pill>
          <Donut value={idx} size={44} stroke={5}/>
        </div>
        <Box w="100%" h={120} striped radius={4} style={{marginTop:10}} label="фото"/>
        <T size={10} color="var(--wf-ink-40)" style={{marginTop:10}}>{b}</T>
        <T size={15} weight={600}>{m}</T>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:10,paddingTop:10,borderTop:'1px solid var(--wf-border-subtle)',alignItems:'center'}}>
          <T size={14} weight={600}>{p}₽</T><Btn size="sm" ghost>Открыть →</Btn>
        </div>
      </div>)}
  </div>;
}

function MobileListD(){ // Split: ranked list + sticky action bar
  return <div style={{position:'relative',paddingBottom:60}}>
    <div style={{padding:'12px 16px',borderBottom:'1px solid var(--wf-border-subtle)',display:'flex',alignItems:'center',gap:10}}>
      <H size={16}>Свой рейтинг</H>
      <Pill tone="accent">3/5</Pill>
      <div style={{flex:1}}/>
      <T size={10} color="var(--wf-ink-60)">Перетащите</T>
    </div>
    {[['1','CASARTE','CAS35',78.8],['2','FUNAI','RAC-1E',77.5],['3','LG','LH187',76]].map(([rk,b,m,idx])=>
      <div key={rk} style={{margin:'8px 16px',padding:'12px 14px',background:'var(--wf-paper)',border:'1px solid var(--wf-border-subtle)',borderRadius:6,display:'flex',alignItems:'center',gap:12}}>
        <div style={{width:24,height:24,borderRadius:999,background:'var(--wf-accent-bg)',color:'var(--wf-accent)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700}}>{rk}</div>
        <div style={{flex:1}}><T size={11} color="var(--wf-ink-40)">{b}</T><T size={13} weight={600}>{m}</T></div>
        <T size={13} weight={600} color="var(--wf-accent)">{idx}</T>
        <Icon d={ICONS.list} size={14} color="var(--wf-ink-40)"/>
      </div>)}
    <div style={{margin:'16px',padding:18,border:'1px dashed var(--wf-border)',borderRadius:6,textAlign:'center'}}>
      <Icon d={ICONS.plus} size={18} color="var(--wf-ink-40)"/>
      <T size={12} color="var(--wf-ink-60)" style={{marginTop:6}}>Добавить ещё модель в сравнение</T>
    </div>
    <div style={{position:'absolute',bottom:0,left:0,right:0,background:'var(--wf-paper)',borderTop:'1px solid var(--wf-border)',padding:'10px 16px',display:'flex',gap:8}}>
      <Btn ghost style={{flex:1,justifyContent:'center'}}>Сбросить</Btn>
      <Btn primary style={{flex:2,justifyContent:'center'}}>Сохранить рейтинг →</Btn>
    </div>
  </div>;
}

// ───────── Page templates (5) — skeletons only ─────────
function Tmpl({title,blocks}){
  return <div style={{padding:'20px 28px'}}>
    <Eyebrow>Шаблон страницы</Eyebrow>
    <H size={20} style={{marginTop:4}}>{title}</H>
    <div style={{marginTop:16,display:'flex',flexDirection:'column',gap:8}}>
      {blocks.map((b,i)=><div key={i} style={{...b.style, border:'1px dashed var(--wf-border)',borderRadius:4,padding:'10px 12px',display:'flex',alignItems:'center',gap:10,color:'var(--wf-ink-60)'}}>
        <T size={9} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1,width:90}}>{b.tag}</T>
        <T size={11} weight={500}>{b.label}</T>
      </div>)}
    </div>
  </div>;
}

function DetailA2(){ return <DetailA variant="stacked"/>; }

// ───────── Mobile detail (matches approved DetailA) ─────────
function MobileDetailA({scrollTo}={}){
  const [tab,setTab] = React.useState('criteria');
  const [critView,setCritView] = React.useState('list');
  const rootRef = React.useRef(null);
  React.useEffect(()=>{
    if(scrollTo==='criteria' && rootRef.current){
      const el = rootRef.current.querySelector('[data-section="criteria"]');
      if(el){
        const container = rootRef.current.parentElement;
        if(container) container.scrollTop = el.offsetTop - 4;
      }
    }
  },[scrollTo]);
  // 30 параметров — тот же список, что в десктопной DetailA
  const CRITERIA = [
    ['Минимальный уровень шума', '31.1 дБ(А)', 0.00, 69.0, null],
    ['Площадь труб внутр. блока', '0.52 кв.м', 10.00, 100.0, 'выше эталона'],
    ['Площадь труб наруж. блока', '1.1 кв.м', 9.40, 94.0, 'выше эталона'],
    ['Мощность компрессора', '— Вт', 7.00, 70.0, null],
    ['Наличие ЭРВ', 'Есть', 5.00, 100.0, null],
    ['Регулировка оборотов', 'Есть', 5.00, 100.0, null],
    ['Инверторный компрессор', 'Есть', 5.00, 100.0, null],
    ['Работа на обогрев', '−30 °C', 5.00, 100.0, 'выше эталона'],
    ['Максимальный перепад высот', '15 м', 4.00, 100.0, null],
    ['Гарантия', '7 лет', 4.00, 100.0, 'выше эталона'],
    ['Длина фреонопровода', '30 м', 3.20, 80.0, null],
    ['Энергоэффективность', 'A+++', 3.00, 100.0, null],
    ['Класс (обогрев)', 'A++', 2.50, 90.0, null],
    ['Хладагент', 'R32', 2.00, 100.0, null],
    ['Wi-Fi управление', 'Есть', 2.00, 100.0, null],
    ['Голосовой ассистент', 'Алиса', 1.50, 75.0, null],
    ['Ночной режим', 'Есть', 1.20, 100.0, null],
    ['Самодиагностика', 'Есть', 1.20, 100.0, null],
    ['Ароматизатор воздуха', 'Есть', 1.00, 100.0, null],
    ['Приток свежего воздуха', 'Без подогрева', 1.00, 50.0, null],
    ['Возраст бренда в РФ', '2018 год', 0.75, 25.0, 'ниже эталона'],
    ['Фильтры тонкой очистки', '1 шт.', 0.50, 50.0, null],
    ['УФ лампа', 'Светодиоды', 0.50, 50.0, null],
    ['Вибрация наруж. блока', '0.17 мм', 0.00, 40.0, null],
    ['Ионизатор', '—', 0.00, 0.0, null],
    ['Русифицированный пульт', 'Нет', 0.00, 0.0, null],
    ['ИК датчик присутствия', 'Нет', 0.00, 0.0, null],
    ['Дежурный обогрев +8 °C', 'Нет', 0.00, 0.0, null],
    ['Автоматический рестарт', 'Есть', 0.00, 100.0, null],
    ['Защита от замерзания', 'Есть', 0.00, 100.0, null],
  ];
  return <div ref={rootRef}>
    {/* HERO */}
    <div style={{padding:'20px 18px 22px',background:'var(--wf-alt)',borderBottom:'1px solid var(--wf-border-subtle)'}}>
      {/* Breadcrumb / back */}
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:14,fontSize:11,color:'var(--wf-ink-60)'}}>
        <span>←</span>
        <span>Рейтинг</span>
        <span style={{opacity:0.4}}>/</span>
        <span>Сплит-системы 2–3 кВт</span>
      </div>

      {/* Brand + rank */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <BrandLogo name="CASARTE"/>
        <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--wf-accent-bg)',padding:'5px 10px',borderRadius:4}}>
          <span style={{fontFamily:WF.mono,fontSize:9,color:'var(--wf-accent)',fontWeight:600,textTransform:'uppercase',letterSpacing:1}}>Ранг</span>
          <span style={{fontFamily:WF.serif,fontSize:16,fontWeight:600,color:'var(--wf-accent)',lineHeight:1}}>#1</span>
          <span style={{fontSize:10,color:'var(--wf-accent)',opacity:0.7}}>/87</span>
        </div>
      </div>

      {/* Meta row */}
      <div style={{display:'flex',alignItems:'flex-start',gap:14,marginBottom:14,paddingBottom:14,borderBottom:'1px solid var(--wf-border-subtle)'}}>
        <div style={{flex:1}}>
          <T size={9} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1,lineHeight:1}}>Серия</T>
          <T size={12} weight={600} style={{marginTop:4}}>Cube Pro · 2025</T>
        </div>
        <span style={{width:1,height:30,background:'var(--wf-border)'}}/>
        <div style={{flex:1.2}}>
          <T size={9} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1,lineHeight:1}}>Мощность охл.</T>
          <div style={{display:'flex',alignItems:'center',gap:5,marginTop:4}}>
            <T size={12} weight={600}>2 800 Вт</T>
            <span title="Номинальная мощность охлаждения по ISO 5151" style={{width:12,height:12,borderRadius:'50%',border:'1px solid var(--wf-ink-40)',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:8,color:'var(--wf-ink-40)',fontWeight:600,lineHeight:1,cursor:'help'}}>?</span>
          </div>
        </div>
      </div>

      {/* Model names */}
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        <div style={{padding:'12px 14px',border:'1px solid var(--wf-border-subtle)',borderRadius:6,background:'var(--wf-paper)'}}>
          <T size={9} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1}}>Внутренний блок</T>
          <div style={{fontFamily:WF.mono,fontSize:18,fontWeight:600,letterSpacing:-0.2,marginTop:4,lineHeight:1.1}}>CAS-35HI/R3</div>
          <T size={10} color="var(--wf-ink-60)" style={{marginTop:4}}>850 × 295 × 189 мм · 10 кг</T>
        </div>
        <div style={{padding:'12px 14px',border:'1px solid var(--wf-border-subtle)',borderRadius:6,background:'var(--wf-paper)'}}>
          <T size={9} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1}}>Наружный блок</T>
          <div style={{fontFamily:WF.mono,fontSize:18,fontWeight:600,letterSpacing:-0.2,marginTop:4,lineHeight:1.1}}>CAS-35HO/R3</div>
          <T size={10} color="var(--wf-ink-60)" style={{marginTop:4}}>780 × 540 × 290 мм · 42 кг</T>
        </div>
      </div>

      {/* Photo swipe carousel (3:2) */}
      <div style={{marginTop:16,position:'relative',aspectRatio:'3 / 2',width:'100%',background:'var(--wf-chip)',border:'1px solid var(--wf-border-subtle)',borderRadius:6,overflow:'hidden'}}>
        {/* placeholder scene — diagonal hatch + label */}
        <svg width="100%" height="100%" viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice" style={{display:'block'}}>
          <defs>
            <pattern id="mdhatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="10" stroke="currentColor" strokeOpacity="0.08" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="300" height="200" fill="url(#mdhatch)"/>
          <rect x="70" y="60" width="160" height="56" rx="4" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1"/>
          <text x="150" y="94" fontSize="10" textAnchor="middle" fill="currentColor" opacity="0.45" fontFamily="ui-monospace, monospace">ФОТО · 3:2</text>
        </svg>
        {/* swipe hint arrows */}
        <div aria-hidden style={{position:'absolute',inset:0,pointerEvents:'none',display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0 10px'}}>
          <span style={{color:'var(--wf-ink-40)',fontSize:18,userSelect:'none'}}>‹</span>
          <span style={{color:'var(--wf-ink-40)',fontSize:18,userSelect:'none'}}>›</span>
        </div>
        {/* counter */}
        <div style={{position:'absolute',top:8,right:8,padding:'3px 8px',background:'rgba(20,20,20,0.72)',color:'#fff',borderRadius:12,fontSize:10,fontFamily:WF.mono,letterSpacing:0.5}}>1 / 6</div>
        {/* dots */}
        <div style={{position:'absolute',bottom:8,left:'50%',transform:'translateX(-50%)',display:'flex',gap:5,padding:'4px 8px',background:'rgba(20,20,20,0.5)',borderRadius:12}}>
          {[0,1,2,3,4,5].map(i=>(
            <span key={i} style={{width:i===0?14:5,height:5,borderRadius:3,background:i===0?'#fff':'rgba(255,255,255,0.55)'}}/>
          ))}
        </div>
      </div>

      {/* Video (16:9) */}
      <div style={{marginTop:10,position:'relative',aspectRatio:'16 / 9',width:'100%',background:'#111',borderRadius:6,overflow:'hidden'}}>
        <svg width="100%" height="100%" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" style={{display:'block'}}>
          <defs>
            <linearGradient id="mdvid" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#2a2a2a"/>
              <stop offset="1" stopColor="#0f0f0f"/>
            </linearGradient>
          </defs>
          <rect width="320" height="180" fill="url(#mdvid)"/>
        </svg>
        {/* play button */}
        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{width:54,height:54,borderRadius:27,background:'rgba(255,255,255,0.12)',border:'1.5px solid rgba(255,255,255,0.7)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{width:0,height:0,borderTop:'9px solid transparent',borderBottom:'9px solid transparent',borderLeft:'14px solid #fff',marginLeft:4}}/>
          </div>
        </div>
        {/* meta */}
        <div style={{position:'absolute',left:10,bottom:10,display:'flex',gap:6,alignItems:'center'}}>
          <span style={{padding:'2px 6px',background:'rgba(255,255,255,0.14)',color:'#fff',borderRadius:3,fontSize:9,fontFamily:WF.mono,letterSpacing:0.8,textTransform:'uppercase'}}>Видео</span>
          <span style={{color:'rgba(255,255,255,0.75)',fontSize:10,fontFamily:WF.mono}}>4:22</span>
        </div>
        <div style={{position:'absolute',right:10,bottom:10,color:'rgba(255,255,255,0.75)',fontSize:10,fontFamily:WF.mono,letterSpacing:0.5}}>16:9</div>
      </div>

      {/* Lead */}
      <T size={13} color="var(--wf-ink-80)" style={{marginTop:16,lineHeight:1.55}}>
        Премиум-инвертор с ребристым теплообменником увеличенной площади. В нашем тесте 2026-H1 — первое место по итоговому индексу, но платить за это приходится <span style={{fontFamily:WF.mono,fontSize:12}}>+30–40%</span> к среднему классу.
      </T>

      {/* Index + price summary */}
      <div style={{display:'grid',gridTemplateColumns:'1.2fr 1fr',gap:10,marginTop:18}}>
        <div style={{padding:'14px 16px',border:'1px solid var(--wf-accent)',borderRadius:6,background:'var(--wf-accent-bg)'}}>
          <T size={9} color="var(--wf-accent)" weight={600} style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1}}>Индекс</T>
          <div style={{display:'flex',alignItems:'baseline',gap:4,marginTop:6}}>
            <span style={{fontFamily:WF.serif,fontSize:36,fontWeight:700,color:'var(--wf-accent)',letterSpacing:-0.8,lineHeight:1}}>78.8</span>
            <span style={{fontSize:11,color:'var(--wf-accent)',opacity:0.7}}>/100</span>
          </div>
          <T size={10} color="var(--wf-accent)" style={{marginTop:4,opacity:0.85}}>↑ 2.1 к 2025-H2</T>
        </div>
        <div style={{padding:'14px 16px',border:'1px solid var(--wf-border-subtle)',borderRadius:6,background:'var(--wf-paper)'}}>
          <T size={9} color="var(--wf-ink-40)" weight={600} style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1}}>От</T>
          <div style={{fontFamily:WF.serif,fontSize:20,fontWeight:600,letterSpacing:-0.3,marginTop:6,lineHeight:1}}>155 000 ₽</div>
          <T size={10} color="var(--wf-ink-60)" style={{marginTop:4}}>8 предложений</T>
        </div>
      </div>
    </div>

    {/* Horizontal scrollable tabs */}
    <div style={{borderBottom:'1px solid var(--wf-border-subtle)',overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
      <div style={{display:'inline-flex',gap:4,padding:'0 10px',minWidth:'100%'}}>
        {[
          ['overview','Обзор',null],
          ['criteria','Оценки',null],
          ['specs','Характеристики',null],
          ['shops','Где купить',8],
          ['reviews','Отзывы',47],
        ].map(([k,label,count])=>{
          const active = tab===k;
          return (
            <button key={k} onClick={()=>setTab(k)} style={{padding:'14px 10px',background:'transparent',border:0,borderBottom:active?'2px solid var(--wf-ink)':'2px solid transparent',color:active?'var(--wf-ink)':'var(--wf-ink-60)',fontSize:12,fontWeight:active?600:500,whiteSpace:'nowrap',cursor:'pointer',fontFamily:WF.sans}}>
              {label}{count!=null && <span style={{opacity:0.6,marginLeft:4}}>({count})</span>}
            </button>
          );
        })}
      </div>
    </div>

    {/* CRITERIA SECTION */}
    <div data-section="criteria" style={{padding:'22px 18px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:14,gap:10}}>
        <div style={{flex:1,minWidth:0}}>
          <Eyebrow>Оценки</Eyebrow>
          <H size={22} serif style={{marginTop:6,letterSpacing:-0.3,lineHeight:1.1}}>30 параметров · 100 баллов</H>
          <T size={10} color="var(--wf-ink-60)" style={{marginTop:6,fontFamily:WF.mono,lineHeight:1.5}}>Итог = Σ (значение × вес). Эталон = 100.</T>
        </div>
        {/* View switcher — icon-only on mobile */}
        <div style={{display:'inline-flex',border:'1px solid var(--wf-border-subtle)',borderRadius:5,background:'var(--wf-paper)',padding:2,flexShrink:0}}>
          {[
            ['list', 'M3 5h14M3 10h14M3 15h14'],
            ['radar','M10 2 L18 8 L15 17 L5 17 L2 8 Z M10 2 L10 17 M2 8 L18 8 M5 17 L15 17'],
            ['grid', 'M3 3h6v6H3z M11 3h6v6h-6z M3 11h6v6H3z M11 11h6v6h-6z'],
          ].map(([k,icon])=>{
            const active = critView===k;
            return (
              <button key={k} onClick={()=>setCritView(k)} aria-label={k} style={{padding:'7px 10px',border:0,borderRadius:3,background:active?'var(--wf-ink)':'transparent',color:active?'var(--wf-paper)':'var(--wf-ink-60)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={icon}/></svg>
              </button>
            );
          })}
        </div>
      </div>

      {/* VIEW · LIST */}
      {critView==='list' && (
        <div>
          {/* column labels */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 72px 52px 40px',gap:8,padding:'6px 0 8px',borderBottom:'1px solid var(--wf-border-subtle)'}}>
            <T size={9} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1}}>Параметр</T>
            <T size={9} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1,textAlign:'right'}}>Факт</T>
            <T size={9} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1,textAlign:'right'}}>%эт</T>
            <T size={9} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1,textAlign:'right'}}>вес</T>
          </div>
          {CRITERIA.map(([name,value,w,pct,flag])=>{
            const contribution = (w*pct/100);
            return (
              <div key={name} style={{padding:'10px 0',borderBottom:'1px solid var(--wf-border-subtle)'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 72px 52px 40px',gap:8,alignItems:'baseline'}}>
                  <T size={12} weight={500} style={{lineHeight:1.3}}>{name}</T>
                  <T size={11} style={{fontFamily:WF.mono,textAlign:'right'}}>{value}</T>
                  <span style={{fontFamily:WF.serif,fontSize:14,fontWeight:600,color:pct>=75?'var(--wf-accent)':pct>=40?'var(--wf-ink)':'var(--wf-ink-40)',textAlign:'right',letterSpacing:-0.2}}>{pct.toFixed(0)}</span>
                  <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textAlign:'right'}}>{w.toFixed(2)}</T>
                </div>
                <div style={{marginTop:6,display:'flex',alignItems:'center',gap:8}}>
                  <div style={{flex:1}}><Meter value={pct} h={3}/></div>
                  <T size={9} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,flexShrink:0}}>+{contribution.toFixed(2)}</T>
                </div>
                {flag && <T size={9} color={flag.startsWith('выше')?'#1f8f4c':'#b24a3b'} style={{fontFamily:WF.mono,marginTop:4}}>▲ {flag}</T>}
              </div>
            );
          })}
          <div style={{marginTop:14,padding:'12px',border:'1px solid var(--wf-border-subtle)',background:'var(--wf-alt)',borderRadius:5,display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
            <T size={11} weight={600} style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1}}>Σ Итог</T>
            <span style={{fontFamily:WF.serif,fontSize:22,fontWeight:600,color:'var(--wf-accent)',letterSpacing:-0.3}}>78.8</span>
          </div>
        </div>
      )}

      {/* VIEW · RADAR */}
      {critView==='radar' && (()=>{
        // Only parameters with weight > 0 (radar is about what contributes)
        const PTS = CRITERIA.filter(c=>c[2]>0);
        const N = PTS.length;
        const cx=175, cy=175, R=115;
        const pt=(i,r)=>{
          const a = -Math.PI/2 + (i/N)*Math.PI*2;
          return [cx + r*Math.cos(a), cy + r*Math.sin(a)];
        };
        const polygon = PTS.map(([,,,pct],i)=>pt(i,(pct/100)*R).join(',')).join(' ');
        return (
          <div style={{padding:'8px 0 12px'}}>
            <svg width="100%" viewBox="0 0 350 360" style={{display:'block'}}>
              {[20,40,60,80,100].map(p=>(
                <polygon key={p} points={PTS.map((_,i)=>pt(i,(p/100)*R).join(',')).join(' ')} fill="none" stroke="currentColor" strokeOpacity="0.12"/>
              ))}
              {PTS.map(([name],i)=>{
                const [x,y] = pt(i,R);
                const [lx,ly] = pt(i,R+14);
                const a = -Math.PI/2 + (i/N)*Math.PI*2;
                const anchor = Math.cos(a) > 0.2 ? 'start' : Math.cos(a) < -0.2 ? 'end' : 'middle';
                const short = name.length>14 ? name.slice(0,13)+'…' : name;
                return (
                  <g key={name}>
                    <line x1={cx} y1={cy} x2={x} y2={y} stroke="currentColor" strokeOpacity="0.08"/>
                    <text x={lx} y={ly} fontSize="6.5" fill="currentColor" opacity="0.7" textAnchor={anchor} dominantBaseline="middle" fontFamily="ui-sans-serif, system-ui">{short}</text>
                  </g>
                );
              })}
              <polygon points={polygon} fill="var(--wf-accent)" fillOpacity="0.22" stroke="var(--wf-accent)" strokeWidth="1.2"/>
              {PTS.map(([,,,pct],i)=>{
                const [x,y] = pt(i,(pct/100)*R);
                return <circle key={i} cx={x} cy={y} r="2.2" fill="var(--wf-accent)"/>;
              })}
            </svg>
            <div style={{marginTop:10,padding:'10px 12px',background:'var(--wf-alt)',border:'1px solid var(--wf-border-subtle)',borderRadius:5}}>
              <T size={10} color="var(--wf-ink-60)" style={{lineHeight:1.5}}>
                Площадь — <span style={{color:'var(--wf-accent)',fontFamily:WF.serif,fontSize:14,fontWeight:600}}>78.8 / 100</span>. Показаны только параметры с весом &gt; 0.
              </T>
            </div>
          </div>
        );
      })()}

      {/* VIEW · GRID */}
      {critView==='grid' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
          {CRITERIA.map(([name,value,w,pct])=>(
            <div key={name} style={{padding:'10px 10px',border:'1px solid var(--wf-border-subtle)',borderRadius:5,background:'var(--wf-paper)'}}>
              <T size={9} weight={600} style={{lineHeight:1.25,minHeight:22}}>{name}</T>
              <T size={9} color="var(--wf-ink-60)" style={{fontFamily:WF.mono,marginTop:3}}>{value}</T>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginTop:6}}>
                <span style={{fontFamily:WF.serif,fontSize:16,fontWeight:600,color:pct>=75?'var(--wf-accent)':pct>=40?'var(--wf-ink)':'var(--wf-ink-40)',letterSpacing:-0.2,lineHeight:1}}>{pct.toFixed(0)}</span>
                <T size={8} color="var(--wf-ink-40)" style={{fontFamily:WF.mono}}>×{w.toFixed(2)}</T>
              </div>
              <div style={{marginTop:6}}><Meter value={pct} h={2}/></div>
            </div>
          ))}
        </div>
      )}

      <T size={10} color="var(--wf-ink-40)" style={{marginTop:14,fontStyle:'italic'}}>Раскрыть методологию замеров →</T>
    </div>

    {/* PROS / CONS */}
    <div style={{padding:'22px 18px',borderTop:'1px solid var(--wf-border-subtle)',background:'var(--wf-alt)'}}>
      <div style={{marginBottom:18}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:'#1f8f4c'}}/>
          <span style={{fontFamily:WF.mono,fontSize:10,textTransform:'uppercase',letterSpacing:1.2,fontWeight:600,color:'#1f8f4c'}}>Плюсы · 4</span>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {[
            ['Низкий шум (24 дБ)','не мешает спать даже на максимуме'],
            ['Большой теплообменник','устойчивая работа зимой'],
            ['Честный инвертор Panasonic','плавные режимы'],
            ['7 лет гарантии','лидер по сроку'],
          ].map(([a,b],i)=>(
            <div key={i}><T size={13} weight={600}>{a}</T><T size={11} color="var(--wf-ink-60)" style={{marginTop:2,lineHeight:1.45}}>{b}</T></div>
          ))}
        </div>
      </div>
      <div style={{height:1,background:'var(--wf-border-subtle)',margin:'18px 0'}}/>
      <div>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:'#b24a3b'}}/>
          <span style={{fontFamily:WF.mono,fontSize:10,textTransform:'uppercase',letterSpacing:1.2,fontWeight:600,color:'#b24a3b'}}>Минусы · 4</span>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {[
            ['Цена 155 000 ₽','+30–40% к среднему классу'],
            ['Нестабильный Wi-Fi','приложение «забывает» сеть'],
            ['Тяжёлый внешний блок','42 кг, сложный монтаж'],
            ['Ограниченная сеть сервисов','в регионах — только Москва+СПб'],
          ].map(([a,b],i)=>(
            <div key={i}><T size={13} weight={600}>{a}</T><T size={11} color="var(--wf-ink-60)" style={{marginTop:2,lineHeight:1.45}}>{b}</T></div>
          ))}
        </div>
      </div>
    </div>

    {/* VERDICT */}
    <div style={{padding:'22px 18px',borderTop:'1px solid var(--wf-border-subtle)'}}>
      <Eyebrow>Вердикт редакции</Eyebrow>
      <T size={14} style={{marginTop:10,lineHeight:1.55,fontStyle:'italic',fontFamily:WF.serif,fontSize:16}}>«Для квартиры 25–30 м² в московском климате — лучший выбор, если бюджет позволяет. В регионах ждите, пока подтянется сервис.»</T>
      <T size={11} color="var(--wf-ink-60)" style={{marginTop:10,fontFamily:WF.mono}}>— Алексей Т., редактор рейтинга</T>
    </div>

    {/* COMPARE · horizontal scroll */}
    <div style={{padding:'22px 0 22px 18px',borderTop:'1px solid var(--wf-border-subtle)',background:'var(--wf-alt)'}}>
      <div style={{paddingRight:18}}>
        <Eyebrow>Сравнить с ближайшими</Eyebrow>
        <H size={20} serif style={{marginTop:6,letterSpacing:-0.2}}>3 похожие модели</H>
      </div>
      <div style={{display:'flex',gap:10,overflowX:'auto',marginTop:14,paddingRight:18,paddingBottom:4,WebkitOverflowScrolling:'touch'}}>
        {[
          ['FUNAI','RAC-1E1020 INDIVIO','117 000 ₽','77.5','#2','−1.3'],
          ['T-MACON','T-MACON-18','54 700 ₽','76.0','#3','−2.8'],
          ['LG','LH187V8KS','99 000 ₽','76.0','#4','−2.8'],
        ].map(([brand,model,price,idx,rank,diff])=>(
          <div key={model} style={{minWidth:200,maxWidth:200,padding:'14px 14px',border:'1px solid var(--wf-border-subtle)',borderRadius:6,background:'var(--wf-paper)',flexShrink:0}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <BrandLogo name={brand}/>
              <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono}}>{rank}</T>
            </div>
            <T size={11} weight={600} style={{fontFamily:WF.mono,marginTop:10,lineHeight:1.3}}>{model}</T>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginTop:10}}>
              <span style={{fontFamily:WF.serif,fontSize:22,fontWeight:600,color:'var(--wf-ink)',letterSpacing:-0.3,lineHeight:1}}>{idx}</span>
              <T size={10} color="var(--wf-ink-60)" style={{fontFamily:WF.mono}}>{diff}</T>
            </div>
            <div style={{marginTop:8}}><Meter value={parseFloat(idx)} h={3}/></div>
            <T size={11} weight={600} style={{marginTop:12}}>{price}</T>
          </div>
        ))}
      </div>
    </div>

    {/* SPECS accordion preview */}
    <div style={{padding:'22px 18px',borderTop:'1px solid var(--wf-border-subtle)'}}>
      <Eyebrow>Характеристики</Eyebrow>
      <div style={{marginTop:12,display:'flex',flexDirection:'column'}}>
        {[
          ['Энергоэффективность','A+++ / A++'],
          ['Инвертор','Panasonic DC Twin'],
          ['Хладагент','R32'],
          ['Диапазон охлаждения','−15…+50 °C'],
          ['Диапазон обогрева','−25…+30 °C'],
          ['Wi-Fi','встроен'],
        ].map(([k,v],i,arr)=>(
          <div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'11px 0',borderBottom:i<arr.length-1?'1px solid var(--wf-border-subtle)':0}}>
            <T size={12} color="var(--wf-ink-60)">{k}</T>
            <T size={12} weight={600}>{v}</T>
          </div>
        ))}
      </div>
      <button style={{marginTop:14,width:'100%',padding:'11px 16px',background:'transparent',color:'var(--wf-ink)',border:'1px solid var(--wf-border)',borderRadius:6,fontSize:12,fontWeight:500,fontFamily:WF.sans,cursor:'pointer'}}>Все 42 параметра →</button>
    </div>

    {/* Sticky-like bottom bar hint */}
    <div style={{padding:'14px 18px',borderTop:'1px solid var(--wf-border-subtle)',background:'var(--wf-paper)',display:'flex',gap:10,alignItems:'center'}}>
      <div style={{flex:1}}>
        <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1}}>От</T>
        <T size={16} weight={700} style={{fontFamily:WF.serif,letterSpacing:-0.3,marginTop:2}}>155 000 ₽</T>
      </div>
      <button style={{padding:'11px 20px',background:'var(--wf-accent)',color:'#fff',border:0,borderRadius:6,fontSize:12,fontWeight:600,fontFamily:WF.sans,cursor:'pointer'}}>Где купить →</button>
    </div>
  </div>;
}

Object.assign(window,{DetailA,DetailA2,DetailB,DetailC,DetailD,NewsListA,NewsDetailA,MobileNewsList,MobileNewsDetail,CardFamily,IndexViz,Methodology,Submit,Archive,NotFound,FooterA,FooterB,MobileListA,MobileListB,MobileListC,MobileListD,MobileDetailA,Tmpl});
