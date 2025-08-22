// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

/**
 * Comprehensive OSCAL type definitions for catalog and profile processing
 */

// Base OSCAL types
export interface OSCALMetadata {
  title: string;
  'last-modified': string;
  version: string;
  'oscal-version': string;
  props?: OSCALProperty[];
  links?: OSCALLink[];
  roles?: OSCALRole[];
  parties?: OSCALParty[];
  'responsible-parties'?: OSCALResponsibleParty[];
}

export interface OSCALProperty {
  name: string;
  value: string;
  class?: string;
  ns?: string;
  uuid?: string;
}

export interface OSCALLink {
  href: string;
  rel?: string;
  'media-type'?: string;
  text?: string;
}

export interface OSCALRole {
  id: string;
  title: string;
  'short-name'?: string;
  description?: string;
}

export interface OSCALParty {
  uuid: string;
  type: 'person' | 'organization';
  name?: string;
  'short-name'?: string;
  'email-addresses'?: string[];
  'telephone-numbers'?: string[];
  addresses?: OSCALAddress[];
  links?: OSCALLink[];
  props?: OSCALProperty[];
}

export interface OSCALAddress {
  'addr-lines'?: string[];
  city?: string;
  state?: string;
  'postal-code'?: string;
  country?: string;
}

export interface OSCALResponsibleParty {
  'role-id': string;
  'party-uuids': string[];
}

// Back-matter types
export interface OSCALBackMatter {
  resources?: OSCALResource[];
}

export interface OSCALResource {
  uuid: string;
  title?: string;
  description?: string;
  citation?: OSCALCitation;
  rlinks?: OSCALResourceLink[];
  base64?: OSCALBase64;
  props?: OSCALProperty[];
}

export interface OSCALCitation {
  text: string;
  props?: OSCALProperty[];
  links?: OSCALLink[];
}

export interface OSCALResourceLink {
  href: string;
  'media-type'?: string;
  hashes?: OSCALHash[];
}

export interface OSCALHash {
  algorithm: string;
  value: string;
}

export interface OSCALBase64 {
  filename?: string;
  'media-type'?: string;
  value: string;
}

// Catalog types
export interface OSCALCatalog {
  catalog: {
    uuid: string;
    metadata: OSCALMetadata;
    params?: OSCALParameter[];
    groups?: OSCALGroup[];
    controls?: OSCALControl[];
    'back-matter'?: OSCALBackMatter;
  };
}

export interface OSCALGroup {
  id?: string;
  class?: string;
  title: string;
  params?: OSCALParameter[];
  props?: OSCALProperty[];
  links?: OSCALLink[];
  parts?: OSCALPart[];
  groups?: OSCALGroup[];
  controls?: OSCALControl[];
}

export interface OSCALControl {
  id: string;
  class?: string;
  title: string;
  params?: OSCALParameter[];
  props?: OSCALProperty[];
  links?: OSCALLink[];
  parts?: OSCALPart[];
  controls?: OSCALControl[];
}

export interface OSCALParameter {
  id: string;
  class?: string;
  label?: string;
  usage?: string;
  constraints?: OSCALConstraint[];
  guidelines?: OSCALGuideline[];
  values?: string[];
  select?: OSCALParameterSelection;
  props?: OSCALProperty[];
  links?: OSCALLink[];
}

export interface OSCALConstraint {
  description?: string;
  tests?: OSCALTest[];
}

export interface OSCALTest {
  expression: string;
  remarks?: string;
}

export interface OSCALGuideline {
  prose: string;
}

export interface OSCALParameterSelection {
  'how-many'?: 'one' | 'one-or-more';
  choice?: string[];
}

export interface OSCALPart {
  id?: string;
  name: string;
  ns?: string;
  class?: string;
  title?: string;
  props?: OSCALProperty[];
  prose?: string;
  parts?: OSCALPart[];
  links?: OSCALLink[];
}

// Profile types
export interface OSCALProfile {
  profile: {
    uuid: string;
    metadata: OSCALMetadata;
    imports: OSCALImport[];
    merge?: OSCALMerge;
    modify?: OSCALModify;
    'back-matter'?: OSCALBackMatter;
  };
}

export interface OSCALImport {
  href: string;
  'include-all'?: {};
  'include-controls'?: OSCALSelectControlById[];
  'exclude-controls'?: OSCALSelectControlById[];
}

export interface OSCALSelectControlById {
  'control-id': string;
  'with-child-controls'?: 'yes' | 'no';
}

export interface OSCALMerge {
  combine?: OSCALCombine;
  flat?: {};
  'as-is'?: boolean;
  custom?: OSCALCustom;
}

export interface OSCALCombine {
  method?: 'use-first' | 'merge' | 'keep';
}

export interface OSCALCustom {
  groups?: OSCALInsertControls[];
  'insert-controls'?: OSCALInsertControls[];
}

export interface OSCALInsertControls {
  order?: 'keep' | 'ascending' | 'descending';
  'include-all'?: {};
  'include-controls'?: OSCALSelectControlById[];
  'exclude-controls'?: OSCALSelectControlById[];
}

export interface OSCALModify {
  'set-parameters'?: OSCALSetParameter[];
  alters?: OSCALAlter[];
}

export interface OSCALSetParameter {
  'param-id': string;
  class?: string;
  values?: string[];
  select?: OSCALParameterSelection;
  links?: OSCALLink[];
  props?: OSCALProperty[];
  constraints?: OSCALConstraint[];
  guidelines?: OSCALGuideline[];
}

export interface OSCALAlter {
  'control-id': string;
  removes?: OSCALRemove[];
  adds?: OSCALAdd[];
}

export interface OSCALRemove {
  'by-name'?: string;
  'by-class'?: string;
  'by-id'?: string;
  'by-ns'?: string;
  'by-item-name'?: string;
}

export interface OSCALAdd {
  position?: 'before' | 'after' | 'starting' | 'ending';
  'by-id'?: string;
  title?: string;
  params?: OSCALParameter[];
  props?: OSCALProperty[];
  links?: OSCALLink[];
  parts?: OSCALPart[];
}

// Internal processed types for YAML output
export interface ProcessedControl {
  id: string;
  title: string;
  class?: string;
  family: string;
  sort_id: string;
  statement?: string;
  guidance?: string;
  objectives?: string[];
  assessment_methods?: string[];
  parameters?: ProcessedParameter[];
  enhancements?: ProcessedControl[];
  properties?: { [key: string]: string };
  links?: OSCALLink[];
  profile_priority?: string;
  source_catalog?: string;
  source_profile?: string;
}

export interface ProcessedParameter {
  id: string;
  label?: string;
  usage?: string;
  values?: string[];
  guidelines?: string[];
  constraints?: string[];
}

export interface ProcessedMetadata {
  title: string;
  version: string;
  last_modified: string;
  oscal_version: string;
  uuid: string;
  source_type: 'catalog' | 'profile';
  source_file: string;
  processed_at: string;
  roles?: OSCALRole[];
  parties?: OSCALParty[];
  responsible_parties?: OSCALResponsibleParty[];
  properties?: { [key: string]: string };
  links?: OSCALLink[];
}

export interface ProcessedBackMatter {
  resources: { [uuid: string]: OSCALResource };
}
