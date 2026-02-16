/**
 * Server Utilities
 */

export { getSecretValue, getSecretId, getSecretIdByScope, getSecretsByPrefix, getSecret, type TokenResult, type SecretRow } from './secrets.js';
export { withTransaction, withTransactionAsync } from './transaction.js';

// Tag utilities
export { generateTagCloud, getUniqueTags } from './tag-utils.js';

// Route utilities (publish/unpublish/ownership helpers)
export { createPublishHandler, createUnpublishHandler, withIsOwner, withIsOwnerList } from './route-utils.js';

/**
 * Strip embedded credentials from a URL.
 */
export function stripCredentialsFromUrl(url: string): string {
  const credentialPattern = /^(https?:\/\/)[^@]+@/;
  if (credentialPattern.test(url)) {
    return url.replace(credentialPattern, '$1');
  }
  return url;
}
