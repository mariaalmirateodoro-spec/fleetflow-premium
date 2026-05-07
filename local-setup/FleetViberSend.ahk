#Requires AutoHotkey v2.0
#SingleInstance Force

; Get the URL passed by the custom protocol handler
url := A_Args.Length > 0 ? A_Args[1] : ""
if (!url)
    ExitApp

; Strip protocol prefix
params := StrReplace(url, "fleetviber://send?", "")

; Parse phone and text from query string
phone   := ""
message := ""

for pair in StrSplit(params, "&") {
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

; Give Viber time to load the chat
Sleep 2200
WinActivate "ahk_exe Viber.exe"
WinWaitActive "ahk_exe Viber.exe", , 5

; Click the message input area (bottom-center of Viber window)
WinGetPos &wx, &wy, &ww, &wh, "ahk_exe Viber.exe"
clickX := wx + (ww // 2)
clickY := wy + wh - 45
Click clickX, clickY
Sleep 400

; Paste and send
Send "^v"
Sleep 350
Send "{Enter}"

ExitApp

; ── URL decode helper ─────────────────────────────────────────
URLDecode(str) {
    str := StrReplace(str, "+", " ")
    Loop {
        if !RegExMatch(str, "i)%[0-9a-f]{2}", &hex)
            break
        str := StrReplace(str, hex[], Chr("0x" . SubStr(hex[], 2)))
    }
    return str
}
