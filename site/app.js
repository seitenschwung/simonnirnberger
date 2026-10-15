const works = [{"id":13,"title":"Werk 13","type":"Malerei","category":"malerei","full":"assets/artworks/13_turquoise-red-skull.webp","thumbnail":"assets/thumbs/13_turquoise-red-skull.webp","width":1321,"height":1917,"description":"Farbintensive Malerei eines surrealen Schädels in Türkis- und Rottönen."},{"id":4,"title":"Werk 04","type":"Zeichnung","category":"zeichnung","full":"assets/artworks/04_surreal-ink-face.webp","thumbnail":"assets/thumbs/04_surreal-ink-face.webp","width":881,"height":1381,"description":"Dichte Schwarz-Weiß-Zeichnung mit organischen, verschlungenen Gesichtsformen."},{"id":5,"title":"Werk 05","type":"Malerei","category":"malerei","full":"assets/artworks/05_red-abstract-portrait.webp","thumbnail":"assets/thumbs/05_red-abstract-portrait.webp","width":1495,"height":2030,"description":"Leuchtend rote und cremefarbene abstrakte Malerei mit organischen Konturen."},{"id":8,"title":"Werk 08","type":"Zeichnung","category":"zeichnung","full":"assets/artworks/08_stone-wall-portal.webp","thumbnail":"assets/thumbs/08_stone-wall-portal.webp","width":986,"height":1417,"description":"Schwarz-Weiß-Zeichnung eines dunklen runden Portals in einer strukturierten Steinwand."},{"id":3,"title":"Werk 03","type":"Malerei","category":"malerei","full":"assets/artworks/03_green-yellow-abstract.webp","thumbnail":"assets/thumbs/03_green-yellow-abstract.webp","width":1518,"height":2030,"description":"Abstrakte grün-gelbe Malerei mit geschwungenen Formen auf dunklem Grund."},{"id":11,"title":"Werk 11","type":"Zeichnung","category":"zeichnung","full":"assets/artworks/11_abstract-body-ink.webp","thumbnail":"assets/thumbs/11_abstract-body-ink.webp","width":835,"height":1131,"description":"Schwarz-Weiß-Zeichnung einer organischen, menschenähnlichen Figur mit verschränkten Gliedmaßen."},{"id":1,"title":"Werk 01","type":"Malerei","category":"malerei","full":"assets/artworks/01_crimson-vessel.webp","thumbnail":"assets/thumbs/01_crimson-vessel.webp","width":1040,"height":1430,"description":"Rote Malerei mit einem gefäßartigen Zentrum und organischen, muschelartigen Formen."},{"id":9,"title":"Werk 09","type":"Zeichnung","category":"zeichnung","full":"assets/artworks/09_surreal-moon-figures.webp","thumbnail":"assets/thumbs/09_surreal-moon-figures.webp","width":1070,"height":1505,"description":"Surreale Schwarz-Weiß-Zeichnung zweier Figuren unter einem kreisförmigen Himmelskörper."},{"id":12,"title":"Werk 12","type":"Malerei","category":"malerei","full":"assets/artworks/12_blue-red-abstract.webp","thumbnail":"assets/thumbs/12_blue-red-abstract.webp","width":1475,"height":2015,"description":"Malerei aus ineinanderfließenden Formen in Blau, Violett und Rot."},{"id":6,"title":"Werk 06","type":"Zeichnung","category":"zeichnung","full":"assets/artworks/06_stone-wall-creature.webp","thumbnail":"assets/thumbs/06_stone-wall-creature.webp","width":1387,"height":1064,"description":"Tintenzeichnung eines surrealen Kopfes, eingerahmt von gemusterten Steinblöcken."},{"id":2,"title":"Werk 02","type":"Zeichnung","category":"zeichnung","full":"assets/artworks/02_mechanical-figure.webp","thumbnail":"assets/thumbs/02_mechanical-figure.webp","width":858,"height":1054,"description":"Schwarz-Weiß-Zeichnung einer zylindrischen, beinartigen mechanischen Figur."},{"id":10,"title":"Werk 10","type":"Zeichnung","category":"zeichnung","full":"assets/artworks/10_infinite-corridor.webp","thumbnail":"assets/thumbs/10_infinite-corridor.webp","width":1012,"height":1513,"description":"Schwarz-Weiß-Zeichnung einer perspektivischen Folge von Architekturformen."},{"id":7,"title":"Werk 07","type":"Zeichnung","category":"zeichnung","full":"assets/artworks/07_organic-figure-ink.webp","thumbnail":"assets/thumbs/07_organic-figure-ink.webp","width":1044,"height":1422,"description":"Schwarz-Weiß-Zeichnung einer vielschichtigen organischen Figur mit spiraliger Kopfform."}];
/* SIMON ERNST NIRNBERGER — Edition 04
 * Standalone vanilla JS. No frameworks, trackers, external network calls or scroll hijacking.
 * Artworks are listed in artworks.json and embedded here to support direct local preview.
 */
const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
const clamp = (n, min=0, max=1) => Math.max(min, Math.min(max, n));
const mix = (a, b, t) => a + (b-a)*t;
const ease = t => { t=clamp(t); return t*t*(3-2*t); };
const range = (n, a, b) => ease((n-a)/(b-a));
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)');
const saveData = navigator.connection?.saveData === true;
const motionAllowed = () => !prefersReduced.matches && !saveData;
const two = n => String(n).padStart(2,'0');
const announce = message => { $('#announcement').textContent=message; };
$$('.year').forEach(el => el.textContent=String(new Date().getFullYear()));

/* ------------------ Editorial menu ------------------ */
const menu=$('#site-menu'), menuToggle=$('#menu-toggle'), menuClose=$('#menu-close');
const menuImage=$('#menu-preview-image');
const menuArt={'13':'13_turquoise-red-skull','04':'04_surreal-ink-face','09':'09_surreal-moon-figures','05':'05_red-abstract-portrait'};
let menuFocus=null, previewRequest=0;
function setMenu(open, restore=true){
  if(open && $('#lightbox').classList.contains('is-open')) return;
  if(open){
    menuFocus=document.activeElement;
    menu.inert=false;
    menu.setAttribute('aria-hidden','false');
    menu.classList.add('is-open');
    menuToggle.setAttribute('aria-expanded','true');
    menuToggle.setAttribute('aria-label','Menü schließen');
    document.body.classList.add('locked','menu-is-open');
    menuClose.focus({preventScroll:true});
  }else{
    menu.classList.remove('is-open');
    menu.inert=true;
    menu.setAttribute('aria-hidden','true');
    menuToggle.setAttribute('aria-expanded','false');
    menuToggle.setAttribute('aria-label','Menü öffnen');
    document.body.classList.remove('locked','menu-is-open');
    if(restore && menuFocus?.isConnected) menuFocus.focus({preventScroll:true});
  }
}
menuToggle.addEventListener('click',()=>setMenu(!menu.classList.contains('is-open')));
menuClose.addEventListener('click',()=>setMenu(false));
async function updateMenuPreview(link){
  if(!motionAllowed()) return;
  const id=link.dataset.menuPreview, file=menuArt[id];
  if(!file) return;
  const src=`assets/thumbs/${file}.webp`;
  if(menuImage.getAttribute('src')===src) return;
  const request=++previewRequest;
  const preload=new Image(); preload.src=src;
  try { await preload.decode(); } catch { return; }
  if(request!==previewRequest || !menu.classList.contains('is-open')) return;
  menuImage.src=src;
  menuImage.animate([
    {opacity:.15,transform:'scale(1.09) rotate(-1deg)',filter:'blur(9px)'},
    {opacity:1,transform:'scale(1)',filter:'blur(0px)'}
  ],{duration:550,easing:'cubic-bezier(.19,1,.22,1)'});
}
$$('.menu-link').forEach(link=>{
  link.addEventListener('click',()=>{
    setMenu(false,false);
    const id=link.getAttribute('href').slice(1);
    requestAnimationFrame(()=>document.getElementById(id)?.focus({preventScroll:true}));
  });
  link.addEventListener('pointerenter',()=>updateMenuPreview(link));
  link.addEventListener('focus',()=>updateMenuPreview(link));
});

/* ------------------ Gallery ------------------ */
const gallery=$('#gallery');
const frameColors=['#dfd6cc','#d8d3ca','#e0dad1','#d5cec5','#ddd5c5','#d8d1c6','#e6dcd1'];
let activeFilter='all', currentWork=null, viewerReturnFocus=null, imageSwitchAnimation=null;
const visibleWorks=()=>works.filter(w=>activeFilter==='all'||w.category===activeFilter);
const findWork=id=>works.find(w=>w.id===Number(id));
const useFilter=category=>['all','zeichnung','malerei'].includes(category);
const cardById=id=>gallery.querySelector(`[data-work="${Number(id)}"]`);
for(const [index,work] of works.entries()){
  const card=document.createElement('article');
  card.className='work'; card.dataset.category=work.category; card.dataset.work=String(work.id);
  card.style.setProperty('--stagger',`${(index%3)*55}ms`);
  card.style.setProperty('--frame',frameColors[index%frameColors.length]);
  card.style.setProperty('--ratio',work.width>work.height?'5 / 4':'4 / 5');
  const label=`Werk ${two(work.id)}`;
  card.innerHTML=`<button class="work-button" type="button" aria-label="${label}, ${work.type} in Großansicht öffnen" data-open-work="${work.id}">
    <span class="work-frame"><img src="${work.thumbnail}" alt="${work.description}" width="${work.width}" height="${work.height}" loading="lazy" decoding="async" fetchpriority="low"><span class="work-number" aria-hidden="true">${two(index+1)} / ${two(works.length)}</span><span class="work-view" aria-hidden="true">↗</span></span>
    <span class="work-meta"><span class="work-title">${label}</span><span class="work-type">${work.type}</span></span>
    </button>`;
  gallery.append(card);
}
gallery.addEventListener('click', event=>{
  const button=event.target.closest('[data-open-work]');
  if(button) openLightbox(Number(button.dataset.openWork),button.querySelector('.work-frame img'));
});
// Preload a full-size image only on intent: hover or keyboard focus, not every artwork.
const preloaded=new Set();
function preloadArtwork(id){
  if(saveData || preloaded.has(id))return;
  const work=findWork(id);if(!work)return;
  preloaded.add(id);
  const img=new Image();img.src=work.full;
}
gallery.addEventListener('pointerover',event=>{
  if(event.pointerType==='touch')return;
  const button=event.target.closest('[data-open-work]');
  if(button)preloadArtwork(Number(button.dataset.openWork));
});
gallery.addEventListener('focusin',event=>{
  const button=event.target.closest('[data-open-work]');
  if(button)preloadArtwork(Number(button.dataset.openWork));
});
function updateFilter(category,animate=true){
  if(!useFilter(category))return;
  activeFilter=category;
  $$('.filter').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.filter===category)));
  const shown=[];
  $$('.work').forEach(el=>{
    const hidden=category!=='all' && el.dataset.category!==category;
    el.hidden=hidden;
    el.classList.toggle('is-hidden',hidden);
    if(!hidden){el.classList.add('in-view');shown.push(el);}
  });
  const description=category==='all'?'alle Techniken':category==='zeichnung'?'Zeichnungen':'Malerei';
  $('#gallery-status').textContent=`${shown.length} Werke werden angezeigt: ${description}.`;
  if(animate && motionAllowed()){
    shown.forEach((card,index)=>card.animate([
      {opacity:.28,transform:'translateY(20px)'},{opacity:1,transform:'translateY(0)'}
    ],{duration:520,delay:Math.min(index*38,220),easing:'cubic-bezier(.19,1,.22,1)'}));
  }
}
$$('.filter').forEach(button=>button.addEventListener('click',()=>{
  if(button.dataset.filter!==activeFilter)updateFilter(button.dataset.filter);
}));

/* ------------------ Focus-safe, shareable artwork viewer ------------------ */
const lightbox=$('#lightbox'), lightImage=$('#lightbox-image');
const lightTitle=$('#lightbox-title'),lightType=$('#lightbox-type');
const lightCounter=$('#lightbox-counter'),lightClose=$('#lightbox-close');
const shareButton=$('#share-work');
let touchOrigin=null, imageRequest=0, transitionActive=false;
function shareUrl(id){
  const url=new URL(window.location.href);
  if(id)url.searchParams.set('werk',String(id));
  else url.searchParams.delete('werk');
  return url;
}
function updateUrl(id){
  if(!['http:','https:'].includes(location.protocol)) return; // Local file/data previews remain usable.
  const url=shareUrl(id);
  if(window.location.href!==url.href)history.replaceState(history.state,'',url.pathname+url.search+url.hash);
}
function loadFullArt(work){
  const ticket=++imageRequest;
  // Show the tiny image immediately while the full-resolution original decodes.
  lightImage.src=work.thumbnail;
  const image=new Image();image.src=work.full;
  const commit=()=>{
    if(ticket===imageRequest && currentWork===work.id) lightImage.src=work.full;
  };
  image.decode().then(commit).catch(()=>{if(image.complete && image.naturalWidth)commit();});
}
function applyWork(id, direction=0, syncUrl=true){
  const work=findWork(id); if(!work)return;
  currentWork=work.id;
  lightTitle.textContent=`Werk ${two(work.id)}`;
  lightType.textContent=work.type;
  $('#lightbox-description').textContent=work.description;
  lightImage.alt=work.description;
  const list=visibleWorks(), at=list.findIndex(w=>w.id===work.id);
  lightCounter.textContent=`${two(at+1)} / ${two(list.length)}`;
  if(imageSwitchAnimation){imageSwitchAnimation.cancel();imageSwitchAnimation=null;}
  loadFullArt(work);
  if(syncUrl)updateUrl(work.id);
  if(direction && motionAllowed()){
    imageSwitchAnimation=lightImage.animate([
      {opacity:.35,transform:`translate3d(${direction*34}px,0,0) scale(.975)`},
      {opacity:1,transform:'translate3d(0,0,0) scale(1)'}
    ],{duration:480,easing:'cubic-bezier(.19,1,.22,1)'});
  }
  const next=list[(at+1)%list.length];
  if(next && motionAllowed() && !saveData)preloadArtwork(next.id);
}
function transitionArtwork(mutator, from, to){
  if(!motionAllowed() || !document.startViewTransition || !from || !to){mutator();return;}
  from.style.viewTransitionName='work-morph';
  const animation=document.startViewTransition(()=>{
    from.style.viewTransitionName='none';
    mutator();
    to.style.viewTransitionName='work-morph';
  });
  animation.finished.finally(()=>{
    from.style.viewTransitionName='none';
    to.style.viewTransitionName='none';
  }).catch(()=>{});
}
function openLightbox(id, origin=null, syncUrl=true){
  const work=findWork(id);if(!work)return;
  if(menu.classList.contains('is-open'))setMenu(false,false);
  if(lightbox.classList.contains('is-open')){applyWork(id,0,syncUrl);return;}
  viewerReturnFocus=document.activeElement;
  const open=()=>{
    lightbox.inert=false;
    lightbox.setAttribute('aria-hidden','false');
    lightbox.classList.add('is-open');
    document.body.classList.add('locked');
    applyWork(id,0,syncUrl);
    lightClose.focus({preventScroll:true});
  };
  transitionArtwork(open,origin,lightImage);
}
function closeLightbox(syncUrl=true){
  if(!lightbox.classList.contains('is-open'))return;
  const target=cardById(currentWork)?.querySelector('.work-frame img');
  const close=()=>{
    lightbox.classList.remove('is-open');
    lightbox.inert=true;
    lightbox.setAttribute('aria-hidden','true');
    document.body.classList.remove('locked');
    ++imageRequest;
    currentWork=null;
    if(syncUrl)updateUrl(null);
    if(viewerReturnFocus?.isConnected && !viewerReturnFocus.closest('[hidden]'))viewerReturnFocus.focus({preventScroll:true});
    else $('#works-heading').focus({preventScroll:true});
  };
  if(target?.getBoundingClientRect().top < innerHeight && target?.getBoundingClientRect().bottom>0){
    transitionArtwork(close,lightImage,target);
  }else close();
}
function stepLightbox(delta){
  const list=visibleWorks(), idx=list.findIndex(w=>w.id===currentWork);
  if(!list.length || idx<0)return;
  applyWork(list[(idx+delta+list.length)%list.length].id,delta);
}
lightClose.addEventListener('click',()=>closeLightbox());
$('#previous').addEventListener('click',()=>stepLightbox(-1));
$('#next').addEventListener('click',()=>stepLightbox(1));
shareButton.addEventListener('click',async()=>{
  const text=shareUrl(currentWork).href;
  try{
    if(navigator.clipboard?.writeText){ await navigator.clipboard.writeText(text); }
    else{
      const area=document.createElement('textarea');area.value=text;
      area.style.position='fixed';area.style.opacity='0';document.body.append(area);
      area.select();if(!document.execCommand('copy'))throw new Error('clipboard');area.remove();
    }
    shareButton.firstChild.textContent='Link kopiert ';
    announce('Link zum Kunstwerk wurde kopiert.');
    setTimeout(()=>{shareButton.firstChild.textContent='Link kopieren ';},1800);
  }catch{
    announce('Link konnte nicht kopiert werden.');
    window.prompt('Link zum Kunstwerk kopieren:',text);
  }
});
function trapFocus(event, root){
  const focusables=$$('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])',root)
    .filter(el=>!el.closest('[hidden],[inert]') && el.getClientRects().length);
  if(!focusables.length)return;
  const first=focusables[0],last=focusables.at(-1);
  if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
}
window.addEventListener('keydown',event=>{
  if(lightbox.classList.contains('is-open')){
    if(event.key==='Escape'){event.preventDefault();closeLightbox();}
    else if(event.key==='ArrowLeft'){event.preventDefault();stepLightbox(-1);}
    else if(event.key==='ArrowRight'){event.preventDefault();stepLightbox(1);}
    else if(event.key==='Tab')trapFocus(event,lightbox);
    return;
  }
  if(menu.classList.contains('is-open')){
    if(event.key==='Escape'){event.preventDefault();setMenu(false);}
    else if(event.key==='Tab')trapFocus(event,menu);
  }
});
lightbox.addEventListener('touchstart',event=>{touchOrigin={x:event.changedTouches[0].screenX,y:event.changedTouches[0].screenY};},{passive:true});
lightbox.addEventListener('touchend',event=>{
  if(!touchOrigin)return;
  const dx=event.changedTouches[0].screenX-touchOrigin.x;
  const dy=event.changedTouches[0].screenY-touchOrigin.y;
  if(Math.abs(dx)>65 && Math.abs(dx)>Math.abs(dy)*1.2)stepLightbox(dx>0?-1:1);
  touchOrigin=null;
},{passive:true});
window.addEventListener('popstate',()=>{
  const requested=Number(new URL(location.href).searchParams.get('werk'));
  if(findWork(requested))openLightbox(requested,null,false);
  else closeLightbox(false);
});
const initialRequested=Number(new URL(location.href).searchParams.get('werk'));
if(findWork(initialRequested))requestAnimationFrame(()=>openLightbox(initialRequested,null,false));

/* ------------------ Native scroll choreography ------------------ */
const hero=$('.scroll-hero'), heroPin=$('#hero-pin'), heroArt=$('#hero-art');
const heroCopy=$('#hero-copy'), heroBottom=$('#hero-bottom');
const manifesto=$('.manifesto'), ticker=$('.ticker'), pause=$('.visual-pause');
const immersive=$('#hero-immersive'), lines=$$('.draw-path');
const progressBar=$('#page-progress-fill'), heroMeter=$('#hero-meter-fill');
const tickerTrack=$('#ticker-track');
let rafPending=false, lastHeroProgress=-1;
function motionFrame(){
  rafPending=false;
  const height=Math.max(1,document.documentElement.scrollHeight-innerHeight);
  progressBar.style.transform=`scaleX(${clamp(scrollY/height)})`;
  if(!motionAllowed())return;
  const rect=hero.getBoundingClientRect();
  const w=heroPin.clientWidth, h=heroPin.clientHeight;
  const progress=clamp(-rect.top/Math.max(1,hero.offsetHeight-h));
  // The expensive hero geometry is updated only when the pinned hero is onscreen.
  if((rect.bottom>0 && rect.top<innerHeight) && Math.abs(progress-lastHeroProgress)>.0003){
    const mobile=w<=760, zoom=range(progress,.04,.74);
    const x=mobile?w*.12:w*.584, y=mobile?h*.515:h*.095;
    const baseWidth=mobile?w*.76:w*.348,baseHeight=mobile?h*.405:h*.79;
    heroArt.style.setProperty('--art-x',`${mix(x,0,zoom).toFixed(2)}px`);
    heroArt.style.setProperty('--art-y',`${mix(y,0,zoom).toFixed(2)}px`);
    heroArt.style.setProperty('--art-width',`${mix(baseWidth,w,zoom).toFixed(2)}px`);
    heroArt.style.setProperty('--art-height',`${mix(baseHeight,h,zoom).toFixed(2)}px`);
    heroArt.style.setProperty('--art-scale',mix(.985,1.42,range(progress,.05,.94)).toFixed(4));
    heroArt.style.setProperty('--art-radius',`${mix(2,0,zoom)}px`);
    heroArt.style.setProperty('--art-shadow',mix(.20,0,zoom).toFixed(3));
    heroArt.style.setProperty('--backdrop-opacity',mix(.13,.77,range(progress,.19,.8)).toFixed(3));
    heroArt.style.setProperty('--shade-opacity',range(progress,.5,.85).toFixed(3));
    heroArt.style.setProperty('--caption-opacity',(range(progress,.36,.61)*(1-range(progress,.88,.99))).toFixed(3));
    heroCopy.style.setProperty('--copy-opacity',(1-range(progress,.09,.36)).toFixed(3));
    heroCopy.style.setProperty('--copy-y',`${mix(0,-40,range(progress,.09,.36)).toFixed(1)}px`);
    heroBottom.style.setProperty('--bottom-opacity',(1-range(progress,.10,.42)).toFixed(3));
    immersive.style.setProperty('--immersive-opacity',range(progress,.64,.9).toFixed(3));
    immersive.style.setProperty('--immersive-y',`${mix(45,0,range(progress,.64,.93)).toFixed(1)}px`);
    immersive.setAttribute('aria-hidden',String(progress<.72));
    heroMeter.style.transform=`scaleX(${progress})`;
    heroCopy.inert=progress>.43;
    $('.hero-skip').inert=progress>.4;
    lastHeroProgress=progress;
  }
  const mr=manifesto.getBoundingClientRect();
  if(mr.top<innerHeight && mr.bottom>0){
    const p=clamp((innerHeight-mr.top)/(innerHeight+mr.height));
    const drawn=2200*(1-range(p,.05,.92));
    lines.forEach(path=>path.style.setProperty('--path-dash',`${drawn.toFixed(1)}px`));
  }
  const tr=ticker.getBoundingClientRect();
  if(tr.top<innerHeight && tr.bottom>0){
    const p=clamp((innerHeight-tr.top)/(innerHeight+tr.height));
    tickerTrack.style.setProperty('--ticker-shift',`${(-p*Math.min(innerWidth*.42,460)).toFixed(1)}px`);
  }
  const pr=pause.getBoundingClientRect();
  if(pr.top<innerHeight && pr.bottom>0){
    const p=clamp((innerHeight-pr.top)/(innerHeight+pr.height));
    pause.style.setProperty('--pause-a',`${mix(-45,65,p).toFixed(1)}px`);
    pause.style.setProperty('--pause-b',`${mix(55,-48,p).toFixed(1)}px`);
  }
}
const requestMotion=()=>{if(!rafPending){rafPending=true;requestAnimationFrame(motionFrame);}};
function configureMotion(){
  document.body.classList.toggle('js-zoom',motionAllowed());
  if(!motionAllowed()){
    heroCopy.inert=false;
    $('.hero-skip').inert=false;
    immersive.setAttribute('aria-hidden','true');
  }
  lastHeroProgress=-1;
  requestMotion();
}
window.addEventListener('scroll',requestMotion,{passive:true});
window.addEventListener('resize',()=>{lastHeroProgress=-1;requestMotion();},{passive:true});
prefersReduced.addEventListener('change',configureMotion);
configureMotion();

/* ------------------ Wayfinding and in-view motion ------------------ */
const chapters=[
  {id:'start',label:'Auftakt',number:'01'},
  {id:'gedanken',label:'Gedanken',number:'02'},
  {id:'werke',label:'Werke',number:'03'},
  {id:'ueber',label:'Zur Person',number:'04'},
  {id:'kontakt',label:'Kontakt',number:'05'}
];
if('IntersectionObserver' in window){
  const watch=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(entry.isIntersecting){
        const data=chapters.find(x=>x.id===entry.target.id);
        if(data){$('#chapter-number').textContent=data.number;$('#chapter-name').textContent=data.label;}
      }
    }
  },{rootMargin:'-20% 0px -61% 0px',threshold:0});
  chapters.forEach(c=>{const node=document.getElementById(c.id);if(node){node.tabIndex=-1;watch.observe(node);}});
}
if(motionAllowed() && 'IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{
    entries.forEach(({target,isIntersecting})=>{
      if(isIntersecting){target.classList.add('in-view');observer.unobserve(target);}
    });
  },{rootMargin:'0px 0px -25px 0px',threshold:.04});
  document.body.classList.add('js-motion');
  $$('.reveal,.work').forEach(item=>observer.observe(item));
}
// All content must remain readable if JS / IntersectionObserver / animations are unavailable.
