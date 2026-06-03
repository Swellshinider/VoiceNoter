# VoiceNoter

VoiceNoter is a local-first Electron desktop app for turning audio and video files into searchable Markdown notes.

The app is built around a user-selected local library folder. Media, generated notes, local metadata, processing state, and search indexes stay on the user's machine. VoiceNoter does not require an account for local usage.

## Status

VoiceNoter is in early development. Current work is focused on the desktop library workflow: selecting a library, importing supported media, running a local processing queue, transcribing with whisper.cpp, generating Markdown notes, and searching notes/transcripts.

End-user installation methods will be added later.

## Features

- Local library folders with portable Markdown notes
- Audio and video import
- Local SQLite metadata and queue state
- FFmpeg-based media inspection and audio extraction
- Local whisper.cpp-compatible transcription
- Markdown note generation with frontmatter and timestamped transcript sections
- Search over notes and transcripts
- Processing queue with retry, cancel, and failure handling
- Model manager for local transcription models

## Privacy Model

VoiceNoter is local-first by default.

- Media files are processed locally.
- Markdown notes are written to the selected local library.
- SQLite is used for metadata, indexes, jobs, and app internals.
- The V1 implementation does not add cloud AI, telemetry, or external media processing.

If cloud AI features are added later, they should be explicit, user-configured, and documented before release.

## Tech Stack

- Electron
- React
- TypeScript
- Vite and electron-vite
- Tailwind CSS
- better-sqlite3
- FFmpeg and FFprobe
- whisper.cpp
- Vitest

## Development Setup

### Prerequisites

- Node.js compatible with the project dependencies
- `pnpm`
- Bash
- Build tools for native Node modules
- Git

On Linux, native module and whisper.cpp builds may require common compiler tooling such as `make`, `gcc`/`g++`, Python, and CMake.

### Install Dependencies

```bash
pnpm install
```

In this Codex workspace, prefix shell commands with `rtk`:

```bash
rtk pnpm install
```

### Prepare whisper.cpp

VoiceNoter uses a pinned whisper.cpp checkout for local transcription.

```bash
pnpm prepare:whisper
```

In this Codex workspace:

```bash
rtk pnpm prepare:whisper
```

### Run The Desktop App

```bash
pnpm dev
```

In this Codex workspace:

```bash
rtk pnpm dev
```

The dev command rebuilds `better-sqlite3` for Electron before launching the app.

### Test

```bash
pnpm test
```

In this Codex workspace:

```bash
rtk pnpm test
```

The test command rebuilds `better-sqlite3` for the host Node runtime before running Vitest. If you run the app after tests, run:

```bash
pnpm rebuild:electron
```

In this Codex workspace:

```bash
rtk pnpm rebuild:electron
```

### Build

```bash
pnpm build
```

In this Codex workspace:

```bash
rtk pnpm build
```

### Package

```bash
pnpm package
```

This creates a Linux unpacked package directory. Additional end-user installation and distribution methods will be documented later.

## Project Structure

```text
src/main              Electron main process
src/main/ipc          IPC handler registration
src/main/services     Local services for library, queue, import, models, notes, search
src/preload           Typed preload bridge
src/shared            Shared types, validation, IPC channel names, errors
src/renderer/src      React renderer application
docs                  Product specs and changelog
scripts               Build helper scripts
```

## Useful Scripts

```bash
pnpm dev              Rebuild native modules for Electron and launch the app
pnpm test             Rebuild native modules for Node and run Vitest
pnpm build            Type-check and build main, preload, and renderer bundles
pnpm package          Build a Linux unpacked package directory
pnpm prepare:whisper  Clone and build pinned whisper.cpp
```

## Contributing

VoiceNoter is early-stage. Before changing behavior, check [docs/CHANGELOG.md](docs/CHANGELOG.md) and relevant files under `docs/`.

For code changes:

- Keep Electron `contextIsolation: true` and `nodeIntegration: false`.
- Keep renderer code behind the typed preload API.
- Prefer small service classes and shared typed contracts.
- Add Vitest coverage beside the module being changed.
- Run `pnpm test` before handoff.
- Run `pnpm build` after renderer, preload, IPC, or packaging changes.

## License

VoiceNoter is licensed under the [MIT License](LICENSE).
