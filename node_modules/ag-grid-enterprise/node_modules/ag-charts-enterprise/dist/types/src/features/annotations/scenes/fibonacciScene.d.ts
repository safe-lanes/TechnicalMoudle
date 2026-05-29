import { _ModuleSupport } from 'ag-charts-community';
import type { AnnotationContext } from '../annotationTypes';
import type { FibonacciProperties } from '../properties/fibonacciProperties';
import type { FibonacciRangeDatum } from '../utils/fibonacci';
import { AnnotationScene } from './annotationScene';
import { CollidableLine } from './collidableLineScene';
import { CollidableText } from './collidableTextScene';
export declare abstract class FibonacciScene<Datum extends FibonacciProperties> extends AnnotationScene {
    protected readonly trendLine: CollidableLine;
    text?: CollidableText;
    private readonly rangeFillsGroup;
    private readonly rangeFillsGroupSelection;
    private readonly rangeStrokesGroup;
    private readonly rangeStrokesGroupSelection;
    private readonly labelsGroup;
    private readonly labelsGroupSelection;
    protected anchor: _ModuleSupport.FloatingToolbarAnchor;
    constructor();
    update(datum: Datum, context: AnnotationContext): void;
    protected extendLine({ x1, y1, x2, y2 }: _ModuleSupport.Vec4, datum: Datum, context: AnnotationContext): {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
    };
    protected updateLine(datum: Datum, coords?: _ModuleSupport.Vec4, line?: CollidableLine): void;
    private updateRangeStrokes;
    protected updateRanges(datum: Datum, data: FibonacciRangeDatum[], context: AnnotationContext): void;
    private updateRangeFills;
    private updateRangeLabels;
    private checkWithinBounds;
    protected updateText(datum: Datum, coords: _ModuleSupport.Vec4): void;
    updateAnchor(_datum: Datum, coords: _ModuleSupport.Vec4, _context: AnnotationContext, _bbox?: _ModuleSupport.BBox): void;
    containsPoint(x: number, y: number): boolean;
    getNodeAtCoords(x: number, y: number): string | undefined;
    protected getHandleStyles(datum: Datum): {
        fill: string | undefined;
        stroke: string | undefined;
        strokeOpacity: number | undefined;
        strokeWidth: number | undefined;
    };
    drag(datum: Datum, target: _ModuleSupport.Vec2, context: AnnotationContext, snapping: boolean): void;
    protected abstract dragHandle(datum: Datum, target: _ModuleSupport.Vec2, context: AnnotationContext, snapping: boolean): void;
    protected abstract dragAll(datum: Datum, target: _ModuleSupport.Vec2, context: AnnotationContext): void;
    abstract translatePoints({ datum, start, end, translation, context, }: {
        datum: Datum;
        start: _ModuleSupport.Vec2;
        end: _ModuleSupport.Vec2;
        translation: _ModuleSupport.Vec2;
        context: AnnotationContext;
    }): void;
    abstract translate(datum: Datum, translation: _ModuleSupport.Vec2, context: AnnotationContext): void;
    abstract copy(datum: Datum, copiedDatum: Datum, context: AnnotationContext): void;
    abstract snapToAngle(datum: Datum, coords: _ModuleSupport.Vec2, context: AnnotationContext): void;
    getAnchor(): _ModuleSupport.FloatingToolbarAnchor;
    getCursor(): string;
    protected abstract updateHandles(datum: Datum, coords1: _ModuleSupport.Vec4, coords2?: _ModuleSupport.Vec4, bbox?: _ModuleSupport.BBox): void;
}
