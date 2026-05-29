import { TextualStartEndStateMachine } from '../states/textualStartEndState';
import { CalloutProperties } from './calloutProperties';
import type { CalloutScene } from './calloutScene';
export declare class CalloutStateMachine extends TextualStartEndStateMachine<CalloutProperties, CalloutScene> {
    protected createDatum(): CalloutProperties;
}
