import { _ModuleSupport } from 'ag-charts-community';
import { type AnnotationContext, AnnotationType } from '../annotationTypes';
import { TextualPointScene } from '../scenes/textualPointScene';
import { type NoteProperties } from './noteProperties';
export declare class NoteScene extends TextualPointScene<NoteProperties> {
    static is(value: unknown): value is NoteScene;
    type: AnnotationType;
    private readonly shape;
    private readonly iconBackground;
    private readonly iconLines;
    private active;
    constructor();
    update(datum: NoteProperties, context: AnnotationContext): void;
    getTextBBox(datum: NoteProperties, coords: _ModuleSupport.Vec2, context: AnnotationContext): _ModuleSupport.BBox;
    updateLabel(datum: NoteProperties, bbox: _ModuleSupport.BBox): void;
    updateShape(datum: NoteProperties, bbox: _ModuleSupport.BBox): void;
    private updateIcon;
    protected updateAnchor(datum: NoteProperties, bbox: _ModuleSupport.BBox, context: AnnotationContext): {
        x: number;
        y: number;
        position: "above" | "below";
    };
    protected getLabelCoords(datum: NoteProperties, bbox: _ModuleSupport.BBox): _ModuleSupport.Vec2;
    protected getTextBaseline(datum: NoteProperties): CanvasTextBaseline;
    protected getHandleCoords(_datum: NoteProperties, coords: _ModuleSupport.Vec2, _bbox: _ModuleSupport.BBox): _ModuleSupport.Vec2;
    protected getHandleStyles(datum: NoteProperties): {
        fill: string | undefined;
        stroke: string | undefined;
        strokeOpacity: number | undefined;
        strokeWidth: number | undefined;
    };
    toggleHovered(hovered: boolean): void;
    toggleActive(active: boolean): void;
    containsPoint(x: number, y: number): boolean;
}
