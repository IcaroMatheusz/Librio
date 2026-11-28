import { dark, light, type LibraryColors } from '../config/colors';
import { normalizeRsvp, rsvpFonts, rsvpSpeed } from './rsvpSettings';

function readerVariables(colors: LibraryColors) {
  return Object.entries(colors).map(([key, value]) => `--reader-${key}:${value}`).join(';');
}

const fontOptions = Object.entries(rsvpFonts).map(([value, { label }]) => `<option value="${value}">${label}</option>`).join('');
const fontFamilies = JSON.stringify(Object.fromEntries(Object.entries(rsvpFonts).map(([value, { family }]) => [value, family])));

export function epubView(content: string, fontScale: number, initialProgress: number, initialWord?: number) {
  const size = 18 * Math.max(0.85, Math.min(1.6, fontScale));
  const initialPosition = Math.max(0, Math.min(100, initialProgress)) / 100;
  const startWord = initialWord !== undefined && Number.isSafeInteger(initialWord) && initialWord >= 0 ? initialWord : null;
  const nonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return String.raw`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; script-src 'nonce-${nonce}'; form-action 'none'; base-uri 'none'"><style>
    :root{${readerVariables(dark)};color-scheme:dark;background:var(--reader-background);--reading-size:${size}px;--rsvp-font:Georgia,serif}
    :root[data-theme="light"]{${readerVariables(light)};color-scheme:light}
    *{box-sizing:border-box}
    body{margin:0;background:var(--reader-background);color:var(--reader-secondary);overflow-anchor:none;overscroll-behavior:contain}
    #librio-content{margin:0 auto;padding:clamp(24px,5vw,52px) clamp(22px,7vw,66px) 100px;overflow-wrap:anywhere;max-width:820px;font:var(--reading-size)/1.8 Georgia,serif;letter-spacing:.01em}
    #librio-content img{max-width:100%;height:auto;display:block;margin:24px auto;border-radius:10px;box-shadow:0 4px 18px rgba(0,0,0,.35)}
    #librio-content p{margin:0 0 1.25em}
    #librio-content h1,#librio-content h2,#librio-content h3{font-family:system-ui,sans-serif;line-height:1.3;color:var(--reader-text);margin:1.6em 0 .7em}
    #librio-content a{color:var(--reader-accent);text-decoration:none}
    #librio-content blockquote{border-inline-start:3px solid var(--reader-accent);padding-inline-start:16px;color:var(--reader-muted);margin:1.4em 0}
    #librio-content svg,#librio-content table,#librio-content pre{max-width:100%;overflow:auto}
    .chapter{padding-bottom:36px}
    .page-break{height:1px;margin:40px 0;background:var(--reader-border)}
    #librio-rsvp[hidden]{display:none}
    #librio-rsvp{position:fixed;z-index:3;inset:0;overflow:auto;overscroll-behavior:contain;background:var(--reader-background);padding:clamp(14px,4vw,28px) 16px;font:15px/1.4 system-ui,sans-serif}
    .rsvp-layout{margin:auto;width:min(100%,560px);min-height:100%;display:flex;flex-direction:column;gap:16px}
    .rsvp-head,.rsvp-settings,.rsvp-controls{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
    .rsvp-head h1{font-size:19px;margin:0;color:var(--reader-text)}
    .rsvp-display{min-height:120px;flex:1;display:flex;flex-direction:column;justify-content:center;gap:12px}
    .rsvp-word{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);text-align:center;font:800 clamp(24px,7.5vw,54px)/1.3 var(--rsvp-font);white-space:pre;direction:ltr;overflow:hidden;background:var(--reader-surface);padding:18px 7px;border-block:1px solid var(--reader-border);border-radius:14px}
    .rsvp-prefix{text-align:right;overflow:visible;justify-self:end}
    .rsvp-suffix{text-align:left;overflow:visible;justify-self:start}
    .rsvp-anchor{color:var(--reader-danger);border-block:1px solid var(--reader-border)}
    .rsvp-status{font-size:13px;color:var(--reader-muted);text-align:center;font-variant-numeric:tabular-nums;margin:0}
    .rsvp-settings{align-items:stretch}
    .rsvp-settings label{flex:1 1 124px;display:grid;grid-template-rows:1fr auto;gap:4px;color:var(--reader-muted);font-size:13px;font-weight:600}
    #librio-rsvp button,#librio-rsvp input,#librio-rsvp select{min-height:44px;border:1px solid var(--reader-controlBorder);border-radius:10px;color:var(--reader-text);background:var(--reader-raised);padding:7px 10px;font:inherit}
    #librio-rsvp input,#librio-rsvp select{width:100%;font-size:16px}
    #librio-rsvp button:disabled{opacity:.45}
    #librio-rsvp button:focus-visible,#librio-rsvp input:focus-visible,#librio-rsvp select:focus-visible{outline:2px solid var(--reader-accent);outline-offset:2px}
    .rsvp-controls button{flex:1 1 auto}
    #librio-rsvp .rsvp-play{flex:2 1 auto;background:var(--reader-accent);color:var(--reader-onAccent);font-weight:800}
  </style></head><body>
    <div id="librio-rsvp" hidden role="dialog" aria-modal="true" aria-labelledby="rsvp-title">
      <div class="rsvp-layout">
        <header class="rsvp-head"><h1 id="rsvp-title">Leitura rápida (RSVP)</h1><button id="rsvp-close" type="button">Voltar ao texto</button></header>
        <div class="rsvp-display">
          <div class="rsvp-word" id="rsvp-word"><span class="rsvp-prefix"></span><span class="rsvp-anchor"></span><span class="rsvp-suffix"></span></div>
          <p class="rsvp-status" id="rsvp-status"></p>
        </div>
        <div class="rsvp-settings">
          <label>Fonte<select id="rsvp-font">${fontOptions}</select></label>
          <label>Palavras por minuto (WPM)<input id="rsvp-wpm" type="number" inputmode="numeric" min="${rsvpSpeed.min}" max="${rsvpSpeed.max}" step="1"></label>
        </div>
        <div class="rsvp-controls">
          <button id="rsvp-back" type="button" aria-label="Voltar 10 palavras">−10</button>
          <button class="rsvp-play" id="rsvp-play" type="button">Reproduzir</button>
          <button id="rsvp-next" type="button" aria-label="Avançar 10 palavras">+10</button>
        </div>
      </div>
    </div>
    <main id="librio-content">${content}</main>
    <script nonce="${nonce}">
    (()=>{
      const content=document.getElementById('librio-content');
      const panel=document.getElementById('librio-rsvp');
      const closeButton=document.getElementById('rsvp-close');
      const playButton=document.getElementById('rsvp-play');
      const backButton=document.getElementById('rsvp-back');
      const nextButton=document.getElementById('rsvp-next');
      const fontInput=document.getElementById('rsvp-font');
      const speedInput=document.getElementById('rsvp-wpm');
      const status=document.getElementById('rsvp-status');
      const word=document.getElementById('rsvp-word');
      const [prefix,anchor,suffix]=word.children;
      const families=${fontFamilies};
      const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter(undefined,{granularity:'grapheme'}):null;
      let preferences=${JSON.stringify(normalizeRsvp())};
      let position=${initialPosition};
      let currentWord=${startWord};
      const words=[];
      let ready=false;
      let playing=false;
      let playback;
      let lastReport=0;
      let scrollTimer;
      let gesture;
      let touched=false;

      const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
      const range=()=>Math.max(0,document.documentElement.scrollHeight-innerHeight);
      const screenCount=()=>Math.max(1,Math.ceil(document.documentElement.scrollHeight/Math.max(1,innerHeight)));
      const post=(type,data)=>window.ReactNativeWebView?.postMessage(JSON.stringify({type,...data}));
      const wordRange=document.createRange();

      function indexWords(){
        const walker=document.createTreeWalker(content,NodeFilter.SHOW_TEXT,{acceptNode(node){
          return node.parentElement.closest('script,style,rt,[hidden],[aria-hidden="true"]')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;
        }});
        for(let node=walker.nextNode();node;node=walker.nextNode()){
          for(const match of node.data.matchAll(/\S+/g)) words.push({node,offset:match.index,text:match[0]});
        }
      }
      function wordBounds(index){
        const {node,offset,text}=words[index];
        wordRange.setStart(node,offset);
        wordRange.setEnd(node,offset+text.length);
        return wordRange.getBoundingClientRect();
      }
      function visibleWord(){
        let start=0,end=words.length-1;
        while(start<end){
          const middle=Math.floor((start+end)/2);
          if(wordBounds(middle).bottom<=16) start=middle+1;
          else end=middle;
        }
        return start;
      }
      function anchorPosition(){
        if(currentWord===null||!words.length) return;
        const height=range();
        position=height?clamp((scrollY+wordBounds(currentWord).top-16)/height,0,1):0;
      }
      function report(type='progress'){
        const screens=screenCount();
        const screen=position===1?screens:Math.min(screens,Math.floor((range()*position+.0001)/Math.max(1,innerHeight))+1);
        const progress=currentWord===null?position:words.length<=1?1:currentWord/(words.length-1);
        post(type,{progress:progress*100,words:words.length,screens,screen,word:currentWord});
      }
      function restore(){
        touched=false;
        clearTimeout(scrollTimer);
        anchorPosition();
        window.scrollTo(0,range()*position);
      }
      function showWord(){
        const text=words[currentWord].text;
        const graphemes=segmenter?Array.from(segmenter.segment(text),part=>part.segment):Array.from(text);
        const letters=graphemes.flatMap((part,index)=>/[\p{L}\p{N}]/u.test(part)?[index]:[]);
        const pivot=letters[Math.floor((letters.length-1)*.35)]??0;
        prefix.textContent=graphemes.slice(0,pivot).join('');
        anchor.textContent=graphemes[pivot];
        suffix.textContent=graphemes.slice(pivot+1).join('');
        word.style.fontSize=graphemes.length>12?'clamp(14px,'+110/graphemes.length+'vw,36px)':'';
        const remaining=Math.ceil((words.length-1-currentWord)/preferences.wpm);
        status.textContent=(currentWord+1).toLocaleString('pt-BR')+' / '+words.length.toLocaleString('pt-BR')+' palavras · '+(remaining?'≈ '+remaining+' min restantes':'Fim do texto');
        playButton.textContent=playing?'Pausar':'Reproduzir';
        playButton.disabled=!playing&&currentWord>=words.length-1;
        backButton.disabled=currentWord===0;
        nextButton.disabled=currentWord>=words.length-1;
      }
      function reportWord(){
        lastReport=Date.now();
        anchorPosition();
        report();
      }
      function schedule(){
        clearTimeout(playback);
        if(!playing) return;
        playback=setTimeout(()=>{
          currentWord+=1;
          if(currentWord>=words.length-1){ pause(); return; }
          showWord();
          if(Date.now()-lastReport>=650) reportWord();
          schedule();
        },60000/preferences.wpm);
      }
      function pause(){
        const wasPlaying=playing;
        playing=false;
        clearTimeout(playback);
        if(wasPlaying){ showWord(); reportWord(); }
      }
      function seekWords(delta){
        currentWord=clamp(currentWord+delta,0,words.length-1);
        if(currentWord===words.length-1) pause();
        showWord();
        reportWord();
        schedule();
      }
      function applyRsvp(settings){
        const font=Object.prototype.hasOwnProperty.call(families,settings.font)?settings.font:'serif';
        const parsed=Number(settings.wpm);
        const wpm=clamp(Math.round(Number.isFinite(parsed)&&parsed>0?parsed:preferences.wpm),${rsvpSpeed.min},${rsvpSpeed.max});
        preferences={font,wpm};
        fontInput.value=font;
        speedInput.value=String(wpm);
        word.style.setProperty('--rsvp-font',families[font]);
        if(!panel.hidden){ showWord(); schedule(); }
      }
      function savePreferences(){
        applyRsvp({font:fontInput.value,wpm:speedInput.valueAsNumber});
        post('rsvp-settings',preferences);
      }

      window.LibrioRsvpSettings=applyRsvp;
      window.LibrioRsvpOpen=()=>{
        if(!words.length||!panel.hidden) return;
        if(currentWord===null) currentWord=visibleWord();
        content.inert=true;
        panel.hidden=false;
        showWord();
        closeButton.focus({preventScroll:true});
        post('rsvp-mode',{active:true});
        reportWord();
      };
      window.LibrioRsvpPause=pause;
      window.LibrioRsvpClose=()=>{
        if(panel.hidden) return;
        pause();
        panel.hidden=true;
        content.inert=false;
        restore();
        post('rsvp-mode',{active:false});
        report();
      };
      window.LibrioJumpToScreen=(screen)=>{
        const count=screenCount();
        if(!Number.isInteger(screen)||screen<1||screen>count) return;
        currentWord=null;
        const height=range();
        position=height?Math.min(height,(screen-1)*innerHeight)/height:0;
        restore();
        report();
      };
      window.LibrioTextSize=(scale)=>{
        document.documentElement.style.setProperty('--reading-size',18*scale+'px');
        restore();
        report();
      };

      closeButton.addEventListener('click',window.LibrioRsvpClose);
      playButton.addEventListener('click',()=>{
        if(playing){ pause(); return; }
        if(currentWord>=words.length-1) return;
        playing=true;
        showWord();
        schedule();
      });
      backButton.addEventListener('click',()=>seekWords(-10));
      nextButton.addEventListener('click',()=>seekWords(10));
      fontInput.addEventListener('change',savePreferences);
      speedInput.addEventListener('change',savePreferences);
      speedInput.addEventListener('keydown',(event)=>{ if(event.key==='Enter') speedInput.blur(); });
      document.addEventListener('visibilitychange',()=>{ if(document.hidden) pause(); });
      window.addEventListener('load',()=>{
        indexWords();
        if(currentWord!==null) currentWord=words.length?clamp(currentWord,0,words.length-1):null;
        applyRsvp(preferences);
        restore();
        ready=true;
        report('ready');
      });
      window.addEventListener('resize',()=>{ if(ready){ restore(); report(); } });
      window.addEventListener('scroll',()=>{
        clearTimeout(scrollTimer);
        scrollTimer=setTimeout(()=>{
          if(!touched||!panel.hidden) return;
          currentWord=null;
          const height=range();
          position=height?clamp(scrollY/height,0,1):position;
          report();
        },140);
      });
      window.addEventListener('touchstart',(event)=>{
        if(!panel.hidden) return;
        touched=true;
        if(event.touches.length!==1||(window.visualViewport?.scale??1)>1.02){ gesture=undefined; return; }
        const native=event.touches[0];
        gesture={y:native.clientY,x:native.clientX,top:scrollY<=2,bottom:scrollY>=range()-2};
      },{passive:true});
      window.addEventListener('touchcancel',()=>{gesture=undefined;},{passive:true});
      window.addEventListener('touchend',(event)=>{
        const start=gesture;
        gesture=undefined;
        const native=event.changedTouches[0];
        if(!panel.hidden||!start||!native||event.touches.length||window.getSelection()?.toString()) return;
        const dy=native.clientY-start.y;
        if(Math.abs(dy)<54||Math.abs(dy)<Math.abs(native.clientX-start.x)) return;
        if(dy<0&&start.bottom&&scrollY>=range()-2)post('boundary',{direction:1});
        if(dy>0&&start.top&&scrollY<=2)post('boundary',{direction:-1});
      },{passive:true});
      window.addEventListener('wheel',()=>{ touched=panel.hidden; },{passive:true});
      content.addEventListener('click',(event)=>{
        if(event.target.closest('a')) return;
        if(!window.getSelection()?.toString()) post('tap');
      });
    })();
    </script></body></html>`;
}
