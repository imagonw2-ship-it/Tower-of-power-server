# Avatar assets

The Class A NBC hazmat mesh and textures were supplied by the project owner in `class-a-nbc-hazmat.zip`. The mobile build uses reduced texture sizes, a 22-bone palette and two skin weights. The original upload is not shipped inside the APK.

Idle, walk and run motion data, and the sneak pose used to derive the crouch cycle, were retargeted from Mixamo animations distributed with the official Three.js additive animation example:

https://threejs.org/examples/webgl_animation_skinning_additive_blending.html
https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/Xbot.glb
https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html

The Xbot character mesh and Three.js rendering engine are not included. The converter uses ufbx (https://github.com/ufbx/ufbx), with generated runtime data in `client/avatar-assets.js`. These credits supplement the existing game asset acknowledgements.
