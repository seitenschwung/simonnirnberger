/* Roman page. The passages are plain HTML in #fragments (all readable without JS);
 * here they become a one-at-a-time reader. No libraries, no network calls. */
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const two=n=>String(n).padStart(2,'0');
const prefersReduced=matchMedia('(prefers-reduced-motion: reduce)');
const motionAllowed=()=>!prefersReduced.matches&&navigator.connection?.saveData!==true;
$$('.year').forEach(el=>el.textContent=String(new Date().getFullYear()));

const items=$$('#fragments .fragment');
const controls=$('#fragments-controls'), count=$('#fragment-count');
let at=0;

// Words fade in one after another, like ink bleeding into paper.
function inkWords(item){
  const p=$('p',item);
  if(!p.dataset.words){
    p.dataset.words='1';
    const words=p.textContent.trim().split(/\s+/);
    p.textContent='';
    words.forEach((word,i)=>{
      const span=document.createElement('span');
      span.className='word';
      span.style.setProperty('--i',i);
      span.textContent=word;
      p.append(span,i<words.length-1?' ':'');
    });
  }
  p.classList.remove('is-inking');
  void p.offsetWidth;
  p.classList.add('is-inking');
}
function show(index,animate=true){
  at=(index+items.length)%items.length;
  items.forEach((item,i)=>{
    const on=i===at;
    item.classList.toggle('is-active',on);
    item.inert=!on;
    if(on&&animate&&motionAllowed())inkWords(item);
  });
  count.textContent=`${two(at+1)} / ${two(items.length)}`;
}
if(items.length){
  document.body.classList.add('js-fragments');
  controls.hidden=false;
  show(0,false);
  $('#fragment-prev').addEventListener('click',()=>show(at-1));
  $('#fragment-next').addEventListener('click',()=>show(at+1));
  document.addEventListener('keydown',event=>{
    if(event.key==='ArrowLeft'){show(at-1);event.preventDefault();}
    if(event.key==='ArrowRight'){show(at+1);event.preventDefault();}
  });
}
