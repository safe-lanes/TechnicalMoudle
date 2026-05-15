import { type Direction, _ModuleSupport } from 'ag-charts-community';
import type { AnnotationsCreateStateMachineContext } from '../annotationsSuperTypes';
import type { AnnotationStateEvents } from '../states/stateTypes';
import { type CrossLineProperties } from './crossLineProperties';
import type { CrossLineScene } from './crossLineScene';
declare const StateMachine: typeof _ModuleSupport.StateMachine;
interface CrossLineStateMachineContext extends Omit<AnnotationsCreateStateMachineContext, 'create'> {
    create: (datum: CrossLineProperties) => void;
}
export declare class CrossLineStateMachine extends StateMachine<'start' | 'waiting-first-render', Pick<AnnotationStateEvents, 'click' | 'drag' | 'cancel' | 'render' | 'reset'>> {
    debug: import("packages/ag-charts-community/dist/types/src/util/debug").DebugLogger;
    protected node?: CrossLineScene;
    constructor(direction: Direction, ctx: CrossLineStateMachineContext);
}
export {};
