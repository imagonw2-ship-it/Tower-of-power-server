// Extra turbines reuse the same offline hearing, emergence, gait and combat.
// A scoped context keeps every enemy's feet, attack and memory independent.
let otherTurbines=[];
function inTurbine(instance,fn){
  const oldBody=turbine,oldState=enemy;
  turbine=instance.body;enemy=instance.state;
  try{return fn();}finally{turbine=oldBody;enemy=oldState;}
}
function resetOtherTurbines(){
  const old=otherTurbines;otherTurbines=activeLayout.turbines.slice(1).map((spawn,i)=>{
    const instance={body:{...spawn,y:terrainHeight(spawn.x,spawn.z)},state:{},meshes:old[i]?.meshes||[makeLegMesh(),makeLegMesh(),makeLegMesh()],style:spawn.style};
    inTurbine(instance,resetEnemy);return instance;
  });
  for(let i=otherTurbines.length;i<old.length;i++)for(const m of old[i].meshes)disposeFieldMesh(m);
}
function extraTurbineNoise(radius){for(const t of otherTurbines)inTurbine(t,()=>emitTurbineNoise(radius));}
function updateOtherTurbines(dt){
  if(isMenuScene()||net.active||game.mode!=='playing')return;
  for(const t of otherTurbines)inTurbine(t,()=>{
    updateEnemy(dt);
    if(!world.turbineStopped&&!enemy.lureId)tickStomp(enemy,turbine,'turbine',dt,terrainHeight,shedBlocksSight,(point,radius)=>{
      sound.enemyStep(Math.hypot(player.x-point[0],player.z-point[2])*.42);game.shake=Math.max(game.shake,1);
      if(!game.godMode&&stompHits({...player,alive:true},point,radius,terrainHeight,shedBlocksSight)){sound.caught();setMode('lost');}
    });
  });
}
function collideOtherTurbines(){
  if(isMenuScene())return;
  for(const t of otherTurbines){
    if(t.state.state==='dormant'){
      const dx=player.x-t.body.x,dz=player.z-t.body.z,d=Math.hypot(dx,dz);
      if(d<8.1){player.x=t.body.x+(d>.001?dx/d:1)*8.1;player.z=t.body.z+(d>.001?dz/d:0)*8.1;}
    }else{
      const segments=legColliders(t.body,t.state,powerCreature,POWER_RIG,terrainHeight).slice(0,12);
      resolveLegCollision(player,segments,terrainHeight(player.x,player.z),game.crouching);
    }
  }
}
function appendTurbine(body,state,meshes,style=0){
  if(!isMenuScene()&&Math.hypot(player.x-body.x,player.z-body.z)>750)return;
  const deployment=state.state==='dormant'?0:ease(clamp(state.awake/7.8,0,1));
  const tilt=state.state==='dormant'?0:(Math.sin(state.gait*1.8)*.008+state.bank)*deployment;
  const orientation=multiply(rotateY(state.heading),multiply(rotateX(state.lean),rotateZ(tilt)));
  const model=multiply(multiply(transform(body.x,body.y,body.z),orientation),transform(0,0,0,TOWER_SCALE,TOWER_SCALE,TOWER_SCALE));
  objectDraws.push({mesh:towerMesh,model,variant:style});
  objectDraws.push({mesh:rotorMesh,model:multiply(multiply(model,transform(0,30.3,2.1)),rotateZ(state.angle)),variant:style});
  // The wide concrete plinth stays where the tower was anchored. The moving
  // shell has a sealed service belly, so looking up never exposes a torn fan.
  const anchor=state.anchor;objectDraws.push({mesh:turbineFoundationMesh,model:transform(anchor[0],terrainHeight(anchor[0],anchor[2]),anchor[2],TOWER_SCALE,TOWER_SCALE,TOWER_SCALE)});
  if(state.state!=='dormant')for(let i=0;i<3;i++){
    updateLegMesh(meshes[i],i,body,state);objectDraws.push({mesh:meshes[i],model:identity(),variant:style});
  }
}
