import { _ModuleSupport } from 'ag-charts-community';
declare const RadialGaugeNeedle_base: new (...args: any[]) => import("packages/ag-charts-community/dist/types/src/scene/transformable").RotatableType<import("packages/ag-charts-community/dist/types/src/scene/transformable").ScalableType<import("packages/ag-charts-community/dist/types/src/scene/transformable").TranslatableType<_ModuleSupport.SvgPath<any>>>>;
export declare class RadialGaugeNeedle extends RadialGaugeNeedle_base {
    static readonly defaultPathData = "M0.50245 0.53745C0.481767 0.53745 0.465 0.520683 0.465 0.5C0.465 0.479317 0.481767 0.46255 0.50245 0.46255L1 0.500012L0.50245 0.53745Z";
    scalingCenterX: number;
    scalingCenterY: number;
    rotationCenterX: number;
    rotationCenterY: number;
}
export {};
