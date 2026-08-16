from pathlib import Path

p = Path('eltopo/social-game.js')
s = p.read_text(encoding='utf-8')

repls = [
    ("import { AVATARS } from './game-data.js?v=0.10.5';", "import { AVATARS } from './game-data.js?v=0.10.6';"),
    ("const VERSION = '0.10.5';", "const VERSION = '0.10.6';"),
    ("const deadline=now()+10000;", "const deadline=now()+20000;"),
    ("spyFinalizeTimer=setTimeout(finalizeSpyfall,10050);", "spyFinalizeTimer=setTimeout(finalizeSpyfall,20050);"),
    ("state.spyfall.deadline=Number(p.deadline)||now()+10000;", "state.spyfall.deadline=Number(p.deadline)||now()+20000;"),
    ("state.spyfall.deadline=Number(p.deadline)||now()+10000;", "state.spyfall.deadline=Number(p.deadline)||now()+20000;"),
    ("<span>Tenés 10 segundos para elegir en qué lugar están.</span>", "<span>Tenés 20 segundos para elegir en qué lugar están.</span>"),
    ("<span>Votación final. Tenés 10 segundos para votar o cambiar tu voto.</span>", "<span>Votación final. Tenés 20 segundos para votar o cambiar tu voto.</span>"),
    ("<small>Cuando empiece la votación final vas a tener 10 segundos para elegir el lugar.</small>", "<small>Cuando empiece la votación final vas a tener 20 segundos para elegir el lugar.</small>"),
    ("else send('return-lobby-request',{},state.adminId).then(()=>toast('Volviendo al lobby…')).catch(()=>toast('No pude volver al lobby.'));", "else send('return-lobby-request',{}).then(()=>toast('Volviendo al lobby…')).catch(()=>toast('No pude volver al lobby.'));"),
]
for old,new in repls:
    if old not in s:
        raise SystemExit(f'missing expected block: {old[:90]}')
    s=s.replace(old,new,1)

old_show = '''function showSpyResult(p){
  const crewWon=p.winner==='crew'; const winner=crewWon?'🏆 GANA EL GRUPO':'🕵️ GANA EL ESPÍA';
  const tally=(p.tally||[]).length?(p.tally||[]).map(x=>`<span class="result-vote-chip">${esc(x.name)} ×${x.count}</span>`).join(''):'<span class="result-no-votes">Sin votos válidos</span>';
  const majority=p.reason==='vote'&&Number.isFinite(Number(p.eligibleVoters))
    ? `<div class="spy-final-detail"><span>Votos al espía</span><b>${Number(p.spyVotes||0)} / ${Number(p.eligibleVoters||0)}</b><span>Mayoría necesaria</span><b>${Number(p.needed||0)}</b></div>`:'';
  const guess=p.spyGuess?`<div class="spy-final-detail"><span>El espía eligió</span><b>${esc(p.spyGuess)}</b></div>`:'';
  const action=isAdmin?'<button id="spyReturnLobby" class="primary-btn">Cerrar resultado y volver al lobby</button>':'<button id="spyResultClose" class="primary-btn">Cerrar resultado</button>';
  showModal('🎉 Resultado · Spyfall',`<div class="spy-final-card"><div class="spy-final-winner">${winner}</div><strong>${esc(p.result||'Partida terminada')}</strong><div class="spy-final-detail"><span>El espía era</span><b>${esc(p.spyName||'?')}</b><span>El lugar era</span><b>${esc(p.location||'?')}</b></div>${majority}${guess}${p.reason==='vote'?`<div class="spy-final-tally"><span>VOTACIÓN FINAL</span>${tally}</div>`:''}${action}</div>`,()=>{
    $('spyResultClose')?.addEventListener('click',closeGenericModal);
    $('spyReturnLobby')?.addEventListener('click',()=>returnEveryoneToLobby(`Spyfall: ${p.result}`));
  });
}'''
new_show = '''function showSpyResult(p){
  const crewWon=p.winner==='crew';
  const winner=crewWon?'🏆 GANA EL GRUPO':'🕵️ GANA EL ESPÍA';
  const spyMember=state.members[p.spyId]||{realName:p.spyName,publicName:p.spyName};
  const tally=(p.tally||[]).length?(p.tally||[]).map(x=>`<span class="result-vote-chip">${esc(x.name)} ×${x.count}</span>`).join(''):'<span class="result-no-votes">Sin votos válidos</span>';
  const majority=p.reason==='vote'&&Number.isFinite(Number(p.eligibleVoters))
    ? `<div class="spy-final-stat"><span>VOTOS AL ESPÍA</span><strong>${Number(p.spyVotes||0)} / ${Number(p.eligibleVoters||0)}</strong><small>se necesitaban ${Number(p.needed||0)}</small></div>`:'';
  const guess=p.spyGuess?`<div class="spy-final-stat"><span>ELECCIÓN DEL ESPÍA</span><strong>${esc(p.spyGuess)}</strong><small>${p.reason==='guess'?'¡acertó el lugar!':'su intento durante el cierre'}</small></div>`:'';
  const action=isAdmin?'<button id="spyReturnLobby" class="primary-btn spy-final-close">Volver al lobby</button>':'<button id="spyResultClose" class="primary-btn spy-final-close">Cerrar resultado</button>';
  showModal('',`<div class="spy-final-show"><div class="spy-final-burst">${crewWon?'🎉🏆🎉':'🕵️✨🕵️'}</div><div class="spy-final-overline">SPYFALL · RONDA TERMINADA</div><div class="spy-final-winner-big">${winner}</div><div class="spy-final-reveal"><span>EL ESPÍA ERA</span><div class="spy-final-avatar">${avatarMarkup(spyMember)}</div><strong>${esc(p.spyName||'?')}</strong></div><div class="spy-final-location"><span>EL LUGAR ERA</span><strong>📍 ${esc(p.location||'?')}</strong></div><p class="spy-final-summary">${esc(p.result||'Partida terminada')}</p><div class="spy-final-stats">${majority}${guess}</div>${p.reason==='vote'?`<div class="spy-final-tally"><span>VOTACIÓN FINAL</span><div>${tally}</div></div>`:''}${action}</div>`,modal=>{
    modal.classList.add('spy-result-modal');
    $('spyResultClose')?.addEventListener('click',()=>{modal.classList.remove('spy-result-modal');closeGenericModal();});
    $('spyReturnLobby')?.addEventListener('click',()=>{modal.classList.remove('spy-result-modal');returnEveryoneToLobby(`Spyfall: ${p.result}`);});
  });
}'''
if old_show not in s:
    raise SystemExit('showSpyResult block not found')
s=s.replace(old_show,new_show,1)

p.write_text(s,encoding='utf-8')

idx=Path('eltopo/index.html')
h=idx.read_text(encoding='utf-8')
h=h.replace('v0.10.5','v0.10.6')
h=h.replace('<button id="messengerBackBtn" class="icon-btn mobile-only" title="Volver al lobby">‹</button>','<button id="messengerBackBtn" class="icon-btn messenger-back-btn" type="button" title="Volver al lobby" aria-label="Volver al lobby">‹</button>')
if 'spyfall-finale.css' not in h:
    h=h.replace('<link rel="stylesheet" href="./fixes-v010.css?v=0.10.6" />','<link rel="stylesheet" href="./fixes-v010.css?v=0.10.6" />\n  <link rel="stylesheet" href="./spyfall-finale.css?v=0.10.6" />')
idx.write_text(h,encoding='utf-8')

shim=Path('eltopo/mixed-avatar-sync.js')
if shim.exists():
    t=shim.read_text(encoding='utf-8').replace("const BUILD_VERSION = '0.10.5';","const BUILD_VERSION = '0.10.6';")
    shim.write_text(t,encoding='utf-8')
