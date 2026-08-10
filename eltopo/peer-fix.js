import {joinRoom} from 'https://esm.sh/trystero@0.25.3';
import {APP_ID} from './game-data.js';

function armPeerHello(){
  setTimeout(()=>{
    const roomCode=document.getElementById('roomCodeDisplay')?.textContent?.trim();
    const name=document.getElementById('playerName')?.value?.trim();
    if(!roomCode||roomCode==='----'||!name)return;
    const room=joinRoom({appId:APP_ID},`eltopo-${roomCode.toLowerCase()}`);
    const hello=room.makeAction('hello');
    room.onPeerJoin=peerId=>hello.send({name},{target:peerId});
  },50);
}
document.getElementById('createRoomBtn')?.addEventListener('click',armPeerHello);
document.getElementById('joinRoomBtn')?.addEventListener('click',armPeerHello);
