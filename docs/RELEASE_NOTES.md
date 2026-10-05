DITASHA Editor 1.8.1

- Fix YTD-only hair import: both the original Add Hair input and a new top-level YTD button can apply dictionaries to existing hair. Select the target when multiple hair models are loaded. Invalid YTD retains the previous preview.
- Confirm the new editor workspace has opened after portable replacement, rather than reporting success as soon as the launcher starts. Restore the previous EXE if startup cannot be confirmed.
- Remove the .previous backup after confirmed startup. Successfully started apps also clean leftovers from older updater versions.
- Add tests for standalone hair YTD loading, multiple-hair targeting, startup acknowledgement, legacy backup cleanup and failed-start rollback. Verify portable download/replacement/restart and backup removal on Windows.

Copyright © 2026 Ditasha-Workshop.
