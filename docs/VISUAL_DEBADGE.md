# Visual debadge · 1.24 preview

Open **Vehicle Workshop → Debadge**. A YFT already open in the workshop is loaded automatically, together with its decoded textures. Alternatively choose **Open YFT + YTD** or drop the files onto the debadge panel. This operation reads and edits GTA V Legacy RSC7 YFT directly. It needs no Blender installation, Sollumz import or AI service.

1. Load one base YFT and its optional matching `_hi.yft` together. Add the matching YTD dictionaries if the preview reports missing textures.
2. Choose the file, drawable and detail level to inspect. Drag to orbit, scroll to zoom and right-drag to pan.
3. Click a badge or select a component from the list. Red marks the entire selected connected component, including UV seams within that native geometry. Material names do not need to contain “badge” or “emblem”. Use the focus button to inspect a small component closely.
4. Use **Preview removed**, undo/redo and clear selection to review the result.
5. Save the debadged YFT. A single output keeps the original filename; multiple edited YFTs are exported together in a ZIP under `stream/`. Apply these files to a copy of the existing vehicle resource, retaining its textures and metadata.

Selection is by connected geometry within each material/geometry buffer. A badge modeled into the body cannot be separated by this tool: clicking it highlights that larger connected component. Cancel that selection if the body is highlighted. This is not texture erasing or arbitrary painted-region mesh cutting.

The exporter collapses only selected visual triangles to zero-area triangles. It does not rebuild the YFT through Blender. Original vertex, shader, texture, skeleton, physics/collision, layout and pointer data are retained. Triangle counts in native buffers stay unchanged; the selected triangles stop rendering. This avoids the Sollumz import step that failed in the reported screenshot.

Review other LODs and `_hi.yft` explicitly. The tool never guesses which distant geometry is the same badge. Shared geometry references reflect the same edit everywhere they reuse that native buffer. Partial edits to ambiguous shared buffers and unreadable fragment geometry are refused. Removing every visible component of a detail level is blocked.

Source files remain untouched by processing; save the result to a separate location. A canceled Save keeps the selection unsaved. Invalid imports preserve the previous vehicle and its selection. Closing DITASHA warns about unexported selections.

The reported screenshot ends before the final exception line. This change removes that failing importer from debadge, but does not claim to repair every Sollumz import failure in rigging or strobo operations. Those operations now offer expandable error details and **Save error report**. To reproduce a specific native import problem, retain its `report.json`, complete traceback and the source YFT/YTD pair.
