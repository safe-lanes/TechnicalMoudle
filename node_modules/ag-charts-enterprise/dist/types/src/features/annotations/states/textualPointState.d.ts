import { _ModuleSupport } from 'ag-charts-community';
import type { AnnotationsCreateStateMachineContext } from '../annotationsSuperTypes';
import type { TextualPointProperties } from '../properties/textualPointProperties';
import type { TextualPointScene } from '../scenes/textualPointScene';
import type { AnnotationStateEvents } from './stateTypes';
declare const StateMachine: typeof _ModuleSupport.StateMachine;
interface TextualPointStateMachineContext<Datum extends TextualPointProperties> extends Omit<AnnotationsCreateStateMachineContext, 'create'> {
    create: (datum: Datum) => void;
}
export declare abstract class TextualPointStateMachine<Datum extends TextualPointProperties, Node extends TextualPointScene<Datum>> extends StateMachine<'start' | 'waiting-first-render' | 'edit', Pick<AnnotationStateEvents, 'click' | 'dragStart' | 'resize' | 'cancel' | 'keyDown' | 'textInput' | 'updateTextInputBBox' | 'color' | 'fontSize' | 'render' | 'reset'>> {
    debug: import("packages/ag-charts-community/dist/types/src/util/debug").DebugLogger;
    protected datum?: Datum;
    protected node?: Node;
    constructor(ctx: TextualPointStateMachineContext<Datum>);
    protected abstract createDatum(): Datum;
}
export {};
