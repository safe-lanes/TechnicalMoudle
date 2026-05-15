import { _ModuleSupport } from 'ag-charts-community';
import type { AnnotationContext } from '../annotationTypes';
import type { AnnotationProperties, AnnotationsStateMachineContext } from '../annotationsSuperTypes';
import type { AnnotationStateEvents } from './stateTypes';
declare const StateMachine: typeof _ModuleSupport.StateMachine;
export declare class DragStateMachine<Datum extends AnnotationProperties, Node extends {
    dragStart: (datum: Datum, offset: _ModuleSupport.Vec2, context: AnnotationContext) => void;
    drag: (datum: Datum, offset: _ModuleSupport.Vec2, context: AnnotationContext, snapping: boolean) => void;
    stopDragging: () => void;
}> extends StateMachine<'idle' | 'dragging', Pick<AnnotationStateEvents, 'keyDown' | 'keyUp' | 'drag' | 'dragStart' | 'dragEnd'>> {
    debug: import("packages/ag-charts-community/dist/types/src/util/debug").DebugLogger;
    protected hasMoved: boolean;
    protected dragStart?: _ModuleSupport.Vec2;
    protected snapping: boolean;
    protected datum?: Datum;
    protected node?: Node;
    private offset?;
    constructor(ctx: AnnotationsStateMachineContext);
}
export {};
