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
world.defaultContactMaterial.restitution=.18;

const ground=new CANNON.Body({type:CANNON.Body.STATIC,shape:new CANNON.Plane()});
ground.quaternion.setFromEuler(-Math.PI/2,0,0);
world.addBody(ground);

let tacho=null,tachoBaseQuat=null,tachoAngle=0,tachoAV=0;
const loader=new GLTFLoader();
loader.load(AS+'escena.glb'+CACHE_BUST,g=>{
  scene.add(g.scene);
  g.scene.traverse(o=>{
    if(o.isMesh){
      o.castShadow=true;
      o.receiveShadow=true;
    }
  });
  const candidates=[];
  g.scene.traverse(o=>{
    if(/tacho|tambor|bin|drum/i.test(o.name)) candidates.push(o);
  });
  tacho=candidates.find(o=>o.isMesh||o.children.length)||candidates[0]||null;
  if(tacho) tachoBaseQuat=tacho.quaternion.clone();
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
  rotX:0,
  rotY:0,
  rotZ:0,
  posX:0,
  posY:-.10,
  posZ:-.85,
  sweep:24,
  curve:.08,
  baseLen:.42
};

let arrowTube=null;
let arrowTip=null;
let aimPhase=0,charging=false,charge=0,lastArrowCharge=-1;

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
  arrowCfg.baseLen=Math.max(.12,+q('alen').value||.42);
}

function writeArrowOutput(){
  const out=document.getElementById('arrowOut');
  if(!out) return;
  out.textContent=`arrow.rot.set(${arrowCfg.rotX.toFixed(1)}, ${arrowCfg.rotY.toFixed(1)}, ${arrowCfg.rotZ.toFixed(1)});\narrow.pos.set(${arrowCfg.posX.toFixed(3)}, ${arrowCfg.posY.toFixed(3)}, ${arrowCfg.posZ.toFixed(3)});\narrow.sweep=${arrowCfg.sweep.toFixed(1)};\narrow.curve=${arrowCfg.curve.toFixed(3)};\narrow.baseLen=${arrowCfg.baseLen.toFixed(3)};`;
}

function rebuildArrow(chargeNow){
  readArrowEditor();
  const len=arrowCfg.baseLen + chargeNow*.72;
  const curveLift=arrowCfg.curve + chargeNow*.10;

  if(arrowTube){
    arrowRoot.remove(arrowTube);
    arrowTube.geometry.dispose();
  }
  if(arrowTip){
    arrowRoot.remove(arrowTip);
    arrowTip.geometry.dispose();
  }

  const curve=new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0,0,0),
    new THREE.Vector3(0,curveLift,-len*.48),
    new THREE.Vector3(0,0,-len)
  );

  arrowTube=new THREE.Mesh(
    new THREE.TubeGeometry(curve,18,.018,8,false),
    arrowMat
  );
  arrowRoot.add(arrowTube);

  arrowTip=new THREE.Mesh(
    new THREE.ConeGeometry(.045,.12,14),
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
  const localOffset=new THREE.Vector3(arrowCfg.posX,arrowCfg.posY,arrowCfg.posZ).applyQuaternion(camera.quaternion);
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
  if(el){
    el.addEventListener('input',()=>{
      readArrowEditor();
      rebuildArrow(charge);
      placeArrow();
      writeArrowOutput();
    });
  }
}
const copyArrow=document.getElementById('copyArrow');
if(copyArrow){
  copyArrow.onclick=async()=>{
    readArrowEditor();
    writeArrowOutput();
    try{
      await navigator.clipboard.writeText(document.getElementById('arrowOut').textContent);
      copyArrow.textContent='Copiado ✓';
      setTimeout(()=>copyArrow.textContent='Copiar configuración',1200);
    }catch{}
  };
}
writeArrowOutput();

// ---------------- PROYECTILES ----------------
const projectiles=[];
let attempts=0,hits=0,nextType=0;

const TYPES=[
  {name:'ESFERA',mass:1.0},
  {name:'CUBO',mass:1.6},
  {name:'DONA',mass:1.25}
];

const scoreEl=document.getElementById('score');
function score(){
  scoreEl.textContent=hits+' / '+attempts;
}

function spawnProjectile(typeIndex,dir,speed){
  // Tamaño aleatorio: bastante visible, pero sin llegar a cosas absurdas.
  const scale=THREE.MathUtils.lerp(.65,1.45,Math.random());
  const base=TYPES[typeIndex];
  const mass=base.mass*Math.pow(scale,3);

  let geom,shape,radius;

  if(typeIndex===0){
    radius=.16*scale;
    geom=new THREE.SphereGeometry(radius,24,16);
    shape=new CANNON.Sphere(radius);
  }else if(typeIndex===1){
    const s=.27*scale;
    radius=s*.87;
    geom=new THREE.BoxGeometry(s,s,s);
    shape=new CANNON.Box(new CANNON.Vec3(s/2,s/2,s/2));
  }else{
    const major=.18*scale;
    const tube=.065*scale;
    radius=(major+tube)*.82;
    geom=new THREE.TorusGeometry(major,tube,12,28);
    geom.rotateX(Math.PI/2);
    // Aproximación física redonda, estable para el juego.
    shape=new CANNON.Sphere(radius);
  }

  const mat=new THREE.MeshStandardMaterial({
    color:typeIndex===0?0x4aa5ff:typeIndex===1?0xff7043:0xf3c64f,
    roughness:.58
  });

  const mesh=new THREE.Mesh(geom,mat);
  mesh.castShadow=true;

  const start=arrowRoot.position.clone().addScaledVector(dir,.40+radius);
  mesh.position.copy(start);
  scene.add(mesh);

  const body=new CANNON.Body({
    mass,
    shape,
    position:new CANNON.Vec3(start.x,start.y,start.z),
    linearDamping:.015,
    angularDamping:.03
  });

  body.velocity.set(dir.x*speed,dir.y*speed+1.0,dir.z*speed);
  body.angularVelocity.set(
    (Math.random()-.5)*7,
    (Math.random()-.5)*7,
    (Math.random()-.5)*7
  );

  world.addBody(body);
  projectiles.push({
    mesh,body,mass,radius,scale,
    scored:false,
    lockedIn:false,
    age:0,
    lastY:start.y,
    hitTacho:false
  });
}

function currentAimDir(){
  return new THREE.Vector3(0,0,-1).applyQuaternion(getAimQuaternion()).normalize();
}

function fire(){
  const dir=currentAimDir();
  const speed=7.5+charge*10.5;
  spawnProjectile(nextType,dir,speed);
  attempts++;
  score();
  nextType=(nextType+1)%TYPES.length;
  charge=0;
}

renderer.domElement.addEventListener('pointerdown',()=>{
  if(arrowEditor?.classList.contains('show')) return;
  charging=true;
});

renderer.domElement.addEventListener('pointerup',()=>{
  if(!charging) return;
  charging=false;
  fire();
});

renderer.domElement.addEventListener('pointercancel',()=>{
  charging=false;
  charge=0;
});

// ---------------- TACHO ----------------
function tachoInfo(){
  if(!tacho) return null;

  const b=new THREE.Box3().setFromObject(tacho);
  const s=new THREE.Vector3();
  const c=new THREE.Vector3();
  b.getSize(s);
  b.getCenter(c);

  return {
    box:b,
    size:s,
    center:c,
    topY:b.max.y,
    bottomY:b.min.y,
    mouthR:Math.max(.12,Math.min(s.x,s.z)*.34)
  };
}

function updateTacho(dt){
  if(!tacho||!tachoBaseQuat) return;

  tachoAV+=(-7*tachoAngle-2.8*tachoAV)*dt;
  tachoAngle+=tachoAV*dt;
  tachoAngle=Math.max(-.65,Math.min(.65,tachoAngle));

  const dq=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),tachoAngle);
  tacho.quaternion.copy(tachoBaseQuat).multiply(dq);
}

function reinforceInsideBin(p,info){
  if(!p.scored) return;

  const q=p.body.position;
  const maxR=Math.max(.08,info.mouthR-p.radius*.72);
  const dx=q.x-info.center.x;
  const dz=q.z-info.center.z;
  const dist=Math.hypot(dx,dz);

  // Una vez que descendió lo suficiente, queda bajo el borde físico del tacho.
  if(!p.lockedIn && q.y < info.topY-p.radius*.7){
    p.lockedIn=true;
  }

  if(!p.lockedIn) return;

  // Pared interior reforzada: corrige penetración y rebota hacia adentro.
  if(dist>maxR && dist>0.0001){
    const nx=dx/dist;
    const nz=dz/dist;
    q.x=info.center.x+nx*maxR;
    q.z=info.center.z+nz*maxR;

    const outward=p.body.velocity.x*nx+p.body.velocity.z*nz;
    if(outward>0){
      p.body.velocity.x-=nx*outward*1.35;
      p.body.velocity.z-=nz*outward*1.35;
    }
    p.body.velocity.x*=.72;
    p.body.velocity.z*=.72;
  }

  // Fondo del tacho: mucho menos saltarín que el piso general.
  const floorY=info.bottomY+p.radius*.92;
  if(q.y<floorY){
    q.y=floorY;
    if(p.body.velocity.y<0) p.body.velocity.y=Math.abs(p.body.velocity.y)*.12;
    p.body.velocity.x*=.82;
    p.body.velocity.z*=.82;
  }

  // Evita que un rebote fuerte vuelva a expulsarlo por la boca.
  const lipY=info.topY-p.radius*.5;
  if(q.y>lipY && p.body.velocity.y>0){
    q.y=lipY;
    p.body.velocity.y*=-.12;
  }
}

function updateProjectiles(dt){
  const info=tachoInfo();

  for(let i=projectiles.length-1;i>=0;i--){
    const p=projectiles[i];
    p.age+=dt;

    if(info){
      const q=new THREE.Vector3(p.body.position.x,p.body.position.y,p.body.position.z);
      const dx=q.x-info.center.x;
      const dz=q.z-info.center.z;

      if(
        !p.scored &&
        p.lastY>info.topY+.03 &&
        q.y<=info.topY+.03 &&
        p.body.velocity.y<0 &&
        Math.hypot(dx,dz)<Math.max(.05,info.mouthR-p.radius*.35)
      ){
        p.scored=true;
        hits++;
        score();
      }

      if(!p.hitTacho){
        const b=info.box;
        const pad=.08+p.radius*.35;

        if(
          q.x>b.min.x-pad && q.x<b.max.x+pad &&
          q.y>b.min.y-pad && q.y<b.max.y+pad &&
          q.z>b.min.z-pad && q.z<b.max.z+pad
        ){
          const v=p.body.velocity;
          const speed=Math.hypot(v.x,v.y,v.z);
          const impulse=p.mass*speed;

          if(impulse>2.2){
            const side=Math.sign(q.x-info.center.x)||1;
            tachoAV+=side*Math.min(.9,(impulse-2.2)*.022);
          }

          p.hitTacho=true;
        }
      }

      reinforceInsideBin(p,info);
      p.lastY=p.body.position.y;
    }

    p.mesh.position.set(p.body.position.x,p.body.position.y,p.body.position.z);
    p.mesh.quaternion.set(
      p.body.quaternion.x,
      p.body.quaternion.y,
      p.body.quaternion.z,
      p.body.quaternion.w
    );

    if(p.age>18||p.body.position.y<-3){
      world.removeBody(p.body);
      scene.remove(p.mesh);
      projectiles.splice(i,1);
    }
  }
}

const clock=new THREE.Clock();

function animate(){
  requestAnimationFrame(animate);

  const dt=Math.min(.033,clock.getDelta());
  // Más substeps para reducir tunneling en objetos chicos/rápidos.
  world.step(1/120,dt,6);

  camera.position.set(18.219,6.239,0.898);
  cameraTarget.set(-0.433,3.538,0.504);
  camera.fov=56;
  camera.updateProjectionMatrix();
  camera.lookAt(cameraTarget);

  if(!charging){
    aimPhase+=dt*1.7;
  }else{
    charge=Math.min(1,charge+dt/1.45);
  }

  if(Math.abs(charge-lastArrowCharge)>.01){
    rebuildArrow(charge);
    lastArrowCharge=charge;
  }

  placeArrow();
  updateTacho(dt);
  updateProjectiles(dt);
  renderer.render(scene,camera);
}

animate();

addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});