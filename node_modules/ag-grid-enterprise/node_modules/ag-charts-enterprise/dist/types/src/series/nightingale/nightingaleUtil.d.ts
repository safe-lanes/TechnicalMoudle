import { _ModuleSupport } from 'ag-charts-community';
import type { RadialColumnNodeDatum } from '../radial-column/radialColumnSeriesBase';
export declare function getRadii(datum: RadialColumnNodeDatum): {
    innerRadius: number;
    outerRadius: number;
    clipInnerRadius: number;
    clipOuterRadius: number;
};
export declare function prepareNightingaleAnimationFunctions(axisZeroRadius: number): {
    toFn: (_sect: _ModuleSupport.Sector, datum: RadialColumnNodeDatum, status: _ModuleSupport.NodeUpdateState) => {
        innerRadius: number;
        outerRadius: number;
        startAngle: number;
        endAngle: number;
        clipSector: _ModuleSupport.SectorBox;
    };
    fromFn: (sect: _ModuleSupport.Sector, datum: RadialColumnNodeDatum, status: _ModuleSupport.NodeUpdateState) => {
        innerRadius: number;
        outerRadius: number;
        startAngle: number;
        endAngle: number;
        clipSector: _ModuleSupport.SectorBox;
        phase: "end" | "remove" | "initial" | "none" | "update" | "add" | "trailing";
    };
};
export declare function resetNightingaleSelectionFn(_sect: _ModuleSupport.Sector, datum: RadialColumnNodeDatum): {
    innerRadius: number;
    outerRadius: number;
    startAngle: number;
    endAngle: number;
    clipSector: _ModuleSupport.SectorBox;
};
