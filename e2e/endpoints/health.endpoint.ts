import { APIRequestContext, APIResponse } from '@playwright/test';

// The options bag Playwright's request.get() accepts (headers, params, ...).
// Derived from the real signature so it can never drift out of sync.
type RequestOptions = Parameters<APIRequestContext['get']>[1];

export class HealthEndpoint {
  private readonly request: APIRequestContext;
  readonly url = '/health';

  constructor(request: APIRequestContext) {
    this.request = request;
  }

  async get(options?: RequestOptions): Promise<APIResponse> {
    return this.request.get(this.url, options);
  }
}
