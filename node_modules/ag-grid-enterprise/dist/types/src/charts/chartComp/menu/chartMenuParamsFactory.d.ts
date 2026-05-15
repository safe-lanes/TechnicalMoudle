import type { AgCheckboxParams, AgComponentSelectorType, AgFieldParams, AgInputNumberFieldParams, AgSelectParams, AgToggleButtonParams, BeanCollection, ListOption } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
import type { AgColorPickerParams } from '../../widgets/agColorPicker';
import type { AgSliderParams } from '../../widgets/agSlider';
import type { ChartOptionsProxy } from '../services/chartOptionsService';
import type { ChartTranslationKey } from '../services/chartTranslationService';
import type { FontPanelParams } from './format/fontPanel';
export declare class ChartMenuParamsFactory extends BeanStub {
    private readonly chartOptionsProxy;
    private chartTranslation;
    wireBeans(beans: BeanCollection): void;
    constructor(chartOptionsProxy: ChartOptionsProxy);
    getDefaultColorPickerParams(expression: string, labelKey?: ChartTranslationKey, options?: {
        parseInputValue: (value: any) => any;
        formatInputValue: (value: any) => any;
    }): AgColorPickerParams;
    getDefaultNumberInputParams(expression: string, labelKey: ChartTranslationKey, options?: {
        precision?: number;
        step?: number;
        min?: number;
        max?: number;
    }): AgInputNumberFieldParams<AgComponentSelectorType>;
    getDefaultSliderParams(expression: string, labelKey: ChartTranslationKey, defaultMaxValue: number, isArray?: boolean): AgSliderParams;
    getDefaultSliderParamsWithoutValueParams(value: number, labelKey: ChartTranslationKey, defaultMaxValue: number): AgSliderParams;
    getDefaultCheckboxParams(expression: string, labelKey: ChartTranslationKey, options?: {
        readOnly?: boolean;
        passive?: boolean;
    }): AgCheckboxParams<AgComponentSelectorType>;
    getDefaultToggleParams(expression: string, labelKey: ChartTranslationKey, options?: {
        readOnly?: boolean;
        passive?: boolean;
    }): AgToggleButtonParams<AgComponentSelectorType>;
    getDefaultSelectParams(expression: string, labelKey: ChartTranslationKey, dropdownOptions: Array<ListOption>): AgSelectParams<AgComponentSelectorType>;
    getDefaultSelectParamsWithoutValueParams(labelKey: ChartTranslationKey, options: Array<ListOption>, value: any, onValueChange: (value: any) => void): AgSelectParams<AgComponentSelectorType>;
    getDefaultFontPanelParams(expression: string, labelKey: ChartTranslationKey): FontPanelParams;
    addValueParams<P extends AgFieldParams>(expression: string, params: P, options?: {
        parseInputValue: (value: any) => any;
        formatInputValue: (value: any) => any;
    }): P;
    addEnableParams<P extends {
        enabled?: boolean;
        onEnableChange?: (value: boolean) => void;
    }>(expression: string, params: P): P;
    getChartOptions(): ChartOptionsProxy;
}
