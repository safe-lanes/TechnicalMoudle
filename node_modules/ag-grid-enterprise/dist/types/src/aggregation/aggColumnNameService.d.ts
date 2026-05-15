import type { AgColumn, IAggColumnNameService, NamedBean } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
export declare class AggColumnNameService extends BeanStub implements NamedBean, IAggColumnNameService {
    beanName: "aggColNameSvc";
    getHeaderName(column: AgColumn, headerName: string | null): string | null;
}
