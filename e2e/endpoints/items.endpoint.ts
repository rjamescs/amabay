import { APIRequestContext, APIResponse } from '@playwright/test';

// The options bag Playwright's request.get() accepts (headers, params, ...).
// Derived from the real signature so it can never drift out of sync.
type RequestOptions = Parameters<APIRequestContext['get']>[1];

export class ItemsEndpoint {
    private readonly request: APIRequestContext;
    readonly url = '/api/items';

    constructor(request: APIRequestContext) {
        this.request = request;
    }

    async listItems(options?: RequestOptions): Promise<APIResponse> {
        return this.request.get(this.url, options);
    }

    async getItemById(id: number | string, options?: RequestOptions): Promise<APIResponse> {
        return this.request.get(`${this.url}/${id}`, options);
    }

    async updateItemById(id: number, body: {}, options?: RequestOptions): Promise<APIResponse> {
        let newOptions = { ...options, data: body };
        return this.request.patch(`${this.url}/${id}`, newOptions);
    }

    async createItem(body: {}, options?: RequestOptions): Promise<APIResponse> {
        let newOptions = { ...options, data: body };
        return this.request.post(this.url, newOptions);
    }

    async deleteItemById(id: number, options?: RequestOptions): Promise<APIResponse> {
        return this.request.delete(`${this.url}/${id}`, options);
    }

}