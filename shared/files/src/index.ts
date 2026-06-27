/**
 * link + base URL → full public URL.
 * ("2025/06/27/15/uuid.pdf", "https://domain.com/files") → "https://domain.com/files/2025/06/27/15/uuid.pdf"
 *
 * link is a relative path stored in the database (e.g. document.path, image.path).
 * baseUrl is the public files endpoint, constructed via buildFilesBaseUrl().
 */
export function buildFileUrl(link: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/${link}`;
}

/**
 * BASE_DOMAIN + FILES_URL_PATH → base URL for files.
 * ("domain.com", "/files") → "https://domain.com/files"
 *
 * Each service receives BASE_DOMAIN and FILES_URL_PATH from env,
 * and calls this to build the base URL once at startup.
 */
export function buildFilesBaseUrl(domain: string, urlPath: string): string {
  return `https://${domain}${urlPath}`;
}