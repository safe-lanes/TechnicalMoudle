import type { _ModuleSupport } from 'ag-charts-community';
import { AnnotationType } from '../annotationTypes';
import { TextualPointScene } from '../scenes/textualPointScene';
import type { TextProperties } from './textProperties';
export declare class TextScene extends TextualPointScene<TextProperties> {
    static is(value: unknown): value is TextScene;
    type: AnnotationType;
    constructor();
    protected getHandleCoords(_datum: TextProperties, point: _ModuleSupport.Vec2): _ModuleSupport.Vec2;
}
