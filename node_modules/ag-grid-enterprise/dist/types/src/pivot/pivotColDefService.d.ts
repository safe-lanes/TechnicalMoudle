import type { BeanCollection, ColDef, ColGroupDef, IPivotColDefService, NamedBean } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
export declare class PivotColDefService extends BeanStub implements NamedBean, IPivotColDefService {
    beanName: "pivotColDefSvc";
    private colModel;
    private pivotColsSvc?;
    private valueColsSvc?;
    private colNames;
    wireBeans(beans: BeanCollection): void;
    private fieldSeparator;
    private pivotDefaultExpanded;
    postConstruct(): void;
    createPivotColumnDefs(uniqueValues: Map<string, any>): (ColDef | ColGroupDef)[];
    private createPivotColumnsFromUniqueValues;
    private recursivelyBuildGroup;
    private buildMeasureCols;
    private addExpandablePivotGroups;
    private addPivotTotalsToGroups;
    private recursivelyAddPivotTotal;
    private addRowGroupTotals;
    /**
     * Recreate a pivot colDef to update from a changed valueColumn colDef
     */
    recreateColDef(colDef: ColDef): ColDef;
    private createColDef;
    private sameAggFuncs;
    private merge;
    private generateColumnGroupId;
    private generateColumnId;
    /**
     * Used by the SSRM to create secondary columns from provided fields
     * @param fields
     */
    createColDefsFromFields(fields: string[]): (ColDef | ColGroupDef)[];
}
