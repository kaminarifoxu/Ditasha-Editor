# File Manager & asset sorting

Open **File Manager** from the sidebar or homepage in the desktop app, then choose a source folder.

1. Browse all subfolders, or turn off **Semua subfolder** to navigate individual folders. Search matches filenames and relative paths, including descendants of the active folder.
2. Filter **Gambar**, **Pakaian**, **Rambut**, **Kendaraan**, or another category. Click a file for its size, path, proposed destination, and a PNG/JPG/WebP/GIF/BMP preview where available.
3. Use **Buka di editor** for supported textures/images, **Buka preview 3D** for YDD/YDR/YFT, or open RPF/OIV/ZIP in GTA V Explorer. One recognized companion YTD is loaded with a model. **Lihat lokasi file** selects the source in the operating system's file manager.
4. Click **Sorting aset**. The plan includes every file matching the active folder, subfolder option, search, and category, including files on other pages. Review the file count and destination paths; the first 100 are shown as examples.
5. Click **Pilih output & salin**, then choose a destination outside the source folder. The app creates a fresh `DITASHA-Sorted-*` directory and copies files sequentially. **Buka hasil sorting** opens it after completion.

## Output and classification

- Images are grouped by extension, such as `Gambar/PNG`.
- Recognized GTA component names group clothing and hair by gender, collection, slot, and drawable index. Texture variants such as `jbib_diff_003_a_uni.ytd` stay with `jbib_003_u.ydd`.
- YFT vehicle models, `_hi` variants, and same-folder matching YTD/YBN files share a vehicle group.
- Ambiguous YDD/YDR models and unpaired textures remain in reviewable categories. Identification uses filenames, not mesh inspection; check uncertain assignments before using the assets.
- Source-relative hierarchy is retained inside each category/group to keep duplicate filenames separate. Filenames are not renamed. Metadata and scripts are retained under **Lainnya**.

Sorting organizes files; it does not generate a new YMT, rewrite metadata, rename GTA drawable indices, or build a ready-to-ensure FiveM resource. Use Clothing Pack or the relevant workshop to prepare a resource.

## Limits and recovery

Scanning reads metadata rather than loading every file. Up to 100,000 directory entries are indexed; the UI shows 100 entries per page. Large files are copied as streams. Internal previews retain the existing 64 MB-per-file limit and resource-decoder memory limits.

Source files remain untouched. Output folders are unique; existing files are not overwritten. Symlinks and unreadable entries are skipped. Files changed after scanning are rejected with a report entry; refresh the source and retry.

**Batalkan proses** stops scanning or copying. Completed copies remain in the output, and a cancelled copy operation writes `ditasha-sort-report.json` with its completed/failed entries and cancellation status. A normal completion also writes this report. If some files fail, review the report before treating the copy as complete.

## Files navigation and Windows app

The internal browser now has folder tabs (up to 10 within the current source), back/forward, clickable paths, quick categories, and list/grid layouts. Choose an ordering before paging; reverse it with the arrow button. Grid thumbnails are bounded to 40 small images per page to avoid retaining full-size source images. The folder tree shows up to 200 child folders; the paginated list still provides access to the rest. Opening a different source or refreshing its index resets folder tabs.

**Buka di Files** sends the current indexed folder to an installed Files Community application in its own Windows window. Stable, preview, and development protocol handlers are detected in that order. If unavailable, use **Dapatkan Files**, install it from the official page, then click **Buka di Files** again. DITASHA does not install Files or make it the system default automatically.

Upstream references reviewed: [Files](https://github.com/files-community/Files), [WinUI project](https://github.com/files-community/Files/blob/main/src/Files.App/Files.App.csproj), [protocol registration](https://github.com/files-community/Files/blob/main/src/Files.App/Package.appxmanifest), [protocol command parsing](https://github.com/files-community/Files/blob/main/src/Files.App/Program.cs), [directory arguments](https://github.com/files-community/Files/blob/main/src/Files.App/Utils/CommandLine/CommandLineParser.cs). This integration calls the published protocol; no upstream application source, logo or executable is copied into DITASHA.
