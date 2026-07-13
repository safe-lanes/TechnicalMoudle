import { _ModuleSupport } from 'ag-charts-community';
import type { AnnotationContext } from '../annotationTypes';
import { CollidableText } from '../scenes/collidableTextScene';
import { StartEndScene } from '../scenes/startEndScene';
import { type MeasurerTypeProperties, QuickDatePriceRangeProperties } from './measurerProperties';
import { MeasurerStatisticsScene, QuickMeasurerStatisticsScene } from './measurerStatisticsScene';
export declare class MeasurerScene extends StartEndScene<MeasurerTypeProperties> {
    static is(value: unknown): value is MeasurerScene;
    type: string;
    private readonly horizontalLine;
    private readonly verticalLine;
    text?: CollidableText;
    private readonly horizontalStartLine;
    private readonly horizontalEndLine;
    private readonly verticalStartLine;
    private readonly verticalEndLine;
    private readonly horizontalEndCap;
    private readonly verticalEndCap;
    readonly background: _ModuleSupport.Path<any>;
    private readonly statistics;
    protected verticalDirection?: 'up' | 'down';
    constructor();
    protected createStatisticsScene(): MeasurerStatisticsScene;
    update(datum: MeasurerTypeProperties, context: AnnotationContext): void;
    private extendPerpendicular;
    private updateVisibilities;
    private updateLines;
    private updateText;
    private updateCaps;
    private updateBoundingLines;
    private readonly updateBackground;
    private updateStatistics;
    updateAnchor(_datum: MeasurerTypeProperties, coords: _ModuleSupport.Vec4, _context: AnnotationContext, _bbox?: _ModuleSupport.BBox): void;
    getBackgroundPoints(_datum: MeasurerTypeProperties, verticalStart: _ModuleSupport.Vec4, verticalEnd: _ModuleSupport.Vec4, _bounds: _ModuleSupport.Vec4): _ModuleSupport.Vec2[];
    protected getLineStyles(datum: MeasurerTypeProperties): {
        lineCap: _ModuleSupport.ShapeLineCap | undefined;
        lineDash: number[] | undefined;
        lineDashOffset: number | undefined;
        stroke: string | undefined;
        strokeWidth: number | undefined;
        strokeOpacity: number | undefined;
        fillOpacity: number;
    };
    getBackgroundStyles(datum: MeasurerTypeProperties): {
        fill: string | undefined;
        fillOpacity: number | undefined;
    };
    getHandleStyles(datum: MeasurerTypeProperties): {
        fill: string | undefined;
        stroke: string | undefined;
        strokeOpacity: number | undefined;
        strokeWidth: number | undefined;
    };
    containsPoint(x: number, y: number): boolean;
    getNodeAtCoords(x: number, y: number): string | undefined;
    private getDateRangeBars;
    private getDateRangeValue;
    private getPriceRangePercentage;
    private getPriceRangeValue;
    private getVolume;
}
export declare class QuickMeasurerScene extends MeasurerScene {
    static is(value: unknown): value is QuickMeasurerScene;
    type: string;
    createStatisticsScene(): QuickMeasurerStatisticsScene;
    private getDirectionStyles;
    getLineStyles(datum: QuickDatePriceRangeProperties): {
        stroke: string | undefined;
        strokeWidth: number | undefined;
        strokeOpacity: number | undefined;
        lineCap: _ModuleSupport.ShapeLineCap | undefined;
        lineDash: number[] | undefined;
        lineDashOffset: number | undefined;
        fillOpacity: number;
    };
    getBackgroundStyles(datum: QuickDatePriceRangeProperties): {
        fill: string | undefined;
        fillOpacity: number | undefined;
    };
    getHandleStyles(datum: QuickDatePriceRangeProperties): {
        fill: string | undefined;
        stroke: string | undefined;
        strokeOpacity: number | undefined;
        strokeWidth: number | undefined;
    };
}
