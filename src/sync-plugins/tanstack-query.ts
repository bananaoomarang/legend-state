import { isFunction, observe } from '@legendapp/state';
import { SyncedOptions, SyncedSetParams, SyncedSubscribeParams, synced } from '@legendapp/state/sync';
import {
    DefaultError,
    DefaultedQueryObserverOptions,
    MutationObserver,
    MutationObserverOptions,
    QueryClient,
    QueryKey,
    QueryObserver,
    QueryObserverOptions,
    notifyManager,
} from '@tanstack/query-core';

export interface ObservableQueryOptions<TQueryFnData, TError, TData, TQueryKey extends QueryKey>
    extends Omit<QueryObserverOptions<TQueryFnData, TError, TData, TQueryKey>, 'queryKey'> {
    queryKey?: TQueryKey | (() => TQueryKey);
}

export interface SyncedQueryParams<TQueryFnData, TError, TData, TQueryKey extends QueryKey>
    extends Omit<SyncedOptions<TData>, 'get' | 'set'> {
    queryClient: QueryClient;
    query: ObservableQueryOptions<TQueryFnData, TError, TData, TQueryKey>;
    mutation?: MutationObserverOptions<TData, TError, void>;
}

export function syncedQuery<
    TQueryFnData = unknown,
    TError = DefaultError,
    TData = TQueryFnData,
    TQueryKey extends QueryKey = QueryKey,
>(params: SyncedQueryParams<TQueryFnData, TError, TData, TQueryKey>) {
    const { query: options, mutation: mutationOptions, queryClient, ...rest } = params;

    const Observer = QueryObserver;
    const defaultedOptions = queryClient!.defaultQueryOptions(
        options as QueryObserverOptions<TQueryFnData, TError, TData, TQueryKey>,
    );
    let observer: QueryObserver<TQueryFnData, TError, TData, TQueryKey> | undefined = undefined;
    let latestOptions = defaultedOptions;
    let queryKeyFromFn: TQueryKey;
    let resolveInitialPromise: undefined | ((value: TData) => void) = undefined;

    const origQueryKey = options.queryKey!;

    // If the queryKey is a function, observe it and extract the raw value
    const isKeyFunction = isFunction(origQueryKey);

    const updateQueryOptions = (obj: DefaultedQueryObserverOptions<TQueryFnData, TError, TData, TQueryKey>) => {
        // Since legend-state mutates the query options, we need to clone it to make Query
        // see it as changed
        const options = Object.assign({}, obj);

        // Use the latest value from the observed queryKey function
        if (isKeyFunction) {
            options.queryKey = queryKeyFromFn;
        }

        latestOptions = options;

        // Update the Query options
        if (observer) {
            observer.setOptions(options, { listeners: false });
        }
    };

    if (isKeyFunction) {
        observe(() => {
            queryKeyFromFn = origQueryKey();
            updateQueryOptions(latestOptions);
        });
    }

    // Create the observer
    observer = new Observer!<TQueryFnData, TError, TData, TQueryKey>(queryClient!, latestOptions);

    const get = async () => {
        // Get the initial optimistic results if it's already cached
        const result = observer!.getOptimisticResult(latestOptions);

        if (result.isLoading) {
            await new Promise((resolve) => {
                resolveInitialPromise = resolve;
            });
        }

        return result.data!;
    };

    const subscribe = ({ update }: SyncedSubscribeParams<any>) => {
        // Subscribe to Query's observer and update the observable
        const unsubscribe = observer!.subscribe(
            notifyManager.batchCalls((result) => {
                if (result.status === 'success') {
                    if (resolveInitialPromise) {
                        resolveInitialPromise(result.data);
                        resolveInitialPromise = undefined;
                    }
                    update({ value: result.data });
                }
            }),
        );

        // Update result to make sure we did not miss any query updates
        // between creating the observer and subscribing to it.
        observer.updateResult();

        return unsubscribe;
    };

    let set: undefined | (({ value }: SyncedSetParams<any>) => Promise<TData>) = undefined;
    if (mutationOptions) {
        const mutator = new MutationObserver(queryClient!, mutationOptions);
        set = ({ value }: SyncedSetParams<TData>) => {
            return mutator.mutate(value as any);
        };
    }

    return synced({
        get,
        set,
        subscribe,
        ...rest,
    });
}
