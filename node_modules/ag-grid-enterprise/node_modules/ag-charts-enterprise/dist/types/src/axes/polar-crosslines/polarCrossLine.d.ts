import type { AgBaseCrossLineLabelOptions, FontStyle, FontWeight } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';
declare const BaseProperties: typeof _ModuleSupport.BaseProperties;
export declare class PolarCrossLineLabel extends BaseProperties implements AgBaseCrossLineLabelOptions {
    enabled?: boolean;
    text?: string;
    fontStyle?: FontStyle;
    fontWeight?: FontWeight;
    fontSize: number;
    fontFamily: string;
    /**
     * The padding between the label and the line.
     */
    padding: number;
    /**
     * The color of the labels.
     */
    color?: string;
    parallel?: boolean;
}
export declare abstract class PolarCrossLine extends BaseProperties implements _ModuleSupport.PolarCrossLine {
    readonly id: string;
    enabled?: boolean;
    type: _ModuleSupport.CrossLineType;
    range?: [unknown, unknown];
    value?: unknown;
    defaultColorRange: string[];
    fill?: string;
    fillOpacity?: number;
    stroke?: string;
    strokeWidth?: number;
    strokeOpacity?: number;
    lineDash?: [];
    shape: 'polygon' | 'circle';
    label: PolarCrossLineLabel;
    scale?: _ModuleSupport.Scale<any, number>;
    clippedRange: [number, number];
    gridLength: number;
    sideFlag: 1 | -1;
    parallelFlipRotation: number;
    regularFlipRotation: number;
    direction: _ModuleSupport.ChartAxisDirection;
    axisInnerRadius: number;
    axisOuterRadius: number;
    readonly lineGroup: _ModuleSupport.Group<unknown>;
    readonly rangeGroup: _ModuleSupport.Group<unknown>;
    readonly labelGroup: _ModuleSupport.Group<unknown>;
    private _isRange;
    protected assignCrossLineGroup(isRange: boolean, crossLineRange: _ModuleSupport.Node): void;
    abstract update(visible: boolean): void;
    protected setSectorNodeProps(node: _ModuleSupport.Path | _ModuleSupport.Sector): void;
    protected setLabelNodeProps(node: _ModuleSupport.RotatableText, x: number, y: number, baseline: CanvasTextBaseline, rotation: number): void;
}
export {};
