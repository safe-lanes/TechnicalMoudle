import type { AgCartesianAxisType } from 'ag-charts-types';
import type { AgColumn, BeanCollection, CellRange, ChartType, IAggFunc, PartialCellRange, SeriesChartType, SeriesGroupType } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
import { ComboChartModel } from './comboChartModel';
export interface ColState {
    column?: AgColumn;
    colId: string;
    displayName: string | null;
    selected?: boolean;
    order: number;
}
export interface ChartModelParams {
    chartId: string;
    pivotChart?: boolean;
    chartType: ChartType;
    chartThemeName: string;
    switchCategorySeries?: boolean;
    aggFunc?: string | IAggFunc;
    cellRange: PartialCellRange;
    suppressChartRanges?: boolean;
    unlinkChart?: boolean;
    crossFiltering?: boolean;
    seriesChartTypes?: SeriesChartType[];
    seriesGroupType?: SeriesGroupType;
}
export declare const DEFAULT_CHART_CATEGORY = "AG-GRID-DEFAULT-CATEGORY";
export declare class ChartDataModel extends BeanStub {
    private rangeSvc;
    private chartTranslation;
    wireBeans(beans: BeanCollection): void;
    readonly params: ChartModelParams;
    readonly chartId: string;
    suppressChartRanges: boolean;
    switchCategorySeries: boolean;
    aggFunc?: string | IAggFunc;
    pivotChart: boolean;
    categoryAxisType?: AgCartesianAxisType;
    chartType: ChartType;
    chartThemeName: string;
    unlinked: boolean;
    chartData: any[];
    groupChartData: any[] | undefined;
    valueColState: ColState[];
    dimensionColState: ColState[];
    colNames: {
        [p: string]: string[];
    };
    valueCellRange?: CellRange;
    dimensionCellRange?: CellRange;
    comboChartModel: ComboChartModel;
    private chartColSvc;
    private datasource;
    referenceCellRange: PartialCellRange;
    suppliedCellRange: PartialCellRange;
    crossFiltering: boolean;
    private grouping;
    seriesGroupType?: SeriesGroupType;
    constructor(params: ChartModelParams);
    private setParams;
    postConstruct(): void;
    updateModel(params: ChartModelParams): void;
    updateCellRanges(params?: {
        updatedColState?: ColState;
        resetOrder?: boolean;
        maintainColState?: boolean;
        setColsFromRange?: boolean;
    }): void;
    updateData(): void;
    isGrouping(): boolean;
    getSelectedValueCols(): AgColumn[];
    getSelectedDimensions(): ColState[];
    getColDisplayName(col: AgColumn, includePath?: boolean): string | null;
    isPivotMode(): boolean;
    getChartDataType(colId: string): string | undefined;
    private isPivotActive;
    private createCellRange;
    private getAllColumnsFromRanges;
    private getRowIndexes;
    private resetColumnState;
    private updateColumnState;
    private reorderColState;
    private setDimensionCellRange;
    private setValueCellRange;
    resetCellRanges(dimension: boolean, value: boolean): void;
    private updateSelectedDimensions;
    private syncDimensionCellRange;
    isComboChart(chartType?: ChartType): boolean;
}
