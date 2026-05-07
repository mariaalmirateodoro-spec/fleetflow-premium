#Requires AutoHotkey v2.0
#SingleInstance Force

; Read phone and message written by the local Node server
phone   := Trim(FileRead("C:\FleetFlow\pending_phone.txt"))
message := Trim(FileRead("C:\FleetFlow\pending_message.txt"))

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

; Give Viber time to navigate to the chat
Sleep 2200
WinActivate "ahk_exe Viber.exe"
WinWaitActive "ahk_exe Viber.exe", , 5

; Click the message input area (bottom-center of the Viber window)
WinGetPos &wx, &wy, &ww, &wh, "ahk_exe Viber.exe"
clickX := wx + (ww // 2)
clickY := wy + wh - 45
Click clickX, clickY
Sleep 400

; Paste and send
Send "^v"
Sleep 350
Send "{Enter}"

; Clean up temp files
FileDelete "C:\FleetFlow\pending_message.txt"
FileDelete "C:\FleetFlow\pending_phone.txt"

ExitApp
