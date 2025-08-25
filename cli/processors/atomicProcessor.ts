// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

/**
 * Universal Atomic Control Processor
 * 
 * Processes OSCAL catalogs and profiles into atomic control units,
 * with optional CCI enhancement for NIST frameworks.
 */

import * as fs from 'fs';
import * as path from 'path';
import { stringify as yamlStringify } from 'yaml';
import { BundledCCIProcessor } from './bundledCciProcessor.js';
import { 
  AtomicControl, 
  CCIControl, 
  ControlFramework, 
  AtomicImportOptions,
  AtomicControlType 
} from '../types/atomicControl.js';
import {
  OSCALCatalog,
  OSCALProfile
} from '../oscal/types.js';

export class AtomicProcessor {
  private cciProcessor: BundledCCIProcessor;
  private frameworks: Map<string, ControlFramework> = new Map();

  constructor() {
    this.cciProcessor = new BundledCCIProcessor();
    this.loadFrameworkRegistry();
  }

  /**
   * Process an OSCAL file into atomic controls
   */
  async processOSCAL(
    filePath: string,
    options: AtomicImportOptions
  ): Promise<{
    framework: ControlFramework;
    controls: AtomicControl[];
    metadata: any;
  }> {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Detect if this is a catalog or profile
    const isCatalog = !!content.catalog;
    const isProfile = !!content.profile;
    
    if (!isCatalog && !isProfile) {
      throw new Error('Input file must be an OSCAL catalog or profile');
    }

    // Process based on type
    let controls: AtomicControl[];
    let metadata: any;
    
    if (isCatalog) {
      const result = await this.processCatalog(content as OSCALCatalog, options);
      controls = result.controls;
      metadata = result.metadata;
    } else {
      const result = await this.processProfile(content as OSCALProfile, options);
      controls = result.controls;
      metadata = result.metadata;
    }

    // Detect framework
    const framework = this.detectFramework(metadata, options);
    
    // Deduplicate controls by ID (CCI processing creates duplicates)
    const uniqueControls = this.deduplicateControls(controls);
    
    // Save controls
    await this.saveControls(uniqueControls, options.output_dir, options.overwrite || false, options.dry_run || false);
    
    // Save framework metadata
    await this.saveFrameworkMetadata(framework, uniqueControls, options.output_dir, options.dry_run || false);

    // Save merged control-set.yaml file
    await this.saveControlSetFile(framework, uniqueControls, metadata, options.output_dir, options.dry_run || false);

    return { framework, controls: uniqueControls, metadata };
  }

  /**
   * Process OSCAL catalog
   */
  private async processCatalog(
    catalogData: OSCALCatalog,
    options: AtomicImportOptions
  ): Promise<{ controls: AtomicControl[]; metadata: any }> {
    const catalog = catalogData.catalog;
    const metadata = catalog.metadata;
    
    // Determine if this is a NIST catalog that should use CCI enhancement
    const isNIST = this.isNISTCatalog(metadata);
    const useCCI = isNIST && (options.use_cci ?? true);

    let controls: AtomicControl[] = [];

    if (useCCI) {
      console.log('Processing with CCI enhancement...');
      await this.cciProcessor.loadCCIDatabase();
      controls = await this.processCatalogWithCCI(catalog, options);
    } else {
      console.log('Processing at control level...');
      controls = await this.processCatalogAsControls(catalog, options);
    }

    return { controls, metadata };
  }

  /**
   * Process OSCAL profile (resolved catalogs only)
   */
  private async processProfile(
    _profileData: OSCALProfile,
    _options: AtomicImportOptions
  ): Promise<{ controls: AtomicControl[]; metadata: any }> {
    // We should only process resolved profile catalogs, not raw profiles
    // This method exists for compatibility but should not be used
    throw new Error('Raw profiles not supported. Use resolved profile catalogs instead.');
  }

  /**
   * Process catalog with CCI enhancement
   */
  private async processCatalogWithCCI(catalog: any, options: AtomicImportOptions): Promise<AtomicControl[]> {
    const controls: AtomicControl[] = [];
    
    if (!catalog.groups) {
      return controls;
    }

    for (const group of catalog.groups) {
      if (group.controls) {
        for (const control of group.controls) {
          // Get CCIs for this NIST control with optional revision filtering
          const ccis = this.cciProcessor.getCCIsForNISTControlWithRevision(
            control.id.toUpperCase(),
            options.nist_revision_filter
          );
          
          if (ccis.length > 0) {
            // Create atomic controls from CCIs using enhanced format
            for (const cci of ccis) {
              const enhancedControl = this.cciProcessor.convertCCIToEnhancedControl(cci, control);
              // Enrich with OSCAL data in enhanced format
              this.enrichEnhancedControlWithOSCAL(enhancedControl, control, { 
                resolveParameters: options.resolve_parameters || false,
                simpleMode: options.resolve_parameters || false 
              });
              controls.push(enhancedControl);
            }
          } else {
            // No CCIs found, create control-level atomic unit
            const atomicControl = this.convertOSCALToAtomic(control, 'nist', { 
              resolveParameters: options.resolve_parameters || false,
              simpleMode: options.resolve_parameters || false 
            });
            controls.push(atomicControl);
          }
        }
      }
    }

    return controls;
  }

  /**
   * Process catalog as control-level atomic units
   */
  private async processCatalogAsControls(catalog: any, options: AtomicImportOptions): Promise<AtomicControl[]> {
    const controls: AtomicControl[] = [];
    
    if (!catalog.groups) {
      return controls;
    }

    // Determine framework type from metadata
    const frameworkType = this.detectFrameworkType(catalog.metadata);
    
    for (const group of catalog.groups) {
      if (group.controls) {
        for (const control of group.controls) {
          const atomicControl = this.convertOSCALToAtomic(control, frameworkType, { 
            resolveParameters: options.resolve_parameters || false,
            simpleMode: false  // Always include full structure for better data representation
          });
          controls.push(atomicControl);
        }
      }
    }

    return controls;
  }

  /**
   * Convert OSCAL control to atomic control
   */
  private convertOSCALToAtomic(
    oscalControl: any, 
    frameworkType: AtomicControlType,
    options?: { resolveParameters?: boolean; simpleMode?: boolean }
  ): AtomicControl {
    const resolveParams = options?.resolveParameters || false;
    const simpleMode = options?.simpleMode || false;
    
    const atomicControl: AtomicControl = {
      id: oscalControl.id,
      type: frameworkType,
      title: oscalControl.title || '',
      definition: this.extractStatement(oscalControl, resolveParams) || oscalControl.title || '',
      framework: this.getFrameworkName(frameworkType),
      family: this.extractFamily(oscalControl.id),
      implementation_status: 'not_implemented',
      sort_id: oscalControl.id.toLowerCase(),
      class: oscalControl.class,
      guidance: this.extractGuidance(oscalControl, resolveParams),
      properties: simpleMode ? this.extractSimpleProperties(oscalControl) : (oscalControl.props ? this.convertProps(oscalControl.props) : undefined)
    };

    // In simple mode, only include essential data
    if (simpleMode) {
      // Override with simpler formatted definition
      atomicControl.definition = this.extractSimpleStatement(oscalControl, resolveParams);
      
      // Keep guidance as is (it's already simple)
      atomicControl.guidance = this.extractGuidance(oscalControl, resolveParams);
      
      // Remove the complex properties and only keep essential ones
      atomicControl.properties = this.extractSimpleProperties(oscalControl);
      
      // Don't add complex structured data - return early
      return atomicControl;
    }

    // Add parameters if present (only if not resolving parameters)
    if (oscalControl.params && oscalControl.params.length > 0 && !resolveParams) {
      atomicControl.parameters = oscalControl.params.map((param: any) => ({
        id: param.id,
        label: param.label,
        values: param.values,
        guidelines: param.guidelines?.map((g: any) => g.prose).filter(Boolean)
      }));
    }

    // Add structured statement parts
    const statementParts = this.extractStatementParts(oscalControl, resolveParams);
    if (statementParts && statementParts.length > 0) {
      atomicControl.statement_parts = statementParts;
    }

    // Add objectives if present
    const objectives = this.extractObjectives(oscalControl, resolveParams);
    if (objectives && objectives.length > 0) {
      atomicControl.objectives = objectives;
    }

    // Add assessment methods if present
    const assessmentMethods = this.extractAssessmentMethods(oscalControl, resolveParams);
    if (assessmentMethods && assessmentMethods.length > 0) {
      atomicControl.assessment_methods = assessmentMethods;
    }

    // Add links (but filter out internal references in simple mode)
    if (oscalControl.links && oscalControl.links.length > 0 && !simpleMode) {
      // Filter out internal OSCAL references that start with #
      const externalLinks = oscalControl.links.filter((link: any) => 
        !link.href?.startsWith('#')
      );
      if (externalLinks.length > 0) {
        atomicControl.links = externalLinks.map((link: any) => ({
          href: link.href,
          rel: link.rel,
          text: link.text
        }));
      }
    }

    return atomicControl;
  }

  /**
   * Enrich enhanced control with OSCAL data in clean format
   */
  private enrichEnhancedControlWithOSCAL(enhancedControl: any, oscalControl: any, options?: { resolveParameters?: boolean; simpleMode?: boolean }): void {
    const resolveParams = options?.resolveParameters || false;
    
    // Set title as separate field
    if (oscalControl.title) {
      enhancedControl.title = oscalControl.title;
    }
    
    // Set control-information field as structured array (similar to assessment-objectives)
    const statementParts = this.extractStatementAsStrings(oscalControl, resolveParams);
    if (statementParts && statementParts.length > 0) {
      enhancedControl['control-information'] = statementParts;
    }
    
    // Populate implementation-guidance field
    const guidance = this.extractGuidance(oscalControl, resolveParams);
    if (guidance) {
      enhancedControl['implementation-guidance'] = this.formatGuidanceText(guidance);
    }
    
    // Populate assessment-procedures field with assessment methods
    const assessmentMethods = this.extractAssessmentMethodsAsStrings(oscalControl, resolveParams);
    if (assessmentMethods && assessmentMethods.length > 0) {
      enhancedControl['assessment-procedures'] = assessmentMethods;
    }
    
    // Add parameters as structured data if available (for reference)
    if (oscalControl.params && oscalControl.params.length > 0 && !resolveParams) {
      enhancedControl['control-parameters'] = oscalControl.params.map((param: any) => ({
        id: param.id,
        label: param.label || '[Define]',
        values: param.values,
        guidelines: param.guidelines?.map((g: any) => g.prose).filter(Boolean)
      }));
    }
    
    // Add assessment objectives for reference (can be used in assessment-procedures)
    const objectives = this.extractObjectivesAsStrings(oscalControl, resolveParams, enhancedControl);
    if (objectives && objectives.length > 0) {
      // Keep as array for cleaner YAML structure and better version control
      enhancedControl['assessment-objectives'] = objectives;
    }
  }

  /**
   * Format control statement text with proper indentation and structure
   */
  private formatControlStatement(statement: string): string {
    // Split into logical parts and format with proper indentation
    let formatted = statement
      .replace(/;\s*and\s*/g, ';\n  ')  // Format list items
      .replace(/:\s*\(/g, ':\n  (')     // Format sub-items
      .replace(/\.\s+([A-Z])/g, '.\n\n$1') // Separate paragraphs
      .trim();
    
    return formatted;
  }

  /**
   * Format guidance text for readability
   */
  private formatGuidanceText(guidance: string): string {
    // Break long guidance into paragraphs and format
    let formatted = guidance
      .replace(/\.\s+([A-Z][^.]{20,})/g, '.\n\n$1')  // Break into paragraphs
      .replace(/;\s*([a-z])/g, ';\n  $1')            // Format lists
      .trim();
    
    return formatted;
  }

  /**
   * Enrich CCI with full OSCAL data structure
   */
  private enrichCCIWithOSCAL(cci: CCIControl, oscalControl: any, options?: { resolveParameters?: boolean; simpleMode?: boolean }): void {
    const resolveParams = options?.resolveParameters || false;
    const simpleMode = options?.simpleMode || false;
    
    // Add OSCAL-specific fields to the CCI while preserving CCI identity
    if (oscalControl.title && !cci.title.includes(oscalControl.title)) {
      cci.title = `${cci.title} (${oscalControl.title})`;
    }
    
    // Add parent NIST control statement (in addition to CCI definition)
    const oscalStatement = this.extractStatement(oscalControl, resolveParams);
    if (oscalStatement) {
      (cci as any).statement = oscalStatement;
    }
    
    // Add full OSCAL guidance
    const oscalGuidance = this.extractGuidance(oscalControl, resolveParams);
    if (oscalGuidance && !cci.guidance) {
      cci.guidance = oscalGuidance;
    }

    // Always add structured data from parent NIST control (even in simple mode)
    // This preserves the backup file's rich structure
    
    // Merge OSCAL properties with existing CCI properties
    if (oscalControl.props) {
      cci.properties = { ...cci.properties, ...this.convertProps(oscalControl.props) };
    }

    // Add OSCAL parameters if present (only if not resolving parameters)
    if (oscalControl.params && oscalControl.params.length > 0 && !resolveParams) {
      cci.parameters = oscalControl.params.map((param: any) => ({
        id: param.id,
        label: param.label,
        values: param.values,
        guidelines: param.guidelines?.map((g: any) => g.prose).filter(Boolean)
      }));
    }

    // Add structured objectives from OSCAL as arrays (preserve list structure)
    const objectives = this.extractObjectivesAsStrings(oscalControl, resolveParams, cci);
    if (objectives && objectives.length > 0) {
      cci.objectives = objectives;  // Keep as array for regular CCI format
    }

    // Add structured assessment methods from OSCAL as arrays (preserve list structure)
    const assessmentMethods = this.extractAssessmentMethodsAsStrings(oscalControl, resolveParams);
    if (assessmentMethods && assessmentMethods.length > 0) {
      cci.assessment_methods = assessmentMethods;
    }

    // Add structured statement parts from OSCAL (for complex controls)
    if (!simpleMode) {
      const statementParts = this.extractStatementParts(oscalControl, resolveParams);
      if (statementParts && statementParts.length > 0) {
        cci.statement_parts = statementParts;
      }
    }

    // Add OSCAL links (filter out internal references in simple mode)
    if (oscalControl.links && oscalControl.links.length > 0 && !simpleMode) {
      // Filter out internal OSCAL references that start with #
      const externalLinks = oscalControl.links.filter((link: any) => 
        !link.href?.startsWith('#')
      );
      if (externalLinks.length > 0) {
        cci.links = externalLinks.map((link: any) => ({
          href: link.href,
          rel: link.rel,
          text: link.text
        }));
      }
    }

    // Set the OSCAL class if available
    if (oscalControl.class) {
      cci.class = oscalControl.class;
    }

    // Add NIST control ID and properties for traceability
    (cci as any).parent_control = oscalControl.id;
    if (oscalControl.props) {
      const labelProp = oscalControl.props.find((p: any) => p.name === 'label');
      if (labelProp) {
        cci.properties = { 
          ...cci.properties, 
          nist_control_label: labelProp.value,
          nist_control_id: oscalControl.id
        };
      }
    }
  }

  /**
   * Save controls to files with family/NIST control structure
   */
  private async saveControls(
    controls: AtomicControl[],
    outputDir: string,
    overwrite: boolean,
    dryRun: boolean
  ): Promise<void> {
    const controlsDir = path.join(outputDir, 'controls');
    
    // Group controls by parent NIST control and family
    const controlGroups = this.groupControlsByNISTControl(controls);
    
    if (!dryRun) {
      if (!fs.existsSync(controlsDir)) {
        fs.mkdirSync(controlsDir, { recursive: true });
      }
    }

    for (const [nistControlId, groupedControls] of controlGroups.entries()) {
      // Extract family from enhanced format or fallback to regular format
      const family = (groupedControls[0] as any)?._metadata?.family?.toLowerCase() || groupedControls[0].family || 'unknown';
      const familyDir = path.join(controlsDir, family);
      
      if (!dryRun && !fs.existsSync(familyDir)) {
        fs.mkdirSync(familyDir, { recursive: true });
      }
      
      // Use the actual control ID for filename to ensure metadata mapping works
      groupedControls.forEach((control, index) => {
        // Use the actual control ID from the control itself
        const actualControlId = control.id;
        const filename = `${actualControlId}.yaml`;
        const filepath = path.join(familyDir, filename);
        
        if (!overwrite && fs.existsSync(filepath)) {
          console.log(`Skipping existing file: ${family}/${filename}`);
          return;
        }

        const yamlContent = yamlStringify(control, {
          lineWidth: 0,
          indent: 2
        });

        if (dryRun) {
          console.log(`Would create: ${family}/${filename}`);
        } else {
          fs.writeFileSync(filepath, yamlContent);
          console.log(`Created: ${family}/${filename}`);
        }
      });
    }
  }

  /**
   * Group controls by their parent NIST control ID
   */
  private groupControlsByNISTControl(controls: AtomicControl[]): Map<string, AtomicControl[]> {
    const groups = new Map<string, AtomicControl[]>();
    
    for (const control of controls) {
      // For enhanced controls, extract from control-acronym; for CCI controls, use parent_control; for others use control.id
      const nistControlId = (control as any)['control-acronym'] || (control as any).parent_control || control.id;
      
      if (!groups.has(nistControlId)) {
        groups.set(nistControlId, []);
      }
      groups.get(nistControlId)!.push(control);
    }
    
    // Sort controls within each group by CCI ID or control ID
    for (const [_, groupControls] of groups) {
      groupControls.sort((a, b) => {
        const aId = (a as any).cci || (a as any).cci_id || a.id;
        const bId = (b as any).cci || (b as any).cci_id || b.id;
        return aId.localeCompare(bId);
      });
    }
    
    return groups;
  }

  /**
   * Save merged control-set.yaml file
   */
  private async saveControlSetFile(
    framework: ControlFramework,
    controls: AtomicControl[],
    metadata: any,
    outputDir: string,
    dryRun: boolean
  ): Promise<void> {
    const controlSetFile = path.join(outputDir, 'control-set.yaml');
    
    // Group controls by family for family metadata
    const familyGroups = new Map<string, AtomicControl[]>();
    for (const control of controls) {
      // For enhanced controls, family is in _metadata.family; for regular controls, it's control.family
      const family = (control as any)?._metadata?.family?.toLowerCase() || control.family;
      if (family) {
        if (!familyGroups.has(family)) {
          familyGroups.set(family, []);
        }
        familyGroups.get(family)!.push(control);
      }
    }

    // Create family metadata
    const families = Array.from(familyGroups.keys()).sort().map(familyId => ({
      id: familyId,
      name: this.getFamilyDisplayName(familyId),
      control_count: familyGroups.get(familyId)!.length
    }));

    const controlSetData = {
      title: metadata.title || framework.name,
      version: framework.version,
      last_modified: new Date().toISOString(),
      oscal_version: metadata['oscal-version'] || '1.1.1',
      uuid: framework.id,
      source_type: 'profile',
      source_file: 'atomic-processor-generated.json',
      processed_at: new Date().toISOString(),
      created_by: 'compliance-manager-cli',

      // Project Configuration
      project: {
        name: outputDir.split('/').pop() || 'compliance-project',
        framework: {
          id: framework.id,
          name: framework.name,
          version: framework.version,
          baseline: this.extractBaseline(framework.name)
        },
        cci_enabled: framework.cci_enabled,
        default_granularity: framework.default_granularity
      },

      // Framework Metadata
      families,

      // OSCAL Metadata
      roles: [
        { id: 'creator', title: 'Document Creator' },
        { id: 'contact', title: 'Contact' }
      ],

      parties: [
        {
          uuid: '71c97c27-4f09-4d06-a6a4-065a54c19a1f',
          type: 'organization',
          name: 'Joint Task Force, Transformation Initiative',
          'email-addresses': ['sec-cert@nist.gov'],
          addresses: [{
            'addr-lines': [
              'National Institute of Standards and Technology',
              'Attn: Computer Security Division',
              'Information Technology Laboratory',
              '100 Bureau Drive (Mail Stop 8930)'
            ],
            city: 'Gaithersburg',
            state: 'MD',
            'postal-code': '20899-8930'
          }]
        }
      ],

      responsible_parties: [
        { 'role-id': 'creator', 'party-uuids': ['71c97c27-4f09-4d06-a6a4-065a54c19a1f'] },
        { 'role-id': 'contact', 'party-uuids': ['71c97c27-4f09-4d06-a6a4-065a54c19a1f'] }
      ],

      // Field Schema - Controls UI presentation and behavior
      field_schema: this.generateFieldSchema(controls, framework.cci_enabled),

      // Statistics
      statistics: {
        total_controls: controls.length,
        families: families.length,
        types: framework.cci_enabled ? ['cci'] : ['nist']
      }
    };

    const yamlContent = yamlStringify(controlSetData, {
      lineWidth: 0,
      indent: 2
    });

    if (dryRun) {
      console.log(`Would create control-set.yaml: ${controlSetFile}`);
    } else {
      fs.writeFileSync(controlSetFile, yamlContent);
      console.log(`Created control-set.yaml`);
    }
  }

  /**
   * Save framework metadata
   */
  private async saveFrameworkMetadata(
    framework: ControlFramework,
    controls: AtomicControl[],
    outputDir: string,
    dryRun: boolean
  ): Promise<void> {
    const metadataDir = path.join(outputDir, 'metadata');
    const frameworkFile = path.join(metadataDir, `${framework.id}.yaml`);
    
    if (!dryRun) {
      if (!fs.existsSync(metadataDir)) {
        fs.mkdirSync(metadataDir, { recursive: true });
      }
    }

    // Group controls by family for metadata
    const familyGroups = new Map<string, AtomicControl[]>();
    for (const control of controls) {
      // For enhanced controls, family is in _metadata.family; for regular controls, it's control.family
      const family = (control as any)?._metadata?.family?.toLowerCase() || control.family;
      if (family) {
        if (!familyGroups.has(family)) {
          familyGroups.set(family, []);
        }
        familyGroups.get(family)!.push(control);
      }
    }

    const frameworkData = {
      ...framework,
      families: Array.from(familyGroups.keys()).map(familyId => ({
        id: familyId,
        name: familyId.toUpperCase(),
        control_count: familyGroups.get(familyId)!.length
      })),
      statistics: {
        total_controls: controls.length,
        families: familyGroups.size,
        types: Array.from(new Set(controls.map(c => c.type)))
      }
    };

    const yamlContent = yamlStringify(frameworkData, {
      lineWidth: 0,
      indent: 2
    });

    if (dryRun) {
      console.log(`Would create framework metadata: ${frameworkFile}`);
    } else {
      fs.writeFileSync(frameworkFile, yamlContent);
      console.log(`Created framework metadata: ${framework.id}.yaml`);
    }
  }

  /**
   * Utility methods
   */
  private isNISTCatalog(metadata: any): boolean {
    const title = metadata.title?.toLowerCase() || '';
    return title.includes('nist') || title.includes('800-53');
  }

  private detectFrameworkType(metadata: any): AtomicControlType {
    const title = metadata.title?.toLowerCase() || '';
    
    if (title.includes('nist') || title.includes('800-53')) {
      return 'nist';
    } else if (title.includes('iso') || title.includes('27001')) {
      return 'iso';
    } else if (title.includes('cobit')) {
      return 'cobit';
    }
    
    return 'custom';
  }

  private detectFramework(metadata: any, options: AtomicImportOptions): ControlFramework {
    const frameworkType = this.detectFrameworkType(metadata);
    const frameworkName = this.getFrameworkName(frameworkType);
    
    return {
      id: frameworkName,
      name: metadata.title || frameworkName,
      version: metadata.version || options.framework_version || '1.0.0',
      description: metadata.description,
      publisher: metadata.publisher,
      default_granularity: options.use_cci ? 'cci' : 'control',
      cci_enabled: frameworkType === 'nist' && (options.use_cci ?? true)
    };
  }

  private getFrameworkName(type: AtomicControlType): string {
    switch (type) {
      case 'nist': return 'nist-800-53';
      case 'iso': return 'iso-27001';
      case 'cobit': return 'cobit';
      case 'cci': return 'nist-800-53';
      default: return 'custom';
    }
  }

  private extractFamily(controlId: string): string {
    const match = controlId.match(/^([A-Za-z]{2,3})-/i);
    return match ? match[1].toLowerCase() : 'unknown';
  }

  /**
   * Extract statement text and structure from OSCAL control
   */
  private extractStatement(oscalControl: any, resolveParams: boolean = false): string {
    if (!oscalControl.parts) return '';
    
    const statementPart = oscalControl.parts.find((p: any) => p.name === 'statement');
    if (!statementPart) return '';
    
    return this.extractTextFromPart(statementPart, oscalControl.params, resolveParams);
  }

  /**
   * Extract guidance text from OSCAL control
   */
  private extractGuidance(oscalControl: any, resolveParams: boolean = false): string {
    if (!oscalControl.parts) return '';
    
    const guidancePart = oscalControl.parts.find((p: any) => p.name === 'guidance');
    if (!guidancePart) return '';
    
    return this.extractTextFromPart(guidancePart, oscalControl.params, resolveParams);
  }

  /**
   * Extract structured statement parts from OSCAL control
   */
  private extractStatementParts(oscalControl: any, resolveParams: boolean = false): any[] | undefined {
    if (!oscalControl.parts) return undefined;
    
    const statementPart = oscalControl.parts.find((p: any) => p.name === 'statement');
    if (!statementPart || !statementPart.parts) return undefined;
    
    return statementPart.parts.map((part: any) => this.convertPartToSimpleStructure(part, oscalControl.params, resolveParams));
  }

  /**
   * Extract objectives from OSCAL control
   */
  private extractObjectives(oscalControl: any, resolveParams: boolean = false): any[] | undefined {
    if (!oscalControl.parts) return undefined;
    
    const objectivePart = oscalControl.parts.find((p: any) => p.name === 'objective');
    if (!objectivePart) return undefined;
    
    return [this.convertPartToSimpleStructure(objectivePart, oscalControl.params, resolveParams)];
  }

  /**
   * Extract assessment methods from OSCAL control
   */
  private extractAssessmentMethods(oscalControl: any, resolveParams: boolean = false): any[] | undefined {
    if (!oscalControl.parts) return undefined;
    
    const assessmentParts = oscalControl.parts.filter((p: any) => p.name === 'assessment');
    if (assessmentParts.length === 0) return undefined;
    
    return assessmentParts.map((part: any) => this.convertPartToSimpleStructure(part, oscalControl.params, resolveParams));
  }

  /**
   * Extract objectives as string array (backup-compatible format)
   * For CCI controls, maps to specific objective parts based on CCI reference
   */
  private extractObjectivesAsStrings(oscalControl: any, resolveParams: boolean = false, cciControl?: any): any[] | undefined {
    if (!oscalControl.parts) return undefined;
    
    const objectivePart = oscalControl.parts.find((p: any) => p.name === 'objective');
    if (!objectivePart) return undefined;
    
    const objectives: any[] = [];
    
    // For CCI controls, try to find the specific objective part that matches the CCI reference
    if (cciControl && cciControl.cci) {
      const specificObjectives = this.extractCCISpecificObjectives(objectivePart, cciControl, resolveParams, oscalControl.params);
      if (specificObjectives && specificObjectives.length > 0) {
        return specificObjectives;
      }
    }
    
    // Fallback to general objective extraction
    // Extract prose directly from objective part
    if (objectivePart.prose) {
      objectives.push(this.cleanTextForBackupFormat(objectivePart.prose, resolveParams, oscalControl.params));
    }
    
    // Extract from sub-parts if present
    if (objectivePart.parts && objectivePart.parts.length > 0) {
      for (const subPart of objectivePart.parts) {
        if (subPart.prose) {
          objectives.push(this.cleanTextForBackupFormat(subPart.prose, resolveParams, oscalControl.params));
        }
        
        // Handle nested parts
        if (subPart.parts && subPart.parts.length > 0) {
          for (const nestedPart of subPart.parts) {
            if (nestedPart.prose) {
              objectives.push(this.cleanTextForBackupFormat(nestedPart.prose, resolveParams, oscalControl.params));
            }
          }
        }
      }
    }
    
    return objectives.length > 0 ? objectives : undefined;
  }

  /**
   * Extract CCI-specific objectives by matching CCI reference to OSCAL objective parts
   */
  private extractCCISpecificObjectives(objectivePart: any, cciControl: any, resolveParams: boolean, parameters?: any[]): any[] | undefined {
    // Get CCI references from the bundled CCI processor to find the NIST index
    const cciId = `CCI-${cciControl.cci.padStart(6, '0')}`;
    
    // Access the CCI database through the processor
    let cciItem;
    try {
      const database = (this.cciProcessor as any).database;
      if (!database) return undefined;
      cciItem = database.items.find((item: any) => item.id === cciId);
    } catch (error) {
      console.warn(`Could not access CCI database for ${cciId}:`, error);
      return undefined;
    }
    
    if (!cciItem) return undefined;

    // Find NIST SP 800-53 Revision 4 reference
    const nistRef = cciItem.references.find(ref => 
      ref.creator === 'NIST' && 
      ref.title.includes('SP 800-53') && 
      ref.version === '4'
    );
    
    if (!nistRef || !nistRef.index) return undefined;

    // Parse the NIST index (e.g., "AC-1 a 1" -> look for parts related to AC-1(a)(1))
    const objectives: any[] = [];
    
    // Try to find matching objective parts by traversing the OSCAL structure
    this.traverseObjectiveForCCI(objectivePart, nistRef.index, objectives, resolveParams, parameters);
    
    return objectives.length > 0 ? objectives : undefined;
  }

  /**
   * Extract control statement as nested structured array (like assessment-objectives)
   * Creates hierarchical structure for complex control statements
   */
  private extractStatementAsStrings(oscalControl: any, resolveParams: boolean = false): any[] | undefined {
    if (!oscalControl.parts) return undefined;
    
    const statementPart = oscalControl.parts.find((p: any) => p.name === 'statement');
    if (!statementPart) return undefined;
    
    // Preserve OSCAL part hierarchy instead of flattening to text first
    const structuredParts = this.extractStructuredPartsFromOSCAL(statementPart, oscalControl.params, resolveParams);
    return structuredParts && structuredParts.length > 0 ? structuredParts : undefined;
  }

  /**
   * Extract structured parts from OSCAL data preserving multi-level hierarchy
   */
  private extractStructuredPartsFromOSCAL(part: any, parameters?: any[], resolveParams: boolean = false): any[] {
    const results: any[] = [];
    
    // Process this part's prose if it exists
    if (part.prose) {
      let proseText = part.prose.trim();
      
      // Resolve parameter insertions if requested
      if (resolveParams && parameters && parameters.length > 0) {
        proseText = this.resolveParameterInsertions(proseText, parameters);
      }
      
      if (proseText) {
        // If this part has sub-parts, create nested structure
        if (part.parts && part.parts.length > 0) {
          const nestedItem: any = {};
          const subParts = this.extractStructuredPartsFromOSCAL({ parts: part.parts }, parameters, resolveParams);
          
          // Create key from prose, ensuring it ends with colon for nested structure
          let key = proseText;
          if (!key.endsWith(':') && subParts.length > 0) {
            key += ':';
          }
          
          nestedItem[key] = subParts;
          results.push(nestedItem);
        } else {
          // Leaf node - just add the prose text
          results.push(proseText);
        }
      }
    }
    
    // Process sub-parts if no prose at this level (container part)
    if (!part.prose && part.parts && part.parts.length > 0) {
      for (const subPart of part.parts) {
        const subResults = this.extractStructuredPartsFromOSCAL(subPart, parameters, resolveParams);
        results.push(...subResults);
      }
    }
    
    return results;
  }
  

  /**
   * Recursively traverse OSCAL objective structure to find CCI-specific parts
   * Now preserves hierarchy by using structured format instead of flat array
   */
  private traverseObjectiveForCCI(part: any, cciIndex: string, objectives: any[], resolveParams: boolean, parameters?: any[]): void {
    // Build structured text that preserves hierarchy
    this.buildStructuredObjectiveText(part, objectives, resolveParams, parameters, 0);
  }

  /**
   * Build structured objective array with proper hierarchy
   */
  private buildStructuredObjectiveText(part: any, objectives: any[], resolveParams: boolean, parameters?: any[], depth: number = 0): void {
    if (!part) return;
    
    // Add this part's prose if it exists and isn't a generic header
    if (part.prose && !part.prose.startsWith('Determine if')) {
      const cleanText = this.cleanTextForBackupFormat(part.prose, resolveParams, parameters);
      
      if (part.parts && part.parts.length > 0 && cleanText.endsWith(':')) {
        // This is a parent with children - create a nested array structure
        const subItems: string[] = [];
        
        for (const subPart of part.parts) {
          this.collectSubItems(subPart, subItems, resolveParams, parameters);
        }
        
        if (subItems.length > 0) {
          // Create a nested object with the main text and sub-items as an array
          const nestedObjective: any = {};
          nestedObjective[cleanText] = subItems;
          objectives.push(nestedObjective);
        } else {
          objectives.push(cleanText);
        }
      } else {
        // Regular objective item
        objectives.push(cleanText);
      }
    } else if (part.parts && part.parts.length > 0) {
      // Process sub-parts without adding prose
      for (const subPart of part.parts) {
        this.buildStructuredObjectiveText(subPart, objectives, resolveParams, parameters, depth);
      }
    }
  }
  
  /**
   * Collect sub-items for nested objectives
   */
  private collectSubItems(part: any, subItems: string[], resolveParams: boolean, parameters?: any[]): void {
    if (part.prose && !part.prose.startsWith('Determine if')) {
      const cleanText = this.cleanTextForBackupFormat(part.prose, resolveParams, parameters);
      subItems.push(cleanText);
    }
    
    if (part.parts && part.parts.length > 0) {
      for (const subPart of part.parts) {
        this.collectSubItems(subPart, subItems, resolveParams, parameters);
      }
    }
  }

  /**
   * Extract assessment methods as string array (backup-compatible format)
   */
  private extractAssessmentMethodsAsStrings(oscalControl: any, resolveParams: boolean = false): string[] | undefined {
    if (!oscalControl.parts) return undefined;
    
    const assessmentParts = oscalControl.parts.filter((p: any) => p.name === 'assessment');
    if (assessmentParts.length === 0) return undefined;
    
    const methods: string[] = [];
    
    for (const assessmentPart of assessmentParts) {
      if (assessmentPart.prose) {
        methods.push(this.cleanTextForBackupFormat(assessmentPart.prose, resolveParams, oscalControl.params));
      }
      
      // Extract from sub-parts if present
      if (assessmentPart.parts && assessmentPart.parts.length > 0) {
        for (const subPart of assessmentPart.parts) {
          if (subPart.prose) {
            methods.push(this.cleanTextForBackupFormat(subPart.prose, resolveParams, oscalControl.params));
          }
        }
      }
    }
    
    return methods.length > 0 ? methods : undefined;
  }

  /**
   * Clean and format text for backup-compatible format
   */
  private cleanTextForBackupFormat(text: string, resolveParams: boolean, parameters?: any[]): string {
    let cleanText = text;
    
    // Resolve parameter insertions if requested
    if (resolveParams && parameters && parameters.length > 0) {
      cleanText = this.resolveParameterInsertions(cleanText, parameters);
    }
    
    // Clean up common OSCAL formatting issues
    cleanText = cleanText
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/\n\s+/g, '\n')  // Clean up line breaks
      .trim();
    
    return cleanText;
  }

  /**
   * Convert OSCAL part to simple structure with optional parameter resolution
   */
  private convertPartToSimpleStructure(part: any, parameters?: any[], resolveParams: boolean = false): any {
    const result: any = {
      id: part.id,
      name: part.name,
      prose: part.prose
    };

    // Resolve parameter insertions in prose if requested
    if (resolveParams && parameters && parameters.length > 0 && result.prose) {
      result.prose = this.resolveParameterInsertions(result.prose, parameters);
    }

    if (part.props && part.props.length > 0) {
      result.properties = this.convertProps(part.props);
    }

    if (part.parts && part.parts.length > 0) {
      result.parts = part.parts.map((p: any) => this.convertPartToSimpleStructure(p, parameters, resolveParams));
    }

    if (part.links && part.links.length > 0) {
      result.links = part.links.map((link: any) => ({
        href: link.href,
        rel: link.rel,
        text: link.text
      }));
    }

    return result;
  }

  private extractTextFromPart(part: any, parameters?: any[], resolveParams: boolean = false): string {
    let text = '';
    
    if (typeof part.prose === 'string') {
      text = part.prose;
    }
    
    if (Array.isArray(part.parts)) {
      const subTexts = part.parts.map((p: any) => this.extractTextFromPart(p, parameters, resolveParams));
      text += (text ? ' ' : '') + subTexts.join(' ');
    }
    
    // Resolve parameter insertions if requested and parameters are available
    if (resolveParams && parameters && parameters.length > 0) {
      text = this.resolveParameterInsertions(text, parameters);
    }
    
    return text.trim();
  }

  /**
   * Resolve parameter insertions like {{ insert: param, parameter_id }}
   * Adapted from OSCALProcessor logic
   */
  private resolveParameterInsertions(text: string, parameters: any[]): string {
    // Create a map for quick parameter lookup
    const paramMap = new Map(parameters.map(p => [p.id, p.label || `[${p.id}]`]));
    
    // Replace {{ insert: param, parameter_id }} with [parameter_label]
    return text.replace(/\{\{\s*insert:\s*param,\s*([^}]+)\s*\}\}/g, (match, paramId) => {
      const paramLabel = paramMap.get(paramId.trim());
      return paramLabel ? `[${paramLabel}]` : match;
    });
  }

  private convertProps(props: any[]): Record<string, any> {
    const result: Record<string, any> = {};
    for (const prop of props) {
      result[prop.name] = prop.value;
    }
    return result;
  }

  /**
   * Extract simple statement for human-readable output
   */
  private extractSimpleStatement(oscalControl: any, resolveParams: boolean = false): string {
    if (!oscalControl.parts) return oscalControl.title || '';
    
    const statementPart = oscalControl.parts.find((p: any) => p.name === 'statement');
    if (!statementPart) return oscalControl.title || '';
    
    return this.extractSimpleTextFromPart(statementPart, oscalControl.params, resolveParams);
  }

  /**
   * Extract simple properties (only essential ones for human readability)
   */
  private extractSimpleProperties(oscalControl: any): Record<string, any> | undefined {
    if (!oscalControl.props) return undefined;
    
    const result: Record<string, any> = {};
    for (const prop of oscalControl.props) {
      // Only include non-technical properties
      if (['priority', 'label'].includes(prop.name)) {
        result[prop.name] = prop.value;
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  /**
   * Extract simple text from parts without complex nested structures
   */
  private extractSimpleTextFromPart(part: any, parameters?: any[], resolveParams: boolean = false): string {
    let text = part.prose || '';
    
    // Add sub-parts as simple text, but format them nicely
    if (part.parts && part.parts.length > 0) {
      const subTexts = part.parts.map((subPart: any) => {
        let subText = subPart.prose || '';
        
        // Add nested parts as indented list items
        if (subPart.parts && subPart.parts.length > 0) {
          const nestedTexts = subPart.parts.map((nested: any) => 
            `  ${nested.properties?.label || ''} ${nested.prose || ''}`.trim()
          );
          if (nestedTexts.length > 0) {
            subText += '\n' + nestedTexts.join('\n');
          }
        }
        
        return `${subPart.properties?.label || ''} ${subText}`.trim();
      });
      
      if (subTexts.length > 0) {
        text += '\n' + subTexts.join('\n');
      }
    }
    
    // Resolve parameter insertions if requested
    if (resolveParams && parameters && parameters.length > 0) {
      text = this.resolveParameterInsertions(text, parameters);
    }
    
    return text.trim();
  }


  /**
   * Deduplicate controls by ID, keeping the most enriched version
   * (needed for CCI processing which creates duplicates)
   */
  private deduplicateControls(controls: AtomicControl[]): AtomicControl[] {
    const controlMap = new Map<string, AtomicControl>();
    
    for (const control of controls) {
      const existing = controlMap.get(control.id);
      if (!existing) {
        controlMap.set(control.id, control);
      } else {
        // Keep the version with more enriched data (more fields)
        const existingFields = Object.keys(existing).filter(k => existing[k as keyof AtomicControl] != null).length;
        const newFields = Object.keys(control).filter(k => control[k as keyof AtomicControl] != null).length;
        if (newFields > existingFields) {
          controlMap.set(control.id, control);
        }
      }
    }
    
    return Array.from(controlMap.values());
  }

  private loadFrameworkRegistry(): void {
    // Initialize with known frameworks
    this.frameworks.set('nist-800-53', {
      id: 'nist-800-53',
      name: 'NIST Special Publication 800-53',
      version: '5.0.0',
      publisher: 'NIST',
      default_granularity: 'cci',
      cci_enabled: true
    });

    this.frameworks.set('iso-27001', {
      id: 'iso-27001',
      name: 'ISO/IEC 27001',
      version: '2013',
      publisher: 'ISO',
      default_granularity: 'control',
      cci_enabled: false
    });
  }

  /**
   * Get display name for control family
   */
  private getFamilyDisplayName(familyId: string): string {
    const familyNames: Record<string, string> = {
      'ac': 'Access Control',
      'at': 'Awareness and Training', 
      'au': 'Audit and Accountability',
      'ca': 'Security Assessment and Authorization',
      'cm': 'Configuration Management',
      'cp': 'Contingency Planning',
      'ia': 'Identification and Authentication',
      'ir': 'Incident Response',
      'ma': 'Maintenance',
      'mp': 'Media Protection',
      'pe': 'Physical and Environmental Protection',
      'pl': 'Planning',
      'ps': 'Personnel Security',
      'ra': 'Risk Assessment',
      'sa': 'System and Services Acquisition',
      'sc': 'System and Communications Protection',
      'si': 'System and Information Integrity',
      'pm': 'Program Management',
      'ar': 'Privacy',
      'cci': 'Control Correlation Identifiers'
    };
    
    return familyNames[familyId.toLowerCase()] || familyId.toUpperCase();
  }

  /**
   * Extract baseline information from framework name
   */
  private extractBaseline(frameworkName: string): string {
    const name = frameworkName.toLowerCase();
    
    if (name.includes('high')) return 'high';
    if (name.includes('moderate')) return 'moderate'; 
    if (name.includes('low')) return 'low';
    if (name.includes('privacy')) return 'privacy';
    if (name.includes('800-53')) return 'moderate'; // Default NIST baseline
    
    return 'custom';
  }

  /**
   * Generate field schema for UI presentation control
   */
  private generateFieldSchema(controls: AtomicControl[], cciEnabled: boolean): any {
    const fields: any = {};

    // Core fields - always present
    fields.id = {
      type: 'string',
      required: true
    };

    fields.title = {
      type: 'string',
      required: true
    };

    // Add control-information field (structured control statement array with nesting like assessment-objectives)
    const controlsWithControlInfo = controls.filter(c => (c as any)['control-information']);
    if (controlsWithControlInfo.length > 0) {
      fields['control-information'] = {
        type: 'array',
        array_item_type: 'mixed' // Can contain strings or nested objects like assessment-objectives
      };
    }

    // Add control-implementation-narrative field
    fields['control-implementation-narrative'] = {
      type: 'string'
    };

    // Note: ap-acronym field removed as requested

    // Add implementation-guidance field
    const controlsWithImplGuidance = controls.filter(c => (c as any)['implementation-guidance']);
    if (controlsWithImplGuidance.length > 0) {
      fields['implementation-guidance'] = {
        type: 'string'
      };
    }

    // Add assessment-procedures field
    const controlsWithAssessmentProcs = controls.filter(c => (c as any)['assessment-procedures'] && Array.isArray((c as any)['assessment-procedures']));
    if (controlsWithAssessmentProcs.length > 0) {
      fields['assessment-procedures'] = {
        type: 'array',
        array_item_type: 'string'
      };
    }

    // Add assessment-objectives field (CCI-specific)
    const controlsWithAssessmentObjs = controls.filter(c => (c as any)['assessment-objectives'] && Array.isArray((c as any)['assessment-objectives']));
    if (controlsWithAssessmentObjs.length > 0) {
      fields['assessment-objectives'] = {
        type: 'array',
        array_item_type: 'string'
      };
    }

    // Add inheritance fields
    fields['inherited'] = {
      type: 'boolean'
    };

    fields['remote-inheritance-instance'] = {
      type: 'string'
    };

    // Add testing and compliance fields
    fields['compliance-status'] = {
      type: 'string',
      options: [
        'Not Assessed',
        'Satisfied',
        'Other Than Satisfied',
        'Not Applicable'
      ]
    };

    fields['date-tested'] = {
      type: 'string'
    };

    fields['tested-by'] = {
      type: 'string'
    };

    fields['test-results'] = {
      type: 'string'
    };

    // Legacy fields for backward compatibility (simplified)
    const definitionCount = controls.filter(c => c.definition).length;
    if (definitionCount > 0) {
      fields.definition = {
        type: 'string'
      };
    }

    // Control implementation status
    fields['control-implementation-status'] = {
      type: 'string',
      required: true,
      options: [
        'Not Implemented',
        'Planned', 
        'Partially Implemented',
        'Implemented',
        'Alternative Implementation',
        'Not Applicable'
      ]
    };

    // Security control designation
    fields['security-control-designation'] = {
      type: 'string',
      options: [
        'System',
        'Hybrid',
        'Common',
        'Inherited'
      ]
    };

    // Core identification fields
    fields.family = {
      type: 'string',
      required: true
    };

    fields.framework = {
      type: 'string',
      required: true
    };

    // Add CCI-specific fields
    if (cciEnabled) {
      fields.cci = {
        type: 'string'
      };

      fields['cci-definition'] = {
        type: 'string'
      };
    }

    // Optional fields for backward compatibility
    const guidanceCount = controls.filter(c => c.guidance).length;
    if (guidanceCount > 0) {
      fields.guidance = {
        type: 'string'
      };
    }

    return {
      fields,
      total_controls: controls.length,
      analyzed_at: new Date().toISOString()
    };
  }
}
