import { _ModuleSupport } from 'ag-charts-community';
import type { AnnotationProperties, AnnotationScene, AnnotationsStateMachineContext } from './annotationsSuperTypes';
import type { AnnotationStateEvents } from './states/stateTypes';
declare const ParallelStateMachine: typeof _ModuleSupport.ParallelStateMachine;
declare enum States {
    Idle = "idle",
    Dragging = "dragging",
    Translating = "translating",
    TextInput = "text-input"
}
/**
 * - AnnotationsStateMachine (runs children in parallel, distributes properties across children)
 *     - SnappingStateMachine (changes `snapping` property with shift key)
 *     - UpdateStateMachine (ensures the active `node` is set after renders)
 *     - AnnotationsMainStateMachine
 *         - Idle (most interactions, with child machine per annotation type for creating annotations)
 *         - Dragging (entered on `dragStart`, dragging interactions with child machine per annotation type)
 *         - TextInput (entered on `click` of active text node, text input interactions)
 */
export declare class AnnotationsStateMachine extends ParallelStateMachine<States, AnnotationStateEvents> {
    private active?;
    protected snapping: boolean;
    protected datum?: AnnotationProperties;
    protected node?: AnnotationScene;
    constructor(ctx: AnnotationsStateMachineContext);
    getActive(): number | undefined;
    isActive(index: number): boolean;
}
export {};
