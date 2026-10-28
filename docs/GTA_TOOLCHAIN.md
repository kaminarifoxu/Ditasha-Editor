# GTA Toolchain (v1.48 preview)

Open **GTA Toolchain** from Home or Asset workshop. This workspace connects the original Windows tools to DITASHA.

| Tool                       | Package                       | In DITASHA                                                                                                     | Original desktop window                                            |
| -------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| ModDropV                   | 2.0.1 Windows x64 ZIP         | Build add-on vehicle, ped, prop and MP clothing DLCs using `mdvctl.exe`; logs, cancellation and output folders | Full mod installation/library and other upstream features          |
| AddonWeaponsBuilder        | 2.0.0 Windows x64 ZIP         | Real `awbctl.exe` scan, naming plan and weapon DLC build; name/model/price and Legacy/Enhanced options         | Full upstream UI                                                   |
| TRIUM Skeleton Studio Free | 1.0 RAR, or its extracted EXE | Verified installation and desktop launcher                                                                     | Skeleton inspection/comparison, diagnostics, validator and viewers |

TRIUM's native UI is not embedded in Electron. There is no documented CLI in the supplied manual; open models inside its original window. DITASHA does not claim to reproduce TRIUM's private engine.

## Setup

Use **Pasang ZIP/RAR** and select the corresponding package. AddonWeaponsBuilder also has **Unduh resmi**, downloading its pinned GitHub release only when requested. ModDropV and TRIUM use the packages already downloaded by the user; their binaries are not redistributed with DITASHA. Package and executable SHA-256 checks match the supplied versions. Unsupported package versions are rejected.

Windows `tar.exe` extracts the verified archives. If Windows cannot extract the TRIUM RAR, extract it yourself and use **Pasang EXE** with `TRIUM Skeleton Studio Free.exe`. Its fingerprint is verified too. No administrative installation or system-wide runtime setup is performed.

## Build

1. Extract a mod into a source folder and select that folder.
2. Select the engine and action. For weapons, use Analisis and Rencana nama before Build. ModDropV vehicle builds require a base vehicle, for example `adder`; ped base is optional. Clothing supports a female fallback for unprefixed inputs.
3. Choose an output parent outside the source folder. Every build creates a separate `DITASHA-...` output folder and writes a result report.
4. Inspect live logs, open the output folder or open models plus YTD in the existing DITASHA 3D viewer.

Outputs follow the upstream GTA V DLC layout. These exports are not automatically converted into FiveM resources. The DITASHA 3D reader currently targets Legacy resources; Enhanced output can be built but needs a compatible external viewer.

The embedded build workflow does not pass game installation flags or edit the user's GTA installation. Actual game installation and mod management are available in the original ModDropV/AddonWeaponsBuilder windows. Source folders and package archives are retained. A failed/cancelled build can leave a partial output folder with a failure report; it is not reported as a successful DLC.

## Implementation and validation

The renderer can request fixed operations only. Executable paths are resolved by the main process from verified managed installs. Commands use argument arrays with `shell:false`; source/output folders come from native folder dialogs. Processes have timeouts and cancellation, and logs are bounded. Imports stage and verify a package before replacing a working install.

Tests cover argument validation, path isolation, immutable inputs, package mismatch/tampering, cancellation, original-window launch wiring, trusted IPC and responsive UI. The Windows pipeline additionally downloads the official AddonWeaponsBuilder package, runs the real CLI scan/plan/build and reads its produced `dlc.rpf` directory. Real ModDropV builds and TRIUM UI behavior require their local packages and are not claimed by that automated AWB test.

Upstream references: [ModDropV CLI](https://github.com/sruckstar/ModDropV/blob/main/src/Mdv.Cli/Program.cs), [AddonWeaponsBuilder CLI](https://github.com/sruckstar/AddonWeaponsBuilder/blob/main/src/Awb.Cli/Program.cs), [AWB release](https://github.com/sruckstar/AddonWeaponsBuilder/releases/tag/2.0.0), and the supplied TRIUM Free manual. All build logic remains in the respective upstream executable.
