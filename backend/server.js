import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {runAgent,webSearch,executeSandbox,WORKSPACE} from './agent.js';

const app=express();
app.use(cors());
app.use(express.json({limit:process.env.JSON_LIMIT||'250mb'}));
const MODEL=process.env.OPENAI_MODEL||'gpt-5.6-luna';
const REPO=process.env.GITHUB_REPO||'izzatqalandarov169-sys/Superme_ai_chatgpt_model';
const WORKFLOW=process.env.GITHUB_WORKFLOW||'superme-build.yml';
const DATA=path.resolve(process.env.DATA_DIR||'./data');
const USERS=path.join(DATA,'users.json');
const CHATS=path.join(DATA,'chats');
await fs.mkdir(CHATS,{recursive:true});
await fs.mkdir(WORKSPACE,{recursive:true});
try{await fs.access(USERS)}catch{await fs.writeFile(USERS,'{}')}

const SECRET=process.env.AUTH_SECRET;
if(!SECRET) console.warn('WARNING: AUTH_SECRET is not configured; set a strong secret in production.');
const AUTH_SECRET=SECRET||crypto.randomBytes(32).toString('hex');
const prompt=`You are SUPERME AI, a direct general-purpose assistant and coding/build agent. Reply in the user's language; Uzbek input gets natural Uzbek. Be accurate and do not invent facts. For current information use web_search. For coding tasks inspect and edit workspace files and run tests with tools. Never reveal secrets. You are SUPERME AI, not OpenAI or ChatGPT.`;
const b64=x=>Buffer.from(x).toString('base64url');
function jwt(p){const h=b64(JSON.stringify({alg:'HS256',typ:'JWT'})),b=b64(JSON.stringify({...p,exp:Date.now()/1000+2592000}));return h+'.'+b+'.'+crypto.createHmac('sha256',AUTH_SECRET).update(h+'.'+b).digest('base64url')}
function verify(t){try{const[h,b,s]=String(t||'').split('.');if(!h||!b||!s)return null;const e=crypto.createHmac('sha256',AUTH_SECRET).update(h+'.'+b).digest('base64url');const p=JSON.parse(Buffer.from(b,'base64url'));return crypto.timingSafeEqual(Buffer.from(s),Buffer.from(e))&&p.exp>Date.now()/1000?p:null}catch{return null}}
const readUsers=async()=>JSON.parse(await fs.readFile(USERS,'utf8'));
const saveUsers=u=>fs.writeFile(USERS,JSON.stringify(u));
function hash(p,s=crypto.randomBytes(16).toString('hex')){return s+':'+crypto.scryptSync(p,s,64).toString('hex')}
function check(p,v){try{const[s,h]=String(v).split(':');if(!s||!h)return false;const actual=crypto.scryptSync(p,s,64);const expected=Buffer.from(h,'hex');return expected.length===actual.length&&crypto.timingSafeEqual(expected,actual)}catch{return false}}
function auth(req,res,next){const u=verify(req.headers.authorization?.replace(/^Bearer\s+/i,''));if(!u)return res.status(401).json({error:'Authentication required'});req.user=u;next()}
const client=()=>import('openai').then(({default:OpenAI})=>new OpenAI({apiKey:process.env.OPENAI_API_KEY}));
function input(messages,images=[]){const a=(messages||[]).filter(x=>x&&(x.role==='user'||x.role==='assistant')).map(x=>({role:x.role,content:String(x.content||x.text||'')}));const last=a.pop()||{role:'user',content:''};const c=[{type:'input_text',text:last.content}];for(const i of images)if(/^data:image\//.test(String(i)))c.push({type:'input_image',image_url:i});return [...a,{role:'user',content:c}]}
async function gh(url,opt={}){if(!process.env.GITHUB_TOKEN)throw Error('GITHUB_TOKEN is not configured');const r=await fetch('https://api.github.com'+url,{...opt,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+process.env.GITHUB_TOKEN,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'}});const t=await r.text();if(!r.ok)throw Error(t);return t?JSON.parse(t):null}
app.get('/health',(_,r)=>r.json({ok:true,service:'SUPERME AI',model:MODEL}));
app.get('/api/config/status',(_,r)=>r.json({openai:!!process.env.OPENAI_API_KEY,githubBuild:!!process.env.GITHUB_TOKEN,telegram:!!(process.env.TELEGRAM_BOT_TOKEN&&process.env.TELEGRAM_CHAT_ID),model:MODEL,features:{webSearch:true,voice:true,realtimeVoice:false,fileAnalysis:true,sandbox:true,auth:true,persistentChats:true,tools:true,githubAgent:!!process.env.GITHUB_TOKEN}}));
app.post('/api/auth/register',async(req,res)=>{try{const email=String(req.body?.email||'').trim().toLowerCase(),password=String(req.body?.password||'');if(!/^\S+@\S+\.\S+$/.test(email)||password.length<6)return res.status(400).json({error:'Valid email and 6+ character password required'});const u=await readUsers();if(u[email])return res.status(409).json({error:'Account already exists'});u[email]={id:crypto.randomUUID(),email,password:hash(password)};await saveUsers(u);res.json({token:jwt({sub:u[email].id,email}),user:{id:u[email].id,email}})}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/auth/login',async(req,res)=>{try{const email=String(req.body?.email||'').trim().toLowerCase(),u=(await readUsers())[email];if(!u||!check(String(req.body?.password||''),u.password))return res.status(401).json({error:'Email or password is incorrect'});res.json({token:jwt({sub:u.id,email}),user:{id:u.id,email}})}catch(e){res.status(500).json({error:e.message})}});
app.get('/api/auth/me',auth,(req,res)=>res.json({user:{id:req.user.sub,email:req.user.email}}));

async function doChat(req,res,stream){try{if(!process.env.OPENAI_API_KEY)return res.status(500).json({error:'OPENAI_API_KEY is not configured'});const c=await client();
  if(stream){
    // Use the same agent/tool path as non-streaming chat so web search, sandbox and workspace tools actually work.
    const x=await runAgent(c,MODEL,prompt,input(req.body.messages,req.body.images||[]));
    res.setHeader('Content-Type','text/event-stream');res.setHeader('Cache-Control','no-cache');res.setHeader('Connection','keep-alive');
    const text=x.output_text||'';res.write('data: '+JSON.stringify({type:'delta',text})+'\n\n');res.write('data: '+JSON.stringify({type:'done',id:x.id})+'\n\n');return res.end();
  }
  const x=await runAgent(c,MODEL,prompt,input(req.body.messages,req.body.images||[]));res.json({id:x.id,text:x.output_text,model:MODEL});
}catch(e){if(!res.headersSent)res.status(500).json({error:e.message});else{res.write('data: '+JSON.stringify({type:'error',error:e.message})+'\n\n');res.end()}}}
app.post('/api/chat',auth,(req,res)=>doChat(req,res,false));
app.post('/api/chat/stream',auth,(req,res)=>doChat(req,res,true));
app.post('/api/search',auth,async(req,res)=>{try{res.json({results:await webSearch(String(req.body?.query||''))})}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/sandbox',auth,async(req,res)=>{try{res.json(await executeSandbox(req.body?.language,req.body?.code||''))}catch(e){res.status(400).json({error:e.message})}});
app.post('/api/files/analyze',auth,async(req,res)=>{try{const c=await client();const x=await c.responses.create({model:MODEL,instructions:prompt,input:[{role:'user',content:[{type:'input_text',text:'Analyze file '+String(req.body?.name||'file')+':\n'+String(req.body?.content||'').slice(0,2000000)}]}]});res.json({text:x.output_text})}catch(e){res.status(500).json({error:e.message})}});
app.get('/api/chats',auth,async(req,res)=>{try{res.json(JSON.parse(await fs.readFile(path.join(CHATS,req.user.sub+'.json'))))}catch{res.json([])}});
app.post('/api/chats',auth,async(req,res)=>{try{await fs.writeFile(path.join(CHATS,req.user.sub+'.json'),JSON.stringify(Array.isArray(req.body?.chats)?req.body.chats.slice(0,200):[]));res.json({ok:true})}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/build',auth,async(req,res)=>{try{const target=['web','zip','android'].includes(req.body?.target)?req.body.target:'web';const name=String(req.body?.artifact_name||'superme-ai-build').replace(/[^\w.-]/g,'-');await gh(`/repos/${REPO}/actions/workflows/${encodeURIComponent(WORKFLOW)}/dispatches`,{method:'POST',body:JSON.stringify({ref:process.env.GITHUB_REF||'main',inputs:{target,artifact_name:name,build_type:req.body?.build_type||'debug'}})});res.json({ok:true,message:'Build workflow started',target,artifact_name:name})}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/telegram/test',auth,async(_,res)=>{try{if(!process.env.TELEGRAM_BOT_TOKEN||!process.env.TELEGRAM_CHAT_ID)return res.status(400).json({error:'Telegram secrets are not configured'});const r=await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:process.env.TELEGRAM_CHAT_ID,text:'SUPERME AI: Telegram test OK ✅'})});const d=await r.json();if(!d.ok)return res.status(500).json({error:d.description});res.json({ok:true})}catch(e){res.status(500).json({error:e.message})}});
app.listen(process.env.PORT||3000,()=>console.log('SUPERME AI backend listening on '+(process.env.PORT||3000)+' using '+MODEL));
