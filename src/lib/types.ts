export interface Control {
  id: string;
  'control-acronym': string;
  'control-information': string;
  'control-implementation-status': 'Implemented' | 'Planned' | 'Not Implemented';
  'security-control-designation': 'Common' | 'Hybrid' | 'System-Specific';
  'control-implementation-narrative': string;
  cci: string;
  'cci-definition': string;
  'implementation-guidance': string;
  'assessment-procedures': string;
  inherited?: string;
  'remote-inheritance-instance'?: string;
  'compliance-status': 'Compliant' | 'Non-Compliant' | 'Not Assessed';
  'test-results'?: string;
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
  id: string;
  name: string;
  version: string;
  description: string;
  published: string;
  created: string;
  lastModified: string;
  path?: string; // directory path for this control set
  families?: string[]; // derived from directory structure at runtime
  
  // Schema derived from import process
  schema?: {
    name: string;
    version: string;
    importedFrom?: string; // which adapter was used during import
    fields: {
      id: string;
      label: string;
      type: 'text' | 'textarea' | 'select' | 'multi-select' | 'date' | 'number' | 'boolean';
      group: 'identification' | 'description' | 'implementation' | 'compliance' | 'metadata';
      required?: boolean;
      options?: string[]; // for select/multi-select fields
      defaultValue?: any;
      description?: string;
    }[];
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