import {joinRoom} from 'https://esm.sh/trystero@0.25.3';
import {APP_ID} from './game-data.js';

const VERSION='0.2.1';
let retryTimer=null;

function armJoinHandshake(){
  clearInterval(retryTimer);
  const code=document.getElementById('roomCodeInput')?.value?.trim().toUpperCase().replace(/[^A-Z]/g,'').slice(0,4);
  const name=document.getElementById('playerName')?.value?.trim();
  if(!code||code.length!==4||!name)return;

  // IMPORTANTE: usa exactamente el mismo namespace/sala que game-main.js.
  // Trystero devuelve la misma instancia si joinRoom() se llama otra vez
  // con el mismo appId + roomId, así que esto solo refuerza el handshake.
  const room=joinRoom({appId:APP_ID},code);
  const hello=room.makeAction('hello');

  const sendHello=(peerId)=>{
    try{
      hello.send({name,version:VERSION},peerId?{target:peerId}:undefined);
    }catch(e){console.warn('[ElTopo] hello retry failed',e)}
  };

  // No dependemos únicamente de onPeerJoin: puede ocurrir antes de instalar
  // el callback en redes/dispositivos rápidos.
  sendHello();
  retryTimer=setInterval(()=>sendHello(),700);
  setTimeout(()=>clearInterval(retryTimer),9500);

  const previous=room.onPeerJoin;
  room.onPeerJoin=peerId=>{
    try{if(typeof previous==='function')previous(peerId)}catch{}
    sendHello(peerId);
  };
}

document.getElementById('joinRoomBtn')?.addEventListener('click',()=>setTimeout(armJoinHandshake,0));
