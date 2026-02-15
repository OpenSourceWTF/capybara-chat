/**
 * OrgSelector - GitHub organization selector with avatar
 *
 * Extracted from AddWorkspaceModal for better separation of concerns.
 */

import { ExternalLink, Plus } from 'lucide-react';
import { Select, Label } from '../ui';

export interface GitHubOrg {
  login: string;
  avatar_url: string;
  type: 'user' | 'org';
  installationId: number;
}

export interface OrgSelectorProps {
  orgs: GitHubOrg[];
  selectedOrg: string;
  loading: boolean;
  onOrgChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onAddOrganization: () => void;
}

export function OrgSelector({
  orgs,
  selectedOrg,
  loading,
  onOrgChange,
  onAddOrganization,
}: OrgSelectorProps) {
  const selectedOrgInfo = orgs.find(o => o.login === selectedOrg);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs uppercase tracking-wide">Organization</Label>
        <button
          type="button"
          onClick={onAddOrganization}
          className="text-2xs uppercase font-bold text-primary hover:underline flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          Add Organization
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        {/* Org avatar */}
        {selectedOrgInfo && (
          <img
            src={selectedOrgInfo.avatar_url}
            alt={selectedOrgInfo.login}
            className="w-8 h-8 rounded-none border border-border flex-shrink-0"
          />
        )}
        <Select
          value={selectedOrg}
          onChange={onOrgChange}
          disabled={loading}
          className="flex-1"
        >
          {loading ? (
            <option>Loading...</option>
          ) : orgs.length === 0 ? (
            <option>No organizations found</option>
          ) : (
            orgs.map((org) => (
              <option key={org.login} value={org.login}>
                {org.login} {org.type === 'user' ? '(personal)' : ''}
              </option>
            ))
          )}
        </Select>
      </div>
    </div>
  );
}
