import { _ModuleSupport } from 'ag-charts-community';
export type PositionedScene = Vec2Scene | Vec4Scene;
type Vec2Scene = _ModuleSupport.Node & {
    x: number;
    y: number;
};
type Vec4Scene = _ModuleSupport.Node & {
    x: number;
    y: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
};
export declare function layoutScenesRow(scenes: Array<PositionedScene | Array<PositionedScene>>, startX?: number, gap?: number): void;
export declare function layoutScenesColumn(scenes: Array<PositionedScene | Array<PositionedScene>>, startY?: number, gap?: number): void;
export declare function layoutAddX(scene: PositionedScene, x: number): void;
export declare function layoutAddY(scene: PositionedScene, y: number): void;
export {};
