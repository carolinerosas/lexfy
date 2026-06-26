' Roda um script PowerShell totalmente escondido (sem abrir janela).
' Uso: wscript.exe run-hidden.vbs "C:\caminho\para\script.ps1"
Dim shell, comando
Set shell = CreateObject("WScript.Shell")
comando = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & WScript.Arguments(0) & """"
' O segundo parametro (0) esconde a janela; o terceiro (False) nao espera terminar.
shell.Run comando, 0, False
