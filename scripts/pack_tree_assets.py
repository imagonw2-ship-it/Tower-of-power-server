"""Pack prepared LODs and original leaf-opacity textures into one atlas."""
from pathlib import Path
from PIL import Image
import base64,io,json,sys
source=Path(sys.argv[1]);root=Path(__file__).resolve().parents[1];atlas=Image.new('RGBA',(1024,1024))
for pack,y in [('low',512),('high',0)]:
    for role,x in [('bark',0),('leaf',512)]:
        image=Image.open(next(source.glob(pack+'-'+role+'.*'))).convert('RGBA')
        if role=='leaf':image.putalpha(Image.open(next(source.glob(pack+'-alpha.*'))).convert('L').resize(image.size))
        image=image.resize((506,506),Image.Resampling.LANCZOS);atlas.paste(image,(x+3,y+3))
        atlas.paste(image.crop((0,0,1,506)).resize((3,506)),(x,y+3));atlas.paste(image.crop((505,0,506,506)).resize((3,506)),(x+509,y+3))
        atlas.paste(image.crop((0,0,506,1)).resize((506,3)),(x+3,y));atlas.paste(image.crop((0,505,506,506)).resize((506,3)),(x+3,y+509))
buf=io.BytesIO();atlas.save(buf,format='WEBP',quality=88,method=6)
(root/'client/tree-assets.js').write_text('// User-provided tree packs. See ASSET_CREDITS.md.\nconst TREE_ASSETS='+source.joinpath('models.json').read_text()+';\nconst TREE_TEXTURE='+json.dumps('data:image/webp;base64,'+base64.b64encode(buf.getvalue()).decode())+';\n')
(root/'shared/tree-shapes.js').write_text('// Normalized trunk widths used by both server and client.\nexport const FOREST_TREE_TYPES='+source.joinpath('shapes.json').read_text()+';\n')
print('Tree atlas bytes',len(buf.getvalue()))
