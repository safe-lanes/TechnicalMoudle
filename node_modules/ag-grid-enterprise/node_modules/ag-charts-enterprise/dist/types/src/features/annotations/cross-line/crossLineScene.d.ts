import { _ModuleSupport } from 'ag-charts-community';
import type { AnnotationContext } from '../annotationTypes';
import { AnnotationScene } from '../scenes/annotationScene';
import { CollidableText } from '../scenes/collidableTextScene';
import { type CrossLineProperties } from './crossLineProperties';
export declare class CrossLineScene extends AnnotationScene {
    static is(value: unknown): value is CrossLineScene;
    type: string;
    activeHandle?: 'middle';
    private readonly line;
    private readonly middle;
    private axisLabel?;
    text?: CollidableText;
    private seriesRect?;
    private dragState?;
    private isHorizontal;
    constructor();
    update(datum: CrossLineProperties, context: AnnotationContext): void;
    private updateLine;
    private updateHandle;
    private updateText;
    private createAxisLabel;
    private updateAxisLabel;
    setAxisLabelOpacity(opacity: number): void;
    setAxisLabelVisible(visible: boolean): void;
    toggleHandles(show: boolean): void;
    destroy(): void;
    toggleActive(active: boolean): void;
    dragStart(datum: CrossLineProperties, target: _ModuleSupport.Vec2, context: AnnotationContext): void;
    drag(datum: CrossLineProperties, target: _ModuleSupport.Vec2, context: AnnotationContext): void;
    translate(datum: CrossLineProperties, translation: _ModuleSupport.Vec2, context: AnnotationContext): void;
    protected translatePoint(datum: CrossLineProperties, value: _ModuleSupport.Vec2, translation: _ModuleSupport.Vec2, context: AnnotationContext): void;
    stopDragging(): void;
    copy(datum: CrossLineProperties, copiedDatum: CrossLineProperties, context: AnnotationContext): CrossLineProperties | undefined;
    getCursor(): "pointer" | "col-resize" | "row-resize" | undefined;
    containsPoint(x: number, y: number): boolean;
    getNodeAtCoords(x: number, y: number): "line" | "text" | "handle" | undefined;
    getAnchor(): {
        x: number;
        y: number;
        position?: undefined;
    } | {
        x: number;
        y: number;
        position: "right";
    };
    private convertCrossLine;
}
