# DITASHA Studio UI

The 1.19.0 redesign adds an animated Home studio to the existing editor. It uses the same local application, parsers and tool actions; Home is a navigation surface, not a second editor.

- Nine cards open the existing workspaces: Texture & Model, texture/model viewers, GTA V Explorer, Vehicle workshop, Converter, Clothing pack, Code editor, and Auto rig ped.
- Search combines with category filters. A no-results state lets users recover without resetting their work.
- Continue returns to the last workspace visited during this session. It does not reopen or persist files.
- Moving between Home and a workspace hides/shows the existing DOM. Open documents, loaded models and unsaved edits remain in memory.
- Opening a file from Home uses the original editor input/importer. No additional upload service is introduced.
- Dark/light theme and compact density continue to use the existing settings.

## Motion vocabulary

| Token                | Duration          | Use                                 |
| -------------------- | ----------------- | ----------------------------------- |
| `--motion-fast`      | 120 ms            | Press/hover feedback                |
| `--motion-normal`    | 200 ms            | Color, border and arrow transitions |
| `--motion-panel`     | 280 ms            | Cards and dialogs entering          |
| Workspace transition | 240 ms            | One visible workspace entering      |
| Card stagger         | 40 ms × at most 2 | Related cards entering together     |

Workspace animations are cancelled when a new navigation or pointer interaction begins. Ambient logo/orbit motion runs only on Home; background tabs pause it. Home includes an animation switch that persists `ditasha.motion`. The OS `prefers-reduced-motion` setting always disables decorative motion, including when it changes while the app is open. File-loading indicators are left to their existing controls.

## Design references requested by the user

- [Owl-Listener/designer-skills — motion system](https://github.com/Owl-Listener/designer-skills/blob/main/design-systems/skills/motion-system/SKILL.md): shared duration/easing tokens, reduced motion, and short choreography.
- [Owl-Listener/designer-skills — animation principles](https://github.com/Owl-Listener/designer-skills/blob/main/interaction-design/skills/animation-principles/SKILL.md): easing, short entrances, bounded staggering and interruptible interactions. These design concepts inform original DITASHA code; no skill installer or agent runtime is bundled.
- [Hacker-Anakin/Chat-GPT-UI-UX-Design](https://github.com/Hacker-Anakin/Chat-GPT-UI-UX-Design): reviewed for responsive/themed interface context. Its chatbot implementation is not imported into the asset editor.
- [BayramAnnakov/chatgpt-app-skill](https://github.com/BayramAnnakov/chatgpt-app-skill): reviewed; its Apps SDK/MCP app architecture is outside this local editor redesign.

Existing Ditasha-Workshop artwork, offline fonts and attributed Flaticon icons remain in use. No new runtime package is required for the redesign.

## Verification

`scripts/studio-ui-checks.cjs` runs in the real renderer before the existing workspace/viewer smoke checks. It exercises filters, search, route buttons, Continue, tab preservation, motion controls and overflow. The browser QA additionally checks light mode, a 900 px viewport and OS reduced motion. Existing native/portable EXE checks stay in the Windows release workflow.
