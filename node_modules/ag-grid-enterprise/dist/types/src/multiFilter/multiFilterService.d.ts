import type { CoreDataTypeDefinition, DataTypeFormatValueFunc, IMultiFilterParams, IMultiFilterService, ValueGetterFunc } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
export declare class MultiFilterService extends BeanStub implements IMultiFilterService {
    readonly beanName: "multiFilter";
    getParamsForDataType(existingFilterParams: IMultiFilterParams | undefined, existingFilterValueGetter: string | ValueGetterFunc | undefined, dataTypeDefinition: CoreDataTypeDefinition, formatValue: DataTypeFormatValueFunc): {
        filterParams?: any;
        filterValueGetter?: string | ValueGetterFunc<any, any> | undefined;
    };
}
