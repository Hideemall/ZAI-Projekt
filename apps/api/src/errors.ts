export interface FieldError {
  field: string;
  message: string;
}

export class HttpProblem extends Error {
  constructor(
    readonly status: number,
    readonly title: string,
    readonly detail?: string,
    readonly errors?: FieldError[],
  ) {
    super(title);
  }
}