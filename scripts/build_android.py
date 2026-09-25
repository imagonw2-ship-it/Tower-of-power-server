"""Build with the existing local Android tools and development signing identity.

Usage: python3 scripts/build_android.py /absolute/path/to/android-tools
Requires Java, ECJ, D8, aapt, the framework resources and apksigner.
For a standard Android SDK installation, android/build.gradle is also provided.
"""
from pathlib import Path
import os, subprocess, sys, tempfile, zipfile, struct

root=Path(__file__).resolve().parents[1]
tools=Path(sys.argv[1]).resolve()
android=root/'android'
work=Path(tempfile.mkdtemp(prefix='tower-android-'))
env=os.environ.copy()
sysroot=tools/'sysroot/usr'
env['LD_LIBRARY_PATH']=':'.join(str(sysroot/p) for p in [
    'lib/p7zip','lib/x86_64-linux-gnu/android','lib/x86_64-linux-gnu'])
def run(*args): subprocess.run([str(a) for a in args],check=True,env=env)
run(sys.executable,root/'scripts/build_client.py')
(work/'classes').mkdir()
android_jar=tools/'android-complete.jar' if (tools/'android-complete.jar').exists() else tools/'android.jar'
with zipfile.ZipFile(android_jar) as check:
    if check.testzip() is not None: raise ValueError('Damaged Android API library')
run('java','-jar',tools/'ecj.jar','-source','8','-target','8','-proc:none',
    '-classpath',android_jar,'-d',work/'classes',
    android/'src/com/towerofpower/online/MainActivity.java')
run('java','-cp',tools/'r8.jar','com.android.tools.r8.D8','--min-api','26',
    '--lib',android_jar,'--output',work,*sorted((work/'classes').rglob('*.class')))
framework=sysroot/'share/android-framework-res/framework-res.apk'
if (tools/'framework-complete.deb').exists():
    run('dpkg-deb','-x',tools/'framework-complete.deb',work/'framework')
    framework=work/'framework/usr/share/android-framework-res/framework-res.apk'
with zipfile.ZipFile(framework) as check:
    if check.testzip() is not None: raise ValueError('Damaged Android framework package')
run(sysroot/'lib/android-sdk/build-tools/debian/aapt','package','-f',
    '-M',android/'AndroidManifest.xml','-S',android/'res','-A',android/'assets',
    '-I',framework,'-F',work/'resources.apk')
# Align uncompressed resources before signing; Android requires 4-byte alignment.
with zipfile.ZipFile(work/'resources.apk') as source, zipfile.ZipFile(work/'unsigned.apk','w') as target:
    for info in source.infolist():
        if info.compress_type==zipfile.ZIP_STORED:
            padding=(-(target.fp.tell()+30+len(info.filename.encode())+4))%4
            info.extra=struct.pack('<HH',0xffff,padding)+b'\0'*padding
        target.writestr(info,source.read(info.filename))
    target.write(work/'classes.dex','classes.dex',compress_type=zipfile.ZIP_DEFLATED)
output=root.parent/'TOWER_OF_POWER_ONLINE.apk'
signer=sysroot/'share/java/apksigner-35.0.2.jar'
run('java','-jar',signer,'sign','--ks',android/'development.keystore',
    '--ks-key-alias','androiddebugkey','--ks-pass','pass:android','--key-pass','pass:android',
    '--v4-signing-enabled','false','--out',output,work/'unsigned.apk')
run('java','-jar',signer,'verify','--verbose','--print-certs',output)
run(sysroot/'lib/android-sdk/build-tools/debian/aapt','dump','badging',output)
print('Built',output,output.stat().st_size,'bytes')
