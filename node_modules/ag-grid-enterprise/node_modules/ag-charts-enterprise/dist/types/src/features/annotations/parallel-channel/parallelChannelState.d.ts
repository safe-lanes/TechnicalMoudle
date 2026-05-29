import { _ModuleSupport } from 'ag-charts-community';
import type { AnnotationsCreateStateMachineContext } from '../annotationsSuperTypes';
import type { AnnotationStateEvents } from '../states/stateTypes';
import { ParallelChannelProperties } from './parallelChannelProperties';
import type { ParallelChannelScene } from './parallelChannelScene';
declare const StateMachine: typeof _ModuleSupport.StateMachine;
interface ParallelChannelStateMachineContext extends Omit<AnnotationsCreateStateMachineContext, 'create'> {
    create: (datum: ParallelChannelProperties) => void;
}
export declare class ParallelChannelStateMachine extends StateMachine<'start' | 'waiting-first-render' | 'end' | 'height', Pick<AnnotationStateEvents, 'click' | 'hover' | 'keyDown' | 'keyUp' | 'drag' | 'dragEnd' | 'cancel' | 'reset' | 'render'>> {
    debug: import("packages/ag-charts-community/dist/types/src/util/debug").DebugLogger;
    protected datum?: ParallelChannelProperties;
    protected node?: ParallelChannelScene;
    protected snapping: boolean;
    constructor(ctx: ParallelChannelStateMachineContext);
}
export {};
