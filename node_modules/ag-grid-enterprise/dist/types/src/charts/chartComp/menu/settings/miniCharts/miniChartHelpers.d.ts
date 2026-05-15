import type { AgChartsExports } from '../../../../agChartsExports';
import type { CommandPath, CommandSegment, XCoordShape, XYCoordShape } from './miniChartApi';
interface CreateColumnRectsParams {
    agChartsExports: AgChartsExports;
    stacked: boolean;
    root: any;
    data: any;
    size: number;
    padding: number;
    xScaleDomain: number[];
    yScaleDomain: number[];
    xScalePadding: number;
}
export declare function createColumnRects(params: CreateColumnRectsParams): any;
export declare function prepareXYScales(_Scene: AgChartsExports['_Scene'], data: XYCoordShape[], size: number, padding: number): {
    xScale: any;
    yScale: any;
};
export declare function prepareLinearScene(_Scene: AgChartsExports['_Scene'], data: XCoordShape[], size: number, padding: number): {
    xScale: any;
    yScale: any;
};
export declare function createXPathCommands(data: XCoordShape[], xScale: any, yScale: any): CommandPath[];
export declare function createXYPathCommands(shape: XYCoordShape, xScale: any, yScale: any): CommandPath;
export declare function closePath(commandSegments: CommandSegment[]): CommandSegment[];
export declare function createPath(_Scene: AgChartsExports['_Scene'], commands: CommandSegment[]): any;
export declare function createAreaPathCommands(commands: CommandSegment[][], yScale: any, stacked: boolean): CommandSegment[][];
export declare function closePathViaPreviousSeries(all: CommandSegment[][], index: number, yScale: any): any[][];
export declare function closePathViaOrigin(pathCommands: CommandSegment[], yScale: any): any[][];
export declare function commandsToPath(_Scene: AgChartsExports['_Scene'], commands: CommandSegment[]): any;
export declare function createShapePaths({ _Scene }: AgChartsExports, root: any, shapes: XYCoordShape[], size: number, padding: number): any[];
export declare function createLinePaths({ _Scene }: AgChartsExports, root: any, data: number[][], size: number, padding: number): any[];
export declare function createAreaPaths(_Scene: AgChartsExports['_Scene'], root: any, data: number[][], size: number, padding: number, stacked?: boolean): any[];
export declare function stackData(data: number[][]): number[][];
export declare function normalizeStackData(data: number[][]): number[][];
export declare function createPolarPaths(agChartsExports: AgChartsExports, root: any, data: number[][], size: number, radius: number, innerRadius: number, markerSize?: number): {
    paths: any[];
    markers: any[];
};
export declare function accumulateData(data: number[][]): {
    processedData: number[][];
    min: number;
    max: number;
};
export {};
