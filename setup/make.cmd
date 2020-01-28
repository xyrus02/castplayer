@echo off

set root=.\
set package=castplayer-win32-x64

set FOUND=
for %%X in (candle.exe) do (set FOUND=%%~$PATH:X)
if not defined FOUND goto err_no_wix

set FOUND=
for %%X in (light.exe) do (set FOUND=%%~$PATH:X)
if not defined FOUND goto err_no_wix

:candle
echo --- Compiling setup information...
candle.exe -nologo -arch x64 -dBuild="%root%target\win\%package%" -out "%root%target\win\%package%\setup.wxobj" "%~d0%~p0CastPlayer.wxs"
if errorlevel 0 goto light
echo Error compiling setup information! 1>&2
exit 1

:light
echo --- Creating windows installer package...
"light.exe" -nologo -sw1076 -o "%root%target\win\%package%\setup.msi" "%root%target\win\%package%\setup.wxobj"
if errorlevel 0 goto done
echo Error creating MSI package! 1>&2
exit 1

:err_no_wix
echo Unable to locate WIX Toolset - did you configure the binary directory in PATH correctly? 1>&2
exit 1

:done
echo Done.
exit 0