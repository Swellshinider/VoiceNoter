# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),

## [Unreleased] - 05-06-2026

### Added

- Add a dark theme default with a settings selector for dark, light, and system themes
- Replace the Inbox tab with a dashboard that shows file counts, storage usage, transcription trends, queue health, and recent pipeline items

### Fixed

- Remove the raw Markdown note editor from the item detail view and keep transcript playback focused on the player panel
- Fix transcript segment seeking and active highlighting while media is playing
- Fix media playback freeze by serving local media with byte-range-aware streaming instead of a one-shot file fetch

## [Unreleased] - 04-06-2026

### Fixed

- Fix transcription language auto-detection by passing `-l auto` to whisper.cpp when no manual language is selected
- Fix whisper timestamp parsing for comma-formatted timestamps and offset metadata
- Fix item detail refresh after transcription, Markdown generation, or indexing completes
- Fix media playback by streaming library media through a main-process custom protocol instead of renderer-built `file://` URLs
- Fix Markdown regeneration to update existing note rows and files instead of duplicating notes during reprocessing

## [Unreleased] - 03-06-2026

### Added

- Add `rebuild-electron.sh` with stamp-based caching to skip redundant `better-sqlite3` rebuilds
- Add an option on the setup screen to open the last successfully opened library
- Add a project README with development setup guidance
- Add the MIT license

### Changed

- Convert `install-whisper.cpp.mjs` to bash (`install-whisper.sh`)
- Update `package.json` scripts to use new bash scripts

### Fixed

- Fix whisper.cpp build: enable `WHISPER_BUILD_EXAMPLES` to build `whisper-cli` binary
- Fix processing queue: jobs stuck in pending forever after app restart or unhandled error
- Fix processing queue: resolve downstream item jobs when an upstream job fails or is cancelled
- Fix transcription retry: prevent whisper.cpp stdout backpressure from leaving jobs running at 0% and enable progress reporting
- Fix `rebuild-electron.sh`: check for Electron binary before use, fail fast with clear error
- Fix `rebuild-electron.sh`: verify Electron can load `better-sqlite3` before skipping cached rebuilds
