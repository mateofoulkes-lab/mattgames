from pathlib import Path
p=Path('eltopo/social-game.js')
s=p.read_text()

def rep(old,new,label):
    global s
    if old not in s: raise SystemExit('NOT FOUND '+label)
    s=s.replace(old,new,1)

rep("./game-data.js?v=0.10.2","./game-data.js?v=0.10.3","game data")
rep("const VERSION = '0.10.2';","const VERSION = '0.10.3';","version")
rep("members:{}, lobbyMessages:[], messages:[], trigger:'', guesses:{}, scores:null,","members:{}, lobbyMessages:[], messages:[], chatSeq:0, trigger:'', guesses:{}, scores:null,","chat seq state")
rep("    case 'chat': return onChat(data.payload,cid);","    case 'chat': return onChat(data.payload,cid);\n    case 'chat-submit': return onChatSubmit(data.payload,cid);","chat submit event")

old='''function onChat(msg,cid){
  if(!msg?.id||state.messages.some(m=>m.id===msg.id))return;
  const sender=state.members[cid]; msg.senderId=cid; msg.senderName=msg.senderName||displayName(sender); state.messages.push(msg); state.messages.sort((a,b)=>a.ts-b.ts); renderMessages();
}
function sendChat(){
  if(state.chatDisabled||me()?.muted){toast('El chat está deshabilitado.');return;}
  const input=$('messageInput'); const text=input?.value.trim(); if(!text)return;
  input.value=''; const msg={id:uid(),senderId:selfId,senderName:displayName(me()),text:text.slice(0,1000),ts:now(),replyTo:replyingTo?{id:replyingTo.id,senderName:replyingTo.senderName,text:replyingTo.text.slice(0,120)}:null,reactions:{}};
  state.messages.push(msg); replyingTo=null; renderComposerReply(); renderMessages(); send('chat',msg).catch(()=>toast('No se pudo enviar'));
}'''
new='''function onChat(msg,cid){
  if(!msg?.id||state.messages.some(m=>m.id===msg.id))return;
  const canonicalIncognito=state.mode==='incognito'&&msg.canonical===true;
  const senderId=canonicalIncognito?(msg.senderId||cid):cid;
  const sender=state.members[senderId]; msg.senderId=senderId; msg.senderName=msg.senderName||displayName(sender); state.messages.push(msg);
  if(state.mode==='incognito') state.messages.sort((a,b)=>Number(a.seq||0)-Number(b.seq||0)||Number(a.ts||0)-Number(b.ts||0));
  else state.messages.sort((a,b)=>a.ts-b.ts);
  renderMessages();
}
function onChatSubmit(msg,cid){
  if(!isAdmin||state.mode!=='incognito'||!state.started||!msg?.id||!msg?.text)return;
  const sender=state.members[cid]; if(!sender||sender.online===false||sender.spectator||sender.muted)return;
  if(state.messages.some(m=>m.id===msg.id))return;
  state.chatSeq=Number(state.chatSeq||0)+1;
  const canonical={id:msg.id,senderId:cid,senderName:displayName(sender),text:String(msg.text||'').slice(0,1000),ts:now(),seq:state.chatSeq,canonical:true,replyTo:msg.replyTo||null,reactions:{}};
  state.messages.push(canonical); renderMessages(); send('chat',canonical).catch(()=>{});
}
function sendChat(){
  if(state.chatDisabled||me()?.muted){toast('El chat está deshabilitado.');return;}
  const input=$('messageInput'); const text=input?.value.trim(); if(!text)return;
  input.value=''; const msg={id:uid(),senderId:selfId,senderName:displayName(me()),text:text.slice(0,1000),ts:now(),replyTo:replyingTo?{id:replyingTo.id,senderName:replyingTo.senderName,text:replyingTo.text.slice(0,120)}:null,reactions:{}};
  replyingTo=null; renderComposerReply();
  if(state.mode==='incognito'&&state.started){
    if(isAdmin)onChatSubmit(msg,selfId); else send('chat-submit',msg,state.adminId).catch(()=>toast('No se pudo enviar'));
    return;
  }
  state.messages.push(msg); renderMessages(); send('chat',msg).catch(()=>toast('No se pudo enviar'));
}'''
rep(old,new,"chat authoritative incognito")

# Clean chat sequence at mode start / lobby return.
rep("state.messages=[{id:uid(),system:true,text:'🕶️ Modo Incógnito activado. El historial del lobby fue eliminado para proteger las identidades.',ts:now()}];","state.chatSeq=0; state.messages=[{id:uid(),system:true,text:'🕶️ Modo Incógnito activado. El historial del lobby fue eliminado para proteger las identidades.',ts:now(),seq:0}];","incog chat seq reset")
rep("state.started=false; state.phase='lobby'; state.final=false; state.trigger=''; state.messages=[];","state.started=false; state.phase='lobby'; state.final=false; state.trigger=''; state.messages=[]; state.chatSeq=0;","return seq reset")

p.write_text(s)

for name in ['eltopo/index.html','eltopo/mixed-avatar-sync.js','eltopo/superadmin/admin.js','eltopo/superadmin/index.html']:
    q=Path(name)
    if q.exists():q.write_text(q.read_text().replace('0.10.2','0.10.3'))
