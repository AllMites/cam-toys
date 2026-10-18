!macro customInstall
  ; Phase 2: ExecWait 'regsvr32 /s "$INSTDIR\resources\app.asar.unpacked\resources\softcam.dll"'
!macroend

!macro customUnInstall
  ; Phase 2: ExecWait 'regsvr32 /s /u "$INSTDIR\resources\app.asar.unpacked\resources\softcam.dll"'
!macroend
