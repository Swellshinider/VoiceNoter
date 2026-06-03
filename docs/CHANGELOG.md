# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),

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
- Fix `rebuild-electron.sh`: check for Electron binary before use, fail fast with clear error
- Fix `rebuild-electron.sh`: verify Electron can load `better-sqlite3` before skipping cached rebuilds
