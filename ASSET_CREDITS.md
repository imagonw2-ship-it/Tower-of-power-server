# Avatar assets

The Class A NBC hazmat mesh and textures were supplied by the project owner in `class-a-nbc-hazmat.zip`. The mobile build uses reduced texture sizes, a 22-bone palette and two skin weights. The original upload is not shipped inside the APK.

Idle, walk and run motion data, and the sneak pose used to derive the crouch cycle, were retargeted from Mixamo animations distributed with the official Three.js additive animation example:

https://threejs.org/examples/webgl_animation_skinning_additive_blending.html
https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/Xbot.glb
https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html

The Xbot character mesh and Three.js rendering engine are not included. The converter uses ufbx (https://github.com/ufbx/ufbx), with generated runtime data in `client/avatar-assets.js`. These credits supplement the existing game asset acknowledgements.

## Handheld camera (11.1)

Camera 01 by Rajil Jose Macatangay, CC0, downloaded from its original Poly Haven distribution: https://polyhaven.com/a/Camera_01 . The same asset was discovered through this Sketchfab listing: https://sketchfab.com/3d-models/camera-4fdac0ba365f4c38bf919ad43c3e3b26 . Original model/textures are CC0; no Sketchfab account or runtime asset downloads are required.

The mobile conversion omits the loose tabletop strap, packs the diffuse maps into one 1024px atlas, combines four materials into one draw call, and represents the lens with opaque dark glass. Geometry is embedded in `client/camera-assets.js`; regenerate with `scripts/prepare_camera.py` and the official 1K glTF download (including its binary buffer and diffuse textures). Equipped cameras are distance culled at 60m.
