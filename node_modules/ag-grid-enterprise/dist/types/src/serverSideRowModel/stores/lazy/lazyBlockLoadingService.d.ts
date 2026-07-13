import type { BeanCollection, NamedBean } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
import type { LazyCache } from './lazyCache';
export declare class LazyBlockLoadingService extends BeanStub implements NamedBean {
    beanName: "lazyBlockLoadingSvc";
    private outboundRequests;
    private maxOutboundRequests;
    private rowRenderer;
    private rowModel;
    wireBeans(beans: BeanCollection): void;
    private cacheLoadingNodesMap;
    private isCheckQueued;
    private nextBlockToLoad?;
    private loaderTimeout?;
    postConstruct(): void;
    subscribe(cache: LazyCache): void;
    unsubscribe(cache: LazyCache): void;
    /**
     * Queues a microtask to check if any blocks need to be loaded.
     */
    queueLoadCheck(): void;
    private onLoadComplete;
    private hasAvailableLoadBandwidth;
    private queueLoadAction;
    private attemptLoad;
    private executeLoad;
    private getBlockToLoad;
    isRowLoading(cache: LazyCache, index: number): boolean;
}
