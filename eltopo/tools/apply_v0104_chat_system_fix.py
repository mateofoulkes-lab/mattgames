from pathlib import Path
p=Path('eltopo/social-game.js')
s=p.read_text()
s=s.replace("./game-data.js?v=0.10.3","./game-data.js?v=0.10.4")
s=s.replace("const VERSION = '0.10.3';","const VERSION = '0.10.4';")
s=s.replace("    case 'system': return addSystem(data.payload?.text||'');","    case 'system': return onSystem(data.payload,cid);")
old="""function addSystem(text){
  if(!text)return;
  const msg={id:uid(),system:true,text,ts:now()};
  if(!state.messages.some(m=>m.id===msg.id))state.messages.push(msg);
  if(isAdmin&&joined) send('system',{text}).catch(()=>{});
  renderMessages();
}"""
new="""function addSystem(text){
  if(!text)return;
  const msg={id:uid(),system:true,text,ts:now()};
  if(state.mode==='incognito'&&state.started&&isAdmin){state.chatSeq=Number(state.chatSeq||0)+1;msg.seq=state.chatSeq;msg.canonical=true;}
  if(!state.messages.some(m=>m.id===msg.id))state.messages.push(msg);
  if(isAdmin&&joined) send('system',msg).catch(()=>{});
  renderMessages();
}
function onSystem(payload,cid){
  const text=payload?.text||''; if(!text)return;
  const msg={id:payload.id||uid(),system:true,text,ts:Number(payload.ts||now()),seq:Number(payload.seq||0),canonical:payload.canonical===true};
  if(state.messages.some(m=>m.id===msg.id))return;
  state.messages.push(msg);
  if(state.mode==='incognito')state.messages.sort((a,b)=>Number(a.seq||0)-Number(b.seq||0)||Number(a.ts||0)-Number(b.ts||0));
  renderMessages();
}"""
if old not in s: raise SystemExit('addSystem block not found')
s=s.replace(old,new,1)
p.write_text(s)
for name in ['eltopo/index.html','eltopo/mixed-avatar-sync.js','eltopo/superadmin/admin.js','eltopo/superadmin/index.html']:
    q=Path(name)
    if q.exists(): q.write_text(q.read_text().replace('0.10.3','0.10.4'))
