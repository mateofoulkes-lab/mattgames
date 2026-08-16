from pathlib import Path
import re

root = Path(__file__).resolve().parents[2]
js_path = root / 'eltopo' / 'social-game.js'
html_path = root / 'eltopo' / 'index.html'
sync_path = root / 'eltopo' / 'mixed-avatar-sync.js'
css_path = root / 'eltopo' / 'fixes-v010.css'

js = js_path.read_text(encoding='utf-8')
js = js.replace("0.10.7", "0.10.8")

old_case = "    case 'spy-turn': return onSpyTurn(data.payload);\n    case 'spy-voting': return onSpyVoting(data.payload);"
new_case = "    case 'spy-turn': return onSpyTurn(data.payload);\n    case 'spy-final-phase': return onSpyFinalPhase(data.payload);\n    case 'spy-voting': return onSpyVoting(data.payload);"
if old_case not in js:
    raise SystemExit('handleEnvelope spy-turn anchor not found')
js = js.replace(old_case, new_case, 1)

start_pat = re.compile(r"function beginSpyFinalVoting\(\)\{.*?\n\}\nfunction onSpyVoting", re.S)
new_start = r'''function beginSpyFinalVoting(){
  if(!isAdmin||state.mode!=='spyfall'||state.final||state.spyfall?.voting)return;
  const deadline=now()+20000;
  state.phase='spy-voting';
  state.spyfall.voting=true;
  state.spyfall.deadline=deadline;
  state.spyfall.votes={};
  state.spyfall.locationWindow=false;
  state.spyfall.spyGuessSubmitted=false;
  state.spyfall.spyLocationGuess=null;
  state.spyfall.spyLocationCorrect=false;
  delete state.spyfall.spyLocationPending;

  // One public phase signal is more robust than two different targeted setup messages.
  // Each device already knows its private role and opens the correct forced modal locally.
  const payload={active:true,deadline};
  send('spy-final-phase',payload).catch(()=>{});
  onSpyFinalPhase(payload);
  clearTimeout(spyFinalizeTimer);
  spyFinalizeTimer=setTimeout(finalizeSpyfall,20050);
}
function closeSpyFinalChoiceModal(){
  const modal=$('characterSelectModal');
  if(!modal)return;
  if(modal.dataset.spyFinalChoice){
    modal.classList.add('hidden');
    delete modal.dataset.spyFinalChoice;
    $('characterSelectGrid')?.classList.remove('spy-final-choice-grid','spy-location-grid');
  }
}
function updateSpyFinalChoiceCountdown(){
  const modal=$('characterSelectModal');
  if(!modal||!modal.dataset.spyFinalChoice||modal.classList.contains('hidden'))return;
  const left=Math.max(0,Math.ceil((Number(state.spyfall?.deadline||0)-now())/1000));
  const sub=$('characterSelectSub');
  if(!sub)return;
  if(modal.dataset.spyFinalChoice==='location'){
    const chosen=state.spyfall?.spyLocationGuess||state.spyfall?.spyLocationPending;
    sub.textContent=chosen?`Elegiste “${chosen}”. Esperando el resultado · ${left}s`:`Elegí una ubicación. Tenés ${left} segundos y una sola oportunidad.`;
  }else{
    const chosen=state.spyfall?.votes?.[selfId];
    const name=chosen?displayName(state.members[chosen]):'';
    sub.textContent=name?`Tu voto actual: ${name}. Podés cambiarlo · ${left}s`:`Elegí quién creés que es el espía · ${left}s`;
  }
}
function openSpyVoteModal(){
  if(privateInfo?.isSpy||state.final||!state.spyfall?.voting||now()>=Number(state.spyfall.deadline||0))return;
  closeGenericModal();
  const modal=$('characterSelectModal'),grid=$('characterSelectGrid');
  if(!modal||!grid)return;
  modal.dataset.spyFinalChoice='vote';
  $('characterSelectTitle').textContent='🗳️ Votación final';
  const targets=players().filter(m=>m.id!==selfId);
  const mine=state.spyfall?.votes?.[selfId]||null;
  grid.classList.add('spy-final-choice-grid');
  grid.classList.remove('spy-location-grid');
  grid.innerHTML=targets.map(m=>`<button class="spy-player-vote ${mine===m.id?'selected':''}" data-spy-final-vote="${m.id}"><div class="spy-player-vote-avatar">${avatarMarkup(m)}</div><strong>${esc(displayName(m))}</strong><span>Votar</span></button>`).join('');
  grid.querySelectorAll('[data-spy-final-vote]').forEach(b=>b.onclick=()=>{
    castSpyVote(b.dataset.spyFinalVote);
    grid.querySelectorAll('[data-spy-final-vote]').forEach(x=>x.classList.toggle('selected',x.dataset.spyFinalVote===b.dataset.spyFinalVote));
    updateSpyFinalChoiceCountdown();
  });
  modal.classList.remove('hidden');
  updateSpyFinalChoiceCountdown();
}
function openSpyLocationVoteModal(){
  if(!privateInfo?.isSpy||state.final||!state.spyfall?.locationWindow||now()>=Number(state.spyfall.deadline||0))return;
  closeGenericModal();
  const modal=$('characterSelectModal'),grid=$('characterSelectGrid');
  if(!modal||!grid)return;
  modal.dataset.spyFinalChoice='location';
  $('characterSelectTitle').textContent='🕵️ ¿Dónde están?';
  const chosen=state.spyfall?.spyLocationGuess||state.spyfall?.spyLocationPending||null;
  grid.classList.add('spy-final-choice-grid','spy-location-grid');
  grid.innerHTML=SPY_LOCATIONS.map(l=>`<button class="spy-location-vote ${chosen===l.name?'selected':''}" data-spy-final-location="${esc(l.name)}" ${state.spyfall?.spyGuessSubmitted?'disabled':''}><span>📍</span><strong>${esc(l.name)}</strong></button>`).join('');
  grid.querySelectorAll('[data-spy-final-location]').forEach(b=>b.onclick=()=>castSpyLocationVote(b.dataset.spyFinalLocation));
  modal.classList.remove('hidden');
  updateSpyFinalChoiceCountdown();
}
function castSpyLocationVote(location){
  if(!spyLocationWindowOpen())return;
  const guess=String(location||'').trim(); if(!guess)return;
  state.spyfall.spyGuessSubmitted=true;
  state.spyfall.spyLocationPending=guess;
  openSpyLocationVoteModal();
  const payload={location:guess};
  if(isAdmin){
    onSpyGuessLocation(payload,selfId);
  }else{
    // Broadcast is intentional: only the host processes this message, but it avoids a
    // fragile logical-id targeted route that could leave the spy unable to submit.
    send('spy-guess-location',payload).catch(()=>{
      state.spyfall.spyGuessSubmitted=false;
      delete state.spyfall.spyLocationPending;
      toast('No pude enviar tu elección. Probá nuevamente.');
      openSpyLocationVoteModal();
    });
  }
  updateSpyFinalChoiceCountdown();
}
function onSpyFinalPhase(p){
  if(!p?.active||state.mode!=='spyfall'||state.final)return;
  state.phase='spy-voting';
  state.spyfall.voting=true;
  state.spyfall.deadline=Number(p.deadline)||now()+20000;
  state.spyfall.spyGuessSubmitted=false;
  state.spyfall.spyLocationGuess=null;
  delete state.spyfall.spyLocationPending;
  state.spyfall.locationWindow=!!privateInfo?.isSpy;
  clearInterval(spyCountdownTicker);
  spyCountdownTicker=setInterval(()=>{
    renderGameBar();
    updateSpyFinalChoiceCountdown();
    if(now()>=state.spyfall.deadline)clearInterval(spyCountdownTicker);
  },200);
  renderGameBar();
  setTimeout(()=>privateInfo?.isSpy?openSpyLocationVoteModal():openSpyVoteModal(),0);
}
function onSpyVoting'''
js, n = start_pat.subn(new_start, js, count=1)
if n != 1:
    raise SystemExit(f'beginSpyFinalVoting replacement count={n}')

# Make the old targeted handlers compatible if an older host is still around.
old_voting = "function onSpyVoting(p){\n  if(privateInfo?.isSpy||!p?.voting||state.final)return;\n  state.phase='spy-voting';\n  state.spyfall.voting=true;\n  state.spyfall.deadline=Number(p.deadline)||now()+20000;\n  clearInterval(spyCountdownTicker);\n  spyCountdownTicker=setInterval(()=>{\n    renderGameBar();\n    if(now()>=state.spyfall.deadline)clearInterval(spyCountdownTicker);\n  },200);\n  renderGameBar();\n}"
new_voting = "function onSpyVoting(p){\n  if(privateInfo?.isSpy||!p?.voting||state.final)return;\n  onSpyFinalPhase({active:true,deadline:p.deadline});\n}"
if old_voting not in js:
    raise SystemExit('old onSpyVoting not found')
js = js.replace(old_voting, new_voting, 1)

old_loc = "function onSpyLocationWindow(p){\n  if(!privateInfo?.isSpy||!p?.active||state.final)return;\n  state.spyfall.locationWindow=true;\n  state.spyfall.deadline=Number(p.deadline)||now()+20000;\n  state.spyfall.spyGuessSubmitted=false;\n  state.spyfall.spyLocationGuess=null;\n  clearInterval(spyCountdownTicker);\n  spyCountdownTicker=setInterval(()=>{\n    renderGameBar();\n    if(now()>=state.spyfall.deadline)clearInterval(spyCountdownTicker);\n  },200);\n  renderGameBar();\n}"
new_loc = "function onSpyLocationWindow(p){\n  if(!privateInfo?.isSpy||!p?.active||state.final)return;\n  onSpyFinalPhase({active:true,deadline:p.deadline});\n}"
if old_loc not in js:
    raise SystemExit('old onSpyLocationWindow not found')
js = js.replace(old_loc, new_loc, 1)

old_guess = re.compile(r"function guessSpyLocation\(\)\{.*?\n\}\nfunction onSpyGuessLocation", re.S)
new_guess = r'''function guessSpyLocation(){
  if(!spyLocationWindowOpen()){
    if(privateInfo?.isSpy&&!state.final)toast('Podés elegir el lugar durante los 20 segundos de la votación final.');
    return;
  }
  openSpyLocationVoteModal();
}
function onSpyGuessLocation'''
js, n = old_guess.subn(new_guess, js, count=1)
if n != 1:
    raise SystemExit(f'guessSpyLocation replacement count={n}')

old_ack = "function onSpyLocationAck(p){\n  if(!privateInfo?.isSpy||state.final)return;\n  state.spyfall.spyGuessSubmitted=true; state.spyfall.spyLocationGuess=p?.guess||null;\n  if(!p?.correct)toast(`Elegiste “${p?.guess||'—'}”. No acertaste; esperá el resultado de la ronda.`);\n  renderGameBar();\n}"
new_ack = "function onSpyLocationAck(p){\n  if(!privateInfo?.isSpy||state.final)return;\n  state.spyfall.spyGuessSubmitted=true; state.spyfall.spyLocationGuess=p?.guess||null; delete state.spyfall.spyLocationPending;\n  if(!p?.correct)toast(`Elegiste “${p?.guess||'—'}”. No acertaste; esperá el resultado de la ronda.`);\n  renderGameBar(); openSpyLocationVoteModal(); updateSpyFinalChoiceCountdown();\n}"
if old_ack not in js:
    raise SystemExit('old onSpyLocationAck not found')
js = js.replace(old_ack, new_ack, 1)

old_final = "function onSpyFinal(p){\n  clearTimeout(spyFinalizeTimer); clearInterval(spyCountdownTicker);"
new_final = "function onSpyFinal(p){\n  clearTimeout(spyFinalizeTimer); clearInterval(spyCountdownTicker); closeSpyFinalChoiceModal();"
if old_final not in js:
    raise SystemExit('onSpyFinal anchor not found')
js = js.replace(old_final, new_final, 1)

js_path.write_text(js, encoding='utf-8')

html = html_path.read_text(encoding='utf-8').replace('0.10.7','0.10.8')
html_path.write_text(html, encoding='utf-8')

sync = sync_path.read_text(encoding='utf-8').replace("0.10.7", "0.10.8")
sync_path.write_text(sync, encoding='utf-8')

css = css_path.read_text(encoding='utf-8')
marker = '/* v0.10.8 Spyfall forced final vote */'
if marker not in css:
    css += r'''

/* v0.10.8 Spyfall forced final vote */
.spy-final-choice-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:16px}
.spy-player-vote{border:2px solid transparent;background:#f6f8f9;border-radius:14px;padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:7px;min-height:150px}
.spy-player-vote:hover{background:#edf7f4}.spy-player-vote.selected{border-color:#00a884;background:#e8fff7;box-shadow:0 0 0 3px rgba(0,168,132,.12)}
.spy-player-vote-avatar{width:82px;height:82px;border-radius:50%;overflow:hidden;background:#dfe5e7;display:grid;place-items:center}.spy-player-vote-avatar img{width:100%;height:100%;object-fit:cover}.spy-player-vote strong{font-size:14px}.spy-player-vote span{font-size:11px;color:#008069;font-weight:800}
.spy-location-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.spy-location-vote{border:2px solid #e4e8ea;background:#fff;border-radius:12px;padding:13px 8px;display:flex;align-items:center;justify-content:center;gap:7px;min-height:52px}.spy-location-vote strong{font-size:12px}.spy-location-vote.selected{border-color:#7b3ca4;background:#f7effd}.spy-location-vote:disabled{opacity:.55;cursor:default}.spy-location-vote.selected:disabled{opacity:1}
@media(max-width:700px){.spy-final-choice-grid,.spy-location-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.spy-player-vote{min-height:132px}.spy-player-vote-avatar{width:68px;height:68px}}
'''
css_path.write_text(css, encoding='utf-8')

print('Patched El Topo v0.10.8')
