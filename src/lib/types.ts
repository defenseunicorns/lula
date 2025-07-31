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
}

export interface Mapping {
  uuid: string;
  control_id: string;
  justification: string;
  source_entries: SourceEntry[];
  created_by: string;
  created_at: string;
  status: 'planned' | 'implemented' | 'verified';
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