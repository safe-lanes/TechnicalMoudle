import type { NamedBean, RowNode } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
export declare class NodeManager extends BeanStub implements NamedBean {
    beanName: "ssrmNodeManager";
    private readonly rowNodes;
    addRowNode(rowNode: RowNode): void;
    removeNode(rowNode: RowNode): void;
    destroy(): void;
    clear(): void;
}
