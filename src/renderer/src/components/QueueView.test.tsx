// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueueView } from "./QueueView";
import { mockJob } from "./test-utils";

describe("QueueView", () => {
  it("shows empty state when no jobs", () => {
    render(<QueueView jobs={[]} onRetry={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getAllByText("No jobs yet.")[0]).toBeInTheDocument();
  });

  it("renders job rows with status badges", () => {
    const job = { ...mockJob, status: "running" as const };
    render(<QueueView jobs={[job]} onRetry={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getAllByText("transcribe")[0]).toBeInTheDocument();
    expect(screen.getAllByText("running")[0]).toBeInTheDocument();
  });

  it("shows error details for failed jobs", () => {
    const job = {
      ...mockJob,
      status: "failed" as const,
      error: { title: "Model not found", message: "No transcription model selected.", technicalDetails: "err-404", retryable: true },
    };
    render(<QueueView jobs={[job]} onRetry={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText((content) => content.includes("Model not found"))).toBeInTheDocument();
  });

  it("retry button calls onRetry for failed jobs", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const job = { ...mockJob, status: "failed" as const, error: { title: "fail", message: "fail", retryable: true } };
    render(<QueueView jobs={[job]} onRetry={onRetry} onCancel={vi.fn()} />);
    await user.click(screen.getAllByRole("button", { name: /Retry/ })[0]);
    expect(onRetry).toHaveBeenCalledWith("job-1");
  });

  it("cancel button calls onCancel for running jobs", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const job = { ...mockJob, status: "running" as const };
    render(<QueueView jobs={[job]} onRetry={vi.fn()} onCancel={onCancel} />);
    await user.click(screen.getAllByRole("button", { name: /Cancel/ })[0]);
    expect(onCancel).toHaveBeenCalledWith("job-1");
  });

  it("retry button is disabled for completed jobs", () => {
    const job = { ...mockJob, status: "completed" as const };
    render(<QueueView jobs={[job]} onRetry={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: /Retry/ })[0]).toBeDisabled();
  });
});
