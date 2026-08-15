Unicode true
SetCompressor /SOLID lzma
!include "MUI2.nsh"
!include "FileFunc.nsh"

!ifndef SRC_DIR
  !define SRC_DIR "..\dist\win-unpacked"
!endif
!ifndef OUT_FILE
  !define OUT_FILE "..\dist\KEY-Vision-Setup-0.6.0.exe"
!endif

Name "KEY 视界"
OutFile "${OUT_FILE}"
InstallDir "$LOCALAPPDATA\KEY Vision"
RequestExecutionLevel user
BrandingText "奎燕竞品分析智能体 · 0.6.0"

!define MUI_ABORTWARNING
!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "${SRC_DIR}\*.*"
  CreateShortCut "$DESKTOP\KEY 视界.lnk" "$INSTDIR\KEY 视界.exe" "" "$INSTDIR\KEY 视界.exe" 0
  CreateDirectory "$SMPROGRAMS\KEY 视界"
  CreateShortCut "$SMPROGRAMS\KEY 视界\KEY 视界.lnk" "$INSTDIR\KEY 视界.exe" "" "$INSTDIR\KEY 视界.exe" 0
  CreateShortCut "$SMPROGRAMS\KEY 视界\卸载 KEY 视界.lnk" "$INSTDIR\Uninstall.exe"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\KEYVision" "DisplayName" "KEY 视界"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\KEYVision" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\KEYVision" "DisplayIcon" "$INSTDIR\KEY 视界.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\KEYVision" "DisplayVersion" "0.6.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\KEYVision" "Publisher" "奎燕 AI 研究室"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\KEYVision" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\KEYVision" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\KEYVision" "EstimatedSize" "$0"
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\KEY 视界.lnk"
  RMDir /r "$SMPROGRAMS\KEY 视界"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\KEYVision"
  RMDir /r "$INSTDIR"
SectionEnd
