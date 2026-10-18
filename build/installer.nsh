; Registers the "cam-toys" DirectShow virtual camera (softcam.dll, x64). perMachine install = admin.
; The installer is 32-bit, so turn off WOW64 redirection to run the 64-bit regsvr32.
!include x64.nsh

!macro customInstall
  ${DisableX64FSRedirection}
  ExecWait '"$SYSDIR\regsvr32.exe" /s "$INSTDIR\resources\app.asar.unpacked\resources\softcam.dll"'
  ${EnableX64FSRedirection}
!macroend

!macro customUnInstall
  ${DisableX64FSRedirection}
  ExecWait '"$SYSDIR\regsvr32.exe" /s /u "$INSTDIR\resources\app.asar.unpacked\resources\softcam.dll"'
  ${EnableX64FSRedirection}
!macroend
