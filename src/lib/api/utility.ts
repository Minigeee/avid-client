import assert from 'assert';

import config from '@/config';
import { SessionState } from '@/lib/contexts';
import { id } from '@/lib/db';
import {
  ApiPath,
  ApiReturn,
  ApiRouteOptions,
  ApiSchema,
  ApiSchemaTemplate,
} from '@/lib/types';
import { axiosHandler } from '@/lib/utility/error-handler';

import axios, { AxiosRequestConfig } from 'axios';

/**
 * Create an axios config object with the correct auth header attached
 *
 * @param session The current user session which contains access token
 * @param options Extra axios request configurations
 * @returns An axio request config object with auth headers
 */
export function withAccessToken(
  session: { _exists: boolean; token: string },
  options: AxiosRequestConfig = {},
): AxiosRequestConfig {
  assert(session._exists);

  return {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${session.token}`,
    },
  };
}

/** Param options for api req function */
export type ApiReqParams<Path extends ApiPath> = Omit<
  ApiSchema[Path],
  'params' | 'return' | 'body' | 'req'
> &
  (ApiSchema[Path] extends { body: any }
    ? { body: ApiSchema[Path]['body'] } | { form: FormData }
    : {}) &
  (ApiSchema[Path] extends { params: string[] }
    ? {
        params: Record<ApiSchema[Path]['params'][number], string>;
      }
    : {});

/** Encode a query value */
function _queryEncode(x: any): string {
  const type = typeof x;
  let str = '';

  if (typeof x === 'object') {
    if (x === null) str = 'null';
    else if (x instanceof Date) str = x.toISOString();
    else if (Array.isArray(x)) str = x.map((x) => _queryEncode(x)).join(',');
    else if (typeof window !== 'undefined')
      str = window.btoa(JSON.stringify(x));
    else str = Buffer.from(JSON.stringify(x)).toString('base64');
  } else if (typeof x === 'undefined') str = '';
  else if (typeof x === 'string') str = /^\w+:\w+$/.test(x) ? id(x) : x;
  else str = x;

  return encodeURIComponent(str);
}

/**
 * Perform an api call
 *
 * @param path The api path that includes the HTTP method and the path
 * @param options The request options, including params, query, and body
 * @param axiosOpts Extra axios and session related options
 * @returns The results of the api call
 */
export async function api<P extends ApiPath>(
  path: P,
  params: ApiReqParams<P>,
  options: {
    session: {
      _exists: boolean;
      token: string;
      _mutators?: SessionState['_mutators'];
    };
    throw?: boolean;
  } & AxiosRequestConfig,
): Promise<ApiReturn<P>> {
  assert(options.session.token);

  // Access token (for client request)
  let token = options.session.token as string | undefined;

  // Retype
  const _params = params as any;

  // Get method
  let [method, p] = path.split(' ');
  method = method.toLowerCase();

  // Construct full path string
  if (_params.params)
    p = p.replaceAll(/:(\w+)\b/g, (_, m1) => {
      // Modify param value to remove table from records
      const value = _params.params?.[m1] || '';
      return /^\w+:\w+$/.test(value) ? id(value) : value;
    });
  p =
    config.domains.api +
    p +
    (_params.query
      ? `?${Object.entries(_params.query)
          .filter(([k, v]) => v !== undefined)
          .map(([k, v]) => `${k}=${_queryEncode(v)}`)
          .join('&')}`
      : '');

  // Perform axios request
  const axiosOpts = withAccessToken(options.session, options);

  let results = null;

  // Retry once if fail first time
  for (let i = 0; i < 2; ++i) {
    try {
      if (method === 'get') results = await axios.get(p, axiosOpts);
      else if (method === 'post')
        results = await axios.post(p, _params.form || _params.body, axiosOpts);
      else if (method === 'put')
        results = await axios.put(p, _params.body, axiosOpts);
      else if (method === 'patch')
        results = await axios.patch(p, _params.body, axiosOpts);
      else if (method === 'delete') results = await axios.delete(p, axiosOpts);
      else assert(false, 'unimplemented api method');

      // @ts-ignore
      return results.data;
    } catch (error: any) {
      let retry = false;

      // Not authenticated
      if (
        i === 0 &&
        error.response?.status === 403 &&
        options.session._mutators
      ) {
        // Auto refresh if 403 error
        const newToken = await options.session._mutators.refresh();

        // Stop retrying if invalid token
        retry = newToken !== undefined && newToken !== token;

        // Set token for retry
        token = newToken;
      }

      if (!retry) {
        if (options.throw !== false) throw error;

        // Default axios handler
        axiosHandler(error);
        return null;
      }
    }
  }

  // This part should never be reached
  throw new Error('failed to perform api call');
}
