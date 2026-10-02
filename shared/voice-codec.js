// Independent 50 ms IMA ADPCM packets: 16 kHz mono, 8.2 KB/s while speaking.
// No encoder history crosses packets, so a lost packet cannot corrupt the next.
export const VOICE_SAMPLES = 800;
export const VOICE_BYTES = 408;
export const VOICE_STEPS = [7,8,9,10,11,12,13,14,16,17,19,21,23,25,28,31,34,37,41,45,50,55,60,66,73,80,88,97,107,118,130,143,157,173,190,209,230,253,279,307,337,371,408,449,494,544,598,658,724,796,876,963,1060,1166,1282,1411,1552,1707,1878,2066,2272,2499,2749,3024,3327,3660,4026,4428,4871,5358,5894,6484,7132,7845,8630,9493,10442,11487,12635,13899,15289,16818,18500,20350,22385,24623,27086,29794,32767];
export const VOICE_INDEX = [-1,-1,-1,-1,2,4,6,8];
export function validVoicePacket(bytes) {
  return bytes?.byteLength === VOICE_BYTES && bytes[0] === 86 && bytes[1] === 1 && bytes[6] <= 88 && bytes[7] === 0;
}
export function encodeVoice(samples, sequence=0) {
  const bytes = new Uint8Array(VOICE_BYTES), view = new DataView(bytes.buffer);
  bytes[0]=86;bytes[1]=1;view.setUint16(2,sequence & 65535,true);
  let predictor = Math.max(-32768,Math.min(32767,Math.round(samples[0]*32767))), index=32;
  view.setInt16(4,predictor,true);bytes[6]=index;
  for(let i=1;i<VOICE_SAMPLES;i++){
    const sample=Math.max(-32768,Math.min(32767,Math.round((samples[i]||0)*32767)));
    let delta=sample-predictor,code=delta<0?8:0;delta=Math.abs(delta);
    const step=VOICE_STEPS[index];let change=step>>3;
    if(delta>=step){code|=4;delta-=step;change+=step;}
    if(delta>=step>>1){code|=2;delta-=step>>1;change+=step>>1;}
    if(delta>=step>>2){code|=1;change+=step>>2;}
    predictor=Math.max(-32768,Math.min(32767,predictor+(code&8?-change:change)));
    index=Math.max(0,Math.min(88,index+VOICE_INDEX[code&7]));
    bytes[8+((i-1)>>1)]|=code<<(((i-1)&1)*4);
  }
  return bytes;
}
export function decodeVoice(bytes) {
  if(!validVoicePacket(bytes))return null;
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),out=new Float32Array(VOICE_SAMPLES);
  let predictor=view.getInt16(4,true),index=bytes[6];out[0]=predictor/32768;
  for(let i=1;i<VOICE_SAMPLES;i++){
    const code=(bytes[8+((i-1)>>1)]>>(((i-1)&1)*4))&15,step=VOICE_STEPS[index];
    const change=(step>>3)+(code&4?step:0)+(code&2?step>>1:0)+(code&1?step>>2:0);
    predictor=Math.max(-32768,Math.min(32767,predictor+(code&8?-change:change)));
    index=Math.max(0,Math.min(88,index+VOICE_INDEX[code&7]));out[i]=predictor/32768;
  }
  return out;
}
