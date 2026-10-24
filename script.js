const loader=document.getElementById('loader');
window.addEventListener('load',()=>setTimeout(()=>loader.classList.add('hide'),350));
const menu=document.getElementById('mobileMenu');
const btn=document.getElementById('menuButton');
const close=document.getElementById('menuClose');
function setMenu(open){menu.classList.toggle('open',open);menu.setAttribute('aria-hidden',String(!open));btn.setAttribute('aria-expanded',String(open));document.body.style.overflow=open?'hidden':''}
btn.addEventListener('click',()=>setMenu(true)); close.addEventListener('click',()=>setMenu(false));
menu.addEventListener('click',e=>{if(e.target===menu||e.target.closest('a'))setMenu(false)});
const obs=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible')}),{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));
