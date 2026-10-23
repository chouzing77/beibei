$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$beibeiJdk = $env:JAVA_HOME
if (Test-Path toolchain/jdk) { $beibeiJdk = (Get-ChildItem toolchain/jdk -Directory | Select-Object -First 1).FullName }
if (!$beibeiJdk -or !(Test-Path "$beibeiJdk/bin/javac.exe")) { throw 'Set JAVA_HOME to JDK 21 or extract it into toolchain/jdk/<jdk-folder>.' }
$env:JAVA_HOME = $beibeiJdk
$env:PATH = "$beibeiJdk/bin;$env:PATH"
$sdk = Join-Path $PSScriptRoot 'toolchain/sdk'
if (!(Test-Path $sdk)) { $sdk = $env:ANDROID_HOME; if (!$sdk) { $sdk = $env:ANDROID_SDK_ROOT } }
if (!$sdk -or !(Test-Path "$sdk/build-tools/35.0.0")) { throw 'Install Android SDK platform 35 / build-tools 35.0.0; set ANDROID_HOME.' }
$bt = Join-Path $sdk 'build-tools/35.0.0'
$androidJar = Join-Path $sdk 'platforms/android-35/android.jar'
function Run([string]$exe, [string[]]$arguments) {
  & $exe @arguments
  if ($LASTEXITCODE -ne 0) { throw "$exe exited with $LASTEXITCODE" }
}
$webSource = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../sites/beishu-lab/dist'))
New-Item -ItemType Directory -Force assets/web,res/drawable,build/gen,build/classes,build/dex,release,signing | Out-Null
Copy-Item "$webSource/*" assets/web -Recurse -Force
Copy-Item '../../desktop/beibei/assets/icon.png' res/drawable/icon.png -Force
Run "$bt/aapt2.exe" @('compile','--dir','res','-o','build/resources.zip')
Run "$bt/aapt2.exe" @('link','-o','build/unsigned.apk','--manifest','AndroidManifest.xml','-I',$androidJar,'--java','build/gen','-A','assets','build/resources.zip')
$javaSources = @(Get-ChildItem src,build/gen -Recurse -Filter '*.java' | ForEach-Object FullName)
Run "$beibeiJdk/bin/javac.exe" (@('-J-Duser.language=en','-encoding','UTF-8','--release','8','-classpath',$androidJar,'-d','build/classes') + $javaSources)
Run "$beibeiJdk/bin/jar.exe" @('cf','build/classes.jar','-C','build/classes','.')
Run "$bt/d8.bat" @('--release','--lib',$androidJar,'--min-api','26','--output','build/dex','build/classes.jar')
Run "$beibeiJdk/bin/jar.exe" @('uf','build/unsigned.apk','-C','build/dex','classes.dex')
Run "$bt/zipalign.exe" @('-p','-f','4','build/unsigned.apk','build/aligned.apk')
if (!(Test-Path signing/release.jks)) {
  if (!(Test-Path signing/password.txt)) {
    $keyBytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Fill($keyBytes)
    [IO.File]::WriteAllText((Join-Path $PSScriptRoot 'signing/password.txt'),[Convert]::ToBase64String($keyBytes))
  }
  Run "$beibeiJdk/bin/keytool.exe" @('-genkeypair','-keystore','signing/release.jks','-storepass:file','signing/password.txt','-keypass:file','signing/password.txt','-alias','beibei','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=Beibei, O=Beibei, C=CN','-storetype','JKS')
}
Run "$bt/apksigner.bat" @('sign','--ks','signing/release.jks','--ks-key-alias','beibei','--ks-pass','file:signing/password.txt','--out','release/Beibei-1.0.0.apk','build/aligned.apk')
Run "$bt/apksigner.bat" @('verify','--verbose','release/Beibei-1.0.0.apk')
Run "$bt/zipalign.exe" @('-c','-p','4','release/Beibei-1.0.0.apk')
Get-FileHash release/Beibei-1.0.0.apk -Algorithm SHA256 | Format-List
