import { TextualPointStateMachine } from '../states/textualPointState';
import { NoteProperties } from './noteProperties';
import type { NoteScene } from './noteScene';
export declare class NoteStateMachine extends TextualPointStateMachine<NoteProperties, NoteScene> {
    protected createDatum(): NoteProperties;
}
