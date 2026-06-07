import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import { openVoiceNoterDatabase } from "./database";
import { ImportService } from "./import-service";
import { LibraryService } from "./library";
import { QueueService } from "./queue";
import { TranscriptionService } from "./transcription";

describe("TranscriptionService", () => {
  test("drains whisper stdout and enables progress reporting", async () => {
    const sourceRoot = await mkdtemp(join(tmpdir(), "voicenoter-source-"));
    const libraryRoot = await mkdtemp(join(tmpdir(), "voicenoter-library-"));
    const mediaPath = join(sourceRoot, "Lecture One.mp3");
    const modelPath = join(libraryRoot, "models", "ggml-base.bin");
    const whisperCliPath = join(sourceRoot, "fake-whisper-cli.cjs");
    const argsPath = join(sourceRoot, "whisper-args.json");
    await writeFile(mediaPath, "fake audio content", "utf8");
    await writeFile(
      whisperCliPath,
      `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.writeFileSync(${JSON.stringify(argsPath)}, JSON.stringify(args));
process.stdout.write("x".repeat(1024 * 1024));
if (!args.includes("-pp")) {
  process.stderr.write("missing -pp\\n");
  process.exitCode = 3;
} else {
  const outputBase = args[args.indexOf("-of") + 1];
  process.stderr.write("whisper_print_progress_callback: progress =  42%\\n");
  fs.writeFileSync(\`\${outputBase}.json\`, JSON.stringify({
    transcription: [{
      offsets: { from: 88000, to: 90500 },
      timestamps: { from: "00:01:28,000", to: "00:01:30,500" },
      text: "Hello world."
    }],
    result: { language: "en" }
  }));
}
`,
      "utf8",
    );
    await chmod(whisperCliPath, 0o755);
    await new LibraryService().initializeLibrary(libraryRoot);
    await writeFile(modelPath, "fake model", "utf8");
    const db = openVoiceNoterDatabase(join(libraryRoot, "voicenoter.db"));
    const previousWhisperCli = process.env.VOICENOTER_WHISPER_CLI;
    process.env.VOICENOTER_WHISPER_CLI = whisperCliPath;
    try {
      const importResult = await new ImportService(libraryRoot, db).importFiles([mediaPath]);
      const itemId = importResult.importedItems[0]!.id;
      db.prepare("UPDATE models SET status = 'installed', local_path = ?, downloaded_at = ?, selected_at = ? WHERE id = 'base'").run(
        modelPath,
        new Date().toISOString(),
        new Date().toISOString(),
      );
      const queue = new QueueService(db);
      const transcribeJob = (await queue.listJobs()).items.find((job) => job.type === "transcribe")!;
      queue.startJob(transcribeJob.id);

      const result = await Promise.race([
        new TranscriptionService(libraryRoot, db, queue).transcribe(transcribeJob.id, itemId, mediaPath),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("transcription timed out")), 500)),
      ]);

      expect(result).toEqual(
        expect.objectContaining({
          itemId,
          model: "base",
          language: "en",
          rawText: "Hello world.",
        }),
      );
      expect(JSON.parse(await readFile(argsPath, "utf8"))).toEqual(expect.arrayContaining(["-l", "auto"]));
      expect(result.segments).toEqual([{ startSeconds: 88, endSeconds: 90.5, text: "Hello world." }]);
      expect((await queue.listJobs()).items.find((job) => job.id === transcribeJob.id)).toEqual(expect.objectContaining({ progress: 1 }));
    } finally {
      if (previousWhisperCli === undefined) {
        delete process.env.VOICENOTER_WHISPER_CLI;
      } else {
        process.env.VOICENOTER_WHISPER_CLI = previousWhisperCli;
      }
      db.close();
    }
  });

  test("passes a manually selected language through to whisper", async () => {
    const sourceRoot = await mkdtemp(join(tmpdir(), "voicenoter-source-"));
    const libraryRoot = await mkdtemp(join(tmpdir(), "voicenoter-library-"));
    const mediaPath = join(sourceRoot, "Lecture One.mp3");
    const modelPath = join(libraryRoot, "models", "ggml-base.bin");
    const whisperCliPath = join(sourceRoot, "fake-whisper-cli.cjs");
    const argsPath = join(sourceRoot, "whisper-args.json");
    await writeFile(mediaPath, "fake audio content", "utf8");
    await writeFile(
      whisperCliPath,
      `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.writeFileSync(${JSON.stringify(argsPath)}, JSON.stringify(args));
const outputBase = args[args.indexOf("-of") + 1];
fs.writeFileSync(\`\${outputBase}.json\`, JSON.stringify({
  transcription: [{ timestamps: { from: "00:00:01.000", to: "00:00:02.500" }, text: "こんにちは。" }],
  result: { language: "ja" }
}));
`,
      "utf8",
    );
    await chmod(whisperCliPath, 0o755);
    await new LibraryService().initializeLibrary(libraryRoot);
    await writeFile(modelPath, "fake model", "utf8");
    const db = openVoiceNoterDatabase(join(libraryRoot, "voicenoter.db"));
    const previousWhisperCli = process.env.VOICENOTER_WHISPER_CLI;
    process.env.VOICENOTER_WHISPER_CLI = whisperCliPath;
    try {
      const importResult = await new ImportService(libraryRoot, db).importFiles([mediaPath]);
      const itemId = importResult.importedItems[0]!.id;
      db.prepare("UPDATE models SET status = 'installed', local_path = ?, downloaded_at = ?, selected_at = ? WHERE id = 'base'").run(
        modelPath,
        new Date().toISOString(),
        new Date().toISOString(),
      );
      const queue = new QueueService(db);
      const transcribeJob = (await queue.listJobs()).items.find((job) => job.type === "transcribe")!;
      queue.startJob(transcribeJob.id);

      const result = await new TranscriptionService(libraryRoot, db, queue).transcribe(transcribeJob.id, itemId, mediaPath, "ja");

      expect(result.language).toBe("ja");
      expect(JSON.parse(await readFile(argsPath, "utf8"))).toEqual(expect.arrayContaining(["-l", "ja"]));
    } finally {
      if (previousWhisperCli === undefined) {
        delete process.env.VOICENOTER_WHISPER_CLI;
      } else {
        process.env.VOICENOTER_WHISPER_CLI = previousWhisperCli;
      }
      db.close();
    }
  });
});
