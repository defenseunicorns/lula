
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors
export interface Control {
  id: string;
  title: string;
  family: string;
  class?: string;
  sort_id?: string;
  statement?: string;
  guidance?: string;
  objectives?: string[];
  assessment_methods?: string[];
  properties?: { [key: string]: string };
  links?: Array<{
    href: string;
    rel?: string;
    text?: string;
  }>;
  parameters?: Array<{
    id: string;
    label?: string;
    usage?: string;
    values?: string[];
    guidelines?: string[];
    constraints?: string[];
  }>;
  enhancements?: Control[];
  // Allow dynamic field access for form components
  [key: string]: any;
}

export interface Mapping {
  uuid: string;
  control_id: string;
  justification: string;
  source_entries: SourceEntry[];
  status: 'planned' | 'implemented' | 'verified';
  created_by?: string;
}

export interface SourceEntry {
  file: string;
  line: number;
  context?: string;
}

export interface ControlWithMappings extends Control {
  mappings: Mapping[];
}

export interface SearchResult {
  controls: Control[];
  mappings: Mapping[];
}

export interface Stats {
  controls: number;
  mappings: number;
  families: number;
  familyList: string[];
}

export interface ControlSet {
  title: string;
  version: string;
  last_modified?: string;
  oscal_version?: string;
  uuid?: string;
  source_type?: string;
  source_file?: string;
  processed_at?: string;
  path?: string; // directory path for this control set
  families?: string[]; // derived from directory structure at runtime

  // Dynamic field schema from OSCAL import
  field_schema?: {
    fields: {
      [fieldName: string]: {
        type: string;
        ui_type: string;
        is_array: boolean;
        max_length: number;
        usage_count: number;
        usage_percentage: number;
        required: boolean;
        visible: boolean;
        show_in_table: boolean;
        editable: boolean;
        display_order: number;
        category: string;
        examples?: string[];
        array_item_type?: string;
      };
    };
    total_controls: number;
    analyzed_at: string;
  };
}

export interface ControlSetInfo {
  currentSet: ControlSet;
  availableSets: ControlSet[];
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  authorEmail: string;
  date: string;
  message: string;
  changes: {
    insertions: number;
    deletions: number;
    files: number;
  };
  diff?: string; // The actual file diff
  yamlDiff?: any; // Intelligent YAML diff (YamlDiffResult)
  type?: string; // 'control' or 'mapping' - added by unified endpoint
  fileType?: string; // 'Control File' or 'Mappings' - added by unified endpoint
  isPending?: boolean; // true for uncommitted changes
  isStaged?: boolean; // true for staged changes (optional since user doesn't care about staged vs unstaged)
}

export interface GitFileHistory {
  filePath: string;
  commits: GitCommit[];
  totalCommits: number;
  firstCommit: GitCommit | null;
  lastCommit: GitCommit | null;
}

export interface ControlWithHistory extends Control {
  history?: GitFileHistory;
}

export interface UnifiedHistory {
  commits: GitCommit[];
  totalCommits: number;
  controlCommits: number;
  mappingCommits: number;
  controlFilePath?: string;
  mappingFilePath?: string;
}

export interface ControlCompleteData {
  control: Control;
  mappings: Mapping[];
  unifiedHistory: UnifiedHistory;
}
