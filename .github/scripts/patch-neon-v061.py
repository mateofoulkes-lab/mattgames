from pathlib import Path
p=Path('neoncr/index.html')
s=p.read_text()
assert 'v0.6.0' in s
s=s.replace('v0.6.0','v0.6.1',1)
s=s.replace("function renderShop(){ui.shop.classList.toggle('cannonTab',state.shopTab==='cannon');", "function renderShop(){let unlockSector=state.sector+(ui.shop.dataset.mode==='success'?1:0);ui.shop.classList.toggle('cannonTab',state.shopTab==='cannon');",1)
s=s.replace("sectorOk=state.sector>=d.sector,moneyOk=state.credits>=d.cost", "sectorOk=unlockSector>=d.sector,moneyOk=state.credits>=d.cost",1)
s=s.replace("if(!state.unlockedNodes.has(d.type)&&state.sector>=d.sector&&state.credits>=d.cost){state.credits-=d.cost;state.unlockedNodes.add(d.type);tone(620", "if(!state.unlockedNodes.has(d.type)&&unlockSector>=d.sector&&state.credits>=d.cost){state.credits-=d.cost;state.unlockedNodes.add(d.type);applyNewNodeNow(d.type);tone(620",1)
anchor="function openShop(mode){if(mode==='success'&&state.nodes.some(n=>n.alive)){mode='turn';state.levelCleared=false}ui.shop.dataset.mode=mode;ui.shop.classList.add('show');ui.shopTitle.textContent='TALLER';ui.shopSub.textContent=mode==='success'?'Pantalla limpia.':mode==='retry'?'Quedaron nodos vivos.':'Quedan '+state.nodes.filter(n=>n.alive).length+' nodos.';renderShop()}"
extra="function applyNewNodeNow(type){if(ui.shop.dataset.mode==='success'||state.levelCleared)return;let a=state.nodes.filter(n=>n.alive&&!worldTypes.has(n.type));let qty=Math.min(3,Math.max(1,Math.round(a.length*.16)));for(let i=0;i<qty&&a.length;i++){let n=a.splice((Math.random()*a.length)|0,1)[0];n.type=type;n.triggered=false;n.hp=1;n.maxHp=1;n.lastDirectHit=-9999;n.lastChainHit=-9999;n.ox=n.x;n.oy=n.y;n.movePhase=rand(0,6.28);n.r=Math.max(9,Math.min(n.r,15));n.baseR=n.r;n.scaleMul=1;burst(n.x,n.y,C[type],12,130)}if(qty)msg('¡'+nodeInfo[type].name+' INCORPORADO!',C[type],1200)}"
assert anchor in s
s=s.replace(anchor,anchor+'\n'+extra,1)
p.write_text(s)
