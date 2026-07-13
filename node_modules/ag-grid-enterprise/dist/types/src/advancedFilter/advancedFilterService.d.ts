import type { AdvancedFilterModel, BeanCollection, IAdvancedFilterService, IRowNode, NamedBean } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
import { AdvancedFilterCtrl } from './advancedFilterCtrl';
import type { AutocompleteEntry } from './autocomplete/autocompleteParams';
import { FilterExpressionParser } from './filterExpressionParser';
export declare class AdvancedFilterService extends BeanStub implements NamedBean, IAdvancedFilterService {
    beanName: "advancedFilter";
    private valueSvc;
    private colModel;
    private dataTypeSvc?;
    private advFilterExpSvc;
    private filterValueSvc;
    wireBeans(beans: BeanCollection): void;
    private enabled;
    private ctrl;
    private expressionProxy;
    private appliedExpression;
    /** The value displayed in the input, which may be invalid */
    private expression;
    private expressionFunction;
    private expressionParams;
    private isValid;
    postConstruct(): void;
    isEnabled(): boolean;
    isFilterPresent(): boolean;
    doesFilterPass(node: IRowNode): boolean;
    getModel(): AdvancedFilterModel | null;
    setModel(model: AdvancedFilterModel | null): void;
    getExpressionDisplayValue(): string | null;
    setExpressionDisplayValue(expression: string | null): void;
    isCurrentExpressionApplied(): boolean;
    createExpressionParser(expression: string | null): FilterExpressionParser | null;
    getDefaultExpression(updateEntry: AutocompleteEntry): {
        updatedValue: string;
        updatedPosition: number;
    };
    isHeaderActive(): boolean;
    getCtrl(): AdvancedFilterCtrl;
    private setEnabled;
    applyExpression(): void;
    getAppliedExpressionDisplayValue(): string | null;
    private applyExpressionFromParser;
    updateValidity(): boolean;
    private onNewColumnsLoaded;
}
