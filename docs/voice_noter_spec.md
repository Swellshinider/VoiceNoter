# VoiceNoter Product Specification Prompt

Use this document as a master prompt/specification for designing and implementing **VoiceNoter**, a full-featured cross-platform desktop application.

VoiceNoter is a desktop app for **Linux, Windows, and macOS** that lets users store, manage, transcribe, organize, search, and chat with their audio and video knowledge archive. The product is local-first and privacy-oriented. It works fully offline for file storage, media management, transcription, indexing, and note browsing. The only internet-dependent feature is optional AI access through a user-provided API key.

The selected GUI stack is:

```text
Electron
React
TypeScript
Vite
Tailwind CSS
shadcn/ui
Node.js backend layer
SQLite local database
FFmpeg for media processing
Local Whisper-compatible transcription
OpenAI-compatible AI provider abstraction
Markdown files as a first-class output format
```

---

## 1. Product Vision

VoiceNoter is a local-first desktop knowledge system built around audio and video.

Users should be able to import lectures, meetings, interviews, voice memos, podcasts, screen recordings, courses, calls, and personal recordings, then convert them into structured Markdown notes. The app should automatically transcribe media, summarize content, extract tasks, detect topics, organize notes into categories, and allow users to ask questions about their archive through an AI chat interface.

The product should feel closer to an **Obsidian-like knowledge base for audio and video** than a simple transcription utility.

Also the videos and audios must be "linked" to the markdown notes.

The core value proposition:

> Turn scattered audio and video files into a private, searchable, AI-assisted Markdown knowledge base.

---

## 2. Product Principles

### 2.1 Local-first by default

VoiceNoter must work offline for:

- importing files
- storing media
- managing notes
- playing audio/video
- transcribing locally
- generating basic transcripts
- searching local notes
- browsing categories and tags
- editing Markdown files

The app must not require user login for local usage.

### 2.2 User-owned data

The user owns all data. Notes must be stored as real `.md` files in a user-selected local library folder.

The app should not trap the user's content inside an opaque database.

SQLite is used for metadata, indexes, search, job states, and app internals, but Markdown files remain portable and readable outside VoiceNoter.

### 2.3 Explicit AI boundary

VoiceNoter may use external AI APIs only when the user configures an API key and enables AI-powered features.

The app must make clear:

- what is processed locally
- what may be sent to an AI provider
- which provider is being used
- whether raw media, transcripts, summaries, or selected chunks are sent
- whether the action is manual or automatic

Default behavior should avoid sending raw media to the cloud.

### 2.4 Markdown-native

Markdown is not an export format only. It is a primary storage and editing format.

Every processed media item should be able to produce a `.md` note containing metadata, summary, transcript, timestamps, tags, action items, references, and AI-generated sections.

### 2.5 AI-assisted, not AI-dependent

The app should remain useful without AI API access. Local transcription, local search, manual organization, and Markdown management should continue working offline.

AI features should enhance the product, not become a hard dependency.

---

## 3. Target Platforms

VoiceNoter must support:

```text
Windows 10+
Windows 11
macOS Apple Silicon
macOS Intel, where practical
Modern Linux distributions (Arch, Debian, Ubuntu etc)
```

Linux packaging targets should eventually include:

```text
AppImage
.deb
.rpm
```

Windows packaging should include:

```text
.exe installer
```

macOS packaging should include:

```text
.dmg
signed app bundle
notarization support
```

---

## 4. Target Users

### 4.1 Primary users

- software engineers
- researchers
- students
- consultants
- founders
- content creators
- journalists
- coaches
- therapists, with extra privacy caution
- product managers
- teachers
- people who record voice notes frequently

### 4.2 Main use cases

- transcribe meetings into Markdown notes
- organize course recordings
- summarize interviews
- turn voice memos into structured thoughts
- search through a personal archive of recordings
- ask AI questions across transcripts
- extract tasks from calls
- convert videos into readable study notes
- maintain a private local knowledge base

---

## 5. Core Product Concept

Each imported audio or video file becomes a **VoiceNoter Item**.

A VoiceNoter Item contains:

- original media file reference
- optional copied media file inside the library
- extracted or normalized audio
- transcript
- timestamped segments
- speaker information, if available
- generated Markdown note
- summary
- category
- tags
- topics
- action items
- entities
- embeddings, if enabled
- processing history
- AI interaction history, if enabled

---

## 6. Main Features

## 6.1 Media Import

The app must support importing:

```text
.mp3
.wav
.m4a
.flac
.ogg
.aac
.mp4
.mov
.mkv
.webm
.avi
```

Import methods:

- drag and drop files
- file picker
- folder import
- watch folder
- clipboard file paste
- system share integration, where available
- direct recording inside the app

Import options:

- copy files into VoiceNoter library
- reference files in original location
- extract audio from video
- normalize audio
- detect language automatically
- choose transcription model
- choose local or cloud transcription
- process immediately or add to queue

The app should preserve the original file unless the user explicitly deletes it.

---

## 6.2 Recording

VoiceNoter should support recording directly from:

- microphone
- selected system input device
- system audio, where OS permissions allow
- combined microphone and system audio, where practical

Recording features:

- pause/resume
- live timer
- waveform preview
- input device selection
- gain indicator
- automatic save
- crash-safe temporary recording file
- optional auto-transcription after recording
- optional note template selection before recording

Recording output should become a normal VoiceNoter Item.

---

## 6.3 Media Playback

The app should include an integrated audio/video player.

Playback features:

- play/pause
- seek
- playback speed
- volume
- timestamp navigation
- jump to transcript segment
- keyboard shortcuts
- mini-player mode
- waveform view for audio
- video preview for video files
- segment highlighting during playback

Transcript and media playback should stay synchronized.

---

## 6.4 Local Transcription

VoiceNoter should support local transcription by default.

Recommended engine:

```text
whisper.cpp or another Whisper-compatible local runtime
```

Local transcription features:

- model selection
- language auto-detection
- manual language selection
- timestamped segments
- progress reporting
- cancellation
- retry
- batch processing
- CPU mode
- GPU acceleration where available
- model download manager, optional
- local model path configuration

Supported local model sizes may include:

```text
tiny
base
small
medium
large
large-v3 or compatible future models
```

The app should make tradeoffs visible:

- speed
- accuracy
- disk usage
- memory usage
- recommended hardware

---

## 6.5 Optional Cloud Transcription

Cloud transcription should be optional and disabled by default.

Cloud transcription may be useful for:

- better accuracy
- difficult audio
- diarization
- longer files
- users with weak local hardware

Cloud transcription must require explicit provider configuration.

The app should support provider abstraction so future providers can be added.

Potential providers:

```text
OpenAI
Deepgram
AssemblyAI
Gladia
Local HTTP-compatible transcription server
Custom endpoint
```

The user must be able to decide whether raw media can be sent externally.

---

## 6.6 Markdown Note Generation

Each processed item should generate a Markdown file.

Default Markdown structure:

```md
---
id: "voice-note-id"
title: "Generated or user-defined title"
created_at: "2026-06-02T12:00:00-03:00"
source_file: "meeting.mp4"
duration: "00:42:18"
type: "video"
language: "en"
category: "Work"
tags:
  - planning
  - roadmap
  - backend
transcription_engine: "local-whisper"
ai_provider: "openai-compatible"
---

# Title

## Summary

A concise summary of the content.

## Key Points

- Important point 1
- Important point 2
- Important point 3

## Action Items

- [ ] Task 1
- [ ] Task 2

## Questions Raised

- Question 1
- Question 2

## Decisions

- Decision 1
- Decision 2

## Topics

- Topic 1
- Topic 2

## Transcript

### 00:00:00

Transcript segment text.

### 00:01:24

Transcript segment text.
```

Users should be able to customize Markdown templates.

Template variables:

```text
{{title}}
{{date}}
{{duration}}
{{source_file}}
{{summary}}
{{key_points}}
{{action_items}}
{{transcript}}
{{category}}
{{tags}}
{{language}}
{{speakers}}
{{topics}}
```

---

## 6.7 Markdown Editor

The app should include a Markdown editor with:

- raw Markdown editing
- preview mode
- split editor/preview mode
- syntax highlighting
- frontmatter editor
- local autosave
- undo/redo
- headings outline
- internal links
- backlinks, optional
- note templates
- export actions

Recommended editor options:

```text
CodeMirror 6
Milkdown
TipTap with Markdown support
```

For VoiceNoter, CodeMirror 6 is likely the safest choice for precise Markdown handling.

---

## 6.8 Categories and Tags

VoiceNoter should support both manual and AI-assisted organization.

Organization concepts:

- categories
- tags
- topics
- collections
- favorites
- archived notes
- smart views
- saved searches

Categories are broad groupings, such as:

```text
Work
Personal
Study
Meetings
Ideas
Interviews
Courses
Research
Health
Finance
Legal
```

Tags are flexible labels.

Topics can be automatically inferred from content.

The user must be able to override all AI-generated categories and tags.

---

## 6.9 AI Organization

When AI is enabled, the app should be able to analyze transcripts and generate:

- title
- short summary
- detailed summary
- category
- tags
- topics
- action items
- decisions
- questions
- entities
- follow-up items
- sentiment, optional
- meeting type, optional

The app should support three modes:

```text
Manual AI
Ask before running AI actions.

Semi-automatic AI
Run AI after transcription, but show pending suggestions.

Automatic AI
Run AI after transcription and apply results automatically.
```

Automatic mode should be opt-in.

---

## 6.10 Search

VoiceNoter should include high-quality local search.

Search modes:

- title search
- transcript search
- Markdown body search
- tag search
- category search
- date search
- file type search
- speaker search, if available
- full-text search
- semantic search, if embeddings are enabled

Recommended implementation:

```text
SQLite FTS5 for lexical full-text search
Vector store or SQLite vector extension for semantic search
```

Search result features:

- highlighted matches
- jump to timestamp
- filter by type
- filter by date range
- filter by category
- filter by tag
- filter by duration
- sort by relevance
- sort by date
- saved searches

---

## 6.11 AI Chat

VoiceNoter should include an AI chat interface.

Chat modes:

```text
Chat with current note
Chat with selected notes
Chat with category
Chat with all notes
Chat with search results
```

The chat should use retrieval-augmented generation.

Basic flow:

```text
User asks a question
↓
App searches local index
↓
App selects relevant chunks
↓
App sends only selected chunks to configured AI provider
↓
AI answers with citations to local notes and timestamps
```

The chat must cite sources.

Citation format examples:

```text
[Project Planning Call.md, 00:12:31]
[Interview with Ana.md, Summary]
[Course Module 3.md, Transcript 00:44:10]
```

The chat UI should show:

- user message
- assistant answer
- cited notes
- cited timestamps
- ability to open cited note
- ability to jump to media timestamp
- token/cost estimate, optional
- context used, optional

The app should support multiple chat scopes.

---

## 6.12 AI Provider Settings

VoiceNoter should not hard-code one AI vendor.

Support an OpenAI-compatible provider abstraction.

Provider settings:

- provider name
- base URL
- API key
- model
- embedding model
- transcription model, if applicable
- max tokens
- temperature
- request timeout
- proxy settings
- privacy mode

Initial providers:

```text
OpenAI-compatible endpoint
OpenAI
OpenRouter
Anthropic, through adapter
Ollama, local option
LM Studio, local option
Custom endpoint
```

API keys should be stored securely using OS-native credential storage where possible.

Potential library:

```text
keytar
```

---

## 6.13 Embeddings and Semantic Search

Embeddings should be optional.

Embedding modes:

```text
Disabled
Local embeddings
Cloud embeddings
```

Local embeddings are preferable for privacy.

The app should chunk transcripts and notes into searchable units.

Chunk metadata:

- item ID
- note path
- start timestamp
- end timestamp
- speaker
- text
- token count
- embedding model
- created_at

Chunking strategy:

- transcript segments grouped into coherent chunks
- approximate token limit per chunk
- preserve timestamps
- avoid splitting mid-topic where possible
- include note metadata in retrieval

---

## 6.14 Library Management

The user should choose a VoiceNoter Library folder.

The library should contain:

```text
VoiceNoter Library/
  media/
    original/
    extracted/
    recordings/
  notes/
  models/
  indexes/
  exports/
  temp/
  voicenoter.db
  settings.json
```

The app should support:

- moving library location
- opening library folder
- repairing library
- reindexing library
- relinking missing files
- cleaning temporary files
- backing up metadata
- exporting notes
- importing existing Markdown notes

---

## 6.15 File Storage Modes

When importing media, the user can choose:

```text
Copy into library
Move into library
Keep original location and reference it
```

The app should track missing referenced files and provide a relink workflow.

---

## 6.16 Job Queue

Long-running work should happen through a local job queue.

Job types:

- import file
- extract audio
- normalize audio
- transcribe
- generate Markdown
- summarize
- categorize
- embed
- index
- export
- delete cleanup
- model download

Job features:

- visible queue
- progress status
- pause/resume where possible
- cancel
- retry
- error log
- background execution
- notifications
- concurrency control

Job states:

```text
pending
running
paused
completed
failed
cancelled
```

---

## 6.17 Privacy and Security

VoiceNoter must have a clear privacy model.

Privacy controls:

- disable all cloud AI
- ask before sending transcript text
- ask before sending raw media
- show estimated data sent
- redact sensitive terms, optional
- local-only mode
- clear AI chat history
- clear embeddings
- delete all derived files
- secure API key storage

The app should include a privacy dashboard showing:

- local library path
- AI provider enabled or disabled
- cloud transcription enabled or disabled
- cloud embeddings enabled or disabled
- last AI requests, optional
- data categories that may leave the device

---

## 6.18 Settings

Settings sections:

### General

- library path
- theme
- language
- startup behavior
- default import behavior

### Transcription

- local transcription engine path
- default model
- language detection
- CPU/GPU settings
- diarization options, if available
- output format preferences

### AI

- provider
- API key
- model
- embedding model
- default chat scope
- automatic AI behavior
- privacy prompts

### Markdown

- default template
- filename format
- frontmatter style
- transcript timestamp format
- note folder structure

### Media

- FFmpeg path
- copy/move/reference behavior
- audio normalization
- temporary file cleanup

### Search

- index status
- reindex button
- embeddings enabled/disabled
- semantic search settings

### Shortcuts

- global shortcuts
- recording shortcut
- search shortcut
- command palette shortcut

---

## 6.19 UI Layout

Recommended layout:

```text
┌─────────────────────────────────────────────────────────────┐
│ Top Bar: Search | Import | Record | Command Palette          │
├──────────────┬──────────────────────┬───────────────────────┤
│ Sidebar      │ Item List             │ Main Detail Panel      │
│              │                       │                       │
│ Inbox        │ Search results        │ Markdown note          │
│ All Notes    │ Recent notes          │ Transcript             │
│ Recordings   │ Processing queue      │ Media player           │
│ Categories   │                       │ AI chat                │
│ Tags         │                       │                       │
│ Smart Views  │                       │                       │
│ Settings     │                       │                       │
└──────────────┴──────────────────────┴───────────────────────┘
```

Primary views:

- Inbox
- All Notes
- Item Detail
- Search
- Chat
- Processing Queue
- Recording
- Settings
- Model Manager
- Privacy Dashboard

The UI should support resizable panels.

---

## 6.20 Command Palette

The app should include a command palette.

Example commands:

```text
Import file
Import folder
Start recording
Stop recording
Search notes
Chat with current note
Chat with all notes
Open library folder
Reindex library
Transcribe selected item
Regenerate summary
Export note
Copy Markdown
Open settings
Toggle theme
```

Recommended shortcut:

```text
Ctrl+K / Cmd+K
```

---

## 6.21 Keyboard Shortcuts

Suggested shortcuts:

```text
Ctrl/Cmd + K      Open command palette
Ctrl/Cmd + O      Import file
Ctrl/Cmd + F      Search
Ctrl/Cmd + N      New text note
Ctrl/Cmd + R      Start recording
Space             Play/pause media when focused
J                 Back 10 seconds
L                 Forward 10 seconds
Ctrl/Cmd + S      Save note
Ctrl/Cmd + ,      Settings
```

---

## 6.22 Notifications

Use local desktop notifications for:

- transcription completed
- transcription failed
- import completed
- recording saved
- export completed
- model download completed
- long job failed

Notifications should be configurable.

---

## 6.23 Export

Export formats:

```text
Markdown
Plain text
JSON
CSV
PDF, optional
SRT
VTT
```

Export scopes:

- current note
- selected notes
- category
- tag
- entire library

Export should preserve timestamps where relevant.

---

## 6.24 Import Existing Notes

VoiceNoter should support importing existing Markdown notes.

For imported Markdown notes:

- parse frontmatter
- index body text
- detect tags
- optionally create embeddings
- optionally link to media file if frontmatter contains a source path

This allows migration from Obsidian, Logseq, or filesystem-based notes.

---

## 6.25 Integrations

Potential integrations:

```text
Obsidian vault compatibility
Local folder sync tools
Raycast / Alfred deep links
System share menu
Calendar import, optional
Zoom/Meet/Teams recordings folder watcher
YouTube URL import, optional and legally cautious
```

Obsidian compatibility should be prioritized by using normal Markdown files, wiki-style links optionally, and YAML frontmatter.

---

## 6.26 Deep Links

The app should support internal links such as:

```text
voicenoter://note/{id}
voicenoter://note/{id}?t=123
voicenoter://search?q=roadmap
```

These links can be used inside Markdown notes, citations, and external tools.

---

## 6.27 Data Model

SQLite schema should include at least the following conceptual tables.

### items

```sql
id TEXT PRIMARY KEY,
title TEXT,
source_type TEXT,
original_path TEXT,
library_media_path TEXT,
note_path TEXT,
duration_seconds INTEGER,
language TEXT,
status TEXT,
created_at TEXT,
updated_at TEXT,
imported_at TEXT
```

### transcripts

```sql
id TEXT PRIMARY KEY,
item_id TEXT,
engine TEXT,
model TEXT,
language TEXT,
raw_text TEXT,
segments_json TEXT,
speakers_json TEXT,
created_at TEXT
```

### notes

```sql
id TEXT PRIMARY KEY,
item_id TEXT,
path TEXT,
title TEXT,
summary TEXT,
frontmatter_json TEXT,
content_hash TEXT,
created_at TEXT,
updated_at TEXT
```

### categories

```sql
id TEXT PRIMARY KEY,
name TEXT,
description TEXT,
created_at TEXT
```

### tags

```sql
id TEXT PRIMARY KEY,
name TEXT,
created_at TEXT
```

### item_tags

```sql
item_id TEXT,
tag_id TEXT
```

### chunks

```sql
id TEXT PRIMARY KEY,
item_id TEXT,
note_id TEXT,
text TEXT,
start_seconds INTEGER,
end_seconds INTEGER,
speaker TEXT,
chunk_index INTEGER,
token_count INTEGER
```

### embeddings

```sql
id TEXT PRIMARY KEY,
chunk_id TEXT,
provider TEXT,
model TEXT,
vector BLOB,
created_at TEXT
```

### jobs

```sql
id TEXT PRIMARY KEY,
type TEXT,
status TEXT,
payload_json TEXT,
progress REAL,
error_message TEXT,
created_at TEXT,
started_at TEXT,
completed_at TEXT
```

### ai_requests

```sql
id TEXT PRIMARY KEY,
provider TEXT,
model TEXT,
purpose TEXT,
input_summary TEXT,
tokens_in INTEGER,
tokens_out INTEGER,
created_at TEXT
```

---

## 6.28 Electron Architecture

Recommended Electron process structure:

```text
Main Process
- window lifecycle
- native menus
- IPC handlers
- filesystem access
- job orchestration
- secure key storage
- FFmpeg process management
- local transcription process management

Renderer Process
- React UI
- note editor
- media player UI
- chat UI
- settings UI

Preload Script
- secure IPC bridge
- typed API exposed to renderer
```

Do not expose unrestricted Node.js APIs directly to the renderer.

Security settings:

```text
contextIsolation: true
nodeIntegration: false
sandbox: true, where practical
enableRemoteModule: false
```

Use a narrow typed IPC layer.

---

## 6.29 Suggested Project Structure

```text
voicenoter/
  apps/
    desktop/
      electron/
        main/
        preload/
        renderer/
  packages/
    core/
      domain/
      services/
      types/
    database/
      migrations/
      repositories/
    transcription/
      local/
      cloud/
    ai/
      providers/
      prompts/
      retrieval/
    media/
      ffmpeg/
      playback/
    markdown/
      templates/
      parser/
      generator/
    search/
      fts/
      embeddings/
    shared/
      config/
      errors/
      logging/
  resources/
    icons/
    default-templates/
  scripts/
  tests/
```

Simpler structure for a single repo:

```text
src/
  main/
  preload/
  renderer/
  shared/
  core/
  database/
  services/
  workers/
  assets/
```

---

## 6.30 Recommended Libraries

### Desktop

```text
electron
electron-builder
electron-updater
vite
typescript
```

### React UI

```text
react
react-dom
react-router
@tanstack/react-query
zustand
zod
react-hook-form
tailwindcss
shadcn/ui
radix-ui
lucide-react
cmdk
react-resizable-panels
```

### Editor

```text
codemirror
@codemirror/lang-markdown
```

### Database

```text
better-sqlite3
drizzle-orm or kysely
```

### Files and jobs

```text
chokidar
p-queue
execa
fs-extra
```

### Media

```text
ffmpeg-static, optional
ffprobe-static, optional
fluent-ffmpeg, optional
```

Consider bundling FFmpeg carefully because binary licensing and packaging details matter.

### AI

```text
openai SDK, for OpenAI-compatible APIs
zod for structured output validation
```

### Security

```text
keytar
```

### Testing

```text
vitest
playwright
testing-library/react
```

### Logging

```text
electron-log
pino
```

---

## 6.31 AI Prompting System

VoiceNoter should maintain internal prompts for each AI task.

AI tasks:

```text
generate_title
generate_summary
extract_action_items
extract_decisions
extract_questions
categorize_note
suggest_tags
generate_markdown_note
answer_chat_question
```

AI responses should use structured JSON where possible.

Example categorization output:

```json
{
  "title": "Backend Roadmap Planning",
  "category": "Work",
  "tags": ["backend", "roadmap", "architecture"],
  "topics": ["API design", "database migration", "deployment"],
  "confidence": 0.87
}
```

The app must validate AI output before applying it.

---

## 6.32 Chat Retrieval Requirements

The chat system should:

- retrieve relevant chunks locally
- rank chunks by relevance
- include source note metadata
- include timestamps
- limit context size
- avoid sending the entire library
- cite sources in answers
- refuse unsupported claims when no relevant notes are found
- allow user to inspect retrieved context

A good answer should say when the archive does not contain enough evidence.

---

## 6.33 Error Handling

Important error cases:

- unsupported file format
- FFmpeg missing
- transcription model missing
- insufficient disk space
- insufficient memory
- API key invalid
- AI provider timeout
- file moved or deleted
- corrupted SQLite database
- malformed Markdown frontmatter
- cancelled job
- OS permission denied
- microphone access denied

Errors should be user-readable and actionable.

---

## 6.34 Performance Requirements

The app should handle:

- thousands of notes
- hundreds of hours of transcripts
- large video files
- long-running background transcription
- search across large transcript archives
- editing Markdown without lag
- resumable job processing after app restart

Use lazy loading and virtualization for large lists.

---

## 6.35 Accessibility

The UI should support:

- keyboard navigation
- visible focus states
- screen reader labels
- sufficient color contrast
- scalable font sizes
- captions/transcripts as first-class media companions

---

## 6.36 Theming

Support:

```text
Light mode
Dark mode
System mode
```

Optional later:

```text
Custom accent color
Compact mode
Large text mode
```

---

## 6.37 Auto-update

Desktop builds should eventually support auto-update.

Use:

```text
electron-updater
```

Auto-update should be configurable and transparent.

---

## 6.38 Licensing and Compliance Considerations

The project must evaluate licenses for:

- Electron
- FFmpeg distribution
- Whisper runtime
- bundled transcription models
- UI libraries
- icons
- codecs
- AI provider terms

FFmpeg packaging requires careful review depending on distribution method and enabled codecs.

---

## 6.39 Non-goals

VoiceNoter should not initially try to be:

- a cloud SaaS notes platform
- a team collaboration suite
- a real-time meeting bot
- a calendar system
- a task manager replacement
- a general video editor
- a podcast production suite

These may become integrations, but they should not define the product.

---

## 6.40 Full Product Roadmap Concepts

Although this is not an MVP specification, the full product can include advanced capabilities over time.

Potential advanced features:

- speaker diarization
- speaker naming
- local speaker profiles
- automatic folder watcher
- smart collections
- topic clustering
- timeline visualization
- note graph
- backlinks
- Obsidian vault sync
- encrypted library
- local LLM support
- local embeddings
- meeting template presets
- podcast episode templates
- interview analysis templates
- research mode
- batch operations
- media deduplication
- cross-note synthesis
- custom AI workflows
- plugin system
- command automation
- global recording shortcut
- OCR for videos/slides, optional
- screenshot extraction from video, optional

---

## 7. Desired User Experience

A typical user flow:

```text
User opens VoiceNoter
↓
User drags a video file into the app
↓
VoiceNoter imports the file
↓
VoiceNoter extracts audio locally
↓
VoiceNoter transcribes locally
↓
VoiceNoter creates a Markdown note
↓
AI, if enabled, suggests title, summary, category, tags, and action items
↓
User reviews or edits the note
↓
The note appears in the local library
↓
User later asks: "What did we decide about the backend migration?"
↓
VoiceNoter searches local notes
↓
VoiceNoter sends selected chunks to AI
↓
AI answers with citations and timestamps
↓
User clicks a citation and jumps to the exact moment in the original recording
```

This is the core product loop.

---

## 8. Implementation Quality Bar

The implementation should prioritize:

- data portability
- privacy clarity
- reliable local processing
- robust error handling
- clear background job visibility
- high-quality search
- responsive UI
- maintainable architecture
- typed boundaries between renderer and main process
- explicit separation between local and cloud behavior

Avoid building a thin wrapper around cloud AI. The durable value is the local knowledge system.

---

## 9. Build Instruction Prompt for an AI Coding Assistant

Use the following prompt to guide implementation:

```text
You are helping build VoiceNoter, a full-featured cross-platform desktop app using Electron, React, TypeScript, SQLite, FFmpeg, local Whisper-compatible transcription, and optional AI API providers.

VoiceNoter is local-first. Audio files, video files, transcripts, Markdown notes, indexes, and metadata must be stored locally. The app must work offline except for optional AI features configured by the user through their own API key.

Do not design this as an MVP. Design the architecture as a scalable full product while implementing features incrementally.

Primary goals:
1. Import and manage audio/video files.
2. Extract and normalize audio using FFmpeg.
3. Transcribe locally using a Whisper-compatible engine.
4. Generate Markdown notes with YAML frontmatter.
5. Store user-readable Markdown files in a local library folder.
6. Store metadata, indexes, jobs, and relationships in SQLite.
7. Provide full-text search and optional semantic search.
8. Provide AI-assisted title, summary, categorization, tags, and action item extraction.
9. Provide AI chat over current note, selected notes, categories, or all notes using retrieval-augmented generation.
10. Keep the cloud AI boundary explicit and user-controlled.

Architecture requirements:
- Use secure Electron defaults.
- Keep Node.js access out of the renderer.
- Use typed IPC through preload.
- Use React and TypeScript in the renderer.
- Use SQLite for app metadata.
- Use Markdown files as first-class local content.
- Use a job queue for long-running tasks.
- Use structured services for media, transcription, AI, Markdown, search, and storage.
- Use provider abstractions for AI and transcription.
- Keep privacy and data portability central.

When implementing, prefer clear modular code over shortcuts.
Use TypeScript types and runtime validation where data crosses boundaries.
Write tests for core services.
Expose user-readable errors for failed media, transcription, AI, and file operations.
```

---

## 10. Open Product Decisions

These decisions should be answered before detailed implementation:

1. Should VoiceNoter copy imported media into its library by default, or reference original files by default?
2. Should local transcription models be bundled, downloaded by the app, or manually configured by the user?
3. Should AI-generated summaries be automatically written to Markdown, or first shown as suggestions?
4. Should chat history be stored by default?
5. Should the app support encrypted libraries?
6. Should semantic search use local embeddings by default?
7. Should VoiceNoter optimize for Obsidian compatibility from the beginning?
8. Should there be a plugin system?
9. Should cloud transcription be included in the first complete product design, or left as a later provider?
10. Should users be able to create normal text notes not linked to media?

---

## 11. Suggested Default Decisions

Unless changed, use these defaults:

```text
Copy imported media into library by default.
Allow reference mode as an advanced option.
Do not bundle large transcription models initially.
Offer a model manager for local model downloads.
Write basic transcript Markdown automatically.
Show AI-generated organization as reviewable suggestions by default.
Store chat history locally, with an option to disable.
Do not enable cloud AI automatically.
Use SQLite FTS5 by default.
Make semantic search optional.
Design Markdown to be Obsidian-compatible where practical.
Support normal text notes eventually, but keep media notes as the core.
```

---

## 12. Product Positioning

Potential positioning statement:

> VoiceNoter is a private desktop knowledge base that turns audio and video into organized Markdown notes, searchable transcripts, and AI-assisted insights.

Alternative positioning:

> The local-first AI notebook for your recordings.

Alternative positioning:

> Obsidian for audio and video, with local transcription and optional AI chat.

---

## 13. Success Criteria

VoiceNoter succeeds if users can:

- trust that their media library remains local
- transcribe recordings without uploading them
- find information inside old audio/video files
- ask questions across their archive
- export or inspect all notes as Markdown
- avoid vendor lock-in
- understand exactly when external AI is used
- manage large personal archives reliably

The product should make audio and video as searchable and useful as written notes.
