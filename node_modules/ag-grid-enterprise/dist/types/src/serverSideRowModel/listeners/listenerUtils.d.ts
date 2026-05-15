import type { BeanCollection, NamedBean } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
export declare class ListenerUtils extends BeanStub implements NamedBean {
    beanName: "ssrmListenerUtils";
    private pivotResultCols?;
    private valueColsSvc?;
    wireBeans(beans: BeanCollection): void;
    isSortingWithValueColumn(changedColumnsInSort: string[]): boolean;
    isSortingWithSecondaryColumn(changedColumnsInSort: string[]): boolean;
}
