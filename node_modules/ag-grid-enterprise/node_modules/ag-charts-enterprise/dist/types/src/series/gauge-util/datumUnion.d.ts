import type { _ModuleSupport } from 'ag-charts-community';
export declare class DatumUnion<TNode extends _ModuleSupport.Shape, TDatum extends _ModuleSupport.SeriesNodeDatum<unknown>> {
    node?: TNode;
    datum?: TDatum;
    [Symbol.iterator](): IterableIterator<{
        node: TNode;
        datum: TDatum;
    }>;
    nodes(): Iterable<TNode>;
    update(datumSelection: {
        nodes(): TNode[];
    }, group: {
        appendChild(child: TNode): void;
    }, ctor: new () => TNode, nodeUpdater: (unionNode: TNode, first: TNode, last: TNode) => void): void;
}
