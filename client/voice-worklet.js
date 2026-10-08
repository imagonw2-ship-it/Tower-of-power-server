// Embedded in a Blob by voice.js. It never records to a file or persistent store.
class ProximityAudioProcessor extends AudioWorkletProcessor {
  constructor(){
    super();this.capture=false;this.frame=new Float32Array(800);this.at=0;this.phase=0;this.sum=0;this.count=0;this.peers=new Map();
    this.port.onmessage=({data:m})=>{
      if(m.type==='capture'){this.capture=m.enabled;this.at=0;this.phase=0;this.sum=0;this.count=0;}
      if(m.type==='clear')this.peers.clear();
      if(m.type==='forget')this.peers.delete(m.id);
      if(m.type==='packet'){
        let p=this.peers.get(m.id);if(!p){p={queue:[],cursor:0,ready:false,gain:0,pan:0,last:currentTime};this.peers.set(m.id,p);}
        if(p.queue.length>=5){p.queue.shift();p.cursor=0;}
        p.queue.push(m.samples);p.gain=m.gain;p.pan=m.pan;p.last=currentTime;
        if(p.queue.length>=2)p.ready=true;
      }
    };
  }
  process(inputs,outputs){
    const input=inputs[0]?.[0],out=outputs[0];if(!out?.[0])return true;
    if(this.capture&&input)for(const value of input){
      this.sum+=value;this.count++;this.phase+=16000;
      if(this.phase>=sampleRate){this.phase-=sampleRate;this.frame[this.at++]=this.sum/this.count;this.sum=0;this.count=0;
        if(this.at===800){this.port.postMessage({type:'capture',samples:this.frame},[this.frame.buffer]);this.frame=new Float32Array(800);this.at=0;}
      }
    }
    const left=out[0],right=out[1]||left;left.fill(0);if(right!==left)right.fill(0);
    for(const [id,p] of this.peers){
      if(currentTime-p.last>.5){this.peers.delete(id);continue;}
      if(!p.ready)continue;
      const fade=Math.min(1,Math.max(0,(.32-(currentTime-p.last))/.06));
      const l=Math.sqrt((1-p.pan)*.5)*p.gain*fade,r=Math.sqrt((1+p.pan)*.5)*p.gain*fade;
      for(let i=0;i<left.length;i++){
        if(!p.queue.length){p.ready=false;break;}
        const frame=p.queue[0],a=Math.floor(p.cursor),b=Math.min(a+1,799),v=frame[a]+(frame[b]-frame[a])*(p.cursor-a);
        left[i]+=v*l;if(right!==left)right[i]+=v*r;p.cursor+=16000/sampleRate;
        if(p.cursor>=800){p.queue.shift();p.cursor-=800;}
      }
    }
    for(let i=0;i<left.length;i++){left[i]=Math.max(-1,Math.min(1,left[i]));if(right!==left)right[i]=Math.max(-1,Math.min(1,right[i]));}
    return true;
  }
}
registerProcessor('tower-proximity-audio',ProximityAudioProcessor);
