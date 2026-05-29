import { TextualPointStateMachine } from '../states/textualPointState';
import { CommentProperties } from './commentProperties';
import type { CommentScene } from './commentScene';
export declare class CommentStateMachine extends TextualPointStateMachine<CommentProperties, CommentScene> {
    protected createDatum(): CommentProperties;
}
