import { _ModuleSupport } from 'ag-charts-community';
import type { AnnotationContext } from '../annotationTypes';
import type { TextualPointProperties } from '../properties/textualPointProperties';
import { PointScene } from './pointScene';
export declare abstract class TextualPointScene<Datum extends TextualPointProperties> extends PointScene<Datum> {
    activeHandle?: string;
    protected readonly label: _ModuleSupport.Text<any>;
    protected anchor: _ModuleSupport.FloatingToolbarAnchor;
    private textInputBBox?;
    setTextInputBBox(bbox?: _ModuleSupport.BBox): void;
    update(datum: Datum, context: AnnotationContext): void;
    copy(datum: Datum, copiedDatum: Datum, context: AnnotationContext): Datum;
    containsPoint(x: number, y: number): boolean;
    getNodeAtCoords(x: number, y: number): string | undefined;
    protected getTextBBox(datum: Datum, coords: _ModuleSupport.Vec2, _context: AnnotationContext): _ModuleSupport.BBox;
    protected updateLabel(datum: Datum, bbox: _ModuleSupport.BBox): void;
    protected updateShape(_datum: Datum, _bbox: _ModuleSupport.BBox): void;
    protected updateAnchor(_datum: Datum, bbox: _ModuleSupport.BBox, context: AnnotationContext): {
        x: number;
        y: number;
        position: "right" | "above" | "above-left" | "below" | undefined;
    };
    protected getLabelCoords(_datum: Datum, bbox: _ModuleSupport.BBox): _ModuleSupport.Vec2;
    protected getTextBaseline(datum: Datum): CanvasTextBaseline;
    protected getHandleCoords(_datum: Datum, _coords: _ModuleSupport.Vec2, bbox: _ModuleSupport.BBox): _ModuleSupport.Vec2;
    protected getHandleStyles(datum: Datum): {
        fill: string | undefined;
        stroke: string | undefined;
        strokeOpacity: number | undefined;
        strokeWidth: number | undefined;
    };
}
