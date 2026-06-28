import { create } from 'zustand';
import type { PipelineProviders, PipelineRun, PipelineStageEvent } from '../types/api';

interface PipelineStore {
    activeRunId?: string;
    isRunning: boolean;
    currentStage: string;
    sseProgress: PipelineStageEvent[];
    latestRun?: PipelineRun;
    providers?: PipelineProviders;
    setActiveRunId: (runId?: string) => void;
    startRun: () => void;
    addProgress: (event: PipelineStageEvent) => void;
    completeRun: (run: PipelineRun) => void;
    failRun: (message: string) => void;
    setProviders: (providers: PipelineProviders) => void;
}

export const usePipelineStore = create<PipelineStore>((set) => ({
    isRunning: false,
    currentStage: 'idle',
    sseProgress: [],
    setActiveRunId: (activeRunId) => set({ activeRunId }),
    startRun: () => set({ isRunning: true, currentStage: 'discovering', sseProgress: [], latestRun: undefined }),
    addProgress: (event) => set((state) => ({
        currentStage: event.stage,
        sseProgress: [...state.sseProgress, event],
    })),
    completeRun: (run) => set({
        activeRunId: run.id,
        isRunning: false,
        currentStage: 'complete',
        latestRun: run,
    }),
    failRun: (message) => set((state) => ({
        isRunning: false,
        currentStage: 'error',
        sseProgress: [...state.sseProgress, { stage: 'error', message }],
    })),
    setProviders: (providers) => set({ providers }),
}));
