import { _ModuleSupport } from 'ag-charts-community';
type AnimatableRadialColumnDatum = {
    innerRadius: number;
    outerRadius: number;
    columnWidth: number;
    axisInnerRadius: number;
    axisOuterRadius: number;
    startAngle: number;
    endAngle: number;
};
type AngleKey = 'startAngle' | 'endAngle';
type AngleObject = Record<AngleKey, number>;
export declare function createAngleMotionCalculator(): {
    calculate: (node: _ModuleSupport.Path & AngleObject, datum: AngleObject, status: _ModuleSupport.NodeUpdateState) => void;
    from: (datum: AngleObject) => {
        startAngle: number;
        endAngle: number;
    };
    to: (datum: AngleObject) => {
        startAngle: number;
        endAngle: number;
    };
};
export declare function fixRadialColumnAnimationStatus(node: _ModuleSupport.Path, datum: {
    startAngle: number;
    endAngle: number;
}, status: _ModuleSupport.NodeUpdateState): _ModuleSupport.NodeUpdateState;
export declare function prepareRadialColumnAnimationFunctions(axisZeroRadius: number): {
    toFn: (node: _ModuleSupport.RadialColumnShape, datum: AnimatableRadialColumnDatum, status: _ModuleSupport.NodeUpdateState) => {
        innerRadius: number;
        outerRadius: number;
        columnWidth: number;
        axisInnerRadius: number;
        axisOuterRadius: number;
        startAngle: number;
        endAngle: number;
    };
    fromFn: (node: _ModuleSupport.RadialColumnShape, datum: AnimatableRadialColumnDatum, status: _ModuleSupport.NodeUpdateState) => {
        innerRadius: number;
        outerRadius: number;
        columnWidth: number;
        axisInnerRadius: number;
        axisOuterRadius: number;
        startAngle: number;
        endAngle: number;
        phase: "end" | "remove" | "initial" | "none" | "update" | "add" | "trailing";
    };
};
export declare function resetRadialColumnSelectionFn(_node: _ModuleSupport.RadialColumnShape, { innerRadius, outerRadius, columnWidth, axisInnerRadius, axisOuterRadius, startAngle, endAngle, }: AnimatableRadialColumnDatum): {
    innerRadius: number;
    outerRadius: number;
    columnWidth: number;
    axisInnerRadius: number;
    axisOuterRadius: number;
    startAngle: number;
    endAngle: number;
};
export {};
