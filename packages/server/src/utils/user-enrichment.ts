/**
 * User Enrichment Helper
 *
 * Enriches entities with author details (name, username, avatar)
 * by batch-fetching user profiles from the repository.
 */

import type { User } from '@capybara-chat/types';
import type { UserRepository } from '../repositories/user-repository.js';

export interface AuthorDetails {
  name: string;
  username: string;
  avatarUrl: string | null;
}

export interface EnrichedWithUser {
  author?: AuthorDetails;
}

/**
 * Batch-enrich a list of entities with author info.
 */
export function enrichWithUser<T extends { createdBy?: string | null }>(
  items: T[],
  userRepo: UserRepository
): (T & EnrichedWithUser)[] {
  const userIds = new Set<string>();
  items.forEach(item => {
    if (item.createdBy) userIds.add(item.createdBy);
  });

  if (userIds.size === 0) return items;

  const userMap = new Map<string, User>();
  userIds.forEach(id => {
    const user = userRepo.findById(id);
    if (user) userMap.set(id, user);
  });

  return items.map(item => {
    if (!item.createdBy) return item;
    const user = userMap.get(item.createdBy);
    if (!user) return item;
    return {
      ...item,
      author: {
        name: user.name || user.username,
        username: user.username,
        avatarUrl: user.avatarUrl,
      },
    };
  });
}

/**
 * Single item enrichment helper.
 */
export function enrichItemWithUser<T extends { createdBy?: string | null }>(
  item: T,
  userRepo: UserRepository
): T & EnrichedWithUser {
  if (!item.createdBy) return item;
  const user = userRepo.findById(item.createdBy);
  if (!user) return item;
  return {
    ...item,
    author: {
      name: user.name || user.username,
      username: user.username,
      avatarUrl: user.avatarUrl,
    },
  };
}
