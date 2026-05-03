This document is the authoritative source for 02Engine's changelogs. Everything else gets generated from this list by `node scripts/generate-changelogs.js`.

Prefix notes with "Windows:", "macOS:", or "Linux:" as needed. Do not use **formatting** or [links](https://desktop.turbowarp.org/).

# 1.2.7 (2026-04-26)

GUI:
 - Added automatic crash restore points, plus a crash-debug shortcut: Ctrl + Shift + Alt + Z + 0
 - Improved Backpack stability and fixed actions that could fail in some cases
 - Fixed extension library page layout issues
 - Added draggable minimized buttons for some New UI windows
 - Added collapsible top menu bar support
 - Added optional offscreen sprite rendering skip for better performance in some projects
 - Cleaned up old forum / Git / Flarum-related UI and related leftover content
 - Fixed several storage, styling, and startup prompt issues
 - Added a few small polish and surprise touches

Packager:
 - Updated to v3.1.0
 - Added Precompile scripts into package (experimental)
 - Added optional obfuscation for precompiled JavaScript
 - Added optional Private Scratch global mode
 - Improved runtime startup flow and compiled-project loading behavior
 - Fixed multiple dependency/workflow issues so web builds and local builds stay more consistent

# 1.2.6 (2026-04-19)

New Features:
 - Added a new Background Settings section in Advanced Settings
 - Users can now upload a custom background image and adjust its blur level
 - Backgrounds can be applied either to the blocks workspace or to the New UI desktop area
 - Added localization support for the new background settings
 - Added a collapsible menu bar button for New UI mode, allowing the top menu bar to be hidden or restored

New UI Improvements:
 - Improved editor window behavior in New UI mode
 - Fixed editor windows not updating correctly when switching light/dark themes
 - Fixed cases where newly created editor windows could temporarily show content from the previous target
 - Fixed multi-window editor toolbox sizing issues where the blocks palette could inherit the wrong height from another editor window
 - Improved editor window layout refresh so the blocks area and related UI resize more reliably
 - Removed unnecessary placeholder text when all editor windows are closed
 - Improved window layering so stage, sprite, editor, dialogs, and extension windows appear in the correct order
 - Fixed minimized stage/sprite window restore buttons being partially hidden by the top bar
 - Adjusted default editor window size so it no longer starts fully covering the top menu area

Addon Compatibility Fixes:
 - Fixed several addon UI elements disappearing or duplicating after switching New UI windows or creating new editor windows
 - Improved addon DOM refresh behavior to reduce unnecessary reloads while keeping UI-based addons working
 - Fixed addon toolbar items such as variable/search-related UI disappearing when opening new editor windows
 - Reduced risk of duplicate addon-injected menu items or controls after UI remounts

Blocks Workspace Improvements:
 - Fixed custom background rendering in the blocks workspace so the original grid overlay can remain visible
 - Fixed incorrect background layering where workspace backgrounds could appear under the wrong UI layer
 - Improved New UI workspace background handling so stage and sprite windows are no longer covered incorrectly
 - Fixed cases where the blocks palette did not refresh after adding certain extensions, such as the custom return value extension

Stability and Build Fixes:
 - Fixed build/compile issues in the Bun-based workflow
 - Updated package scripts to use local Node entry points for webpack, Jest, and ESLint, improving compatibility with Bun
 - Restored broken local scratch-vm and scratch-render dependencies
 - Added missing Jest setup and mock files required by the current test configuration
 - Cleaned up unnecessary repeated addon DOM refresh logic
 - Added safer cleanup for draggable window document event listeners to avoid leaked drag/resize handlers

# 1.2.5 (2026-03-29)

 - NewUI now supports multiple editor windows
 - Editor windows can be dragged, resized, closed, fullscreened, and locked
 - When a window is locked, selecting another sprite opens a new editor window; when unlocked, the current window is reused
 - The active editor window shows the full editor, while inactive windows keep sprite info and preview content for easier multi-sprite management
 - The stage window now supports auto-fit resizing, with a dedicated top-bar button
 - The extension library UI has been redesigned for a cleaner workflow, with improved search, filtering, source grouping, and batch import
 - Batch extension import now follows better import rules, and built-in extensions automatically use normal import mode
 - Fixed issues where some addons were duplicated, disappeared, or rendered incorrectly when switching between NewUI and the classic UI
 - Fixed multiple window-related issues, including z-index conflicts, minimized button overlap, drag offset problems, and resize syncing issues
 - Improved performance in several editor/addon update paths by reducing unnecessary live refreshes and repeated updates