from pathlib import Path
import re
p=Path('a-ware/index.html')
s=p.read_text(encoding='utf-8')
s=s.replace('A-WARE v0.23 · WAYPOINT ROUTINE','A-WARE v0.24 · EMERGENT CONTROL')
s=s.replace("walk:'Y Bot@Standard Walk.fbx'","walk:'Y Bot@Walking.fbx'")
route_pat=r"let routeStarted=false,routeIndex=0,routeMode='wait'.*?function updateRoute\(dt\)\{.*?\}"
route_new="""let routeStarted=false,routeCursor=0,routeIndex=0,routeMode='wait',routeTimer=0,routeNext=0,routeElapsed=0,routeDuration=1;const routeFrom=new THREE.Vector3(),routeTo=new THREE.Vector3(),routeAnim={typing:'typing',idle:'idle',sitting:'sit',phone:'phone',stairs:'stairs',sleep:'sleep',interact:'interact',walk:'walk'};const routePlan=[0,1,2,6,7,8,9,3,5,4,10,11];
function arriveRoute(i){const w=houseLayout.waypoints[i];humanRoot.position.fromArray(w.position);humanRoot.rotation.set(...w.rotation);currentHumanMode=w.animation;if(w.kind==='transit')playHuman('walk');else playHuman(routeAnim[w.animation]||'idle');activity.textContent='ACTIVIDAD: '+w.name.replaceAll('_',' ');routeIndex=i;routeMode='wait';routeTimer=w.kind==='transit'?.12:(w.animation==='sleep'?12:4.5);}
function beginRouteMove(){routeCursor=(routeCursor+1)%routePlan.length;routeNext=routePlan[routeCursor];const w=houseLayout.waypoints[routeNext];routeFrom.copy(humanRoot.position);routeTo.fromArray(w.position);routeDuration=Math.max(1.0,routeFrom.distanceTo(routeTo)/1.45);routeElapsed=0;routeMode='move';currentHumanMode='walk';const dx=routeTo.x-routeFrom.x,dz=routeTo.z-routeFrom.z;if(Math.hypot(dx,dz)>.01)humanRoot.rotation.set(0,Math.atan2(dx,dz),0);playHuman('walk');activity.textContent='ACTIVIDAD: caminando';}
function updateRoute(dt){if(!humanRoot||!humanClips.walk||!houseLayout.waypoints.length)return;if(!routeStarted){routeStarted=true;routeCursor=0;arriveRoute(routePlan[0]);return;}if(routeMode==='wait'){routeTimer-=dt;if(routeTimer<=0)beginRouteMove();return;}routeElapsed+=dt;const q=Math.min(1,routeElapsed/routeDuration),e=q*q*(3-2*q);humanRoot.position.lerpVectors(routeFrom,routeTo,e);if(q>=1)arriveRoute(routeNext);}"""
s,n=re.subn(route_pat,route_new,s,count=1,flags=re.S)
if n!=1: raise SystemExit('route patch failed')
s=s.replace("const palette={human:0x9bfaff,computer:0x45a6ff,network:0xc85cff,phone:0x55ffab,structure:0xffb65c,unknown:0x62717a,room:0x2a7784};","const palette={human:0x9bfaff,computer:0x45a6ff,network:0xc85cff,phone:0x55ffab,structure:0xffb65c,unknown:0x62717a,room:0x2a7784};let currentHumanMode='typing';")
s=s.replace("else if(file==='doorway.glb'){box([.14,2.2,.18],[-.57,1.1,0]);box([.14,2.2,.18],[.57,1.1,0]);box([1.28,.14,.18],[0,2.13,0])}return q;}","else if(file==='doorway.glb'){box([.14,2.2,.18],[-.57,1.1,0]);box([.14,2.2,.18],[.57,1.1,0]);box([1.28,.14,.18],[0,2.13,0])}else if(file==='smoke_alarm.glb'){const m=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,.18,24),new THREE.MeshBasicMaterial());m.rotation.x=Math.PI/2;q.add(m)}return q;}")
s=s.replace("if(['cama.glb','mesadenoche.glb','doorway.glb'].includes(file))obj=proceduralObject(file);","if(['cama.glb','mesadenoche.glb','doorway.glb','smoke_alarm.glb'].includes(file))obj=proceduralObject(file);")
p.write_text(s,encoding='utf-8')