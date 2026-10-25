const loader=document.getElementById('loader');
window.addEventListener('load',()=>setTimeout(()=>loader&&loader.classList.add('hide'),350));
const menu=document.getElementById('mobileMenu');
const btn=document.getElementById('menuButton');
const close=document.getElementById('menuClose');
function setMenu(open){if(!menu||!btn)return;menu.classList.toggle('open',open);menu.setAttribute('aria-hidden',String(!open));btn.setAttribute('aria-expanded',String(open));document.body.style.overflow=open?'hidden':''}
if(btn)btn.addEventListener('click',()=>setMenu(true)); if(close)close.addEventListener('click',()=>setMenu(false));
if(menu)menu.addEventListener('click',e=>{if(e.target===menu||e.target.closest('a'))setMenu(false)});
const obs=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible')}),{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));

(async()=>{
  if(!document.body.classList.contains('resource-page')) return;
  const page=location.pathname.split('/').pop()||'';
  const category=page.includes('mentoring-guides')?'mentorship-guide':page.includes('family-support')?'family-support':page.includes('leadership-stem')?'leadership-stem':'';
  if(!category) return;
  const sections=[...document.querySelectorAll('.library-section')];
  if(!sections.length) return;
  const esc=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const kindLabel={document:'Document / Guide',video:'Video / Teaching',link:'Recommended Link'};
  const defaultButton={document:'Open resource',video:'Watch resource',link:'Visit resource'};
  try{
    const response=await fetch(`/api/resources?category=${encodeURIComponent(category)}`);
    const result=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(result.error||'Unable to load resources.');
    const items=result.items||[];
    [1,2,3].forEach(sectionNo=>{
      const host=sections[sectionNo-1];
      if(!host) return;
      const list=items.filter(item=>Number(item.section_no)===sectionNo);
      if(!list.length) return;
      const placeholder=host.querySelector('.empty-resource');
      const markup=`<div class="resource-live-list">${list.map(item=>{
        const external=/^https?:\/\//i.test(item.url||'');
        return `<article class="resource-live-card">
          <div class="resource-live-meta"><span>${esc(kindLabel[item.resource_kind]||'Resource')}</span></div>
          <h4>${esc(item.title)}</h4>
          ${item.description?`<p>${esc(item.description)}</p>`:''}
          <a href="${esc(item.url)}" ${external?'target="_blank" rel="noopener"':''}>${esc(item.button_label||defaultButton[item.resource_kind]||'Open resource')} <span>↗</span></a>
        </article>`;
      }).join('')}</div>`;
      if(placeholder) placeholder.outerHTML=markup; else host.insertAdjacentHTML('beforeend',markup);
    });
  }catch(error){
    console.error('ELROHI resource library:',error);
  }
})();
