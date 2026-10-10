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

## User-supplied tree packs (12.5.1)

`low-poly-trees-free.zip`, `realistic-trees-pack-of-2-free.zip`, and `more-realistic-trees-free.zip` were supplied for this game. Their seven Blender trees and embedded bark, leaf and opacity images are converted by `scripts/prepare_trees.py` and `scripts/pack_tree_assets.py`. The mobile versions share an atlas, retain roots below ground, simplify branches and reduce leaf clusters into two LODs. Original author and license metadata were not supplied with these packs; this project does not label them CC0. The older Kenney credit above applies to the previous pine assets.

## Host tablet and forest eyes (13)

The tablet mesh is converted from the project owner's `the-tablet.zip` / `Planchet2.blend`. Its five original mesh parts are retained. The upload did not include the referenced textures; the runtime uses dark housing materials and an original interactive Fieldlink display. No author or license is inferred for the supplied model. `scripts/export_tablet.py INPUT.blend client/tablet-assets.js` reads its Blender 2.93 SDNA records directly.

The watching-eye photograph is **Eye Shot - 1 - Professionally Edited** by Bernie Thomas / Berniethomas68, released by its author into the public domain: https://commons.wikimedia.org/wiki/File:Eye_Shot_-_1_-_Professionally_Edited.jpg . The original JPEG is bundled in `client/assets/watching-eye.jpg`. The game samples its eye region, darkens the iris and masks the surrounding skin in the shader. There are no runtime image downloads.

Version 14 renders the existing public-domain eye photograph in an opaque black square. The tactical tablet UI is original; it uses no Bodycam assets.

## Gun and military backpack (16)

The project owner supplied `glock-17-pistol-low-poly-game-ready-3d-model.zip` (source `model.glb`) and `military-backpack-02.zip` (source `Backpack-Outdoor-02.fbx`). The runtime retains their original color textures, with reduced resolution and simplified backpack geometry. Original author and redistribution license metadata were not supplied; no license or authorship is inferred.

The gun frame, slide and magazine and the backpack body and opening flap are packaged by `scripts/prepare_equipment.py`. The FBX conversion uses ufbx (https://github.com/ufbx/ufbx); UV-preserving geometry simplification uses meshoptimizer (https://github.com/zeux/meshoptimizer). These are build-time tools, not runtime downloads. The existing user-provided hazmat hands are reused. Recoil, aiming, reload, bag-opening animations, sounds and the projected inventory are original game code; no Bodycam assets or animations are included.

## Traffic light (17)

The project owner supplied `8-inch-ge-dr6-traffic-signals.zip`. This build uses only the first complete head (`Cylinder.299`) from `source/8 inch GE dr6 signals.fbx`, rotated horizontally, plus the supplied lens textures. The other two duplicate display heads are not included. The nominal eight-inch lenses establish the physical scale. Wooden poles, fence runs, cable geometry, gait, and pendulum simulation are authored in this project. `scripts/prepare_traffic_light.py` packs the static ufbx export without external runtime downloads.
