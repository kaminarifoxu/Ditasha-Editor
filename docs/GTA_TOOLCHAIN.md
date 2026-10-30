# Separate GTA builders (v1.49 preview)

Open **ModDropV / AddonWeaponsBuilder** from Home or Asset workshop. Each workspace connects the original Windows tools to DITASHA.

| Tool                | Package               | In DITASHA                                                                                                     | Original desktop window                                   |
| ------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| ModDropV            | 2.0.1 Windows x64 ZIP | Build add-on vehicle, ped, prop and MP clothing DLCs using `mdvctl.exe`; logs, cancellation and output folders | Full mod installation/library and other upstream features |
| AddonWeaponsBuilder | 2.0.0 Windows x64 ZIP | Real `awbctl.exe` scan, naming plan and weapon DLC build; name/model/price and Legacy/Enhanced options         | Full upstream UI                                          |

## Setup

Open either builder from its own menu. Use **Pasang ZIP** to import the original pinned Windows package. AddonWeaponsBuilder also offers **Unduh resmi**. Windows `tar.exe` extracts verified archives; native binaries are not redistributed.

Each page retains its own input settings, log and output. TRIUM has been removed from the application.

## Build

1. Extract a mod into a source folder and select that folder.
2. Select the action. For weapons, use Analisis and Rencana nama before Build. ModDropV vehicle builds require a base vehicle, for example `adder`; ped base is optional. Clothing supports a female fallback for unprefixed inputs.
3. Choose an output parent outside the source folder. Every build creates a separate `DITASHA-...` output folder and writes a result report.
4. Inspect live logs, open the output folder or open models plus YTD in the existing DITASHA 3D viewer.

Outputs follow the upstream GTA V DLC layout. These exports are not automatically converted into FiveM resources. The DITASHA 3D reader currently targets Legacy resources; Enhanced output can be built but needs a compatible external viewer.

The embedded build workflow does not pass game installation flags or edit the user's GTA installation. Actual game installation and mod management are available in the original ModDropV/AddonWeaponsBuilder windows. Source folders and package archives are retained. A failed/cancelled build can leave a partial output folder with a failure report; it is not reported as a successful DLC.

## Implementation and validation

The renderer can request fixed operations only. Executable paths are resolved by the main process from verified managed installs. Commands use argument arrays with `shell:false`; source/output folders come from native folder dialogs. Processes have timeouts and cancellation, and logs are bounded. Imports stage and verify a package before replacing a working install.
