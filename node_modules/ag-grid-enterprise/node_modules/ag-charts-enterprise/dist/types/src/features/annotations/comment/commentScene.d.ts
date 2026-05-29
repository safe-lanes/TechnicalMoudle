import { _ModuleSupport } from 'ag-charts-community';
import { type AnnotationContext, AnnotationType } from '../annotationTypes';
import { TextualPointScene } from '../scenes/textualPointScene';
import type { CommentProperties } from './commentProperties';
export declare class CommentScene extends TextualPointScene<CommentProperties> {
    static is(value: unknown): value is CommentScene;
    type: AnnotationType;
    private readonly shape;
    constructor();
    protected updateShape(datum: CommentProperties, bbox: _ModuleSupport.BBox): void;
    protected getLabelCoords(datum: CommentProperties, point: _ModuleSupport.Vec2): _ModuleSupport.Vec2;
    protected getHandleStyles(datum: CommentProperties): {
        fill: string | undefined;
        stroke: string | undefined;
        strokeOpacity: number | undefined;
        strokeWidth: number | undefined;
    };
    protected updateAnchor(datum: CommentProperties, bbox: _ModuleSupport.BBox, context: AnnotationContext): {
        x: number;
        y: number;
        position: "right" | "above" | "above-left" | "below" | undefined;
    };
    private updatePath;
    containsPoint(x: number, y: number): boolean;
}
