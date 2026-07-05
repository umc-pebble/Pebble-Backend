import { ERROR_CODE, ErrorCodeKey } from '../constants/error-code';

export class AppError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(codeKey: ErrorCodeKey, message: string) {
    super(message);
    this.code = ERROR_CODE[codeKey].code;
    this.status = ERROR_CODE[codeKey].status;
  }
}
