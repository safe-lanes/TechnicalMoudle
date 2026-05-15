import { _ModuleSupport } from 'ag-charts-community';
import type { AnnotationsStateMachineContext } from '../annotationsSuperTypes';
import type { TextualStartEndProperties } from '../properties/textualStartEndProperties';
import type { TextualStartEndScene } from '../scenes/textualStartEndScene';
import type { AnnotationStateEvents } from './stateTypes';
declare const StateMachine: typeof _ModuleSupport.StateMachine;
interface TextualStartEndStateMachineContext<Datum extends TextualStartEndProperties> extends Omit<AnnotationsStateMachineContext, 'create' | 'delete' | 'datum' | 'node' | 'showTextInput'> {
    create: (datum: Datum) => void;
    delete: () => void;
    showTextInput: () => void;
    deselect: () => void;
    showAnnotationOptions: () => void;
}
export declare abstract class TextualStartEndStateMachine<Datum extends TextualStartEndProperties, Node extends TextualStartEndScene<Datum>> extends StateMachine<'start' | 'waiting-first-render' | 'edit' | 'end', Pick<AnnotationStateEvents, 'click' | 'drag' | 'dragEnd' | 'dragStart' | 'resize' | 'cancel' | 'hover' | 'textInput' | 'keyDown' | 'updateTextInputBBox' | 'color' | 'fontSize' | 'render' | 'reset'>> {
    debug: import("packages/ag-charts-community/dist/types/src/util/debug").DebugLogger;
    protected datum?: Datum;
    protected node?: Node;
    constructor(ctx: TextualStartEndStateMachineContext<Datum>);
    protected abstract createDatum(): Datum;
}
export {};
