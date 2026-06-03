import type { UserFacingError } from "./types";

export class VoiceNoterError extends Error {
  readonly userFacingError: UserFacingError;

  constructor(error: UserFacingError) {
    super(error.message);
    this.name = "VoiceNoterError";
    this.userFacingError = error;
  }
}

export function userError(
  title: string,
  message: string,
  options: { technicalDetails?: string; retryable?: boolean } = {},
): UserFacingError {
  return {
    title,
    message,
    technicalDetails: options.technicalDetails,
    retryable: options.retryable ?? false,
  };
}

export function toUserFacingError(error: unknown, fallbackTitle = "Operation failed"): UserFacingError {
  if (error instanceof VoiceNoterError) {
    return error.userFacingError;
  }

  if (error && typeof error === "object" && "title" in error && "message" in error) {
    const maybeError = error as UserFacingError;
    return {
      title: maybeError.title,
      message: maybeError.message,
      technicalDetails: maybeError.technicalDetails,
      retryable: maybeError.retryable,
    };
  }

  return userError(fallbackTitle, "VoiceNoter could not complete the operation.", {
    technicalDetails: error instanceof Error ? error.stack ?? error.message : String(error),
    retryable: true,
  });
}
