' Refreshes stats.html without a console window, then opens it as a Chrome app window.
Set sh = CreateObject("WScript.Shell")
dir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.Run """C:\Program Files\nodejs\node.exe"" """ & dir & "\build.js"" --no-open", 0, True
sh.Run """C:\Program Files\Google\Chrome\Application\chrome.exe"" --app=""file:///" & Replace(dir, "\", "/") & "/stats.html"" --window-size=960,900", 1, False
