// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsView } from "./SettingsView";
import { mockLibraryState, mockModelInfo } from "./test-utils";

describe("SettingsView", () => {
  it("updates the theme setting when the user selects a new theme", async () => {
    const user = userEvent.setup();
    const onUpdateSettings = vi.fn();

    render(
      <SettingsView
        library={mockLibraryState}
        settings={{
          libraryPath: mockLibraryState.path,
          theme: "dark",
          defaultImportBehavior: "copy",
          defaultModelId: null,
          transcriptionLanguage: "auto",
          modelStorageBytes: 0,
          installedModelCount: 0,
        }}
        models={[mockModelInfo]}
        onOpenFolder={vi.fn()}
        onRescan={vi.fn()}
        onReindex={vi.fn()}
        onUpdateSettings={onUpdateSettings}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Theme"), "light");

    expect(onUpdateSettings).toHaveBeenCalledWith({ theme: "light" });
  });
});
