# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),

## [Unreleased] - 18-06-2026

### Added

- Add a tags workflow with post-import tagging, tag autocomplete plus comma-separated entry, bulk tag assignment/removal, a dedicated `Tag Manager`, and multi-tag filtering across `All Items` and search

### Changed

- Keep `All Items` as the single list surface, run submitted text searches inside it, and preserve active tag filters while moving in and out of the focus page
- Rename `Processing Queue` to `Processing Status` and group queue entries into per-item cards plus a `System Tasks` section
- Remove categories from app behavior and storage, migrate legacy note frontmatter to a preserved legacy comment, and rebuild search/index state without category matches
- Require selecting a transcription model before import, land libraries without one on `Model Manager`, and block drag-drop plus header imports until selection succeeds

## [Unreleased] - 16-06-2026

### Changed

- Add a `pnpm bootstrap` flow so new developers can install dependencies, build whisper.cpp, and prepare Electron in one step
- Rewrite the README development section as a first-run guide with in-app model setup and troubleshooting steps

### Fixed

- Require confirmation before deleting a tag that is still assigned to imported files
- Save transcript corrections explicitly with `Save` / `Cancel`, update the canonical SQLite transcript in place, refresh transcript search, and rewrite only the note `## Transcript` section

## [Unreleased] - 08-06-2026

### Changed

- Refactor the renderer shell into smaller typed helpers so page loading, toast handling, and theme syncing are less repetitive
- Validate IPC payloads in the main process before dispatching to services, and align the settings/model contracts with the real return types

### Fixed

- Remove dead service helpers and centralize background error logging in the main-process services

## [Unreleased] - 07-06-2026

### Changed

- Lazy-load item, queue, and search lists with paged results so startup does not hydrate the full library at once
- Move media copying into background import jobs so large imports keep the UI responsive
- Simplify the setup screen to the app purpose plus `Choose Library` and `Open Last Library`

### Fixed

- Defer dashboard storage calculations until the user is on the dashboard
- Replace sidebar category and tag derivation from loaded items with fast facet counts from the database
- Keep the dashboard overview-only and open recent item clicks in All Items instead of showing the detail panel there

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
