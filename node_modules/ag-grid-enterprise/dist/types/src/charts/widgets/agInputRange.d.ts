import type { AgComponentSelectorType, AgEventTypeParams, AgGridCommon, AgInputFieldParams, BeanCollection, ComponentSelector, GridOptionsService, GridOptionsWithDefaults } from 'ag-grid-community';
import { AgAbstractInputField } from 'ag-grid-community';
interface IInputRange extends AgInputFieldParams<AgComponentSelectorType> {
    min?: number;
    max?: number;
    step?: number;
}
export declare class AgInputRange extends AgAbstractInputField<BeanCollection, GridOptionsWithDefaults, AgEventTypeParams, AgGridCommon<any, any>, GridOptionsService, AgComponentSelectorType, HTMLInputElement, string, IInputRange> {
    private min;
    private max;
    constructor(config?: IInputRange);
    postConstruct(): void;
    protected addInputListeners(): void;
    setMinValue(value: number): this;
    setMaxValue(value: number): this;
    setStep(value: number): this;
    setValue(value: string, silent?: boolean): this;
}
export declare const AgInputRangeSelector: ComponentSelector;
export {};
