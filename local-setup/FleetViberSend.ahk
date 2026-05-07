#NoEnv
#SingleInstance Force
SetWorkingDir %A_ScriptDir%

; Receive the full URL from the custom protocol handler
url := A_Args[1]
if (!url) {
    ExitApp
}

; Strip protocol prefix: fleetviber://send?
StringReplace, params, url, fleetviber://send?,

; Parse phone and text from query string
phone   := ""
message := ""

Loop, Parse, params, &
{
    pair  := A_LoopField
    eqPos := InStr(pair, "=")
    if (eqPos > 0) {
        key := SubStr(pair, 1, eqPos - 1)
        val := SubStr(pair, eqPos + 1)
        val := URLDecode(val)
        if (key = "phone")
            phone := val
        else if (key = "text")
            message := val
    }
}

if (!phone || !message)
    ExitApp

; Put message on clipboard
Clipboard := message
ClipWait, 2

; Open Viber to the supplier's chat
Run, viber://chat?number=%phone%

; Wait for Viber to appear (up to 15 seconds)
WinWait, ahk_exe Viber.exe, , 15
if ErrorLevel
    ExitApp

; Give Viber time to navigate to the chat
Sleep, 2200
WinActivate, ahk_exe Viber.exe
WinWaitActive, ahk_exe Viber.exe, , 5

; Click the message input area (bottom-center of Viber window)
WinGetPos, wx, wy, ww, wh, ahk_exe Viber.exe
clickX := wx + (ww / 2)
clickY := wy + wh - 45
Click, %clickX%, %clickY%
Sleep, 400

; Paste and send
Send, ^v
Sleep, 350
Send, {Enter}

ExitApp

; ── Helper: URL-decode a string ──────────────────────────────
URLDecode(str) {
    str := StrReplace(str, "+", " ")
    Loop {
        RegExMatch(str, "i)%[0-9a-f]{2}", hex)
        if !hex
            break
        str := StrReplace(str, hex, Chr("0x" . SubStr(hex, 2)))
    }
    return str
}
