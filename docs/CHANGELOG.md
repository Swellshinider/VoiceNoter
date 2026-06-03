# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),

## [Unreleased] - 03-06-2026

### Added

- Add `rebuild-electron.sh` with stamp-based caching to skip redundant `better-sqlite3` rebuilds

### Changed

- Convert `install-whisper.cpp.mjs` to bash (`install-whisper.sh`)
- Update `package.json` scripts to use new bash scripts
