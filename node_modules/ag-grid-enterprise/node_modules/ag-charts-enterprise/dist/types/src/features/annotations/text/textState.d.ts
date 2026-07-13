import { TextualPointStateMachine } from '../states/textualPointState';
import { TextProperties } from './textProperties';
import type { TextScene } from './textScene';
export declare class TextStateMachine extends TextualPointStateMachine<TextProperties, TextScene> {
    protected createDatum(): TextProperties;
}
