import type { EventEnvelope } from "@penny/core";

export type WorkflowContext = {
  correlationId?: string;
  receiptHandle?: string;
};

export type Workflow = {
  name: string;
  source: string;
  detailType: string;
  schemaVersion: number;
  handle: (envelope: EventEnvelope, ctx: WorkflowContext) => Promise<void>;
};

export function workflowKey(source: string, detailType: string, schemaVersion: number): string {
  return `${source}::${detailType}::${schemaVersion}`;
}
