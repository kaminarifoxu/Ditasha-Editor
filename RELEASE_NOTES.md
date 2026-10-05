DITASHA Editor 1.6.0

- New built-in Archive workspace for GTA V RPF7 archives, OpenIV OIV packages and ZIP files.
- Browse folders, search paths, inspect file sizes, open nested RPF archives and return to their parent.
- Extract individual files or export all files as ZIP. RPF resources receive their RSC7 headers for use in the editor.
- Open supported YTD/YDD/YDR/YFT, DDS, images and GLB assets in Texture & Model. Export editor changes, then replace the file in Archive.
- Add, replace or remove archive files, then save an edited copy as OPEN RPF7, OIV or ZIP. Canceling a save preserves the unsaved warning.
- Inspect OIV package metadata and assembly.xml instructions. Installation scripts are displayed as text and are not executed. Existing assembly.xml is retained; edit manifest references when adding/removing/renaming package content.
- Supports unencrypted OPEN/NONE RPF7 and Stored/Deflate ZIP. AES/NG encryption, encrypted scripts, ZIP64 and password archives are unsupported. Extracted files and rebuilt archives are limited to 128 MB; editor imports and replacements to 64 MB. RPF resource rebuilds must be smaller than 16 MB.
- Nested RPF edits are exported separately; replace the nested RPF in its parent to include those edits. Empty directories are omitted when exporting.
- Independent archive format tests, production-renderer interaction checks and Windows portable download/replace/restart checks included.

This is a native archive tool in DITASHA, not a bundled copy of OpenIV. Format references: OpenIV-Team/OpenIV-PackageFormat v2.2 and CodeWalker RpfFile.cs.

Copyright © 2026 Ditasha-Workshop.
