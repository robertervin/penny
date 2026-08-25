import {
  PermanentWorkflowError,
  type EventEnvelope,
} from "../events/envelope.js";
import type { Logger } from "../logger.js";
import { workflowKey, type Workflow, type WorkflowContext } from "./types.js";

export class WorkflowRouter {
  private readonly byKey = new Map<string, Workflow>();

  constructor(
    workflows: Workflow[],
    private readonly log: Logger,
  ) {
    for (const wf of workflows) {
      const key = workflowKey(wf.source, wf.detailType, wf.schemaVersion);
      if (this.byKey.has(key)) {
        throw new Error(`Duplicate workflow registration: ${key}`);
      }
      this.byKey.set(key, wf);
    }
  }

  resolve(envelope: EventEnvelope): Workflow {
    const key = workflowKey(envelope.source, envelope.detailType, envelope.schemaVersion);
    const wf = this.byKey.get(key);
    if (!wf) {
      this.log.warn(
        { source: envelope.source, detailType: envelope.detailType, schemaVersion: envelope.schemaVersion },
        "workflow.unroutable",
      );
      throw new PermanentWorkflowError(`No workflow for ${key}`);
    }
    return wf;
  }

  async dispatch(envelope: EventEnvelope, ctx: WorkflowContext): Promise<void> {
    const wf = this.resolve(envelope);
    this.log.info(
      {
        workflow: wf.name,
        eventId: envelope.eventId,
        source: envelope.source,
        detailType: envelope.detailType,
        correlationId: ctx.correlationId ?? envelope.correlationId,
      },
      "workflow.dispatch",
    );
    await wf.handle(envelope, {
      ...ctx,
      correlationId: ctx.correlationId ?? envelope.correlationId,
    });
  }
}
