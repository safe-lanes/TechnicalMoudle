import { _ModuleSupport } from 'ag-charts-community';
import type { AnnotationsCreateStateMachineContext } from '../annotationsSuperTypes';
import type { AnnotationStateEvents } from '../states/stateTypes';
import { FibonacciRetracementTrendBasedProperties } from './fibonacciRetracementTrendBasedProperties';
import type { FibonacciRetracementTrendBasedScene } from './fibonacciRetracementTrendBasedScene';
declare const StateMachine: typeof _ModuleSupport.StateMachine;
interface FibonacciRetracementTrendBasedStateMachineContext extends Omit<AnnotationsCreateStateMachineContext, 'create'> {
    create: (datum: FibonacciRetracementTrendBasedProperties) => void;
}
export declare class FibonacciRetracementTrendBasedStateMachine extends StateMachine<'start' | 'waiting-first-render' | 'end' | 'endRetracement', Pick<AnnotationStateEvents, 'click' | 'hover' | 'keyDown' | 'keyUp' | 'drag' | 'dragEnd' | 'reset' | 'cancel' | 'render'>> {
    debug: import("packages/ag-charts-community/dist/types/src/util/debug").DebugLogger;
    protected datum?: FibonacciRetracementTrendBasedProperties;
    protected node?: FibonacciRetracementTrendBasedScene;
    protected snapping: boolean;
    constructor(ctx: FibonacciRetracementTrendBasedStateMachineContext);
    createDatum(): FibonacciRetracementTrendBasedProperties;
}
export {};
