import { _ModuleSupport } from 'ag-charts-community';
import type { AnnotationsCreateStateMachineContext } from '../annotationsSuperTypes';
import type { PointProperties } from '../properties/pointProperties';
import type { PointScene } from '../scenes/pointScene';
import type { AnnotationStateEvents } from './stateTypes';
declare const StateMachine: typeof _ModuleSupport.StateMachine;
interface PointStateMachineContext<Datum extends PointProperties> extends Omit<AnnotationsCreateStateMachineContext, 'create'> {
    create: (datum: Datum) => void;
}
export declare abstract class PointStateMachine<Datum extends PointProperties, Node extends PointScene<Datum>> extends StateMachine<'start' | 'waiting-first-render', Pick<AnnotationStateEvents, 'click' | 'drag' | 'cancel' | 'render' | 'reset'>> {
    debug: import("packages/ag-charts-community/dist/types/src/util/debug").DebugLogger;
    protected node?: Node;
    constructor(ctx: PointStateMachineContext<Datum>);
    protected abstract createDatum(): Datum;
}
export {};
