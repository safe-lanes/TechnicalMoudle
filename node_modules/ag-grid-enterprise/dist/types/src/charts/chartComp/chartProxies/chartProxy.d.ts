import type { AgChartInstance, AgChartInstanceOptions, AgChartOptions, AgChartTheme, AgChartThemeOverrides, AgChartThemePalette } from 'ag-charts-types';
import type { ChartType, GridChartContext, SeriesChartType, SeriesGroupType } from 'ag-grid-community';
import type { AgChartsExports } from '../../agChartsExports';
import type { CrossFilteringContext } from '../../chartService';
import type { ChartSeriesType } from '../utils/seriesTypeMapper';
export interface ChartProxyParams {
    agChartsExports: AgChartsExports;
    chartInstance?: AgChartInstance<AgChartInstanceOptions>;
    chartType: ChartType;
    customChartThemes?: {
        [name: string]: AgChartTheme;
    };
    parentElement: HTMLElement;
    grouping: boolean;
    styleNonce?: string;
    getChartThemeName: () => string;
    getChartThemes: () => string[];
    getGridOptionsChartThemeOverrides: () => AgChartThemeOverrides | undefined;
    getExtraPaddingDirections: () => ExtraPaddingDirection[];
    apiChartThemeOverrides?: AgChartThemeOverrides;
    crossFiltering: boolean;
    crossFilterCallback: (event: any, reset?: boolean) => void;
    chartThemeToRestore?: string;
    chartOptionsToRestore?: AgChartThemeOverrides;
    chartPaletteToRestore?: AgChartThemePalette;
    seriesChartTypes: SeriesChartType[];
    suppressFieldDotNotation?: boolean;
    translate: (toTranslate: string, defaultText?: string) => string;
    context: GridChartContext;
}
export type ExtraPaddingDirection = 'top' | 'right' | 'bottom' | 'left';
export interface FieldDefinition {
    colId: string;
    displayName: string | null;
}
export interface UpdateParams {
    data: any[];
    groupData?: any[];
    grouping: boolean;
    categories: {
        id: string;
        name: string;
        chartDataType?: string;
    }[];
    fields: FieldDefinition[];
    chartId?: string;
    getCrossFilteringContext: () => CrossFilteringContext;
    seriesChartTypes: SeriesChartType[];
    updatedOverrides?: AgChartThemeOverrides;
    seriesGroupType?: SeriesGroupType;
}
export declare abstract class ChartProxy<TOptions extends AgChartOptions = AgChartOptions, TSeries extends ChartSeriesType = ChartSeriesType> {
    protected readonly chartProxyParams: ChartProxyParams;
    protected readonly agChartsExports: AgChartsExports;
    protected readonly chartType: ChartType;
    protected readonly standaloneChartType: TSeries;
    protected readonly chart: AgChartInstance<AgChartInstanceOptions>;
    protected readonly crossFiltering: boolean;
    protected readonly crossFilterCallback: (event: any, reset?: boolean) => void;
    protected clearThemeOverrides: boolean;
    constructor(chartProxyParams: ChartProxyParams);
    protected abstract getUpdateOptions(params: UpdateParams, commonChartOptions: TOptions): TOptions;
    crossFilteringReset(): void;
    update(params: UpdateParams): void;
    updateThemeOverrides(themeOverrides: AgChartThemeOverrides): void;
    getChart(): import("../utils/integration").AgChartActual;
    getChartRef(): AgChartInstance<AgChartInstanceOptions>;
    downloadChart(dimensions?: {
        width: number;
        height: number;
    }, fileName?: string, fileFormat?: string): void;
    getChartImageDataURL(type?: string): string;
    private getChartOptions;
    getChartThemeOverrides(): AgChartThemeOverrides;
    getChartPalette(): AgChartThemePalette | undefined;
    setPaired(paired: boolean): void;
    isPaired(): boolean;
    lookupCustomChartTheme(themeName: string): AgChartTheme<any, unknown>;
    getSeriesGroupType(): SeriesGroupType | undefined;
    protected transformCategoryData(data: any[], categoryKey: string): any[];
    private getCommonChartOptions;
    private getChartThemeDefaults;
    protected getSeriesChartThemeDefaults(): AgChartThemeOverrides[TSeries];
    private getActiveFormattingPanelOverrides;
    destroy({ keepChartInstance }?: {
        keepChartInstance?: boolean | undefined;
    }): AgChartInstance<AgChartInstanceOptions> | undefined;
    protected destroyChart(): void;
}
