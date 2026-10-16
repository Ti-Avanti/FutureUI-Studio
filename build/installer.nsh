; 安装版标记只在安装过程中生成，便携版和直接解压的目录不会误用安装更新。
!macro customInstall
  Push $0
  FileOpen $0 "$INSTDIR\resources\studio-installed" w
  FileWrite $0 "nsis"
  FileClose $0
  Pop $0
  ; 直接启动已安装程序，避免开始菜单快捷方式未创建或被重定向时无法启动。
  StrCpy $launchLink "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
!macroend
