const messages = document.querySelector('#messages');
const filesInput = document.querySelector('#files');
const attachments = document.querySelector('#attachments');
const prompt = document.querySelector('#prompt');
const API = window.SUPERME_API_URL || 'http://localhost:3000';
let chats = JSON.parse(localStorage.getItem('superme_chats') || '[]');
let current = [];

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m])); }
function renderChats() { document.querySelector('#chatList').innerHTML = chats.map((c,i) => `<div class="chat-item" onclick="loadChat(${i})">${escapeHtml(c.title || 'Yangi chat')}</div>`).join(''); }
function newChat() { saveChat(); current=[]; messages.innerHTML='<div class="welcome"><div class="logo-mark">✦</div><h1>Qanday yordam beray?</h1><p>Savol bering, kod yozdiring yoki loyiha yaratishni so‘rang.</p></div>'; renderChats(); showScreen('chat'); prompt.focus(); }
function saveChat() { if (!current.length) return; const first=current.find(x=>x.role==='user'); chats.unshift({ title:first?.text?.replace(/\s+/g,' ').slice(0,45)||'Yangi chat', messages:current }); chats=chats.slice(0,100); localStorage.setItem('superme_chats', JSON.stringify(chats)); }
function loadChat(i) { current=chats[i].messages||[]; messages.innerHTML=''; current.forEach(renderMessage); showScreen('chat'); }
function renderMessage(m) {
  const wrap=document.createElement('div'); wrap.className='message-row '+m.role;
  if(m.role==='assistant') { const avatar=document.createElement('div'); avatar.className='avatar'; avatar.textContent='✦'; wrap.appendChild(avatar); }
  const d=document.createElement('div'); d.className='msg '+m.role; d.textContent=m.text||''; wrap.appendChild(d); messages.appendChild(wrap); messages.scrollTop=messages.scrollHeight;
}
function showFiles() { attachments.innerHTML=''; [...filesInput.files].forEach(f=>{ const c=document.createElement('div'); c.className='chip'; c.textContent=`${f.type.startsWith('image/')?'🖼️':f.type.startsWith('video/')?'🎥':'📎'} ${f.name}`; attachments.appendChild(c); }); }
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));
  const titles={chat:['SUPERME AI','AI assistant'],build:['Build','GitHub Actions'],secrets:['Secrets','Environment / GitHub Secrets']};
  document.querySelector('#'+name+'Screen').classList.add('active'); document.querySelector('#screenTitle').textContent=titles[name][0]; document.querySelector('#screenSub').textContent=titles[name][1];
  if(name==='secrets') loadSecretStatus();
}

async function sendMessage(e) {
  e.preventDefault();
  const text=prompt.value.trim(); const selected=[...filesInput.files]; if(!text&&!selected.length) return;
  const user={role:'user',text:text+(selected.length?`\n[${selected.length} ta fayl biriktirildi]`:'')};
  current.push(user); renderMessage(user); prompt.value=''; attachments.innerHTML=''; filesInput.value='';
  const reply={role:'assistant',text:''}; current.push(reply); renderMessage(reply);
  const bubble=messages.lastChild.querySelector('.msg'); bubble.classList.add('typing'); bubble.textContent='';
  try {
    const apiMessages=current.slice(0,-1).filter(x=>x.role==='user'||x.role==='assistant').map(x=>({role:x.role,content:x.text}));
    const images=[]; for(const f of selected.filter(x=>x.type.startsWith('image/')).slice(0,10)) images.push(await fileToDataUrl(f));
    const r=await fetch(API+'/api/chat/stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:apiMessages,images,videos:[]})});
    if(!r.ok){let d={};try{d=await r.json()}catch{} throw new Error(d.error||`Backend xatosi (${r.status})`);}
    const reader=r.body.getReader(); const decoder=new TextDecoder(); let buffer='';
    while(true){ const {value,done}=await reader.read(); if(done) break; buffer+=decoder.decode(value,{stream:true}); const chunks=buffer.split('\n\n'); buffer=chunks.pop()||'';
      for(const chunk of chunks){ const line=chunk.split('\n').find(x=>x.startsWith('data: ')); if(!line) continue; const data=JSON.parse(line.slice(6));
        if(data.type==='delta'){ reply.text+=data.text; bubble.textContent=reply.text; messages.scrollTop=messages.scrollHeight; }
        if(data.type==='error') throw new Error(data.error);
      }
    }
    if(!reply.text) reply.text='Javob kelmadi.';
  } catch(err) { reply.text='⚠️ '+err.message; bubble.textContent=reply.text; }
  bubble.classList.remove('typing'); saveChat(); renderChats();
}
function fileToDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});}

async function startBuild(){
  const result=document.querySelector('#buildResult'); result.textContent='⏳ Build workflow ishga tushirilmoqda...';
  try{const target=document.querySelector('#buildTarget').value;const artifact_name=document.querySelector('#artifactName').value.trim()||'superme-ai-build';const r=await fetch(API+'/api/build',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target,artifact_name})});const data=await r.json();if(!r.ok)throw new Error(data.error||'Build xatosi');result.textContent=`✅ ${data.message}. Artifact: ${data.artifact_name}`;}catch(err){result.textContent='❌ '+err.message;}
}
async function loadSecretStatus(){
  try{const r=await fetch(API+'/api/config/status');const s=await r.json();document.querySelector('#openaiStatus').textContent=s.openai?'✅ Ulangan':'❌ Yo‘q';document.querySelector('#telegramStatus').textContent=s.telegram?'✅ Ulangan':'❌ Yo‘q';document.querySelector('#telegramChatStatus').textContent=s.telegram?'✅ Sozlangan':'❌ Yo‘q';document.querySelector('#githubStatus').textContent=s.githubBuild?'✅ Build ruxsati bor':'❌ Yo‘q';}catch(err){document.querySelector('#secretResult').textContent='⚠️ Backend bilan ulanish yo‘q: '+err.message;}
}
async function testTelegram(){const result=document.querySelector('#secretResult');result.textContent='⏳ Telegram tekshirilmoqda...';try{const r=await fetch(API+'/api/telegram/test',{method:'POST'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Telegram xatosi');result.textContent='✅ Telegram bot ishlayapti.';}catch(e){result.textContent='❌ '+e.message;}}

renderChats();
