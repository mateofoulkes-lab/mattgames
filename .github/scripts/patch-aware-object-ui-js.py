from pathlib import Path
import re
p=Path('a-ware/index.html')
s=p.read_text(encoding='utf-8')

s=s.replace('deviceClouds[name]=pts;if(pendingReveal.has(name))revealObject(name);if(pendingControl.has(name))controlObject(name);return obj;', 'pts.userData.awareName=name;deviceClouds[name]=pts;if(pendingReveal.has(name))revealObject(name);if(pendingControl.has(name))controlObject(name);return obj;',1)

s=s.replace("laptopRow=document.querySelector('#laptopRow'),controlList=document.querySelector('#controlList'),objective=document.querySelector('#objective');", "laptopRow=document.querySelector('#laptopRow'),controlList=document.querySelector('#controlList'),knownList=document.querySelector('#knownList'),objective=document.querySelector('#objective'),revealToast=document.querySelector('#revealToast'),hoverCard=document.querySelector('#hoverCard');",1)

old="function actionButton(label,fn){const b=document.createElement('button');b.textContent=label;b.onclick=fn;return b;}"
new="function actionButton(label,fn){const b=document.createElement('button');b.textContent=label;b.onclick=e=>{e.stopPropagation();fn()};return b;}"
s=s.replace(old,new,1)

start=s.find('function renderControls(){')
end=s.find('\nfunction updatePuzzle',start)
if start<0 or end<0: raise SystemExit('renderControls block not found')
block="""function renderControls(){renderKnownList();if(hoveredName)renderHoverCard(hoveredName);}
const objectUI={PC:['▣','PC'],ROUTER:['⌁','ROUTER'],LAPTOP:['▰','NOTEBOOK'],PHONE:['▯','TELÉFONO'],HEATING:['♨','CALEFACTOR'],CEILING_FAN:['✣','VENTILADOR'],COUCH:['▱','SOFÁ'],TV:['▣','TV'],STAIRS:['⌁','ESCALERA'],DOOR:['▯','PUERTA'],'ac_indoor.glb_4':['❄','AIRE ACONDICIONADO'],SMOKE_ALARM:['◉','DETECTOR DE HUMO'],'cama.glb_2':['▬','CAMA'],COFFEE_TABLE:['◇','MESA RATONA'],'doorway.glb_1':['⌑','ABERTURA']};
const uiInfo=name=>objectUI[name]||['·',name.replaceAll('_',' ')];let hoveredName=null,lastMX=0,lastMY=0,toastTimer=0;
function showReveal(name){if(name==='ROOM')return;const [,label]=uiInfo(name);revealToast.textContent=label+' REVELADO';revealToast.classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>revealToast.classList.remove('on'),1500);}
function renderKnownList(){knownList.innerHTML='';for(const name of known){if(name==='ROOM')continue;const [icon,label]=uiInfo(name),d=document.createElement('div');d.className='knownItem'+(controlled.has(name)?' controlled':'');d.innerHTML='<span class=\"knownIcon\">'+icon+'</span><span>'+label+'</span>';knownList.append(d);}}
function hoverButtons(name){const a=[];if(name==='ac_indoor.glb_4')a.push(actionButton(sim.ac?'APAGAR':'ENFRIAR',()=>{sim.ac=!sim.ac;renderControls()}));else if(name==='HEATING')a.push(actionButton(sim.heat?'APAGAR':'ENCENDER',()=>{sim.heat=!sim.heat;renderControls()}));else if(name==='CEILING_FAN')a.push(actionButton(sim.fan?'APAGAR':'ENCENDER',()=>{sim.fan=!sim.fan;renderControls()}));else if(name==='SMOKE_ALARM')a.push(actionButton(sim.sensor?'SILENCIAR':'ACTIVAR',()=>{sim.sensor=!sim.sensor;renderControls()}));return a;}
function renderHoverCard(name,x=lastMX,y=lastMY){if(!name||!known.has(name)){hoverCard.classList.remove('on');return;}const [,label]=uiInfo(name);hoverCard.innerHTML='';const n=document.createElement('div');n.className='hoverName';n.textContent=label;hoverCard.append(n);const st=document.createElement('div');st.className='hoverState';st.textContent=controlled.has(name)?'CONTROL DISPONIBLE':'SOLO OBSERVACIÓN';hoverCard.append(st);if(controlled.has(name)){const box=document.createElement('div');box.className='hoverActions';hoverButtons(name).forEach(b=>box.append(b));hoverCard.append(box);}hoverCard.style.left=Math.min(innerWidth-230,x+14)+'px';hoverCard.style.top=Math.min(innerHeight-120,y+14)+'px';hoverCard.classList.add('on');}
const hoverRay=new THREE.Raycaster(),hoverMouse=new THREE.Vector2();hoverRay.params.Points.threshold=.18;
renderer.domElement.addEventListener('pointermove',e=>{lastMX=e.clientX;lastMY=e.clientY;const r=renderer.domElement.getBoundingClientRect();hoverMouse.x=((e.clientX-r.left)/r.width)*2-1;hoverMouse.y=-((e.clientY-r.top)/r.height)*2+1;hoverRay.setFromCamera(hoverMouse,camera);const clouds=Object.values(deviceClouds).filter(p=>p.visible&&known.has(p.userData.awareName));const hit=hoverRay.intersectObjects(clouds,false)[0];hoveredName=hit?.object?.userData?.awareName||null;if(hoveredName)renderHoverCard(hoveredName,e.clientX,e.clientY);else hoverCard.classList.remove('on');});renderer.domElement.addEventListener('pointerleave',()=>{hoveredName=null;hoverCard.classList.remove('on')});
function updateHoverGlow(t){for(const [name,p] of Object.entries(deviceClouds)){if(!p?.visible)continue;const baseSize=controlled.has(name)?.034:.018,baseOpacity=controlled.has(name)?.96:.24;if(name===hoveredName){const pulse=.5+.5*Math.sin(t*7);p.material.size=baseSize*(1.35+.18*pulse);p.material.opacity=Math.min(1,baseOpacity+.28+.12*pulse);}else{p.material.size+=(baseSize-p.material.size)*.14;p.material.opacity+=(baseOpacity-p.material.opacity)*.14;}}}
"""
s=s[:start]+block+s[end:]

s=s.replace("function revealObject(name){if(name==='ROOM'){known.add(name);if(roomCloud)roomCloud.visible=true;return;}known.add(name);const p=deviceClouds[name];", "function revealObject(name){const first=!known.has(name);if(name==='ROOM'){known.add(name);if(roomCloud)roomCloud.visible=true;return;}known.add(name);if(first){showReveal(name);renderKnownList();}const p=deviceClouds[name];",1)

# Make sure control changes refresh the right inventory.
s=s.replace('p.material.opacity=.96;p.material.size=.034;renderControls();}', 'p.material.opacity=.96;p.material.size=.034;renderControls();}',1)

# Pulse hovered cloud every frame.
needle='updatePuzzle(dt);for(const c of animatedClouds)updateHumanCloud(c);'
if needle in s:
    s=s.replace(needle,'updatePuzzle(dt);updateHoverGlow(clock.elapsedTime);for(const c of animatedClouds)updateHumanCloud(c);',1)
else:
    needle='for(const c of animatedClouds)updateHumanCloud(c);'
    if needle not in s: raise SystemExit('animate hook not found')
    s=s.replace(needle,'updateHoverGlow(clock.elapsedTime);for(const c of animatedClouds)updateHumanCloud(c);',1)

p.write_text(s,encoding='utf-8')