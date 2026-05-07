#Requires AutoHotkey v2.0
#SingleInstance Force

; Read phone and message written by the local Node server
phone   := Trim(FileRead("C:\FleetFlow\pending_phone.txt",   "UTF-8"))
message := Trim(FileRead("C:\FleetFlow\pending_message.txt", "UTF-8"))

if (!phone || !message)
    ExitApp

; Put the message on the clipboard
A_Clipboard := message
ClipWait(2)

; Open Viber to the supplier's chat
Run "viber://chat?number=" . phone

; Wait for Viber window (up to 15 seconds)
try {
    WinWait "ahk_exe Viber.exe", , 15
} catch {
    ExitApp
}

; Give Viber more time to navigate to the chat
Sleep 3000
WinActivate "ahk_exe Viber.exe"
WinWaitActive "ahk_exe Viber.exe", , 5

; Click the message input area
; Viber's text input sits ~80px above the window bottom (above emoji/attach toolbar)
WinGetPos &wx, &wy, &ww, &wh, "ahk_exe Viber.exe"
clickX := wx + (ww // 2)
clickY := wy + wh - 80
Click clickX, clickY
Sleep 300
; Second click to guarantee focus
Click clickX, clickY
Sleep 400

; Paste the message
Send "^v"
Sleep 500

; Send
Send "{Enter}"
Sleep 200

; Clean up temp files
FileDelete "C:\FleetFlow\pending_message.txt"
FileDelete "C:\FleetFlow\pending_phone.txt"

ExitApp
