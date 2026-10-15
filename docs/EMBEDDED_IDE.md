# Integrated IDE in DITASHA

This integration hosts the **Code - OSS server-web workbench inside the DITASHA window** using an isolated Electron WebContentsView. It does not launch the desktop VS Code window or reproduce its UI with Monaco controls. The existing Monaco editor remains available for quick edits and applying text changes to RPF archives.

## Current validation status

The integration requires a separate MIT Code - OSS `reh-web` engine. The regular Microsoft `Code.exe` application is not this engine. Microsoft VS Code Server binaries and Microsoft Marketplace extensions are not redistributed. Windows packaging, terminal, language debugging and extension compatibility must pass a real-engine smoke test before this can ship as a release.

## Build the Windows engine

Use the manual `Build embedded Code - OSS engine` GitHub Actions workflow. It checks out a pinned upstream source revision and builds `vscode-reh-web-win32-x64-min`. Download and extract the resulting artifact, then choose its root from **Code editor → Choose engine**. The root contains `node.exe`, `out/server-main.js`, `product.json`, `extensions`, and the full web workbench. Dependencies must remain together.

The expensive source-engine build runs manually or when a branch commit contains `[build-engine]`. Ordinary studio changes use the separate Windows preview workflow, avoiding a full VS Code source rebuild for every UI adjustment.

**Start IDE** opens the workbench in the same application window. The DITASHA navigation and toolbar remain visible. Switching workspace hides the IDE without terminating its engine or closing project tabs. Quick edits to archive files remain a separate workflow; they are not automatically written back from the IDE into an RPF.

## Capabilities and limits

- The local engine provides project Explorer, file search, tabs, terminal, the extension host, settings, tasks, Git integration and debugger infrastructure.
- Install Git, compilers, language runtimes, language extensions and debug adapters as needed. They are not part of DITASHA itself.
- Code - OSS is not Microsoft's branded VS Code distribution. Microsoft-only services, Settings Sync, Copilot, Remote extensions and Marketplace access are not promised. Compatible VSIX packages can be installed through the workbench. Do not bypass extension licensing restrictions.
- No AI provider or API key is needed for the IDE integration.
- Each engine starts on an OS-assigned loopback port with a random connection token. The IDE view has no DITASHA preload or renderer IPC bridge. Other origins and pop-up windows cannot navigate the DITASHA shell.
- Engine processes stop when DITASHA closes. Save important files before closing; the embedded workbench's before-unload guard is respected.
- IDE buffers and extensions use a separate persistent data directory. Engine selection does not overwrite the original game assets.

Before release, test on Windows: resize and DPI changes; switch between all workspaces; open and save a project; search; terminal input/output and process cleanup; Git diff; install a compatible VSIX; breakpoint debugging with its installed runtime; unsaved-close cancellation; and restore after restart. Passing the application unit tests alone does not establish these capabilities end-to-end.
