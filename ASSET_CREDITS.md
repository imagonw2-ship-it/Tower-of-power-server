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

Version 11.3 first-person sleeve/glove: extracted from the existing user-provided Class A NBC hazmat model; original suit texture and skin weights retained. No additional third-party asset.

## Flare gun (11.6)

The flare-gun model was supplied by the project owner and converted for the mobile build. Its original author and redistribution license were not provided; no third-party license or authorship is inferred. The separate Oxygen3D Sketchfab listing was not downloaded or bundled.

Version 11.7 fits the existing glove vertices to each item grip and renders flare light with an original radial shader. The updated button icons are original SVG artwork, not Higgsfield-generated assets.

## Pine forest (12.0)

Three detailed pine meshes from **Nature Kit** by Kenney, distributed under Creative Commons CC0: https://kenney.nl/assets/nature-kit . The original license is preserved in `client/tree-license.txt`. Source models: `tree_pineTallA_detailed`, `tree_pineTallB_detailed`, and `tree_pineTallD_detailed`.

The mobile conversion normalizes scale, combines OBJ geometry, recolors the foliage and bark, and embeds the geometry in `client/tree-assets.js`. Forest placement, terrain shading, batching, distance fading and trunk collisions are original game code. Trees require no login or runtime download. Regenerate with `scripts/prepare_trees.py` and the official Nature Kit ZIP.

The printed suit-card portrait in 12.0 is rendered from the existing uploaded hazmat suit. Its face is blacked out before it is embedded; `scripts/prepare_suit_portrait.mjs` regenerates it.
