// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import * as fs from 'fs';
import * as path from 'path';
import { stringify as yamlStringify } from 'yaml';
import {
  OSCALCatalog,
  OSCALProfile,
  OSCALControl,
  OSCALPart,
  OSCALResource,
  ProcessedControl,
  ProcessedMetadata,
  ProcessedBackMatter,
  ProcessedParameter,
  OSCALParameter,
  OSCALModify
} from './types.js';

export class OSCALProcessor {
  private backMatterResources: Map<string, OSCALResource> = new Map();
  private processedMetadata: ProcessedMetadata | null = null;

  /**
   * Process an OSCAL catalog file and output to YAML
   */
  async processCatalog(
    catalogPath: string,
    outputDir: string,
    options: { 
      overwrite?: boolean; 
      dryRun?: boolean; 
      flattenReferences?: boolean;
      includeLinks?: boolean;
      resolveParameters?: boolean;
    } = {}
  ): Promise<void> {
    const catalogData = JSON.parse(fs.readFileSync(catalogPath, 'utf8')) as OSCALCatalog;
    const catalog = catalogData.catalog;

    // Process metadata
    this.processedMetadata = this.extractMetadata(catalog.metadata, 'catalog', catalogPath);

    // Process back-matter resources
    if (catalog['back-matter']?.resources) {
      for (const resource of catalog['back-matter'].resources) {
        this.backMatterResources.set(resource.uuid, resource);
      }
    }

    // Process controls
    const controls: ProcessedControl[] = [];
    
    if (catalog.groups) {
      for (const group of catalog.groups) {
        controls.push(...this.processGroupControls(group, group.id || 'UNKNOWN', options));
      }
    }

    if (catalog.controls) {
      controls.push(...this.processControls(catalog.controls, 'MISC', options));
    }

    // Post-process controls based on options
    if (options.flattenReferences) {
      this.flattenBackMatterReferences(controls);
    }
    
    if (options.includeLinks === false) {
      this.removeInternalLinks(controls);
    }

    // Write output files
    await this.writeOutputFiles(controls, outputDir, options);
  }

  /**
   * Process an OSCAL profile file and output to YAML
   */
  async processProfile(
    profilePath: string,
    outputDir: string,
    catalogResolver: (href: string) => Promise<OSCALCatalog>,
    options: { 
      overwrite?: boolean; 
      dryRun?: boolean; 
      flattenReferences?: boolean;
      includeLinks?: boolean;
      resolveParameters?: boolean;
    } = {}
  ): Promise<void> {
    const profileData = JSON.parse(fs.readFileSync(profilePath, 'utf8')) as OSCALProfile;
    const profile = profileData.profile;

    // Process metadata
    this.processedMetadata = this.extractMetadata(profile.metadata, 'profile', profilePath);

    // Process back-matter resources
    if (profile['back-matter']?.resources) {
      for (const resource of profile['back-matter'].resources) {
        this.backMatterResources.set(resource.uuid, resource);
      }
    }

    // Process imports and resolve controls
    const controls: ProcessedControl[] = [];
    
    for (const importDef of profile.imports) {
      const resolvedCatalog = await catalogResolver(importDef.href);
      const importedControls = this.resolveImportedControls(
        resolvedCatalog, 
        importDef,
        options
      );
      controls.push(...importedControls);
    }

    // Apply profile modifications
    if (profile.modify) {
      this.applyProfileModifications(controls, profile.modify);
    }

    // Post-process controls based on options
    if (options.flattenReferences) {
      this.flattenBackMatterReferences(controls);
    }
    
    if (options.includeLinks === false) {
      this.removeInternalLinks(controls);
    }

    // Write output files
    await this.writeOutputFiles(controls, outputDir, options);
  }

  private extractMetadata(metadata: any, sourceType: 'catalog' | 'profile', sourceFile: string): ProcessedMetadata {
    return {
      title: metadata.title,
      version: metadata.version,
      last_modified: metadata['last-modified'],
      oscal_version: metadata['oscal-version'],
      uuid: metadata.uuid || 'unknown',
      source_type: sourceType,
      source_file: path.basename(sourceFile),
      processed_at: new Date().toISOString(),
      roles: metadata.roles,
      parties: metadata.parties,
      responsible_parties: metadata['responsible-parties'],
      properties: this.extractProperties(metadata.props),
      links: metadata.links,
    };
  }

  private processGroupControls(group: any, familyId: string, options: any = {}): ProcessedControl[] {
    const controls: ProcessedControl[] = [];
    
    if (group.controls) {
      controls.push(...this.processControls(group.controls, familyId, options));
    }

    if (group.groups) {
      for (const subgroup of group.groups) {
        controls.push(...this.processGroupControls(subgroup, subgroup.id || familyId, options));
      }
    }

    return controls;
  }

  private processControls(controls: OSCALControl[], familyId: string, options: any = {}): ProcessedControl[] {
    return controls.map(control => this.processControl(control, familyId, options))
      .filter((control): control is ProcessedControl => control !== null);
  }

  private processControl(control: OSCALControl, familyId: string, options: any = {}): ProcessedControl | null {
    // Skip controls that are withdrawn
    const status = control.props?.find(prop => prop.name === 'status')?.value;
    if (status === 'Withdrawn') {
      console.log(`Skipping withdrawn control: ${control.id}`);
      return null;
    }

    const processedControl: ProcessedControl = {
      id: control.id,
      title: control.title,
      class: control.class,
      family: familyId,
      sort_id: this.generateSortId(control.id),
      properties: this.extractProperties(control.props),
      links: control.links,
    };

    // Process parameters first (needed for parameter resolution)
    if (control.params) {
      processedControl.parameters = control.params.map(param => this.processParameter(param));
    }

    // Process parts (statement, guidance, objectives, etc.)
    if (control.parts) {
      this.processControlParts(control.parts, processedControl, options.resolveParameters || false);
    }

    // Remove parameters from control if they were resolved in the text
    if (options.resolveParameters && processedControl.parameters) {
      delete processedControl.parameters;
    }

    // Process sub-controls/enhancements
    if (control.controls) {
      processedControl.enhancements = control.controls.map(subControl => 
        this.processControl(subControl, familyId, options)
      ).filter((control): control is ProcessedControl => control !== null);
    }

    return processedControl;
  }

  private processControlParts(parts: OSCALPart[], control: ProcessedControl, resolveParams: boolean = false): void {
    for (const part of parts) {
      switch (part.name) {
        case 'statement':
          control.statement = this.extractPartText(part, control.parameters, resolveParams);
          break;
        case 'guidance':
          control.guidance = this.extractPartText(part, control.parameters, resolveParams);
          break;
        case 'objective':
          if (!control.objectives) control.objectives = [];
          // Process the entire objective structure and flatten to strings
          const objectiveStructure = this.extractObjectiveStructure(part, control.parameters, resolveParams);
          const flattenedObjectives = this.flattenObjectiveStructure(objectiveStructure);
          control.objectives.push(...flattenedObjectives);
          break;
        case 'assessment':
        case 'assessment-method':
          if (!control.assessment_methods) control.assessment_methods = [];
          control.assessment_methods.push(this.extractPartText(part, control.parameters, resolveParams));
          break;
        default:
          // Recursively process nested parts for other part types
          if (part.parts) {
            this.processControlParts(part.parts, control, resolveParams);
          }
          break;
      }
    }
  }

  private extractPartText(part: OSCALPart, parameters?: ProcessedParameter[], resolveParams: boolean = false): string {
    let text = part.prose || '';
    
    if (part.parts) {
      const subTexts = part.parts.map(subPart => this.extractPartText(subPart, parameters, resolveParams));
      text += subTexts.join(' ');
    }

    // Resolve parameter insertions if requested and parameters are available
    if (resolveParams && parameters) {
      text = this.resolveParameterInsertions(text, parameters);
    }

    return text.trim();
  }


  /**
   * Extract objectives as a structured array preserving OSCAL hierarchy
   */
  private extractObjectiveStructure(part: OSCALPart, parameters?: ProcessedParameter[], resolveParams: boolean = false): any {
    // Handle the root objective structure
    if (part.prose && part.parts && part.parts.length > 0) {
      // This is a header with sub-objectives
      let prose = part.prose;
      if (resolveParams && parameters) {
        prose = this.resolveParameterInsertions(prose, parameters);
      }
      
      const subObjectives: any[] = [];
      for (const subPart of part.parts) {
        if (subPart.name === 'objective') {
          const subObj = this.extractObjectiveStructure(subPart, parameters, resolveParams);
          if (subObj) {
            subObjectives.push(subObj);
          }
        }
      }
      
      // Return an object with header and sub-items
      return {
        header: prose,
        items: subObjectives
      };
    } else if (part.prose) {
      // Simple objective with just prose
      let prose = part.prose;
      if (resolveParams && parameters) {
        prose = this.resolveParameterInsertions(prose, parameters);
      }
      return prose;
    } else if (part.parts && part.parts.length > 0) {
      // No prose but has sub-parts
      const subObjectives: any[] = [];
      for (const subPart of part.parts) {
        if (subPart.name === 'objective') {
          const subObj = this.extractObjectiveStructure(subPart, parameters, resolveParams);
          if (subObj) {
            subObjectives.push(subObj);
          }
        }
      }
      return subObjectives.length === 1 ? subObjectives[0] : subObjectives;
    }
    
    return null;
  }

  /**
   * Flatten the structured objectives back to a clean string array with proper hierarchy
   */
  private flattenObjectiveStructure(structure: any): string[] {
    if (!structure) return [];
    
    if (typeof structure === 'string') {
      return [structure];
    }
    
    if (Array.isArray(structure)) {
      const result: string[] = [];
      for (const item of structure) {
        result.push(...this.flattenObjectiveStructure(item));
      }
      return result;
    }
    
    if (structure.header && structure.items) {
      const result: string[] = [structure.header];
      for (const item of structure.items) {
        const flattened = this.flattenObjectiveStructure(item);
        for (const flatItem of flattened) {
          // Indent sub-items to show hierarchy
          result.push(`  ${flatItem}`);
        }
      }
      return result;
    }
    
    return [];
  }

  private resolveParameterInsertions(text: string, parameters: ProcessedParameter[]): string {
    // Create a map for quick parameter lookup
    const paramMap = new Map(parameters.map(p => [p.id, p.label || `[${p.id}]`]));
    
    // Replace {{ insert: param, parameter_id }} with [parameter_label]
    return text.replace(/\{\{\s*insert:\s*param,\s*([^}]+)\s*\}\}/g, (match, paramId) => {
      const paramLabel = paramMap.get(paramId.trim());
      return paramLabel ? `[${paramLabel}]` : match;
    });
  }

  private processParameter(param: OSCALParameter): ProcessedParameter {
    return {
      id: param.id,
      label: param.label,
      usage: param.usage,
      values: param.values,
      guidelines: param.guidelines?.map(g => g.prose),
      constraints: param.constraints?.map(c => c.description || '').filter(Boolean),
    };
  }

  private resolveImportedControls(
    catalog: OSCALCatalog,
    importDef: any,
    options: any = {}
  ): ProcessedControl[] {
    const allControls: ProcessedControl[] = [];

    // Extract all controls from catalog
    if (catalog.catalog.groups) {
      for (const group of catalog.catalog.groups) {
        allControls.push(...this.processGroupControls(group, group.id || 'UNKNOWN', options));
      }
    }

    if (catalog.catalog.controls) {
      allControls.push(...this.processControls(catalog.catalog.controls, 'MISC', options));
    }

    // Process back-matter from catalog
    if (catalog.catalog['back-matter']?.resources) {
      for (const resource of catalog.catalog['back-matter'].resources) {
        this.backMatterResources.set(resource.uuid, resource);
      }
    }

    // Filter controls based on import specification
    let selectedControls = allControls;

    if (importDef['include-controls']) {
      // Handle both formats: with-ids array or control-id direct
      const includeIds = new Set<string>();
      for (const includeSpec of importDef['include-controls']) {
        if (includeSpec['with-ids']) {
          // Array format: { "with-ids": ["ac-1", "ac-2"] }
          for (const id of includeSpec['with-ids']) {
            includeIds.add(id);
          }
        } else if (includeSpec['control-id']) {
          // Direct format: { "control-id": "ac-1" }
          includeIds.add(includeSpec['control-id']);
        }
      }
      selectedControls = allControls.filter(control => includeIds.has(control.id));
    }

    if (importDef['exclude-controls']) {
      const excludeIds = new Set<string>();
      for (const excludeSpec of importDef['exclude-controls']) {
        if (excludeSpec['with-ids']) {
          for (const id of excludeSpec['with-ids']) {
            excludeIds.add(id);
          }
        } else if (excludeSpec['control-id']) {
          excludeIds.add(excludeSpec['control-id']);
        }
      }
      selectedControls = selectedControls.filter(control => !excludeIds.has(control.id));
    }

    // Source information is already stored in control-set.yaml metadata

    return selectedControls;
  }

  private applyProfileModifications(controls: ProcessedControl[], modify: OSCALModify): void {
    // Apply parameter settings
    if (modify['set-parameters']) {
      for (const setParam of modify['set-parameters']) {
        for (const control of controls) {
          if (control.parameters) {
            const param = control.parameters.find(p => p.id === setParam['param-id']);
            if (param) {
              if (setParam.values) param.values = setParam.values;
              if (setParam.guidelines) param.guidelines = setParam.guidelines.map(g => g.prose);
            }
          }
        }
      }
    }

    // Apply alterations (adds/removes)
    if (modify.alters) {
      for (const alter of modify.alters) {
        const control = controls.find(c => c.id === alter['control-id']);
        if (control) {
          // Handle adds - for now, we'll add properties
          if (alter.adds) {
            for (const add of alter.adds) {
              if (add.props) {
                if (!control.properties) control.properties = {};
                for (const prop of add.props) {
                  control.properties[prop.name] = prop.value;
                }
              }
            }
          }
        }
      }
    }
  }

  private async writeOutputFiles(
    controls: ProcessedControl[],
    outputDir: string,
    options: { overwrite?: boolean; dryRun?: boolean }
  ): Promise<void> {
    // Flatten enhancements into separate controls
    const flattenedControls = this.flattenEnhancements(controls);
    
    if (options.dryRun) {
      console.log(`Would process ${flattenedControls.length} controls to ${outputDir}`);
      return;
    }

    // Create directory structure
    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(path.join(outputDir, 'controls'), { recursive: true });

    // Write metadata
    const metadataPath = path.join(outputDir, 'control-set.yaml');
    if (!fs.existsSync(metadataPath) || options.overwrite) {
      fs.writeFileSync(metadataPath, yamlStringify(this.processedMetadata));
    }

    // Write back-matter resources (only when preserving OSCAL structure)
    if (this.backMatterResources.size > 0) {
      const backMatterPath = path.join(outputDir, 'back-matter.yaml');
      const backMatter: ProcessedBackMatter = {
        resources: Object.fromEntries(this.backMatterResources)
      };
      if (!fs.existsSync(backMatterPath) || options.overwrite) {
        fs.writeFileSync(backMatterPath, yamlStringify(backMatter));
      }
    }

    // Group controls by family
    const controlsByFamily = new Map<string, ProcessedControl[]>();
    for (const control of flattenedControls) {
      if (!controlsByFamily.has(control.family)) {
        controlsByFamily.set(control.family, []);
      }
      controlsByFamily.get(control.family)!.push(control);
    }

    // Write controls by family
    for (const [family, familyControls] of controlsByFamily) {
      const familyDir = path.join(outputDir, 'controls', family);
      fs.mkdirSync(familyDir, { recursive: true });

      for (const control of familyControls) {
        // Remove enhancements from control since they're now separate
        const outputControl = { ...control };
        delete outputControl.enhancements;
        
        const controlPath = path.join(familyDir, `${control.id}.yaml`);
        if (!fs.existsSync(controlPath) || options.overwrite) {
          fs.writeFileSync(controlPath, yamlStringify(outputControl));
        }
      }
    }

    console.log(`Processed ${flattenedControls.length} controls to ${outputDir}`);
  }

  /**
   * Flatten control enhancements into separate top-level controls
   */
  private flattenEnhancements(controls: ProcessedControl[]): ProcessedControl[] {
    const flattened: ProcessedControl[] = [];
    
    for (const control of controls) {
      // Add the main control
      flattened.push(control);
      
      // Add enhancements as separate controls
      if (control.enhancements) {
        for (const enhancement of control.enhancements) {
          // Enhancement inherits family from parent
          enhancement.family = control.family;
          flattened.push(...this.flattenEnhancements([enhancement]));
        }
      }
    }
    
    return flattened;
  }

  private extractProperties(props?: any[]): { [key: string]: string } | undefined {
    if (!props) return undefined;
    
    const result: { [key: string]: string } = {};
    for (const prop of props) {
      result[prop.name] = prop.value;
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  private generateSortId(controlId: string): string {
    // Convert control ID to sortable format (e.g., AC-1 -> AC-0001)
    const match = controlId.match(/^([A-Z]+)-(\d+)(.*)$/);
    if (match) {
      const [, family, number, suffix] = match;
      return `${family}-${number.padStart(4, '0')}${suffix}`;
    }
    return controlId;
  }

  /**
   * Remove internal OSCAL links (references to back-matter) from controls
   */
  private removeInternalLinks(controls: ProcessedControl[]): void {
    for (const control of controls) {
      if (control.links) {
        // Remove links that start with # (internal references)
        control.links = control.links.filter(link => !link.href.startsWith('#'));
        if (control.links.length === 0) {
          delete control.links;
        }
      }
      
      // Process enhancements recursively
      if (control.enhancements) {
        this.removeInternalLinks(control.enhancements);
      }
    }
  }

  /**
   * Flatten back-matter references by resolving them to actual content
   */
  private flattenBackMatterReferences(controls: ProcessedControl[]): void {
    for (const control of controls) {
      if (control.links) {
        for (const link of control.links) {
          if (link.href.startsWith('#')) {
            const resourceId = link.href.substring(1);
            const resource = this.backMatterResources.get(resourceId);
            if (resource) {
              // Replace the link with resolved content
              if (resource.title) {
                link.text = resource.title;
              }
              if (resource.citation?.text) {
                link.text = resource.citation.text;
              }
              // Convert internal reference to external if possible
              if (resource.rlinks && resource.rlinks.length > 0) {
                link.href = resource.rlinks[0].href;
              }
            }
          }
        }
      }
      
      // Process enhancements recursively
      if (control.enhancements) {
        this.flattenBackMatterReferences(control.enhancements);
      }
    }
  }
}
