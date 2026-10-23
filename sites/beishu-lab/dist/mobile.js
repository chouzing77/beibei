/* Touch selection is committed explicitly, after users adjust native selection handles. */
(()=>{
  const surface=$('#paint-surface'),mark=document.createElement('button');mark.type='button';mark.className='button button-dark mobile-mark';mark.textContent='划出所选意群';surface.after(mark);
  let selectedRange=null;
  document.addEventListener('selectionchange',()=>{const s=getSelection();if(s&&!s.isCollapsed&&surface.contains(s.anchorNode)&&surface.contains(s.focusNode))selectedRange=s.getRangeAt(0).cloneRange();});
  mark.addEventListener('pointerdown',e=>e.preventDefault());mark.onclick=()=>{if(selectedRange&&surface.contains(selectedRange.startContainer)){const s=getSelection();s.removeAllRanges();s.addRange(selectedRange);paintSelection();selectedRange=null;}else toast('长按原文并选择一段文字');};
  const original=paintSelection;
  surface.removeEventListener('mouseup',original);surface.addEventListener('mouseup',()=>{if(!matchMedia('(pointer:coarse)').matches)original();});
  for(const phase of ['first','second']){
    const canvas=$(`#${phase}-cards`),bar=document.createElement('span');bar.className='canvas-zoom';bar.innerHTML='<button type="button" class="small-button" aria-label="缩小画布">−</button><button type="button" class="small-button">全图</button><button type="button" class="small-button" aria-label="放大画布">＋</button>';
    const host=phase==='first'?$('.canvas-tools'):$('#understand-second .subhead');host.append(bar);let zoom=1;
    function apply(){canvas.style.zoom=zoom;canvas.dataset.zoom=zoom;}
    bar.children[0].onclick=()=>{zoom=Math.max(.3,zoom-.15);apply();};bar.children[1].onclick=()=>{zoom=Math.min(1,canvas.parentElement.clientWidth/960);apply();};bar.children[2].onclick=()=>{zoom=Math.min(1.5,zoom+.15);apply();};
    // A first visit on mobile starts fitted; subsequent visits retain the chosen zoom.
    const observer=new MutationObserver(()=>{if(!canvas.dataset.zoom&&canvas.parentElement.clientWidth>0&&innerWidth<700){zoom=canvas.parentElement.clientWidth/960;apply();}});observer.observe(canvas,{childList:true});
  }
  const labels={rect:'长方形',ellipse:'椭圆',circle:'圆形',triangle:'三角形'};$$('[data-shape]').forEach(b=>{b.setAttribute('aria-label',labels[b.dataset.shape]);b.title=labels[b.dataset.shape];});
})();
