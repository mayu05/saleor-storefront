import React from "react";

import { isEqual } from "apollo-utilities";
import { SaleorAPI } from "../index";
import { useSaleorClient } from "./helpers";
import {
  ApolloErrorWithUserInput,
  Options,
  Variables,
  WatchQueryReturnData
} from "./types";

type OmittedOptions<T extends keyof SaleorAPI> = Omit<
  Options<T>,
  "onUpdate" | "onComplete" | "onError"
> & { skip?: boolean };
type AdditionalAPI = ReturnType<SaleorAPI["watchQuery"]>;
type Result<TData> = {
  data: TData | null;
  loading: boolean;
  error: ApolloErrorWithUserInput | null;
};

const useQuery = <
  T extends keyof SaleorAPI,
  TVariables extends Variables<T>,
  TOptions extends OmittedOptions<T>,
  TData extends WatchQueryReturnData<T>
>(
  query: T,
  variables: TVariables = {} as any,
  options: TOptions = {} as any
) => {
  const saleor = useSaleorClient();
  const didMountRef = React.useRef(false);
  const prevDataRef = React.useRef<TData | null>(null);
  const prevUnsubRef = React.useRef<any>(null);

  const [result, setResult] = React.useState<Result<TData>>({
    data: null,
    error: null,
    loading: true,
  });

  const setData = React.useCallback((data: TData) => {
    if (!isEqual(data, prevDataRef.current)) {
      prevDataRef.current = data;
      setResult({ data, loading: false, error: null });
    }
  }, []);

  const { unsubscribe, setOptions, refetch: _refetch } = React.useMemo(
    () =>
      (saleor[query] as AdditionalAPI)(variables, {
        ...(options as any),
        onError: (error: ApolloErrorWithUserInput) =>
          setResult(result => ({ ...result, loading: false, error })),
        onUpdate: (data: TData) => {
          setData(data);
        },
      }),
    [query, options.skip]
  );

  const refetch = React.useCallback(
    (variables?: TVariables) => {
      setResult({ data: null, error: null, loading: true });
      _refetch(variables);
    },
    [query]
  );

  React.useEffect(() => {
    // skip on initial mount
    if (didMountRef.current) {
      refetch(variables);
    } else {
      didMountRef.current = true;
    }
  }, [JSON.stringify(variables)]);

  // unsubscribe from watcher on dismount
  React.useEffect(() => {
    if (prevUnsubRef.current) {
      prevUnsubRef.current();
    }
    prevUnsubRef.current = unsubscribe;

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [options.skip]);

  return {
    ...result,
    refetch,
    setOptions,
  };
};

export const queryWithVariablesFactory = <T extends keyof SaleorAPI>(
  query: T
) => (variables: Variables<T>, options?: OmittedOptions<T>) =>
  useQuery(query, variables, options);

export const queryFactory = <T extends keyof SaleorAPI>(query: T) => (
  options?: OmittedOptions<T>
) => useQuery(query, undefined, options);
