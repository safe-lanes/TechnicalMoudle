import type { IColor } from 'ag-charts-types';
import type { AgComponentSelectorType, AgEventTypeParams, AgGridCommon, AgInputTextFieldParams, BeanCollection, ComponentSelector, GridOptionsService, GridOptionsWithDefaults } from 'ag-grid-community';
import { AgInputTextField } from 'ag-grid-community';
type AgColorInputEvent = 'colorChanged';
export declare class AgColorInput extends AgInputTextField<BeanCollection, GridOptionsWithDefaults, AgEventTypeParams, AgGridCommon<any, any>, GridOptionsService, AgComponentSelectorType, AgInputTextFieldParams<AgComponentSelectorType>, AgColorInputEvent> {
    private chartTranslation;
    private color;
    wireBeans(beans: BeanCollection): void;
    private readonly eColor;
    constructor();
    setColor(color: IColor): void;
    setValue(value?: string | null | undefined, silent?: boolean | undefined): this;
    onColorChanged(callback: (color: IColor) => void): void;
}
export declare const AgColorInputSelector: ComponentSelector;
export {};
