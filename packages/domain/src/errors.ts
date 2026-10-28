/** Base class for programming or invariant errors raised by the domain package. */
export class DomainError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** Raised when checked money arithmetic would leave the safe integer range. */
export class MoneyRangeError extends DomainError {}
