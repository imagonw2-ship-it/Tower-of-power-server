class ProximityVoice {
  constructor(network){
    this.net=network;this.enabled=false;this.sequence=0;this.hangover=0;this.generation=0;this.pending=false;this.volume=.85;this.latest=new Map();
    this.button=document.getElementById('voiceToggle');this.label=document.getElementById('voiceStatus');
    this.button.addEventListener('click',()=>this.toggle());
    document.getElementById('voiceVolume').addEventListener('input',e=>{this.volume=Number(e.target.value);if(this.output)this.output.gain.value=this.volume;});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stop();});
    addEventListener('pagehide',()=>this.stop());
    document.addEventListener('pointerdown',()=>{if(this.net.active)this.ensureAudio().catch(()=>{});},{passive:true});
    setInterval(()=>this.update(),150);
  }
  async ensureAudio(){
    if(this.node){if(this.context.state==='suspended')await this.context.resume();return;}
    if(this.audioPending)return this.audioPending;
    this.audioPending=(async()=>{
      const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio||!window.AudioWorkletNode)throw Error('Voice audio is unavailable on this device.');
      const context=new Audio({latencyHint:'interactive'});this.context=context;
      const blob=new Blob([VOICE_WORKLET_SOURCE],{type:'text/javascript'}),url=URL.createObjectURL(blob);
      try{await context.audioWorklet.addModule(url);}catch(e){await context.close();this.context=null;throw e;}finally{URL.revokeObjectURL(url);}
      this.node=new AudioWorkletNode(context,'tower-proximity-audio',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2]});
      this.output=context.createGain();this.output.gain.value=this.volume;this.node.connect(this.output).connect(context.destination);
      this.node.port.onmessage=({data:m})=>{if(m.type==='capture')this.transmit(m.samples);};
      await context.resume();
    })();
    try{return await this.audioPending;}finally{this.audioPending=null;}
  }
  canSpeak(){
    const alive=this.net.snapshots.at(-1)?.players.find(p=>p.id===this.net.player?.id)?.alive!==false;
    return (this.net.active?this.net.connected&&alive:['playing','fieldPanel','inventory','paused'].includes(game.mode))&&!document.hidden&&game.mode!=='lost';
  }
  async toggle(){
    if(this.enabled||this.pending){this.stop();return;}
    if(!this.canSpeak())return;
    const generation=++this.generation;this.pending=true;this.label.textContent='ALLOW MICROPHONE';
    try{
      await this.ensureAudio();
      if(!navigator.mediaDevices?.getUserMedia)throw Error('Microphone unavailable. Use the updated APK.');
      const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
      if(generation!==this.generation||!this.canSpeak()){stream.getTracks().forEach(t=>t.stop());return;}
      this.stream=stream;this.input=this.context.createMediaStreamSource(stream);this.input.connect(this.node);this.enabled=true;
      this.node.port.postMessage({type:'capture',enabled:true});this.net.send({type:'voice',enabled:true});this.label.textContent='MIC ON · MIMICS LISTEN';
      for(const track of stream.getTracks())track.onended=()=>this.stop();
    }catch(e){if(generation===this.generation)this.label.textContent=e.name==='NotAllowedError'?'MIC PERMISSION DENIED':e.message||'VOICE UNAVAILABLE';}
    finally{this.pending=false;this.refresh();}
  }
  stop(){
    localVoiceMemory.clear();localMimic.forget('solo');
    ++this.generation;this.pending=false;this.enabled=false;this.hangover=0;
    this.input?.disconnect();this.input=null;
    if(this.stream){for(const track of this.stream.getTracks()){track.onended=null;track.stop();}this.stream=null;}
    this.node?.port.postMessage({type:'capture',enabled:false});
    if(this.net.connected)this.net.send({type:'voice',enabled:false});
    this.label.textContent='MIC OFF';this.button.classList.remove('speaking');this.refresh();
  }
  refresh(){
    this.button.setAttribute('aria-pressed',String(this.enabled));this.button.setAttribute('aria-label',this.enabled?'Mute microphone':'Enable proximity microphone');
    this.button.classList.toggle('latched',this.enabled);document.getElementById('voiceIcon').setAttribute('href',this.enabled?'#icon-mic':'#icon-mic-off');
  }
  transmit(samples){
    if(!this.enabled||!this.canSpeak()||(this.net.active&&this.net.socket?.bufferedAmount>8192))return;
    let energy=0;for(const value of samples)energy+=value*value;
    const rms=Math.sqrt(energy/samples.length);this.button.classList.toggle('speaking',rms>.008);
    if(rms>.008)this.hangover=6;else if(this.hangover>0)this.hangover--;else return;
    const packet=encodeVoice(samples,this.sequence++);
    if(this.net.active)this.net.socket?.send(packet);else localVoiceMemory.record('solo',packet,localMimic.clock);
  }
  receive(buffer){
    if(!this.node||!this.net.active||this.context.state!=='running'||this.volume===0)return;
    const bytes=new Uint8Array(buffer);if(bytes.length!==416||bytes[0]!==87||(bytes[1]!==1&&bytes[1]!==2))return;
    const view=new DataView(buffer),id=view.getUint16(2,true)+(bytes[1]===2?65536:0),seq=view.getUint16(10,true),old=this.latest.get(id);
    if(old!==undefined&&((seq-old+65536)%65536===0||(seq-old+65536)%65536>32768))return;
    const samples=decodeVoice(bytes.subarray(8));if(!samples)return;this.latest.set(id,seq);
    this.node.port.postMessage({type:'packet',id,samples,gain:view.getUint16(4,true)/65535,pan:view.getInt16(6,true)/32767},[samples.buffer]);
  }
  update(){
    document.getElementById('voiceHud').hidden=!this.net.active&&!['playing','paused','inventory','fieldPanel'].includes(game.mode);
    if((this.enabled||this.pending)&&!this.canSpeak())this.stop();
    if(this.net.active&&!this.net.connected){this.node?.port.postMessage({type:'clear'});this.latest.clear();}
    if(this.enabled&&!this.pending)this.label.textContent='MIC ON · MIMICS LISTEN';
  }
}
const proximityVoice=new ProximityVoice(net);
net.hooks.voice=buffer=>proximityVoice.receive(buffer);
net.hooks.leave=()=>proximityVoice.stop();
