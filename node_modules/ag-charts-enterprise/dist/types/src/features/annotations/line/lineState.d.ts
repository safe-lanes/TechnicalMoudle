import { _ModuleSupport } from 'ag-charts-community';
import type { AnnotationsCreateStateMachineContext } from '../annotationsSuperTypes';
import type { AnnotationStateEvents } from '../states/stateTypes';
import { ArrowProperties, LineProperties, LineTypeProperties } from './lineProperties';
import type { LineScene } from './lineScene';
declare const StateMachine: typeof _ModuleSupport.StateMachine;
interface LineStateMachineContext<Datum extends LineTypeProperties> extends Omit<AnnotationsCreateStateMachineContext, 'create'> {
    create: (datum: Datum) => void;
}
export declare abstract class LineTypeStateMachine<Datum extends LineTypeProperties> extends StateMachine<'start' | 'waiting-first-render' | 'end', Pick<AnnotationStateEvents, 'click' | 'hover' | 'keyDown' | 'keyUp' | 'drag' | 'dragEnd' | 'reset' | 'cancel' | 'render'>> {
    debug: import("packages/ag-charts-community/dist/types/src/util/debug").DebugLogger;
    protected datum?: Datum;
    protected node?: LineScene;
    protected snapping: boolean;
    constructor(ctx: LineStateMachineContext<Datum>);
    abstract createDatum(): Datum;
}
export declare class ArrowStateMachine extends LineTypeStateMachine<ArrowProperties> {
    createDatum(): ArrowProperties;
}
export declare class LineStateMachine extends LineTypeStateMachine<LineProperties> {
    createDatum(): LineProperties;
}
export {};
