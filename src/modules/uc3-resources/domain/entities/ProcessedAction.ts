export interface ProcessedActionProps {
  actionId: string;
  type: string;
  resultRef?: string;
  processedAt: Date;
}

export class ProcessedAction {
  public readonly actionId: string;
  public readonly type: string;
  public readonly resultRef?: string;
  public readonly processedAt: Date;

  constructor(props: ProcessedActionProps) {
    this.actionId = props.actionId;
    this.type = props.type;
    this.resultRef = props.resultRef;
    this.processedAt = new Date(props.processedAt);
  }
}
