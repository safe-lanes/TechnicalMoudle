import { _ModuleSupport } from 'ag-charts-community';
type AnimatableSectorDatum = {
    angleValue: any;
    radiusValue: any;
    innerRadius: number;
    outerRadius: number;
    startAngle: number;
    endAngle: number;
    clipSector: _ModuleSupport.SectorBox;
};
export declare function prepareRadialBarSeriesAnimationFunctions(axisZeroAngle: number): {
    toFn: (sect: _ModuleSupport.Sector, datum: AnimatableSectorDatum, status: _ModuleSupport.NodeUpdateState) => {
        startAngle: number;
        endAngle: number;
        innerRadius: number;
        outerRadius: number;
        clipSector: _ModuleSupport.SectorBox;
    };
    fromFn: (sect: _ModuleSupport.Sector, datum: AnimatableSectorDatum, status: _ModuleSupport.NodeUpdateState) => {
        startAngle: number;
        endAngle: number;
        innerRadius: number;
        outerRadius: number;
        clipSector: _ModuleSupport.SectorBox;
        phase: "end" | "remove" | "initial" | "none" | "update" | "add" | "trailing";
    };
};
export declare function resetRadialBarSelectionsFn(_node: _ModuleSupport.Sector, datum: AnimatableSectorDatum): {
    centerX: number;
    centerY: number;
    innerRadius: number;
    outerRadius: number;
    startAngle: number;
    endAngle: number;
    clipSector: _ModuleSupport.SectorBox;
};
export {};
