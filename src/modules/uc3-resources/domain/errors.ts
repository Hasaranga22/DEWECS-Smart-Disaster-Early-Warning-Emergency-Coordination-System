import { BusinessRuleError, ValidationError } from "@/shared/infra/errors";

export class OverCapacityError extends BusinessRuleError {
  constructor(
    message: string,
    public readonly alternatives: Array<{ id: string; name: string; availableCapacity: number }> = []
  ) {
    super(message);
  }
}

export class InsufficientStockError extends BusinessRuleError {
  constructor(message: string = "Insufficient stock available for distribution") {
    super(message);
  }
}

export class TeamNotAvailableError extends BusinessRuleError {
  constructor(message: string = "Selected rescue team is not currently AVAILABLE") {
    super(message);
  }
}

export class InvalidTransitionError extends BusinessRuleError {
  constructor(from: string, to: string) {
    super(`Invalid team state transition from ${from} to ${to}`);
  }
}

export class CrossOrganizationConfirmationRequiredError extends BusinessRuleError {
  constructor(message: string = "Dispatching a non-government team requires partner organization confirmation") {
    super(message);
  }
}

export class CrossDistrictConfirmationRequiredError extends BusinessRuleError {
  constructor(message: string = "Dispatching a team outside home district requires cross-district confirmation") {
    super(message);
  }
}

export class InvalidQuantityError extends ValidationError {
  constructor(message: string = "Quantity or occupancy count must be a positive integer") {
    super(message);
  }
}
