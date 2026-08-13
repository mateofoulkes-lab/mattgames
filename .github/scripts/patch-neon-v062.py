from pathlib import Path
import re
p=Path('neoncr/index.html')
s=p.read_text()
s=s.replace('v0.6.1','v0.6.2',1)

css='''<style id="v062-shop-notices">
@keyframes availablePulse{0%,100%{box-shadow:0 0 0 1px color-mix(in srgb,currentColor 45%,transparent),0 0 8px color-mix(in srgb,currentColor 18%,transparent),inset 0 0 10px color-mix(in srgb,currentColor 6%,transparent)}50%{box-shadow:0 0 0 1px color-mix(in srgb,currentColor 82%,transparent),0 0 18px color-mix(in srgb,currentColor 35%,transparent),inset 0 0 18px color-mix(in srgb,currentColor 10%,transparent)}}
.card.newAvailable,.cannonUpgrade.newAvailable{border-color:currentColor!important;animation:availablePulse 1.7s ease-in-out infinite!important}
@keyframes tabNoticePulse{0%,100%{filter:brightness(1);box-shadow:0 0 7px #67f8ff22,inset 0 0 10px #67f8ff0a}50%{filter:brightness(1.18);box-shadow:0 0 18px #67f8ff66,inset 0 0 16px #67f8ff20}}
.shopTab.hasNotice:not(.active){color:#bffcff;border-color:#67f8ff99;background:#67f8ff15;animation:tabNoticePulse 1.8s ease-in-out infinite}
#tabCannon.hasNotice:not(.active){color:#fff2a2;border-color:#ffe35c99;background:#ffe35c12;box-shadow:0 0 12px #ffe35c44}
</style>'''
if 'v062-shop-notices' not in s:
    s=s.replace('</head>',css+'</head>',1)

anchor="function pips(lv,limit,max,color){"
helpers="""const noticeSeen=new Set(JSON.parse(localStorage.getItem('neon_shop_notice_seen')||'[]'));
function noticeSave(){localStorage.setItem('neon_shop_notice_seen',JSON.stringify([...noticeSeen]))}
function shopUnlockSector(){return state.sector+(ui.shop.dataset.mode==='success'?1:0)}
function availableNoticeKeys(tab){let keys=[];if(tab==='cannon'){let next=cannonDefs[state.cannonLevel+1];if(next&&state.sector>=next.minSector&&state.credits>=next.cost)keys.push('cannon-evo-'+(state.cannonLevel+1));for(let u of adjustments.filter(x=>x.tab==='cannon')){let lv=state.up[u.k],limit=u.k==='penetration'?state.cannonLevel:u.max,c=cost(u);if(lv<limit&&state.credits>=c)keys.push('up-'+u.k+'-'+(lv+1))}}else{let unlockSector=shopUnlockSector();for(let d of nodeUnlocks)if(!state.unlockedNodes.has(d.type)&&unlockSector>=d.sector&&state.credits>=d.cost)keys.push('node-'+d.type);for(let u of adjustments.filter(x=>x.tab==='nodes')){let lv=state.up[u.k],c=cost(u);if(lv<u.max&&state.credits>=c)keys.push('up-'+u.k+'-'+(lv+1))}}return keys}
function refreshTabNotices(){for(let tab of ['cannon','nodes']){let btn=tab==='cannon'?ui.tabCannon:ui.tabNodes,newKeys=availableNoticeKeys(tab).filter(k=>!noticeSeen.has(k));btn.classList.toggle('hasNotice',tab!==state.shopTab&&newKeys.length>0)}}
function markActiveNoticesSeen(keys){if(!keys.length)return;setTimeout(()=>{for(let k of keys)noticeSeen.add(k);noticeSave();refreshTabNotices()},2600)}
"""
if 'const noticeSeen=' not in s:
    s=s.replace(anchor,helpers+anchor,1)

start=s.find('function renderShop(){')
end=s.find("\nui.tabCannon.onclick",start)
if start<0 or end<0: raise SystemExit('renderShop block not found')
old=s[start:end]
# insert active notice collection after unlockSector declaration
old=old.replace("function renderShop(){let unlockSector=state.sector+(ui.shop.dataset.mode==='success'?1:0);","function renderShop(){let unlockSector=shopUnlockSector(),activeNew=availableNoticeKeys(state.shopTab).filter(k=>!noticeSeen.has(k));",1)
# cannon evolution class
old=old.replace("ui.cannonUpgrade.className='cannonUpgrade'+(can?' ready':'');","ui.cannonUpgrade.className='cannonUpgrade'+(can?' ready':'')+(activeNew.includes('cannon-evo-'+(state.cannonLevel+1))?' newAvailable':'');",1)
# node card class after creation
old=old.replace("b.className='card nodeUnlockCard';b.style.color=C[d.type];","b.className='card nodeUnlockCard'+(activeNew.includes('node-'+d.type)?' newAvailable':'');b.style.color=C[d.type];",1)
# normal adjustment card class
old=old.replace("b.className='card';b.disabled=lv>=limit||state.credits<c;b.style.color=u.color;","b.className='card'+(activeNew.includes('up-'+u.k+'-'+(lv+1))?' newAvailable':'');b.disabled=lv>=limit||state.credits<c;b.style.color=u.color;",1)
# append refresh + delayed mark just before function closes
if old.endswith('}}'):
    old=old[:-2]+"}refreshTabNotices();markActiveNoticesSeen(activeNew)}"
else:
    raise SystemExit('unexpected renderShop ending')
s=s[:start]+old+s[end:]

# tab clicks should immediately clear tab glow by entering tab, while card pulse survives briefly
s=s.replace("ui.tabCannon.onclick=()=>{state.shopTab='cannon';renderShop()};ui.tabNodes.onclick=()=>{state.shopTab='nodes';renderShop()};","ui.tabCannon.onclick=()=>{state.shopTab='cannon';ui.tabCannon.classList.remove('hasNotice');renderShop()};ui.tabNodes.onclick=()=>{state.shopTab='nodes';ui.tabNodes.classList.remove('hasNotice');renderShop()};",1)

p.write_text(s)
