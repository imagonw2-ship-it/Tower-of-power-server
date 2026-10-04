// Small printed ID cards follow the suit's chest bone. Nothing floats above a head.
const suitCards=new Map();let suitCardMesh=null,suitPortrait=null,suitPortraitReady=false;
function clearSuitCards(){for(const c of suitCards.values())gl.deleteTexture(c.texture);suitCards.clear();}
function makeSuitCard(player){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=320;
  const ctx=canvas.getContext('2d');if(!ctx)return null;
  if(!suitPortrait){suitPortrait=new Image();suitPortrait.onload=()=>{suitPortraitReady=true;clearSuitCards();};suitPortrait.src=SUIT_PORTRAIT;}
  ctx.fillStyle='#c5c7bc';ctx.fillRect(0,0,512,320);
  ctx.fillStyle='#242a28';ctx.fillRect(0,0,512,46);ctx.fillStyle='#e3e4d9';ctx.font='bold 22px monospace';ctx.fillText('FIELD PERSONNEL',18,31);
  ctx.fillStyle='#3a4240';ctx.fillRect(16,62,158,224);
  if(suitPortraitReady)ctx.drawImage(suitPortrait,16,62,158,224);
  ctx.fillStyle='#202622';ctx.font='16px monospace';ctx.fillText('IDENTIFICATION',191,86);
  const name=String(player.username||'GUEST').slice(0,20);
  const size=Math.min(31,Math.floor(294/Math.max(1,name.length)*1.55));ctx.font='bold '+size+'px monospace';ctx.fillText(name,191,132,299);
  ctx.font='14px monospace';ctx.fillText('TOWER OPERATIONS',191,164);ctx.fillText('ACCESS / FIELD',191,188);
  ctx.fillStyle='#8c9285';ctx.fillRect(191,206,291,1);ctx.fillStyle='#262d28';
  const id=String(player.id||'guest').replace(/[^a-zA-Z0-9]/g,'').slice(0,12).toUpperCase();
  ctx.font='17px monospace';ctx.fillText(id,191,237);
  for(let i=0;i<58;i++){const width=(id.charCodeAt(i%Math.max(1,id.length))+i)%3+1;ctx.fillRect(193+i*4.7,252,width,24);}
  ctx.strokeStyle='#737b70';ctx.lineWidth=3;ctx.strokeRect(5,5,502,310);
  const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0+5);gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.generateMipmap(gl.TEXTURE_2D);
  const result={texture,name:player.username};suitCards.set(player.id,result);return result;
}
function appendSuitCard(player,root,bones,distance){
  if(distance>24)return;
  let card=suitCards.get(player.id);if(card?.name!==player.username){if(card)gl.deleteTexture(card.texture);card=makeSuitCard(player);}if(!card)return;
  if(!suitCardMesh){
    const g=infraGeometry();
    // Slightly proud of the chest, large enough to read at conversational range.
    infraBox(-.145,1.337,.234,.237,.157,.007,[.22,.24,.22],g);
    infraFace(g,[[-.26,1.263,.239],[-.03,1.263,.239],[-.03,1.411,.239],[-.26,1.411,.239]],[1,1,1],[[0,0],[1,0],[1,1],[0,1]]);
    suitCardMesh=mesh3D(g);
  }
  const chest=AVATAR_ASSET.bones.indexOf('spine_03'),skin=bones.subarray(chest*16,chest*16+16);
  objectDraws.push({mesh:suitCardMesh,model:multiply(root,skin),texture:card.texture,material:5,assetKind:9,castShadow:false,suitCard:true});
}
