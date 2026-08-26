export interface GitHubHttpRequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface GitHubHttpResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export type GitHubFetch = (
  url: string,
  init?: GitHubHttpRequestInit
) => Promise<GitHubHttpResponse>;

export const defaultGitHubFetch: GitHubFetch = async (url, init) => {
  return fetch(url, init);
};
