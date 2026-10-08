// Small, cached studio renders of the same meshes used in the world. One shared
// framebuffer; no extra WebGL contexts, external images or per-frame spinning.
let itemPreviewProgram=null,itemPreviewTarget=null;
const itemPreviewCache=new Map();
function itemAppearance(kind){
  if(kind==='gun')return {mesh:gunPreviewMesh,parts:gunParts,texture:gunTexture,kind:3};
  return {mesh:kind==='flashlight'?flashlightMesh:kind==='soda'?sodaMesh:kind==='flare'?flareGunMesh:cameraItemMesh,
    texture:kind==='camera'?cameraItemTexture:kind==='flare'?flareGunTexture:null,kind:kind==='soda'?2:kind==='flashlight'?1:3};
}
function prepareItemPreviewRenderer(){
  if(itemPreviewProgram)return;
  itemPreviewProgram=makeProgram('Inventory models',`
    precision highp float;
    layout(location=0) in vec3 a_position;layout(location=1) in vec3 a_normal;
    layout(location=2) in vec3 a_color;layout(location=3) in vec2 a_uv;
    uniform mat4 u_model,u_vp;out vec3 normal,tint;out vec2 uv;
    void main(){normal=mat3(u_model)*a_normal;tint=a_color;uv=a_uv;gl_Position=u_vp*u_model*vec4(a_position,1.);}
  `,`
    precision highp float;in vec3 normal,tint;in vec2 uv;
    uniform sampler2D u_texture;uniform float u_kind;out vec4 color;
    void main(){
      vec3 n=normalize(normal);if(!gl_FrontFacing)n=-n;
      vec3 albedo=u_kind>2.5?texture(u_texture,uv).rgb:tint;
      if(u_kind>1.5&&u_kind<2.5)albedo=vec3(.44+dot(tint,vec3(.2126,.7152,.0722))*.4);
      float key=max(0.,dot(n,normalize(vec3(-.45,.7,1.))));
      float rim=max(0.,dot(n,normalize(vec3(.65,.3,-.5))));
      vec3 c=albedo*(.36+.83*key+.24*rim);
      c+=vec3(.15)*pow(max(dot(n,normalize(vec3(-.2,.4,1.))),0.),35.);
      color=vec4(c,1.);
    }
  `);
  const width=256,height=192,texture=gl.createTexture(),depth=gl.createRenderbuffer(),framebuffer=gl.createFramebuffer();
  gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,width,height);
  gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);
  itemPreviewTarget={width,height,texture,depth,framebuffer};
}
function renderItemPreview(kind){
  const result=document.createElement('canvas');result.width=256;result.height=192;
  const ctx=result.getContext('2d');if(!ctx)return null;
  const old={framebuffer:gl.getParameter(gl.FRAMEBUFFER_BINDING),viewport:gl.getParameter(gl.VIEWPORT),clear:gl.getParameter(gl.COLOR_CLEAR_VALUE),blend:gl.isEnabled(gl.BLEND),depth:gl.isEnabled(gl.DEPTH_TEST),depthMask:gl.getParameter(gl.DEPTH_WRITEMASK),active:gl.getParameter(gl.ACTIVE_TEXTURE)};
  try{
    gl.activeTexture(gl.TEXTURE0);prepareItemPreviewRenderer();
    const target=itemPreviewTarget,asset=itemAppearance(kind),u=itemPreviewProgram.uniforms;
    gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);gl.viewport(0,0,target.width,target.height);
    gl.disable(gl.BLEND);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    const bounds=asset.parts?{min:[0,1,2].map(k=>Math.min(...asset.parts.map(p=>p.mesh.bounds.min[k]))),max:[0,1,2].map(k=>Math.max(...asset.parts.map(p=>p.mesh.bounds.max[k])))}:asset.mesh.bounds,center=bounds.min.map((v,k)=>(v+bounds.max[k])*.5);
    const rotation=multiply(rotateX(.16),rotateY(kind==='gun'?-.9:kind==='flare'?-.80:kind==='camera'?2.55:-.55));
    const extent=bounds.max.map((v,k)=>v-bounds.min[k]),radius=Math.hypot(...extent)*.5;
    const model=multiply(rotation,transform(-center[0],-center[1],-center[2]));
    const half=radius*1.12,projection=new Float32Array([1/(half*4/3),0,0,0,0,1/half,0,0,0,0,-1/(radius*3),0,0,0,0,1]);
    gl.useProgram(itemPreviewProgram.p);gl.uniformMatrix4fv(u.u_model,false,model);gl.uniformMatrix4fv(u.u_vp,false,projection);gl.uniform1f(u.u_kind,asset.kind);
    gl.bindTexture(gl.TEXTURE_2D,asset.texture||pylonTexture);gl.uniform1i(u.u_texture,0);for(const part of asset.parts||[{mesh:asset.mesh}]){gl.bindVertexArray(part.mesh.vao);gl.drawElements(gl.TRIANGLES,part.mesh.count,gl.UNSIGNED_INT,0);}
    const pixels=new Uint8Array(target.width*target.height*4),data=ctx.createImageData(target.width,target.height);
    gl.readPixels(0,0,target.width,target.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    for(let y=0;y<target.height;y++)data.data.set(pixels.subarray((target.height-1-y)*target.width*4,(target.height-y)*target.width*4),y*target.width*4);
    ctx.putImageData(data,0,0);return result;
  }finally{
    gl.bindVertexArray(null);gl.bindFramebuffer(gl.FRAMEBUFFER,old.framebuffer);gl.viewport(...old.viewport);gl.clearColor(...old.clear);
    (old.blend?gl.enable:gl.disable).call(gl,gl.BLEND);(old.depth?gl.enable:gl.disable).call(gl,gl.DEPTH_TEST);gl.depthMask(old.depthMask);gl.activeTexture(old.active);
  }
}
function refreshItemPreviews(){
  for(const canvas of document.querySelectorAll('.itemPreview')){
    const kind=canvas.id==='handPreview'?equippedTool:canvas.dataset.preview;
    if(canvas.closest('[hidden]'))continue;
    const ctx=canvas.getContext('2d');if(!ctx)continue;
    if(canvas.dataset.rendered===kind+':'+importedTextureRevision)continue;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(kind!=='none'){
      let cached=itemPreviewCache.get(kind);
      if(!cached||cached.revision!==importedTextureRevision){const image=renderItemPreview(kind);if(!image)continue;cached={image,revision:importedTextureRevision};itemPreviewCache.set(kind,cached);}
      ctx.drawImage(cached.image,0,0,canvas.width,canvas.height);
    }
    canvas.dataset.rendered=kind+':'+importedTextureRevision;
  }
}
