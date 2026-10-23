# YMT & FiveM Tools

Open **Asset workshop → YMT & FiveM Tools**, or its card on Home. These tools run locally with no service, login or embedded website.

## Clothing collection metadata

1. Choose **File**, **Folder**, or **Dari Clothing pack** to use the current pack's original asset bytes. YDD, YTD and YLD are accepted. Alternatively paste one filename/path per line for metadata-only exports.
2. Enter a unique lowercase collection name. A freemode prefix determines gender first, followed by a `male`/`female` folder and then the fallback selector.
3. Review the source/output mapping. Each component/prop needs contiguous drawable indices beginning at 000 and contiguous YTD letters beginning with a. Duplicated collection/slot/variant inputs are rejected; split different source collections before combining. Source files are not changed.
4. Inspect or save individual documents, **Metadata ZIP**, or **Resource ZIP + XML**. The resource ZIP is available only with actual source data and is capped at 128 MB including metadata. It contains normalized stream filenames, the original asset bytes, both genders' applicable YMT XML, shop apparel metadata, fxmanifest, a mapping report and instructions.
5. **Convert each `.ymt.xml` to binary `.ymt` with CodeWalker RPF Explorer Import XML or a compatible YMTEditor XML import, then put that binary in `stream/`.** Changing the extension is not a conversion. Only after conversion should you enable the resource and test the drawable/texture indices on a development server.

Metadata covers 12 freemode components, 11 prop anchor types, `_u`/`_r` texture races, alternatives and matching YLD ownership. Component blocks reference actual `availComp` positions; texture totals use the native byte field. Generation rejects more than 128 drawables per slot, more than 255 total prop entries and invalid source paths. Undo restores the previous file list. Switching workspaces retains it; unsaved collection work participates in the application's close protection. Canceling a save leaves that work unsaved.

This is filename-driven metadata generation. It does not inspect the geometry/skeleton, modify internal drawable or texture names, renumber indices, produce binary YMT, import existing YMT metadata, generate custom-ped definitions, create creature metadata for heels/hair squash, or patch engine limits. XML is checked for structure in the renderer; binary conversion and FiveM behavior require external validation. Existing in-game materials and variants still need their original compatible YDD/YTD contents. Use the existing Clothing pack workflow for 3D preview and optimization; its original replacement/existing-add-on exports are unchanged.

## Hash calculator

Enter a model, texture, collection or another string to get joaat in unsigned, signed and hexadecimal form. Matching is case insensitive. Values can be selected and copied normally.

## Manifest generator

Enter client, server, shared script paths and dependencies, one per line. Script globs and `@resource/path` references are supported. An optional local NUI page adds `ui_page` and that page to `files`; add its JS/CSS/images to the saved manifest as needed. This is a script resource scaffold, not an automatic vehicle/weapon/map metadata detector. Clothing metadata exports have their own generated manifest.

## Format references

- Requested workflow: https://www.fivemad.com/tools/ymt-creator
- Primary field definitions: https://github.com/dexyfex/CodeWalker/blob/master/CodeWalker.Core/GameFiles/MetaTypes/MetaTypes.cs
- Primary XML reader: https://github.com/dexyfex/CodeWalker/blob/master/CodeWalker.Core/GameFiles/MetaTypes/XmlMeta.cs
- Original clothing streaming tutorial: https://forum.cfx.re/t/how-to-stream-clothes-and-props-as-addons-for-mp-freemode-models/3345474
- Collection natives: https://docs.fivem.net/docs/scripting-manual/using-new-game-features/collection-based-natives/

The implementation is authored for DITASHA; no fivemad application code or assets are bundled.
