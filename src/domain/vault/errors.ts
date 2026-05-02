export type VaultErrorCode =
  | 'AuthRequired'
  | 'PermissionDenied'
  | 'RateLimited'
  | 'NetworkFailed'
  | 'RemoteChanged'
  | 'DuplicateName'
  | 'NotFound';

export class VaultError extends Error {
  constructor(
    public readonly code: VaultErrorCode,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'VaultError';
  }
}

export function isVaultError(error: unknown, code?: VaultErrorCode): error is VaultError {
  return error instanceof VaultError && (code === undefined || error.code === code);
}
