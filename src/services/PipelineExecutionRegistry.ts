export class PipelineExecutionRegistry {
    private static readonly activeRunIds = new Set<string>();

    static start(runId: string): boolean {
        if (this.activeRunIds.has(runId)) return false;
        this.activeRunIds.add(runId);
        return true;
    }

    static finish(runId: string): void {
        this.activeRunIds.delete(runId);
    }

    static isActive(runId: string): boolean {
        return this.activeRunIds.has(runId);
    }
}
