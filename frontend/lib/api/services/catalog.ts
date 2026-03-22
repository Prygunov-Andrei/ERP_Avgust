import type { RequestFn } from './types';
import type { PaginatedResponse } from '../types';
import type {
  Category, CategoryTreeNode, Product, ProductPriceHistory,
  ProductDuplicate, SupplierCatalog, SupplierCatalogSection,
} from '../../../types/catalog';

export function createCatalogService(request: RequestFn) {
  return {
    // Categories
    async getCategories() {
      const response = await request<PaginatedResponse<Category> | Category[]>('/catalog/categories/');
      if (response && typeof response === 'object' && 'results' in response) {
        return response.results;
      }
      return response as Category[];
    },

    async getCategoryTree(): Promise<{ tree: CategoryTreeNode[]; uncategorized_count: number }> {
      return request<{ tree: CategoryTreeNode[]; uncategorized_count: number }>('/catalog/categories/tree/');
    },

    async getCategoryById(id: number) {
      return request<Category>(`/catalog/categories/${id}/`);
    },

    async createCategory(data: Partial<Category>) {
      return request<Category>('/catalog/categories/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateCategory(id: number, data: Partial<Category>) {
      return request<Category>(`/catalog/categories/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async deleteCategory(id: number) {
      return request<void>(`/catalog/categories/${id}/`, { method: 'DELETE' });
    },

    // Products
    async getProducts(filters?: {
      status?: string;
      category?: number | 'uncategorized';
      is_service?: boolean;
      search?: string;
      page?: number;
      supplier?: number;
      in_stock?: boolean;
    }) {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.category) params.append('category', filters.category.toString());
      if (filters?.is_service !== undefined) params.append('is_service', filters.is_service.toString());
      if (filters?.search) params.append('search', filters.search);
      if (filters?.page) params.append('page', filters.page.toString());
      if (filters?.supplier) params.append('supplier', filters.supplier.toString());
      if (filters?.in_stock !== undefined) params.append('in_stock', filters.in_stock.toString());

      const queryString = params.toString();
      const endpoint = `/catalog/products/${queryString ? `?${queryString}` : ''}`;
      return request<PaginatedResponse<Product>>(endpoint);
    },

    async getProductById(id: number) {
      return request<Product>(`/catalog/products/${id}/`);
    },

    async getProductPrices(id: number) {
      const response = await request<PaginatedResponse<ProductPriceHistory> | ProductPriceHistory[]>(`/catalog/products/${id}/prices/`);
      if (response && typeof response === 'object' && 'results' in response) {
        return response.results;
      }
      return response as ProductPriceHistory[];
    },

    async verifyProduct(id: number) {
      return request<Product>(`/catalog/products/${id}/verify/`, { method: 'POST' });
    },

    async archiveProduct(id: number) {
      return request<Product>(`/catalog/products/${id}/archive/`, { method: 'POST' });
    },

    async updateProduct(id: number, data: Partial<Product>) {
      return request<Product>(`/catalog/products/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async createProduct(data: Partial<Product>) {
      return request<Product>('/catalog/products/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async deleteProduct(id: number) {
      return request<void>(`/catalog/products/${id}/`, { method: 'DELETE' });
    },

    // Product moderation
    async findDuplicateProducts() {
      return request<ProductDuplicate[]>('/catalog/products/duplicates/');
    },

    async mergeProducts(data: { source_ids: number[]; target_id: number }) {
      return request<{ status: string }>('/catalog/products/merge/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    // Supplier Catalogs (PDF parsing)
    async getSupplierCatalogs() {
      const response = await request<PaginatedResponse<SupplierCatalog> | SupplierCatalog[]>('/catalog/supplier-catalogs/');
      if (response && typeof response === 'object' && 'results' in response) {
        return response.results;
      }
      return response as SupplierCatalog[];
    },

    async getSupplierCatalog(id: number) {
      return request<SupplierCatalog>(`/catalog/supplier-catalogs/${id}/`);
    },

    async uploadSupplierCatalog(formData: FormData) {
      return request<SupplierCatalog>('/catalog/supplier-catalogs/', {
        method: 'POST',
        body: formData,
        headers: {},
      });
    },

    async deleteSupplierCatalog(id: number) {
      return request<void>(`/catalog/supplier-catalogs/${id}/`, { method: 'DELETE' });
    },

    async detectCatalogToc(id: number, tocPages: number = 6) {
      return request<{ sections: SupplierCatalogSection[] }>(`/catalog/supplier-catalogs/${id}/detect-toc/`, {
        method: 'POST',
        body: JSON.stringify({ toc_pages: tocPages }),
      });
    },

    async updateCatalogSections(id: number, sections: SupplierCatalogSection[]) {
      return request<SupplierCatalog>(`/catalog/supplier-catalogs/${id}/update-sections/`, {
        method: 'PATCH',
        body: JSON.stringify({ sections }),
      });
    },

    async parseCatalog(id: number) {
      return request<{ status: string; task_id: string }>(`/catalog/supplier-catalogs/${id}/parse/`, { method: 'POST' });
    },

    async importCatalogToDb(id: number, reset: boolean = false) {
      return request<{ status: string; task_id: string }>(`/catalog/supplier-catalogs/${id}/import-to-db/`, {
        method: 'POST',
        body: JSON.stringify({ reset }),
      });
    },

    async cancelCatalogTask(id: number) {
      return request<{ status: string }>(`/catalog/supplier-catalogs/${id}/cancel/`, { method: 'POST' });
    },
  };
}
