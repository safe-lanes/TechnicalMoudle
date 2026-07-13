import { _ModuleSupport } from 'ag-charts-community';
import type { AxisLabelProperties } from '../annotationProperties';
import type { AnnotationAxisContext } from '../annotationTypes';
type UpdateOpts = {
    x: number;
    y: number;
    value: any;
    styles: Partial<AxisLabelProperties>;
    context: AnnotationAxisContext;
};
export declare class AxisLabelScene extends _ModuleSupport.Group {
    static readonly className = "AxisLabel";
    private readonly label;
    private readonly rect;
    constructor();
    update(opts: UpdateOpts): void;
    private updateLabel;
    private updateRect;
    private updatePosition;
}
export {};
