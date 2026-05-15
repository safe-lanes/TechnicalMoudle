import { _ModuleSupport } from 'ag-charts-community';
import type { AnnotationsCreateStateMachineContext } from '../annotationsSuperTypes';
import type { AnnotationStateEvents } from '../states/stateTypes';
import { DisjointChannelProperties } from './disjointChannelProperties';
import type { DisjointChannelScene } from './disjointChannelScene';
declare const StateMachine: typeof _ModuleSupport.StateMachine;
interface DisjointChannelStateMachineContext extends Omit<AnnotationsCreateStateMachineContext, 'create'> {
    create: (datum: DisjointChannelProperties) => void;
}
export declare class DisjointChannelStateMachine extends StateMachine<'start' | 'waiting-first-render' | 'end' | 'height', Pick<AnnotationStateEvents, 'click' | 'hover' | 'keyDown' | 'keyUp' | 'drag' | 'dragEnd' | 'cancel' | 'reset' | 'render'>> {
    debug: import("packages/ag-charts-community/dist/types/src/util/debug").DebugLogger;
    protected datum?: DisjointChannelProperties;
    protected node?: DisjointChannelScene;
    protected snapping: boolean;
    constructor(ctx: DisjointChannelStateMachineContext);
}
export {};
