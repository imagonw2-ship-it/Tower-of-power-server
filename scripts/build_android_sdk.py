"""Build the unchanged Android wrapper with official SDK build-tools and ECJ.
Usage: python3 scripts/build_android_sdk.py BUILD_TOOLS ANDROID_JAR ECJ_JAR
The existing development.keystore is required; never generates a replacement.
"""
from pathlib import Path
import subprocess, sys, tempfile, zipfile
root=Path(__file__).resolve().parents[1]
bt,api,ecj=[Path(p).resolve() for p in sys.argv[1:]]
android=root/'android'
assert (android/'development.keystore').is_file(), 'Restore the existing signing key first'
def run(*cmd): subprocess.run([str(p) for p in cmd],check=True)
run(sys.executable,root/'scripts/build_client.py')
with tempfile.TemporaryDirectory(prefix='tower-sdk-') as directory:
 w=Path(directory);(w/'classes').mkdir()
 run('java','-jar',ecj,'-source','8','-target','8','-proc:none','-classpath',api,'-d',w/'classes',android/'src/com/towerofpower/online/MainActivity.java')
 run('java','-cp',bt/'lib/d8.jar','com.android.tools.r8.D8','--min-api','26','--lib',api,'--output',w,*sorted((w/'classes').rglob('*.class')))
 run(bt/'aapt','package','-f','-M',android/'AndroidManifest.xml','-S',android/'res','-A',android/'assets','-I',api,'-F',w/'unsigned.apk')
 with zipfile.ZipFile(w/'unsigned.apk','a') as apk:apk.write(w/'classes.dex','classes.dex',compress_type=zipfile.ZIP_DEFLATED)
 run(bt/'zipalign','-f','4',w/'unsigned.apk',w/'aligned.apk')
 output=root.parent/'TOWER_OF_POWER_ONLINE.apk'
 run('java','-jar',bt/'lib/apksigner.jar','sign','--ks',android/'development.keystore','--ks-key-alias','androiddebugkey','--ks-pass','pass:android','--key-pass','pass:android','--v4-signing-enabled','false','--out',output,w/'aligned.apk')
 run('java','-jar',bt/'lib/apksigner.jar','verify','--verbose','--print-certs',output)
 run(bt/'aapt','dump','badging',output)
 print('Built',output,output.stat().st_size,'bytes')
