import {validVoicePacket, decodeVoice} from '../shared/voice-codec.js';
import {blocked} from '../shared/physics.js';

export function voiceMix(speaker,listener,range=42) {
  const dx=speaker.x-listener.x,dz=speaker.z-listener.z,d=Math.hypot(dx,dz);
  if(d>=range)return null;
  let gain=Math.pow(1-Math.max(0,d-3)/(range-3),1.5);
  if(blocked([speaker.x,speaker.y,speaker.z],[listener.x,listener.y,listener.z]))gain*=.3;
  return {gain,pan:d>.01?Math.max(-.9,Math.min(.9,(dx*Math.cos(listener.yaw)-dz*Math.sin(listener.yaw))/d)) : 0};
}
export function relayVoice(ws,bytes,sockets,now=Date.now()) {
  const room=ws.room,p=ws.player;
  if(!room||!p?.alive||!p.connected||!ws.voiceEnabled||sockets.get(p.id)!==ws||!validVoicePacket(bytes))return false;
  ws.voiceBucket=Math.min(26,(ws.voiceBucket??26)+(now-(ws.voiceAt??now))*.021);
  ws.voiceAt=now;if(ws.voiceBucket<1)return false;ws.voiceBucket--;
  const seq=bytes.readUInt16LE?bytes.readUInt16LE(2):new DataView(bytes.buffer,bytes.byteOffset).getUint16(2,true);
  if(ws.voiceSeq!==undefined&&((seq-ws.voiceSeq+65536)%65536===0||(seq-ws.voiceSeq+65536)%65536>32768))return false;
  ws.voiceSeq=seq;
  // Audio energy is measured by the server. Voice can alert the blind enemies,
  // but arbitrary JSON cannot claim to make another player emit sound.
  const samples=decodeVoice(bytes);let energy=0;for(const v of samples)energy+=v*v;
  const rms=Math.sqrt(energy/samples.length);if(rms<.002)return false;
  if(room.phase==='playing'&&now-(ws.voiceNoiseAt||0)>200){room.world.sim.noise(p,Math.min(38,10+rms*240));ws.voiceNoiseAt=now;}
  p.speakingUntil=now+220;
  if(room.phase==='playing')room.world.voiceMemory?.record(p.id,bytes,room.world.mimic.clock);
  for(const listener of room.players.values()){
    if(listener.id===p.id||!listener.alive||!listener.connected)continue;
    const peer=sockets.get(listener.id);if(!peer||peer.room!==room||peer.readyState!==1||peer.bufferedAmount>16384)continue;
    const mix=voiceMix(p,listener);if(!mix)continue;
    const packet=Buffer.alloc(8+bytes.length);packet[0]=87;packet[1]=1;packet.writeUInt16LE(p.voiceSlot,2);
    packet.writeUInt16LE(Math.round(mix.gain*65535),4);packet.writeInt16LE(Math.round(mix.pan*32767),6);packet.set(bytes,8);
    peer.send(packet,{binary:true});
  }
  return true;
}

// Use a separate channel and sequence for echoes: old speech packet numbers
// must not be discarded by the live-speaker replay protection.
export function relayMimic(room,sockets){
  const frames=room.world.mimicFrames.splice(0);
  for(const frame of frames)for(const listener of room.players.values()){
    if(!listener.alive||!listener.connected)continue;
    const peer=sockets.get(listener.id);if(!peer||peer.room!==room||peer.readyState!==1||peer.bufferedAmount>16384)continue;
    const source={...frame,y:listener.y},mix=voiceMix(source,listener,38);if(!mix)continue;
    const packet=Buffer.alloc(416);packet[0]=87;packet[1]=2;packet.writeUInt16LE(1,2);
    packet.writeUInt16LE(Math.round(mix.gain*.85*65535),4);packet.writeInt16LE(Math.round(mix.pan*32767),6);packet.set(frame.bytes,8);packet.writeUInt16LE(frame.sequence,10);
    peer.send(packet,{binary:true});
  }
}
