// Ratings listing wireframes — 4 desktop variants
function ChipRow({items,active=0}){
  return <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{items.map((x,i)=><Pill key={i} active={i===active}>{x}</Pill>)}</div>;
}
function TabRow({items,active=0}){
  return <div style={{display:'flex',gap:22,borderBottom:'1px solid var(--wf-border-subtle)'}}>{items.map((x,i)=>
    <div key={i} style={{padding:'10px 0',borderBottom:i===active?'2px solid var(--wf-accent)':'2px solid transparent',color:i===active?'var(--wf-ink)':'var(--wf-ink-60)',fontSize:12,fontWeight:i===active?600:500,marginBottom:-1}}>{x}</div>
  )}</div>;
}

// Variant A — Hero + editorial leaderboard table
function RatingListA({compact}){
  return <div>
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
          {/* Служебная навигация раздела — чипы */}
          <div style={{marginTop:22,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2,marginRight:6}}>О рейтинге:</T>
            {[
              ['Как мы считаем',true],
              ['Архив моделей',false],
              ['Добавить модель',false],
            ].map(([label,primary],i)=>(
              <a key={i} style={{padding:'6px 12px',border:'1px solid var(--wf-border)',borderRadius:14,fontSize:11,color:primary?'var(--wf-ink)':'var(--wf-ink-60)',fontFamily:WF.sans,fontWeight:primary?600:500,background:primary?'var(--wf-paper)':'transparent',cursor:'pointer',textDecoration:'none',display:'inline-flex',alignItems:'center',gap:5}}>
                {label}
                <span style={{color:'var(--wf-ink-40)',fontSize:10}}>→</span>
              </a>
            ))}
          </div>
        </div>
        <div style={{borderLeft:'1px solid var(--wf-border)',paddingLeft:22}}>
          <div style={{fontSize:10,fontFamily:WF.mono,color:'var(--wf-ink-40)',textTransform:'uppercase',letterSpacing:1.2,marginBottom:12}}>Авторы методики</div>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            {[
              ['Андрей Петров','главный редактор, инженер-теплотехник'],
              ['Ирина Соколова','лаборатория акустики, к. т. н.'],
            ].map(([name,role])=>(
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
    <div style={{padding:'20px 40px 0'}}><TabRow items={['По индексу','Самые тихие','Свой рейтинг']}/></div>
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
    <div style={{padding:'8px 40px 0'}}>
      {[
        [1,'CASARTE','CAS35CU1YDW','155 000 ₽',78.8],
        [2,'FUNAI','RAC-1E1020 INDIVIO','117 000 ₽',77.5],
        [3,'CENTEK','CT-65E09','54 700 ₽',76.0],
        [4,'LG','LH187V8KS','99 000 ₽',76.0],
        [5,'MIDEA','MSAG2-09HRN1','22 500 ₽',72.1],
        [6,'AQUA','AQR-8TS-A7/PA','21 700 ₽',71.5],
        [7,'Jax','ACM-09HE','81 000 ₽',71.4],
        [8,'Haier','HSU-09HNM03','48 500 ₽',70.9],
        [9,'Thaicon','TC-09HRN1','39 900 ₽',70.4],
        [10,'Rovex','RS-09HBS2','34 900 ₽',69.8],
        [11,'Just Aircon','JAC-09HPSA/IGC','42 000 ₽',69.2],
        [12,'Coolberg','CAM-09HBK','38 700 ₽',68.5],
        [13,'Ferrum','FIS09F2/FOS09F2','41 200 ₽',67.9],
        [14,'Mitsubishi Heavy','SRK35ZS-W','32 400 ₽',67.1],
        [15,'Kalashnikov','KCI-09','44 800 ₽',66.4],
        [16,'Keg','KG-09HFN8','28 900 ₽',65.8],
        [17,'Royal Clima','RC-TWN22HN','36 500 ₽',65.2],
        [18,'Ultima Comfort','ECS-09PN','31 400 ₽',64.7],
        [19,'Viomi','KFR-26GW/Y2PC4','46 200 ₽',63.9],
        [20,'Energolux','SAS09L4-A/SAU09L4-A','33 800 ₽',62.4],
      ].map(([rk,brand,model,price,idx])=>{
        const podium = rk<=3;
        const rankColor = 'var(--wf-ink-40)';
        const rankSize = 14;
        const rankFont = WF.mono;
        const rankWeight = 500;
        return (
        <div key={rk} style={{display:'grid',gridTemplateColumns:'56px 180px 60px 160px 1fr 140px 160px',padding:'18px 0',borderBottom:'1px solid var(--wf-border-subtle)',alignItems:'center'}}>
          <div style={{fontFamily:rankFont,fontSize:rankSize,color:rankColor,fontWeight:rankWeight,letterSpacing:-0.5}}>{rk}</div>
          <div style={{height:28,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <BrandLogo name={brand}/>
          </div>
          <div/>
          <T size={13} weight={600} style={{letterSpacing:-0.1}}>{brand}</T>
          <T size={12} color="var(--wf-ink-60)">{model}</T>
          <T size={13} weight={500}>{price}</T>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <Meter value={idx} w={72} h={5}/>
            <T size={15} weight={600} color="var(--wf-accent)" style={{fontFamily:WF.serif,letterSpacing:-0.2}}>{idx}</T>
          </div>
        </div>
      );})}
    </div>
    <div style={{padding:'24px 40px',display:'flex',justifyContent:'center'}}><Btn ghost>Показать ещё 67 моделей</Btn></div>

    {/* SEO-текст раздела */}
    <div style={{padding:'48px 40px 40px',borderTop:'1px solid var(--wf-border-subtle)'}}>
      <div style={{maxWidth:760}}>
        <H size={26} serif style={{letterSpacing:-0.3,textWrap:'balance',marginBottom:16}}>Сравнивайте кондиционеры и сплит-системы не по рекламе, а по измеримым параметрам</H>
        <T size={14} color="var(--wf-ink-60)" style={{lineHeight:1.65,marginBottom:24}}>Мы рассчитываем интегральный индекс качества «Август-климат»: каждая модель получает итоговый балл на основе единой методики с весами критериев.</T>

        <H size={17} serif style={{letterSpacing:-0.2,marginBottom:12,marginTop:8}}>Почему этому рейтингу можно доверять</H>
        <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:28}}>
          {[
            ['Прозрачная методика','оценка строится по понятным критериям и фиксированным весам'],
            ['Проверяемые данные','для параметров указываются источник и статус верификации'],
            ['Независимые измерения','лабораторные показатели учитываются отдельно и влияют на итог'],
            ['Детализация по модели','можно увидеть не только итоговый индекс, но и вклад каждого параметра'],
          ].map(([title,body])=>(
            <div key={title} style={{display:'grid',gridTemplateColumns:'10px 1fr',gap:12,alignItems:'baseline'}}>
              <span style={{width:4,height:4,background:'var(--wf-accent)',borderRadius:'50%',marginTop:7}}/>
              <T size={13} style={{lineHeight:1.6}}><span style={{fontWeight:600}}>{title}</span> <span style={{color:'var(--wf-ink-60)'}}>— {body}</span></T>
            </div>
          ))}
        </div>

        <H size={17} serif style={{letterSpacing:-0.2,marginBottom:12}}>Как читать рейтинг</H>
        <T size={14} color="var(--wf-ink-60)" style={{lineHeight:1.65,marginBottom:20}}>В таблице сплит-системы отсортированы по итоговому индексу. Можно включить режим «Самые тихие» для выбора по акустическому комфорту или собрать собственный рейтинг, отключив неважные для вас критерии.</T>

        <T size={14} color="var(--wf-ink)" style={{lineHeight:1.65,fontStyle:'italic',paddingLeft:16,borderLeft:'3px solid var(--wf-accent)'}}>Этот рейтинг помогает быстро выбрать кондиционер или сплит-систему под ваши приоритеты — с опорой на данные, а не на маркетинговые обещания.</T>
      </div>
    </div>
    {/* Футер раздела — служебная навигация с группировкой */}
    <div style={{padding:'32px 40px',borderTop:'1px solid var(--wf-border-subtle)',background:'var(--wf-alt)'}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:40}}>
        {[
          ['Прозрачность',['Методика рейтинга','Веса критериев','История изменений']],
          ['Участие',['Добавить модель','Сообщить о замерах','Для производителей']],
          ['Архив',['Модели 2023','Модели 2022','Снятые с производства']],
        ].map(([group,links])=>(
          <div key={group}>
            <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2,marginBottom:10}}>{group}</T>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {links.map(l=><T key={l} size={12} color="var(--wf-ink-60)" style={{cursor:'pointer'}}>{l} →</T>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>;
}

// Variant B — Card grid w/ donut index
function RatingListB(){
  return <div>
    <div style={{padding:'32px 40px 20px',borderBottom:'1px solid var(--wf-border-subtle)'}}>
      <Eyebrow>Рейтинг кондиционеров 2026</Eyebrow>
      <H size={30} style={{marginTop:6}}>87 моделей, проверенных в лаборатории</H>
      <T size={13} color="var(--wf-ink-60)" style={{marginTop:8,maxWidth:620}}>Фильтруйте по цене, шуму, мощности. Нажмите ➕, чтобы сравнить до 3 моделей side-by-side.</T>
    </div>
    <div style={{padding:'16px 40px',display:'flex',gap:8,borderBottom:'1px solid var(--wf-border-subtle)',alignItems:'center'}}>
      <TabRow items={['По индексу','Самые тихие','Свой рейтинг']}/>
      <div style={{flex:1}}/>
      <Box w={32} h={32} bg="var(--wf-chip)" radius={4}><Icon d={ICONS.grid} size={14} color="var(--wf-accent)"/></Box>
      <Box w={32} h={32} bg="transparent" radius={4}><Icon d={ICONS.list} size={14} color="var(--wf-ink-40)"/></Box>
    </div>
    <div style={{padding:'20px 40px',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
      {[['CASARTE','CAS35CU1YDW',78.8,'155 000 ₽',1,'C',true],['FUNAI','RAC-1E1020',77.5,'117 000 ₽',2,'F'],['T-MACON','TMC-18',76,'54 700 ₽',3,'T'],['LG','LH187V8KS',76,'99 000 ₽',4,'L'],['MDV','MDGAF-09HRFN8',72.1,'22 500 ₽',5,'M'],['Mitsubishi','SRK35ZS-W',71.4,'81 000 ₽',6,'M']].map(([brand,model,idx,price,rk,letter,hot])=>(
        <div key={rk} style={{border:'1px solid var(--wf-border-subtle)',borderRadius:6,padding:14,background:'var(--wf-paper)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <LogoBox size={30} letter={letter}/>
              <div><T size={11} color="var(--wf-ink-60)">{brand}</T><T size={13} weight={600}>{model}</T></div>
            </div>
            <Donut value={idx} size={52} stroke={5}/>
          </div>
          <Box w="100%" h={88} striped radius={4} label="фото модели" style={{marginBottom:10}}/>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:6}}>
            <div>
              <T size={10} color="var(--wf-ink-40)">#{rk} · {hot?'рекорд тишины':'-'}</T>
              <T size={13} weight={600} style={{marginTop:2}}>{price}</T>
            </div>
            <div style={{display:'flex',gap:6}}>
              <Box w={26} h={26} radius={3} bg="transparent" style={{border:'1px solid var(--wf-border)'}}><Icon d={ICONS.plus} size={10}/></Box>
              <Btn size="sm" ghost>Открыть →</Btn>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>;
}

// Variant C — Side filters + dense data table
function RatingListC(){
  return <div style={{display:'grid',gridTemplateColumns:'240px 1fr'}}>
    <div style={{borderRight:'1px solid var(--wf-border-subtle)',padding:'20px 18px',background:'var(--wf-alt)'}}>
      <Eyebrow>Фильтры</Eyebrow>
      {[['Бренд',['Все','Mitsubishi','LG','Haier','Midea','+12']],['Цена',['<30к','30–70к','70–150к','>150к']],['Шум ниже',['24 дБ','28 дБ','32 дБ']],['Инвертор',['Есть','Нет']],['Wi-Fi',['Есть','Нет']]].map(([g,opts])=>(
        <div key={g} style={{marginTop:18}}>
          <T size={10} weight={600} color="var(--wf-ink-60)" style={{textTransform:'uppercase',letterSpacing:1.2,marginBottom:6}}>{g}</T>
          <div style={{display:'flex',flexWrap:'wrap',gap:4}}>{opts.map((o,i)=><Pill key={o} active={i===0&&g==='Бренд'} style={{fontSize:10,padding:'2px 8px'}}>{o}</Pill>)}</div>
        </div>
      ))}
      <div style={{marginTop:20,paddingTop:14,borderTop:'1px solid var(--wf-border-subtle)'}}><Btn ghost w="100%" size="sm">Сбросить фильтры</Btn></div>
    </div>
    <div>
      <div style={{padding:'18px 24px',borderBottom:'1px solid var(--wf-border-subtle)',display:'flex',alignItems:'center',gap:14}}>
        <H size={18}>Рейтинг кондиционеров</H>
        <Pill tone="accent">27 из 87</Pill>
        <div style={{flex:1}}/>
        <T size={11} color="var(--wf-ink-60)">Сортировка:</T>
        <Pill active>Индекс ↓</Pill>
        <Pill>Цена ↑</Pill>
        <Pill>Шум ↑</Pill>
      </div>
      <div style={{padding:'0 24px'}}>
        <div style={{display:'grid',gridTemplateColumns:'28px 1.3fr 1.7fr 70px 70px 70px 90px 70px 40px',padding:'10px 0',borderBottom:'1px solid var(--wf-border-subtle)',fontFamily:WF.mono,fontSize:9,color:'var(--wf-ink-40)',textTransform:'uppercase',letterSpacing:1}}>
          <div>#</div><div>Бренд</div><div>Модель</div><div>Шум</div><div>SEER</div><div>Гарантия</div><div>Цена</div><div>Индекс</div><div></div>
        </div>
        {[[1,'C','CASARTE','CAS35CU1YDW','24 дБ','6.5','7 лет','155 000 ₽',78.8],[2,'F','FUNAI','RAC-1E1020 INDIVIO','26 дБ','6.2','5 лет','117 000 ₽',77.5],[3,'T','T-MACON','T-MACON-18','28 дБ','5.9','5 лет','54 700 ₽',76.0],[4,'L','LG','LH187V8KS','27 дБ','6.1','7 лет','99 000 ₽',76.0],[5,'M','MDV','MDGAF-09HRFN8','30 дБ','5.5','3 года','22 500 ₽',72.1],[6,'A','AQUA','AQR-8TS-A7/PA','31 дБ','5.4','3 года','21 700 ₽',71.5],[7,'M','Mitsubishi Heavy','SRK35ZS-W','25 дБ','6.0','5 лет','81 000 ₽',71.4],[8,'H','Haier','A2SE12RB5FA-S','26 дБ','5.8','5 лет','24 900 ₽',69.5]].map(([rk,letter,brand,model,noise,seer,warr,price,idx])=>(
          <div key={rk} style={{display:'grid',gridTemplateColumns:'28px 1.3fr 1.7fr 70px 70px 70px 90px 70px 40px',padding:'9px 0',borderBottom:'1px solid var(--wf-border-subtle)',alignItems:'center'}}>
            <T size={11} color="var(--wf-ink-40)">{rk}</T>
            <div style={{display:'flex',gap:6,alignItems:'center'}}><LogoBox size={20} letter={letter}/><T size={11}>{brand}</T></div>
            <T size={11} color="var(--wf-ink-60)">{model}</T>
            <T size={11}>{noise}</T><T size={11}>{seer}</T><T size={11}>{warr}</T><T size={11} weight={500}>{price}</T>
            <T size={12} weight={600} color="var(--wf-accent)">{idx}</T>
            <Icon d={ICONS.plus} size={11} color="var(--wf-ink-40)"/>
          </div>
        ))}
      </div>
    </div>
  </div>;
}

// Variant D — Magazine: featured hero model + top 3 + the rest
function RatingListD(){
  return <div>
    <div style={{padding:'28px 40px 12px'}}>
      <Eyebrow>Лучший выбор редакции · апрель 2026</Eyebrow>
    </div>
    <div style={{padding:'0 40px 28px',display:'grid',gridTemplateColumns:'1.3fr 1fr',gap:32,borderBottom:'1px solid var(--wf-border-subtle)'}}>
      <Box w="100%" h={280} striped radius={6} label="hero shot · главная модель"/>
      <div style={{paddingTop:12}}>
        <div style={{display:'flex',gap:10,marginBottom:12}}><Pill tone="accent">№ 1 по индексу</Pill><Pill>Тихий</Pill><Pill>Инвертор</Pill></div>
        <H size={36} serif>CASARTE CAS35CU1YDW</H>
        <T size={14} color="var(--wf-ink-60)" style={{marginTop:12,maxWidth:440}}>Самый высокий индекс в 2026 году — 78.8. Рекордно низкий шум (24 дБ) и самая большая площадь теплообменника среди всех протестированных моделей.</T>
        <div style={{display:'flex',gap:24,marginTop:22,alignItems:'center'}}>
          <Donut value={78.8} size={72} stroke={7}/>
          <div>
            <T size={11} color="var(--wf-ink-40)">Рекомендуемая цена</T>
            <H size={22} style={{marginTop:2}}>155 000 ₽</H>
          </div>
          <Btn primary>Подробнее →</Btn>
        </div>
      </div>
    </div>
    <div style={{padding:'24px 40px 12px',display:'flex',alignItems:'center',gap:12}}>
      <H size={18}>Вся таблица — 87 моделей</H>
      <Pill>По индексу</Pill><Pill>Самые тихие</Pill><Pill>Свой рейтинг</Pill>
      <div style={{flex:1}}/>
      <Icon d={ICONS.filter} size={14} color="var(--wf-ink-60)"/><T size={11} color="var(--wf-ink-60)">Фильтры</T>
    </div>
    <div style={{padding:'0 40px'}}>
      {[[2,'F','FUNAI','RAC-1E1020',77.5,'117 000 ₽'],[3,'T','T-MACON','T-MACON-18',76,'54 700 ₽'],[4,'L','LG','LH187V8KS',76,'99 000 ₽'],[5,'M','MDV','MDGAF-09HRFN8',72.1,'22 500 ₽']].map(([rk,letter,brand,model,idx,price])=>(
        <div key={rk} style={{display:'grid',gridTemplateColumns:'28px 30px 1.4fr 2fr 1fr 80px 40px',padding:'14px 0',borderBottom:'1px solid var(--wf-border-subtle)',alignItems:'center'}}>
          <T size={11} color="var(--wf-ink-40)">{rk}</T>
          <LogoBox size={24} letter={letter}/>
          <T size={13} weight={500}>{brand}</T>
          <T size={12} color="var(--wf-ink-60)">{model}</T>
          <T size={12} weight={500}>{price}</T>
          <div style={{display:'flex',alignItems:'center',gap:6}}><Meter value={idx} w={40} h={3}/><T size={12} weight={600} color="var(--wf-accent)">{idx}</T></div>
          <Icon d={ICONS.chevronR} size={12} color="var(--wf-ink-40)"/>
        </div>
      ))}
    </div>
  </div>;
}

Object.assign(window,{RatingListA,RatingListB,RatingListC,RatingListD,ListingNavSubbar,ListingNavChips});

// ═══════════════════════════════════════════════════════════
// Служебная навигация раздела — 2 варианта решения.
// Показываем ТОЛЬКО верхнюю часть листинга (hero + первые строки таблицы),
// чтобы было видно нав-решение без дублирования всего листинга.
// Утверждённый LIST-A не трогаем.
// ═══════════════════════════════════════════════════════════

// Маленькая заглушка «остальное как в LIST-A» — даёт контекст без дублирования.
function ListingFoldPreview(){
  return <>
    <div style={{padding:'14px 40px',borderBottom:'1px solid var(--wf-border-subtle)',display:'flex',alignItems:'baseline',gap:16,background:'var(--wf-paper)'}}>
      <H size={18}>Вся таблица — 87 моделей</H>
      <Pill>По индексу</Pill><Pill>Самые тихие</Pill><Pill>Свой рейтинг</Pill>
      <div style={{flex:1}}/>
      <T size={11} color="var(--wf-ink-60)">Фильтры</T>
    </div>
    <div style={{padding:'0 40px'}}>
      {[[2,'F','FUNAI','RAC-1E1020',77.5,'117 000 ₽'],[3,'T','T-MACON','T-MACON-18',76,'54 700 ₽']].map(([rk,letter,brand,model,idx,price])=>(
        <div key={rk} style={{display:'grid',gridTemplateColumns:'28px 30px 1.4fr 2fr 1fr 80px 40px',padding:'14px 0',borderBottom:'1px solid var(--wf-border-subtle)',alignItems:'center'}}>
          <T size={11} color="var(--wf-ink-40)">{rk}</T>
          <LogoBox size={24} letter={letter}/>
          <T size={13} weight={500}>{brand}</T>
          <T size={12} color="var(--wf-ink-60)">{model}</T>
          <T size={12} weight={500}>{price}</T>
          <div style={{display:'flex',alignItems:'center',gap:6}}><Meter value={idx} w={40} h={3}/><T size={12} weight={600} color="var(--wf-accent)">{idx}</T></div>
        </div>
      ))}
      <div style={{padding:'16px 0',textAlign:'center'}}>
        <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,letterSpacing:1,textTransform:'uppercase'}}>· · · листинг продолжается как в LIST-A · · ·</T>
      </div>
    </div>
  </>;
}

// ─── Вариант A · Sub-nav bar под SectionHeader ───────────────
function ListingNavSubbar(){
  return <div>
    {/* Section header */}
    <div style={{padding:'22px 32px',borderBottom:'1px solid var(--wf-border-subtle)',background:'var(--wf-alt)'}}>
      <Eyebrow>раздел</Eyebrow><H size={24} style={{marginTop:6}}>Рейтинг кондиционеров</H>
    </div>
    {/* Sub-nav */}
    <div style={{display:'flex',gap:0,padding:'0 32px',background:'var(--wf-paper)',borderBottom:'1px solid var(--wf-border-subtle)'}}>
      {[['Рейтинг',true],['Методика',false],['Архив',false],['Добавить модель',false]].map(([label,active],i)=>(
        <div key={i} style={{padding:'14px 20px',borderBottom:active?'2px solid var(--wf-accent)':'2px solid transparent',marginBottom:-1,fontSize:12,fontWeight:active?600:500,color:active?'var(--wf-ink)':'var(--wf-ink-60)',fontFamily:WF.sans,cursor:'pointer'}}>
          {label}
        </div>
      ))}
    </div>
    {/* Hero — уменьшенная версия из LIST-A */}
    <div style={{padding:'32px 40px 28px',background:'var(--wf-alt)',borderBottom:'1px solid var(--wf-border-subtle)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
        <Eyebrow>Независимый рейтинг · обновление 04.2026</Eyebrow>
        <div style={{display:'flex',gap:24,alignItems:'baseline'}}>
          {[['87','моделей'],['33','критерия'],['4','года']].map(([n,l])=>(
            <div key={l} style={{display:'flex',gap:6,alignItems:'baseline'}}>
              <span style={{fontFamily:WF.serif,fontSize:20,fontWeight:600,letterSpacing:-0.5}}>{n}</span>
              <span style={{fontSize:11,color:'var(--wf-ink-60)'}}>{l}</span>
            </div>
          ))}
        </div>
      </div>
      <H size={28} serif style={{lineHeight:1.2,letterSpacing:-0.5,textWrap:'balance',maxWidth:780}}>Интегральный индекс «Август-климат» качества бытовых кондиционеров.</H>
      <div style={{marginTop:18,display:'flex',gap:10,alignItems:'center'}}>
        <button style={{padding:'10px 18px',background:'var(--wf-ink)',color:'var(--wf-paper)',border:0,borderRadius:5,fontSize:12,fontWeight:600,fontFamily:WF.sans,cursor:'pointer'}}>Смотреть таблицу ↓</button>
        <T size={11} color="var(--wf-ink-60)" style={{fontFamily:WF.mono}}>— обновлено 12 апреля 2026 —</T>
      </div>
    </div>
    <ListingFoldPreview/>
  </div>;
}

// ─── Вариант F · Chips в hero + футер раздела ────────────────
function ListingNavChips(){
  return <div>
    {/* Section header */}
    <div style={{padding:'22px 32px',borderBottom:'1px solid var(--wf-border-subtle)',background:'var(--wf-alt)'}}>
      <Eyebrow>раздел</Eyebrow><H size={24} style={{marginTop:6}}>Рейтинг кондиционеров</H>
    </div>
    {/* Hero */}
    <div style={{padding:'32px 40px 28px',background:'var(--wf-alt)',borderBottom:'1px solid var(--wf-border-subtle)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
        <Eyebrow>Независимый рейтинг · обновление 04.2026</Eyebrow>
        <div style={{display:'flex',gap:24,alignItems:'baseline'}}>
          {[['87','моделей'],['33','критерия'],['4','года']].map(([n,l])=>(
            <div key={l} style={{display:'flex',gap:6,alignItems:'baseline'}}>
              <span style={{fontFamily:WF.serif,fontSize:20,fontWeight:600,letterSpacing:-0.5}}>{n}</span>
              <span style={{fontSize:11,color:'var(--wf-ink-60)'}}>{l}</span>
            </div>
          ))}
        </div>
      </div>
      <H size={28} serif style={{lineHeight:1.2,letterSpacing:-0.5,textWrap:'balance',maxWidth:780}}>Интегральный индекс «Август-климат» качества бытовых кондиционеров.</H>
      {/* Chips row — компактная служебная навигация прямо в hero */}
      <div style={{marginTop:20,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2,marginRight:6}}>О рейтинге:</T>
        {[
          ['Как мы считаем',true],
          ['Архив моделей',false],
          ['Добавить модель',false],
        ].map(([label,primary],i)=>(
          <a key={i} style={{padding:'6px 12px',border:'1px solid var(--wf-border)',borderRadius:14,fontSize:11,color:primary?'var(--wf-ink)':'var(--wf-ink-60)',fontFamily:WF.sans,fontWeight:primary?600:500,background:primary?'var(--wf-paper)':'transparent',cursor:'pointer',textDecoration:'none',display:'inline-flex',alignItems:'center',gap:5}}>
            {label}
            <span style={{color:'var(--wf-ink-40)',fontSize:10}}>→</span>
          </a>
        ))}
      </div>
    </div>
    <ListingFoldPreview/>
    {/* Section footer — дублирует ссылки с группировкой */}
    <div style={{padding:'28px 40px',borderTop:'1px solid var(--wf-border-subtle)',background:'var(--wf-alt)'}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:40}}>
        {[
          ['Прозрачность',['Методика рейтинга','Веса критериев','История изменений']],
          ['Участие',['Добавить модель','Сообщить о замерах','Для производителей']],
          ['Архив',['Модели 2023','Модели 2022','Снятые с производства']],
        ].map(([group,links])=>(
          <div key={group}>
            <T size={10} color="var(--wf-ink-40)" style={{fontFamily:WF.mono,textTransform:'uppercase',letterSpacing:1.2,marginBottom:10}}>{group}</T>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {links.map(l=><T key={l} size={12} color="var(--wf-ink-60)" style={{cursor:'pointer'}}>{l} →</T>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>;
}
