import { _ModuleSupport } from 'ag-charts-community';
import { type AnnotationContext, AnnotationType } from '../annotationTypes';
import { TextualStartEndScene } from '../scenes/textualStartEndScene';
import type { CalloutProperties } from './calloutProperties';
interface CalloutDimensions {
    tailPoint: {
        x: number;
        y: number;
    };
    bodyBounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}
type PathType = 'corner' | 'side' | 'calloutCorner' | 'calloutSide';
export declare class CalloutScene extends TextualStartEndScene<CalloutProperties> {
    static is(value: unknown): value is CalloutScene;
    type: AnnotationType;
    private readonly shape;
    constructor();
    drag(datum: CalloutProperties, target: _ModuleSupport.Vec2, context: AnnotationContext, snapping: boolean): void;
    protected getLabelCoords(datum: CalloutProperties, bbox: _ModuleSupport.BBox, coords: _ModuleSupport.Vec4): _ModuleSupport.Vec2;
    protected getHandleStyles(datum: CalloutProperties, handle: 'start' | 'end'): {
        fill: string | undefined;
        stroke: string | undefined;
        strokeOpacity: number | undefined;
        strokeWidth: number | undefined;
    } | {
        fill: undefined;
        strokeWidth: number;
        stroke?: undefined;
        strokeOpacity?: undefined;
    };
    protected updateAnchor(datum: CalloutProperties, coords: _ModuleSupport.Vec4, context: AnnotationContext, bbox: _ModuleSupport.BBox): void;
    protected updateShape(datum: CalloutProperties, textBBox: _ModuleSupport.BBox, coords: _ModuleSupport.Vec4): void;
    private updatePath;
    drawPath(path: _ModuleSupport.ExtendedPath2D, { x0, y0, x1, y1, cx, cy }: _ModuleSupport.Corner, cornerRadius: number, type: PathType): void;
    private calculateCalloutPlacement;
    getDimensions(datum: CalloutProperties, textBBox: _ModuleSupport.BBox, coords: _ModuleSupport.Vec4): CalloutDimensions | undefined;
    containsPoint(x: number, y: number): boolean;
}
export {};
