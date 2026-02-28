export interface ConfluenceSpace {
  id: string;
  key: string;
  name: string;
  type?: string;
  status?: string;
  _links?: { webui?: string };
}

export interface ConfluencePage {
  id: string;
  title: string;
  status?: string;
  spaceId?: string;
  parentId?: string | null;
  version?: { number: number; message?: string };
  body?: {
    storage?: { value: string; representation: string };
    atlas_doc_format?: { value: string };
  };
  _links?: { webui?: string; tinyui?: string };
  createdAt?: string;
  authorId?: string;
}

export interface ConfluencePaginatedResult<T> {
  results: T[];
  _links?: { next?: string };
}
