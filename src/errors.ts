import { GraphQLError } from "graphql";

export class ValidationError extends GraphQLError {
  constructor(message: string) {
    super(message, {
      extensions: {
        code: "VALIDATION_ERROR",
      },
    });
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class NotFoundError extends GraphQLError {
  constructor(message: string) {
    super(message, {
      extensions: {
        code: "NOT_FOUND",
      },
    });
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}
