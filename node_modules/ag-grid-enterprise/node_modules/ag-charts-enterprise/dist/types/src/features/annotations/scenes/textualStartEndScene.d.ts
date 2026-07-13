import { type AgAnnotationHandleStyles, _ModuleSupport } from 'ag-charts-community';
import type { AnnotationContext } from '../annotationTypes';
import type { TextualStartEndProperties } from '../properties/textualStartEndProperties';
import { StartEndScene } from './startEndScene';
export declare abstract class TextualStartEndScene<Datum extends TextualStartEndProperties> extends StartEndScene<Datum> {
    activeHandle?: 'start' | 'end';
    protected readonly label: _ModuleSupport.Text<any>;
    protected anchor: _ModuleSupport.FloatingToolbarAnchor;
    protected textInputBBox?: _ModuleSupport.BBox;
    setTextInputBBox(bbox?: _ModuleSupport.BBox): void;
    update(datum: Datum, context: AnnotationContext): void;
    containsPoint(x: number, y: number): boolean;
    getNodeAtCoords(x: number, y: number): string | undefined;
    protected getTextBBox(datum: Datum, coords: _ModuleSupport.Vec4): _ModuleSupport.BBox;
    protected updateLabel(datum: Datum, bbox: _ModuleSupport.BBox, coords: _ModuleSupport.Vec4): void;
    protected updateShape(_datum: Datum, _textBBox: _ModuleSupport.BBox, _coords: _ModuleSupport.Vec4): void;
    protected getLabelCoords(_datum: Datum, _bbox: _ModuleSupport.BBox, coords: _ModuleSupport.Vec4): _ModuleSupport.Vec2;
    protected getHandleStyles(datum: Datum, handle?: 'start' | 'end'): AgAnnotationHandleStyles;
}
