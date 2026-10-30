# Windows Setup and workspace refresh — v1.69

## Install once

Download **DITASHA-Installer-Windows**, extract the ZIP and run **DITASHA-Setup.exe**. Setup installs for the current Windows user, lets you choose the destination and creates desktop/Start Menu shortcuts. It does not delete the existing user-data directory (`GANOMABI Asset Studio`), presets or updater preferences. The portable EXE remains a separate download.

Installed clients select only **DITASHA-Setup.exe** from a newer stable GitHub Release; portable clients keep selecting the portable EXE. Both verify size, SHA-256 and Windows executable headers before allowing installation. Installed updates wait for the editor to quit, then launch NSIS silently with restart enabled. Unsaved-work and creative-engine close checks still run first. A failed installer reports its exit code and attempts to reopen the existing application. Unlike the portable replacement helper, the Setup path does not promise a rollback after an unsuccessful application startup.

The application checks for updates and displays progress inside its update dialog. From v1.72, both installed and portable clients can reconstruct updates using external v2 blockmaps and HTTP byte ranges. The first upgrade from an older updater still downloads the complete package. Later updates reuse the matching NSIS cached installer (or running portable EXE) only after its published SHA-256 matches. Missing or invalid bases/maps, unsupported ranges, limited savings and hash failures automatically fall back to a complete verified download. Pause/resume and engine-only updates are not implemented. See DIFFERENTIAL_UPDATES.md. Preview CI artifacts are not stable Releases and will not automatically be offered by the stable updater. Publishing a matching stable Release with the installer and checksum enables the existing release feed.

## Workspace

- Texture & Model uses a stable three-column workbench. Switching Edit 2D/Edit 3D changes which viewport is central, without leaving the old nested inspector grid or empty rows behind. Texture fitting observes its actual container; model rendering already observes its viewport.
- Native sidebar panels have a minimize/restore rail. Files, Photo Booth, clothing/converter, model viewer, archive tools, file manager and native-build controls use the same affordance. Preferences persist locally. **Settings → Pulihkan panel** restores all panels. This changes panel visibility, not models or document data.
- Inspector groups for model/material, layer and canvas controls can fold independently. Existing details and the fullscreen emote/video minimize buttons remain available.
- Short settings use visible choice buttons: pack type/resolution, stamp type/projection/scope/resolution, scene coordinate space/lighting, theme/density/motion and movie transition/FPS. Large model/texture/emote lists retain their existing selectors. The original select remains the state source for presets and engine logic.
- Actions with similar icons have explicit labels: Undo/Redo 2D, replace image, add layer, fit model, preview photo and Photoshoot. Focus rings, wrapping labels, scrollable details, consistent spacing and reduced-motion preferences are shared across the native shell. Third-party creative-engine canvases are not replaced by these controls.

## Design references

Reviewed with the GitHub connector:

- [Awesome Design Skills](https://github.com/bergside/awesome-design-skills): surveyed its style registry; avoided mixing unrelated visual systems into a production editor.
- [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/.claude/skills/ui-ux-pro-max/SKILL.md): applied its guidance on hierarchy, progressive disclosure, resilient labels, visible focus, consistent controls and reduced motion to the existing Electron/vanilla-JS stack.
- [Oil UI](https://github.com/oil-oil/oil-ui): applied content-first workspace decisions and screenshot verification. No package installation or Pro purchase is required.
- [AI Design Skills](https://github.com/Owl-Listener/ai-design-skills): reviewed; mainly about agentic interactions, so no AI feature or orchestration dependency is introduced for this UI refresh.

The implementation is original project code; these repositories are design references, not runtime dependencies.

## Verification

Unit checks cover installed/portable payload isolation, verified Setup download and helper quoting/wait behavior. Windows CI additionally installs Setup into a path containing spaces, launches the packaged workspace, reinstalls it and checks user-data preservation. Layout checks import real native-format fixtures and switch 2D/3D at 1500, 1100 and 1000 pixel window widths, checking viewport bounds, texture fitting, panel minimization and stamp-button behavior. Existing editor, Photo Booth, creative-engine and native Blender checks remain in the pipeline.
