from pathlib import Path
p=Path('eltopo/social-game.js')
s=p.read_text()

def rep(old,new,label):
    global s
    if old not in s: raise SystemExit('NOT FOUND '+label)
    s=s.replace(old,new,1)

rep("./game-data.js?v=0.10.0","./game-data.js?v=0.10.1","game data")
rep("const VERSION = '0.10.0';","const VERSION = '0.10.1';","version")

old='''function mixedSubmittedVotes(){
  let total=0;
  for(const [voterId,ballot] of Object.entries(state.guesses||{})){
    for(const targetId of Object.keys(ballot||{})) if(voterId!==targetId&&state.members[targetId]&&!state.members[targetId].spectator) total++;
  }
  return total;
}'''
new='''function mixedSubmittedVotes(){
  let total=0;
  for(const [voterId,ballot] of Object.entries(state.guesses||{})){
    const voter=state.members[voterId]; if(!voter||voter.spectator||voter.online===false)continue;
    for(const targetId of Object.keys(ballot||{})){
      const target=state.members[targetId]; if(voterId!==targetId&&target&&!target.spectator&&target.online!==false)total++;
    }
  }
  return total;
}'''
rep(old,new,"submitted")
rep("return Object.entries(state.guesses||{}).reduce((n,[voterId,ballot])=>n+(voterId!==targetId&&ballot?.[targetId]?1:0),0);","return Object.entries(state.guesses||{}).reduce((n,[voterId,ballot])=>{const voter=state.members[voterId],target=state.members[targetId];return n+(voter&&voter.online!==false&&!voter.spectator&&target&&target.online!==false&&!target.spectator&&voterId!==targetId&&ballot?.[targetId]?1:0);},0);","target count")
old='''  for(const [voterId,ballot] of Object.entries(state.guesses||{})){
    if(voterId===targetId)continue;
    const name=ballot?.[targetId]; if(name)counts[name]=(counts[name]||0)+1;
  }'''
new='''  for(const [voterId,ballot] of Object.entries(state.guesses||{})){
    const voter=state.members[voterId],target=state.members[targetId];
    if(voterId===targetId||!voter||voter.online===false||voter.spectator||!target||target.online===false||target.spectator)continue;
    const name=ballot?.[targetId]; if(name)counts[name]=(counts[name]||0)+1;
  }'''
rep(old,new,"breakdown")
rep("if(state.mode!=='mixed'||state.final||!p?.targetId||!state.members[p.targetId])return;","if(state.mode!=='mixed'||state.final||!p?.targetId||!state.members[p.targetId]||state.members[p.targetId].online===false||!state.members[cid]||state.members[cid].online===false)return;","guess active")
old='''  for(const [voterId,ballot] of Object.entries(state.guesses||{})){
    for(const [targetId,guessName] of Object.entries(ballot||{})){
      const target=state.members[targetId]; if(!target||target.spectator||voterId===targetId)continue;
      if(guessName===target.realName) scores[voterId]=(scores[voterId]||0)+1;
      else scores[targetId]=(scores[targetId]||0)+1;
    }
  }'''
new='''  for(const [voterId,ballot] of Object.entries(state.guesses||{})){
    const voter=state.members[voterId]; if(!voter||voter.spectator||voter.online===false)continue;
    for(const [targetId,guessName] of Object.entries(ballot||{})){
      const target=state.members[targetId]; if(!target||target.spectator||target.online===false||voterId===targetId)continue;
      if(guessName===target.realName) scores[voterId]=(scores[voterId]||0)+1;
      else scores[targetId]=(scores[targetId]||0)+1;
    }
  }'''
rep(old,new,"score active")

rep("  addSystem('🕵️ Spyfall comenzó. Las preguntas se hacen por turnos.');","  addSystem('🕵️ Spyfall comenzó. Las preguntas se hacen por turnos.');\n  addSystem(`🎤 Es el turno de ${displayName(state.members[currentSpyTurnId()])} de preguntar.`);","first turn")
rep("  const turn={turnOrder:state.spyfall.turnOrder,turnIndex:state.spyfall.turnIndex}; send('spy-turn',turn).catch(()=>{}); onSpyTurn(turn);","  const turn={turnOrder:state.spyfall.turnOrder,turnIndex:state.spyfall.turnIndex}; send('spy-turn',turn).catch(()=>{}); onSpyTurn(turn);\n  const next=state.members[currentSpyTurnId()]; if(next)addSystem(`🎤 Es el turno de ${displayName(next)} de preguntar.`);","next turn")

p.write_text(s)

p=Path('eltopo/index.html');p.write_text(p.read_text().replace('0.10.0','0.10.1'))
p=Path('eltopo/mixed-avatar-sync.js');
if p.exists():p.write_text(p.read_text().replace('0.10.0','0.10.1'))
p=Path('eltopo/superadmin/admin.js')
a=p.read_text().replace("../game-data.js?v=0.9.1","../game-data.js?v=0.10.1").replace("const CURRENT_CLIENT='0.9.1';","const CURRENT_CLIENT='0.10.1';")
p.write_text(a)
p=Path('eltopo/superadmin/index.html');p.write_text(p.read_text().replace('admin.js?v=0.9.1','admin.js?v=0.10.1').replace('admin.css?v=0.9.1','admin.css?v=0.10.1'))
