import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/+esm';

const AS='./embocacosas-assets/';
const CACHE_BUST='?v='+Date.now();

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x878b86);

const camera=new THREE.PerspectiveCamera(56,innerWidth/innerHeight,.05,150);
camera.position.set(18.219,6.239,0.898);
const cameraTarget=new THREE.Vector3(-0.433,3.538,0.504);
camera.lookAt(cameraTarget);

const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.0;
document.body.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff,0x454b46,1.8));
const sun=new THREE.DirectionalLight(0xfff1d9,2.4);
sun.position.set(-4,7,5);
sun.castShadow=true;
sun.shadow.camera.near=.1;
sun.shadow.camera.far=80;
sun.shadow.camera.left=-20;
sun.shadow.camera.right=20;
sun.shadow.camera.top=20;
sun.shadow.camera.bottom=-20;
scene.add(sun);

const world=new CANNON.World({gravity:new CANNON.Vec3(0,-9.82,0)});
world.defaultContactMaterial.friction=.5;
world.defaultContactMaterial.restitution=.24;

const ground=new CANNON.Body({type:CANNON.Body.STATIC,shape:new CANNON.Plane()});
ground.quaternion.setFromEuler(-Math.PI/2,0,0);
world.addBody(ground);

// ---------- ESCENA / OBJETOS ESPECIALES ----------
let tacho=null,tachoBaseQuat=null,tachoAngle=0,tachoAV=0;
let floorObj=null,wallObj=null,electricalObj=null,extinguisherObj=null;
let floorBox=null,wallBox=null,electricalBox=null,extinguisherBox=null;
let backWallBody=null,electricalBody=null;
let extinguisherFalling=false,extinguisherExploded=false;
let extVel=new THREE.Vector3(), extAV=new THREE.Vector3();

function findByRegex(root,re){
  const hits=[];
  root.traverse(o=>{if(o.name && re.test(o.name)) hits.push(o);});
  return hits.find(o=>o.isMesh||o.children.length)||hits[0]||null;
}

function findElectricalObject(root){
  const byName=findByRegex(root,/electr|tablero|panel|caja|box|gabinete|cabinet|switch|breaker|control/i);
  if(byName)return byName;

  // Fallback: busca un mesh azul/celeste compacto. Así no dependemos del nombre de Blender.
  const candidates=[];
  root.traverse(o=>{
    if(!o.isMesh)return;
    const mats=Array.isArray(o.material)?o.material:[o.material];
    let blueScore=0;
    for(const m of mats){
      const c=m?.color;
      if(c && c.b>c.r*1.12 && c.b>c.g*1.02) blueScore=Math.max(blueScore,c.b-c.r);
    }
    if(blueScore<=0)return;
    const b=boxOf(o);
    const size=new THREE.Vector3();
    b.getSize(size);
    const volume=size.x*size.y*size.z;
    if(volume>.0005 && Math.max(size.x,size.y,size.z)<4) candidates.push({o,score:blueScore+Math.min(volume,.5)});
  });
  candidates.sort((a,b)=>b.score-a.score);
  return candidates[0]?.o||null;
}

function boxOf(o){
  if(!o)return null;
  o.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(o);
}

const loader=new GLTFLoader();
loader.load(AS+'escena.glb'+CACHE_BUST,g=>{
  scene.add(g.scene);
  g.scene.traverse(o=>{
    if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}
  });

  tacho=findByRegex(g.scene,/tacho|tambor|bin|drum/i);
  if(tacho) tachoBaseQuat=tacho.quaternion.clone();

  floorObj=findByRegex(g.scene,/piso|floor|suelo|ground/i);
  wallObj=findByRegex(g.scene,/pared|wall|muro/i);
  electricalObj=findElectricalObject(g.scene);
  extinguisherObj=findByRegex(g.scene,/mataf|exting|extintor|fire.?ext/i);

  floorBox=boxOf(floorObj);
  wallBox=boxOf(wallObj);
  electricalBox=boxOf(electricalObj);
  extinguisherBox=boxOf(extinguisherObj);

  // Collider invisible robusto para la pared de atrás.
  // Usamos una caja física muy fina ocupando el AABB real de la pared,
  // así las normales del mesh de Blender dejan de importar.
  if(wallBox){
    const ws=new THREE.Vector3(),wc=new THREE.Vector3();
    wallBox.getSize(ws);wallBox.getCenter(wc);
    const half=new CANNON.Vec3(
      Math.max(.06,ws.x*.5),
      Math.max(.06,ws.y*.5),
      Math.max(.06,ws.z*.5)
    );
    backWallBody=new CANNON.Body({
      type:CANNON.Body.STATIC,
      shape:new CANNON.Box(half),
      position:new CANNON.Vec3(wc.x,wc.y,wc.z)
    });
    world.addBody(backWallBody);
  }

  // Collider físico real para la caja eléctrica.
  if(electricalBox){
    const es=new THREE.Vector3(),ec=new THREE.Vector3();
    electricalBox.getSize(es);electricalBox.getCenter(ec);
    electricalBody=new CANNON.Body({
      type:CANNON.Body.STATIC,
      shape:new CANNON.Box(new CANNON.Vec3(
        Math.max(.035,es.x*.5),
        Math.max(.035,es.y*.5),
        Math.max(.035,es.z*.5)
      )),
      position:new CANNON.Vec3(ec.x,ec.y,ec.z)
    });
    world.addBody(electricalBody);
  }
});

// ---------------- FLECHA ----------------
const arrowRoot=new THREE.Group();
scene.add(arrowRoot);

const arrowMat=new THREE.MeshStandardMaterial({
  color:0xffd02d,
  emissive:0x3c2400,
  roughness:.5,
  metalness:.05
});

const arrowCfg={
  rotX:14,
  rotY:0,
  rotZ:0,
  posX:0,
  posY:.200,
  posZ:-.920,
  sweep:24,
  curve:.200,
  baseLen:.200
};

let arrowTube=null;
let arrowTip=null;
let aimPhase=0,charging=false,charge=0,lastArrowCharge=-1;

// La base visual de la flecha será el próximo objeto a lanzar.
let previewObject=null;

function readArrowEditor(){
  const q=id=>document.getElementById(id);
  if(!q('arx')) return;
  arrowCfg.rotX=+q('arx').value||0;
  arrowCfg.rotY=+q('ary').value||0;
  arrowCfg.rotZ=+q('arz').value||0;
  arrowCfg.posX=+q('apx').value||0;
  arrowCfg.posY=+q('apy').value||0;
  arrowCfg.posZ=+q('apz').value||0;
  arrowCfg.sweep=Math.max(0,+q('asweep').value||0);
  arrowCfg.curve=Math.max(0,+q('acurve').value||0);
  arrowCfg.baseLen=Math.max(.10,+q('alen').value||.20);
}

function writeArrowOutput(){
  const out=document.getElementById('arrowOut');
  if(!out) return;
  out.textContent=
`arrow.rot.set(${arrowCfg.rotX.toFixed(1)}, ${arrowCfg.rotY.toFixed(1)}, ${arrowCfg.rotZ.toFixed(1)});
arrow.pos.set(${arrowCfg.posX.toFixed(3)}, ${arrowCfg.posY.toFixed(3)}, ${arrowCfg.posZ.toFixed(3)});
arrow.sweep=${arrowCfg.sweep.toFixed(1)};
arrow.curve=${arrowCfg.curve.toFixed(3)};
arrow.baseLen=${arrowCfg.baseLen.toFixed(3)};`;
}

function rebuildArrow(chargeNow){
  readArrowEditor();
  const len=arrowCfg.baseLen+chargeNow*.70;
  const curveLift=arrowCfg.curve+chargeNow*.12;

  if(arrowTube){arrowRoot.remove(arrowTube);arrowTube.geometry.dispose();}
  if(arrowTip){arrowRoot.remove(arrowTip);arrowTip.geometry.dispose();}

  const curve=new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0,0,0),
    new THREE.Vector3(0,curveLift,-len*.48),
    new THREE.Vector3(0,0,-len)
  );

  arrowTube=new THREE.Mesh(
    new THREE.TubeGeometry(curve,18,.016,8,false),
    arrowMat
  );
  arrowRoot.add(arrowTube);

  arrowTip=new THREE.Mesh(
    new THREE.ConeGeometry(.040,.105,14),
    arrowMat
  );
  const end=curve.getPoint(1);
  const tangent=curve.getTangent(1).normalize();
  arrowTip.position.copy(end);
  arrowTip.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),tangent);
  arrowRoot.add(arrowTip);
}
rebuildArrow(0);

function getAimQuaternion(){
  readArrowEditor();
  const yaw=Math.sin(aimPhase)*THREE.MathUtils.degToRad(arrowCfg.sweep);
  const qLocal=new THREE.Quaternion().setFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(arrowCfg.rotX),
    THREE.MathUtils.degToRad(arrowCfg.rotY),
    THREE.MathUtils.degToRad(arrowCfg.rotZ),
    'XYZ'
  ));
  const qSweep=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw);
  return camera.quaternion.clone().multiply(qLocal).multiply(qSweep);
}

function placeArrow(){
  readArrowEditor();
  const localOffset=new THREE.Vector3(
    arrowCfg.posX,arrowCfg.posY,arrowCfg.posZ
  ).applyQuaternion(camera.quaternion);
  arrowRoot.position.copy(camera.position).add(localOffset);
  arrowRoot.quaternion.copy(getAimQuaternion());
}
placeArrow();

const arrowEditor=document.getElementById('arrowEditor');
const arrowEditorToggle=document.getElementById('arrowEditorToggle');
if(arrowEditorToggle){
  arrowEditorToggle.onclick=()=>{
    arrowEditor.classList.toggle('show');
    writeArrowOutput();
  };
}
for(const id of ['arx','ary','arz','apx','apy','apz','asweep','acurve','alen']){
  const el=document.getElementById(id);
  if(el)el.addEventListener('input',()=>{
    readArrowEditor();rebuildArrow(charge);placeArrow();writeArrowOutput();
  });
}
const copyArrow=document.getElementById('copyArrow');
if(copyArrow){
  copyArrow.onclick=async()=>{
    readArrowEditor();writeArrowOutput();
    try{
      await navigator.clipboard.writeText(document.getElementById('arrowOut').textContent);
      copyArrow.textContent='Copiado ✓';
      setTimeout(()=>copyArrow.textContent='Copiar configuración',1200);
    }catch{}
  };
}
writeArrowOutput();

// ---------------- PARTÍCULAS ----------------
const particles=[];
function burstParticles(pos,count,color,speedMin,speedMax,gravity=-4,lifeMin=.5,lifeMax=1.5,size=.035){
  for(let i=0;i<count;i++){
    const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:1});
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(size,6,5),mat);
    mesh.position.copy(pos);
    scene.add(mesh);
    const v=new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(2),
      Math.random()*1.4+.15,
      THREE.MathUtils.randFloatSpread(2)
    ).normalize().multiplyScalar(THREE.MathUtils.randFloat(speedMin,speedMax));
    particles.push({mesh,v,gravity,life:THREE.MathUtils.randFloat(lifeMin,lifeMax),maxLife:lifeMax});
  }
}
function extinguisherBurst(pos){burstParticles(pos,95,0xffffff,1.0,4.0,-1.0,.8,2.1,.045);}
function electricBurst(pos){burstParticles(pos,24,0xbfefff,1.3,4.8,-2.0,.18,.55,.025);burstParticles(pos,10,0xffffff,1.8,5.5,-2.0,.12,.35,.018);}
function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];p.life-=dt;p.v.y+=p.gravity*dt;p.mesh.position.addScaledVector(p.v,dt);p.mesh.material.opacity=Math.max(0,p.life/p.maxLife);
    if(p.life<=0){scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();particles.splice(i,1);}
  }
}

// ---------------- PROYECTILES ----------------
const projectiles=[];
let attempts=0,hits=0,nextType=0;
const TYPES=[
  {name:'ESFERA',mass:1.0,color:0x4aa5ff},
  {name:'CUBO',mass:1.6,color:0xff7043},
  {name:'DONA',mass:1.25,color:0xf3c64f}
];

const MATERIALS=[
  {name:'TELGOPOR',density:.28,metalness:0,roughness:.78},
  {name:'PLÁSTICO',density:.55,metalness:0,roughness:.48},
  {name:'MADERA',density:.82,metalness:0,roughness:.72},
  {name:'ALUMINIO',density:1.25,metalness:.72,roughness:.28},
  {name:'ACERO',density:1.90,metalness:.88,roughness:.22},
  {name:'PLOMO',density:2.65,metalness:.55,roughness:.42}
];

const scoreEl=document.getElementById('score');
function score(){scoreEl.textContent=hits+' / '+attempts;}

function randomSpec(typeIndex){
  const scale=THREE.MathUtils.lerp(.42,1.90,Math.random());
  const material=MATERIALS[Math.floor(Math.random()*MATERIALS.length)];

  // El peso ya no es un random abstracto: sale del material elegido y del volumen.
  const density=material.density;
  const mass=TYPES[typeIndex].mass*Math.pow(scale,3)*density;

  return {typeIndex,scale,density,mass,material};
}

let nextSpec=randomSpec(nextType);

function makeVisual(spec,preview=false){
  const {typeIndex,scale}=spec;
  let geom,radius;

  if(typeIndex===0){
    radius=.16*scale;
    geom=new THREE.SphereGeometry(radius,24,16);
  }else if(typeIndex===1){
    const sz=.27*scale;
    radius=sz*.87;
    geom=new THREE.BoxGeometry(sz,sz,sz);
  }else{
    const major=.18*scale,tube=.065*scale;
    radius=(major+tube)*.82;
    geom=new THREE.TorusGeometry(major,tube,12,28);
    geom.rotateX(Math.PI/2);
  }

  const mesh=new THREE.Mesh(
    geom,
    new THREE.MeshStandardMaterial({
      color:TYPES[typeIndex].color,
      roughness:spec.material?.roughness??.58,
      metalness:spec.material?.metalness??0,
      transparent:preview,
      opacity:preview?.92:1
    })
  );
  mesh.castShadow=!preview;
  return {mesh,radius};
}

function makeShape(spec){
  const {typeIndex,scale}=spec;
  if(typeIndex===0){
    return new CANNON.Sphere(.16*scale);
  }else if(typeIndex===1){
    const sz=.27*scale;
    return new CANNON.Box(new CANNON.Vec3(sz/2,sz/2,sz/2));
  }else{
    const major=.18*scale,tube=.065*scale;
    return new CANNON.Sphere((major+tube)*.82);
  }
}

function refreshPreview(){
  if(previewObject){
    arrowRoot.remove(previewObject);
    previewObject.geometry.dispose();
    previewObject.material.dispose();
  }
  const v=makeVisual(nextSpec,true);
  previewObject=v.mesh;

  // Preview informativo: representa forma/material, pero mide sólo 25% del objeto real.
  previewObject.scale.setScalar(.25);
  previewObject.position.set(0,0,.035);
  arrowRoot.add(previewObject);

  const info=document.getElementById('nextInfo');
  if(info){
    info.textContent=`PRÓXIMO: ${TYPES[nextSpec.typeIndex].name} · ${nextSpec.material.name}`;
  }
}
refreshPreview();

function spawnProjectile(spec,dir,speed){
  const {mesh,radius}=makeVisual(spec,false);
  const shape=makeShape(spec);

  const start=arrowRoot.position.clone().addScaledVector(dir,.38+radius);
  mesh.position.copy(start);
  scene.add(mesh);

  const body=new CANNON.Body({
    mass:spec.mass,
    shape,
    position:new CANNON.Vec3(start.x,start.y,start.z),
    linearDamping:.01,
    angularDamping:.025
  });

  body.velocity.set(dir.x*speed,dir.y*speed,dir.z*speed);
  body.angularVelocity.set(
    (Math.random()-.5)*7,(Math.random()-.5)*7,(Math.random()-.5)*7
  );
  world.addBody(body);

  projectiles.push({
    mesh,body,
    mass:spec.mass,
    radius,
    scale:spec.scale,
    density:spec.density,
    materialName:spec.material.name,
    scored:false,
    enteredThroughMouth:false,
    lockedIn:false,
    age:0,
    lastY:start.y,
    prevPos:start.clone(),
    electricalHit:false,
    extinguisherHit:false
  });
}

function currentAimDir(){
  placeArrow();
  arrowRoot.updateMatrixWorld(true);
  if(arrowTip){
    const tipWorld=new THREE.Vector3();
    arrowTip.getWorldPosition(tipWorld);
    return tipWorld.sub(camera.position).normalize();
  }
  return new THREE.Vector3(0,0,-1).applyQuaternion(arrowRoot.quaternion).normalize();
}

function fire(){
  const dir=currentAimDir();
  const speed=8.0+charge*15.5;

  spawnProjectile(nextSpec,dir,speed);
  attempts++;score();

  nextType=(nextType+1)%TYPES.length;
  nextSpec=randomSpec(nextType);
  refreshPreview();
  charge=0;
}

renderer.domElement.addEventListener('pointerdown',()=>{
  if(arrowEditor?.classList.contains('show'))return;
  charging=true;
});
renderer.domElement.addEventListener('pointerup',()=>{
  if(!charging)return;
  charging=false;fire();
});
renderer.domElement.addEventListener('pointercancel',()=>{
  charging=false;charge=0;
});

// ---------------- COLISIONES ESCENA ----------------
function expanded(box,r){
  return box.clone().expandByScalar(r);
}

function collideAABBProjectile(p,box,restitution=.48){
  if(!box)return false;
  const q=new THREE.Vector3(p.body.position.x,p.body.position.y,p.body.position.z);
  const ex=expanded(box,p.radius);
  if(!ex.containsPoint(q))return false;

  const d=[
    {v:Math.abs(q.x-ex.min.x),axis:'x',sign:-1},
    {v:Math.abs(ex.max.x-q.x),axis:'x',sign:1},
    {v:Math.abs(q.y-ex.min.y),axis:'y',sign:-1},
    {v:Math.abs(ex.max.y-q.y),axis:'y',sign:1},
    {v:Math.abs(q.z-ex.min.z),axis:'z',sign:-1},
    {v:Math.abs(ex.max.z-q.z),axis:'z',sign:1}
  ].sort((a,b)=>a.v-b.v)[0];

  if(d.axis==='x'){
    p.body.position.x=d.sign<0?ex.min.x:ex.max.x;
    p.body.velocity.x*=-restitution;
  }else if(d.axis==='y'){
    p.body.position.y=d.sign<0?ex.min.y:ex.max.y;
    p.body.velocity.y*=-restitution;
  }else{
    p.body.position.z=d.sign<0?ex.min.z:ex.max.z;
    p.body.velocity.z*=-restitution;
  }
  return true;
}

// ---------------- TACHO ----------------
function tachoInfo(){
  if(!tacho)return null;
  const b=boxOf(tacho);
  const s=new THREE.Vector3(),c=new THREE.Vector3();
  b.getSize(s);b.getCenter(c);
  const outerR=Math.max(.12,Math.min(s.x,s.z)*.48);
  const mouthR=Math.max(.10,outerR*.72);
  return {box:b,size:s,center:c,topY:b.max.y,bottomY:b.min.y,outerR,mouthR};
}

function updateTacho(dt){
  if(!tacho||!tachoBaseQuat)return;
  tachoAV+=(-7*tachoAngle-2.8*tachoAV)*dt;
  tachoAngle+=tachoAV*dt;
  tachoAngle=Math.max(-.65,Math.min(.65,tachoAngle));
  const dq=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),tachoAngle);
  tacho.quaternion.copy(tachoBaseQuat).multiply(dq);
}

function collideOuterBinWall(p,info){
  if(p.enteredThroughMouth)return;

  const q=p.body.position;
  const dx=q.x-info.center.x,dz=q.z-info.center.z;
  const dist=Math.hypot(dx,dz);
  if(dist<1e-5)return;

  const contactR=info.outerR+p.radius;
  const inWallHeight=q.y<info.topY-p.radius*.18 && q.y>info.bottomY+p.radius*.20;

  if(inWallHeight && dist<contactR){
    const nx=dx/dist,nz=dz/dist;
    q.x=info.center.x+nx*contactR;
    q.z=info.center.z+nz*contactR;

    const vn=p.body.velocity.x*nx+p.body.velocity.z*nz;
    if(vn<0){
      p.body.velocity.x-=(1+.58)*vn*nx;
      p.body.velocity.z-=(1+.58)*vn*nz;
    }

    const speed=Math.hypot(p.body.velocity.x,p.body.velocity.y,p.body.velocity.z);
    const impulse=p.mass*speed;
    if(impulse>2.2){
      const side=Math.sign(q.x-info.center.x)||1;
      tachoAV+=side*Math.min(.9,(impulse-2.2)*.02);
    }
  }
}

function detectTrueMouthEntry(p,info){
  if(p.enteredThroughMouth)return;
  const q=p.body.position;
  const dx=q.x-info.center.x,dz=q.z-info.center.z;
  const safeMouth=Math.max(.03,info.mouthR-p.radius*.55);

  const crossedDown=
    p.lastY>info.topY+p.radius*.18 &&
    q.y<=info.topY+p.radius*.18 &&
    p.body.velocity.y<0;

  if(crossedDown && Math.hypot(dx,dz)<safeMouth){
    p.enteredThroughMouth=true;
    p.scored=true;
    hits++;score();
  }
}

function reinforceInsideBin(p,info){
  if(!p.enteredThroughMouth)return;

  const q=p.body.position;
  const dx=q.x-info.center.x,dz=q.z-info.center.z;
  const dist=Math.hypot(dx,dz);
  const innerR=Math.max(.06,info.mouthR-p.radius*.72);

  if(!p.lockedIn && q.y<info.topY-p.radius*.65)p.lockedIn=true;
  if(!p.lockedIn)return;

  if(dist>innerR && dist>1e-5){
    const nx=dx/dist,nz=dz/dist;
    q.x=info.center.x+nx*innerR;
    q.z=info.center.z+nz*innerR;
    const outward=p.body.velocity.x*nx+p.body.velocity.z*nz;
    if(outward>0){
      p.body.velocity.x-=(1+.48)*outward*nx;
      p.body.velocity.z-=(1+.48)*outward*nz;
    }
  }

  const floorY=info.bottomY+p.radius*.9;
  if(q.y<floorY){
    q.y=floorY;
    if(p.body.velocity.y<0)p.body.velocity.y=Math.abs(p.body.velocity.y)*.12;
    p.body.velocity.x*=.84;
    p.body.velocity.z*=.84;
  }
}

// ---------------- MATAFUEGOS / CAJA ELÉCTRICA ----------------
function hitSpecials(p){
  const q=new THREE.Vector3(p.body.position.x,p.body.position.y,p.body.position.z);

  if(electricalBox && (p.electricalCooldown||0)<=0){
    // Caja sólida + chispazo en el contacto.
    if(expanded(electricalBox,p.radius).containsPoint(q)){
      p.electricalHit=true;
      p.electricalCooldown=.14;
      const c=new THREE.Vector3();
      electricalBox.getCenter(c);
      electricBurst(q.clone().lerp(c,.20));
      collideAABBProjectile(p,electricalBox,.62);
    }
  }

  if(extinguisherObj && !p.extinguisherHit && !extinguisherFalling){
    extinguisherBox=boxOf(extinguisherObj);
    if(expanded(extinguisherBox,p.radius).containsPoint(q)){
      p.extinguisherHit=true;
      extinguisherFalling=true;
      extVel.set(p.body.velocity.x,p.body.velocity.y,p.body.velocity.z).multiplyScalar(.18);
      extVel.y+=.4;
      extAV.set(
        THREE.MathUtils.randFloat(-4,4),
        THREE.MathUtils.randFloat(-2,2),
        THREE.MathUtils.randFloat(-4,4)
      );
      p.body.velocity.multiplyScalar(.45);
    }
  }
}

function updateExtinguisher(dt){
  if(!extinguisherObj||!extinguisherFalling||extinguisherExploded)return;

  extVel.y-=9.82*dt;
  extinguisherObj.position.addScaledVector(extVel,dt);
  extinguisherObj.rotation.x+=extAV.x*dt;
  extinguisherObj.rotation.y+=extAV.y*dt;
  extinguisherObj.rotation.z+=extAV.z*dt;

  extinguisherBox=boxOf(extinguisherObj);

  // El matafuegos también choca contra el collider invisible de la pared.
  if(wallBox && extinguisherBox.intersectsBox(wallBox)){
    const ec=new THREE.Vector3(),wc=new THREE.Vector3();
    extinguisherBox.getCenter(ec);wallBox.getCenter(wc);
    const ws=new THREE.Vector3();wallBox.getSize(ws);

    // Resolvemos sobre el eje más fino de la pared, que es su normal física.
    let axis='x';
    if(ws.y<ws.x && ws.y<ws.z)axis='y';
    else if(ws.z<ws.x && ws.z<ws.y)axis='z';

    const eSize=new THREE.Vector3();extinguisherBox.getSize(eSize);
    const sign=(ec[axis]-wc[axis])>=0?1:-1;
    const target=wc[axis]+sign*(ws[axis]*.5+eSize[axis]*.5+.01);
    extinguisherObj.position[axis]+=target-ec[axis];
    extVel[axis]*=-.42;
    extAV.multiplyScalar(.86);
    extinguisherBox=boxOf(extinguisherObj);
  }

  let floorY=0;
  if(floorBox)floorY=floorBox.max.y;

  if(extinguisherBox.min.y<=floorY){
    extinguisherObj.position.y+=floorY-extinguisherBox.min.y;
    extinguisherExploded=true;
    const p=new THREE.Vector3();
    extinguisherBox.getCenter(p);
    p.y=floorY+.08;
    extinguisherBurst(p);
  }
}

// ---------------- LOOP ----------------
function updateProjectiles(dt){
  const info=tachoInfo();

  for(let i=projectiles.length-1;i>=0;i--){
    const p=projectiles[i];
    p.age+=dt;
    p.electricalCooldown=Math.max(0,(p.electricalCooldown||0)-dt);

    // Piso del GLB con rebote explícito. La pared de atrás usa ahora
    // un collider físico invisible independiente de las normales del mesh.
    if(floorBox)collideAABBProjectile(p,floorBox,.34);

    hitSpecials(p);

    if(info){
      detectTrueMouthEntry(p,info);
      if(p.enteredThroughMouth)reinforceInsideBin(p,info);
      else collideOuterBinWall(p,info);
      p.lastY=p.body.position.y;
    }

    p.mesh.position.set(p.body.position.x,p.body.position.y,p.body.position.z);
    p.mesh.quaternion.set(
      p.body.quaternion.x,p.body.quaternion.y,p.body.quaternion.z,p.body.quaternion.w
    );

    p.prevPos.copy(p.mesh.position);

    if(p.age>18||p.body.position.y<-6){
      world.removeBody(p.body);
      scene.remove(p.mesh);
      projectiles.splice(i,1);
    }
  }
}

const clock=new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);

  const dt=Math.min(.025,clock.getDelta());
  world.step(1/120,dt,8);

  camera.position.set(18.219,6.239,0.898);
  cameraTarget.set(-0.433,3.538,0.504);
  camera.fov=56;
  camera.updateProjectionMatrix();
  camera.lookAt(cameraTarget);

  placeArrow();

  if(!charging)aimPhase+=dt*1.7;
  else charge=Math.min(1,charge+dt/1.45);

  if(Math.abs(charge-lastArrowCharge)>.01){
    rebuildArrow(charge);
    lastArrowCharge=charge;
  }

  updateTacho(dt);
  updateExtinguisher(dt);
  updateProjectiles(dt);
  updateParticles(dt);

  renderer.render(scene,camera);
}
animate();

addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});