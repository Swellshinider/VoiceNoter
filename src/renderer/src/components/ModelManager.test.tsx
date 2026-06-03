// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModelManager } from "./ModelManager";
import { mockModelInfo } from "./test-utils";

describe("ModelManager", () => {
  it("shows all three models with their status", () => {
    const models = [
      { ...mockModelInfo, id: "tiny" as const, name: "tiny", status: "installed" as const, localPath: "/path/tiny.bin", selected: true },
      { ...mockModelInfo, id: "base" as const, name: "base", status: "available" as const },
      { ...mockModelInfo, id: "small" as const, name: "small", status: "available" as const },
    ];
    render(<ModelManager models={models} onDownload={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getAllByText("tiny")[0]).toBeInTheDocument();
    expect(screen.getAllByText("base")[0]).toBeInTheDocument();
    expect(screen.getAllByText("small")[0]).toBeInTheDocument();
  });

  it("shows default badge on selected model", () => {
    const model = { ...mockModelInfo, status: "installed" as const, localPath: "/path/base.bin", selected: true };
    render(<ModelManager models={[model]} onDownload={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getAllByText("default")[0]).toBeInTheDocument();
  });

  it("download button triggers onDownload", async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();
    const model = { ...mockModelInfo, status: "available" as const };
    render(<ModelManager models={[model]} onDownload={onDownload} onDelete={vi.fn()} onSelect={vi.fn()} />);
    await user.click(screen.getAllByRole("button", { name: /Download/ })[0]);
    expect(onDownload).toHaveBeenCalledWith("base");
  });

  it("select button is disabled when model is not installed", () => {
    const model = { ...mockModelInfo, status: "available" as const };
    render(<ModelManager models={[model]} onDownload={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: /Select/ })[0]).toBeDisabled();
  });

  it("delete button triggers onDelete for installed models", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const model = { ...mockModelInfo, status: "installed" as const, localPath: "/path/base.bin" };
    render(<ModelManager models={[model]} onDownload={vi.fn()} onDelete={onDelete} onSelect={vi.fn()} />);
    await user.click(screen.getAllByRole("button", { name: /Delete/ })[0]);
    expect(onDelete).toHaveBeenCalledWith("base");
  });
});
