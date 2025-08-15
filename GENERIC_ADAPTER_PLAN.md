# Generic Adapter Implementation Plan

## Project Overview

Transform the compliance manager from NIST 800-53 specific to a generic, multi-framework system while maintaining git-friendly YAML storage and adding OSCAL import/export capabilities.

## Core Principles

1. **Preserve git-friendliness**: Keep simple YAML as internal storage format
2. **Zero breaking changes**: Current workflow must remain unchanged
3. **Industry standards**: Support OSCAL for interoperability
4. **Extensible architecture**: Easy to add new compliance frameworks
5. **Clean separation**: Storage format ≠ Import/Export format ≠ UI schema

## Phase 1: Foundation - Adapter Infrastructure

### Goals
- Create adapter pattern without breaking existing functionality
- Establish schema-driven architecture
- Maintain backward compatibility

### Tasks

#### 1.1 Core Interfaces (`src/lib/adapters/types.ts`)
```typescript
interface ControlSchema {
  name: string;
  version: string;
  description: string;
  fields: FieldDefinition[];
}

interface FieldDefinition {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'boolean' | 'date';
  required: boolean;
  validation?: ValidationRule[];
  options?: string[];
  description?: string;
}

interface FormatAdapter {
  schema: ControlSchema;
  import(data: any): Control[];
  export(controls: Control[]): any;
  validate(data: any): ValidationResult;
}

interface AdapterRegistry {
  register(name: string, adapter: FormatAdapter): void;
  get(name: string): FormatAdapter | undefined;
  list(): string[];
}
```

#### 1.2 Native NIST Adapter (`src/lib/adapters/nist-native.ts`)
- Create adapter for current YAML format
- Define complete schema for existing fields
- Implement identity transforms (import/export = pass-through)
- **No changes to existing workflow**

#### 1.3 Adapter Registry (`src/lib/adapters/registry.ts`)
- Singleton pattern for adapter management
- Auto-registration of built-in adapters
- Plugin discovery system for future extensions

#### 1.4 Control Set Metadata Enhancement
```yaml
# control-set.yaml - Enhanced with format info
id: nist-800-53-rev4
name: NIST SP 800-53
version: Revision 4
format_adapter: nist-native  # NEW: specify which adapter to use
description: Security and Privacy Controls for Federal Information Systems
```

### Deliverables
- [ ] Core adapter interfaces
- [ ] NIST native adapter (current format)
- [ ] Adapter registry system
- [ ] Enhanced control-set metadata
- [ ] Unit tests for adapter pattern
- [ ] Documentation for adapter development

### Testing Strategy
- All existing tests must pass unchanged
- New adapter pattern tests
- Verify NIST native adapter produces identical output

---

## Phase 2: OSCAL Import Support

### Goals
- Import official OSCAL catalogs
- Convert OSCAL to simple YAML format
- Preserve metadata for round-trip exports

### Tasks

#### 2.1 OSCAL Research & Schema Analysis
- Download official NIST 800-53 Rev 5 OSCAL catalog
- Map OSCAL control structure to simple YAML fields
- Identify metadata that needs preservation

#### 2.2 OSCAL Import Adapter (`src/lib/adapters/oscal-import.ts`)
```typescript
class OSCALImportAdapter implements FormatAdapter {
  schema: ControlSchema; // Maps to simple YAML schema
  
  import(oscalData: OSCALCatalog): Control[] {
    // Convert complex OSCAL structure to simple YAML
  }
  
  // For Phase 2, export throws "not implemented"
  export(): never { throw new Error("Use oscal-export adapter"); }
}
```

#### 2.3 CLI Import Command
```bash
cya import --format oscal --file nist-catalog.json --output ./my-controls/
```

#### 2.4 Metadata Preservation System
```
.oscal-metadata/
├── catalog.json          # Original OSCAL catalog metadata
├── control-mappings.json # OSCAL ID → Simple YAML ID mappings
└── parameters.json       # OSCAL parameters not in simple format
```

#### 2.5 Control ID Generation Strategy
- Generate short IDs for simple YAML files
- Maintain mapping between OSCAL IDs and generated IDs
- Handle sub-controls and enhancements

### Deliverables
- [ ] OSCAL import adapter
- [ ] CLI import command
- [ ] Metadata preservation system
- [ ] ID generation and mapping
- [ ] Import validation and error handling
- [ ] Integration tests with real OSCAL files

### Testing Strategy
- Test with official NIST OSCAL catalogs
- Verify all controls import correctly
- Check metadata preservation
- Validate generated file structure

---

## Phase 3: Dynamic UI System

### Goals
- Replace hard-coded forms with schema-driven components
- Support multiple control set formats
- Maintain existing user experience

### Tasks

#### 3.1 Schema-Driven Form Components
```svelte
<!-- src/components/forms/DynamicControlForm.svelte -->
<script lang="ts">
  export let control: Control;
  export let schema: ControlSchema;
  export let readonly = false;
</script>

{#each schema.fields as field}
  <DynamicField 
    {field} 
    bind:value={control[field.id]}
    {readonly}
  />
{/each}
```

#### 3.2 Control Set Format Selection
- UI to choose between different control set formats
- Schema switching without data loss (where possible)
- Migration warnings for incompatible schemas

#### 3.3 Backward Compatibility Layer
- Ensure existing NIST-specific UI still works
- Gradual migration of components
- Feature flag system for new vs old UI

#### 3.4 Enhanced Control Editor
- Dynamic field validation based on schema
- Context-aware help text
- Smart defaults from schema definitions

### Deliverables
- [ ] Dynamic form component system
- [ ] Schema-driven field rendering
- [ ] Control set format selector
- [ ] Migrated ControlEditor component
- [ ] Field validation system
- [ ] UI tests for dynamic forms

### Testing Strategy
- Visual regression testing
- Schema switching tests
- Backward compatibility verification
- User experience testing

---

## Phase 4: OSCAL Export & Additional Formats

### Goals
- Export simple YAML back to OSCAL format
- Support System Security Plan (SSP) generation
- Add framework for additional formats (SOC2, ISO)

### Tasks

#### 4.1 OSCAL Export Adapter (`src/lib/adapters/oscal-export.ts`)
```typescript
class OSCALExportAdapter implements FormatAdapter {
  export(controls: Control[]): OSCALCatalog {
    // Convert simple YAML back to full OSCAL structure
    // Use preserved metadata for accurate reconstruction
  }
  
  exportSSP(controls: Control[], mappings: Mapping[]): OSCALSSP {
    // Generate System Security Plan with implementation info
  }
}
```

#### 4.2 CLI Export Commands
```bash
cya export --format oscal-catalog --output catalog.json
cya export --format oscal-ssp --output system-security-plan.json
cya export --format oscal-assessment-plan --output assessment.json
```

#### 4.3 Additional Format Adapters
- SOC2 adapter (CSV export, simple schema)
- ISO 27001 adapter 
- Custom format adapter template

#### 4.4 Implementation Component Mapping
- Map source code mappings to OSCAL implementation components
- Generate implementation statements from justifications
- Link controls to actual source code

### Deliverables
- [ ] OSCAL export adapter
- [ ] SSP generation capability
- [ ] CLI export commands
- [ ] Additional format adapters (SOC2, ISO)
- [ ] Implementation component mapping
- [ ] Export validation against OSCAL schemas

### Testing Strategy
- Round-trip testing (import → export → compare)
- OSCAL schema validation
- Real-world export scenarios
- Performance testing with large control sets

---

## Phase 5: Advanced Features & Polish

### Goals
- Schema migration tools
- Plugin system for custom adapters
- Performance optimizations
- Advanced validation

### Tasks

#### 5.1 Schema Migration System
- Handle schema version upgrades
- Field mapping between different schemas
- Data transformation pipelines
- Migration validation and rollback

#### 5.2 Plugin Architecture
```typescript
// External adapter plugins
class CustomComplianceAdapter implements FormatAdapter {
  // Custom organization-specific format
}

// Plugin registration
registerAdapter('my-org-format', new CustomComplianceAdapter());
```

#### 5.3 Advanced Validation
- Cross-reference validation between controls
- Implementation completeness checking
- Compliance gap analysis
- Automated assessment procedures

#### 5.4 Performance Optimizations
- Lazy loading of large control sets
- Incremental import/export
- Caching strategies
- Background processing

### Deliverables
- [ ] Schema migration framework
- [ ] Plugin system architecture
- [ ] Advanced validation engine
- [ ] Performance optimizations
- [ ] Comprehensive documentation
- [ ] Migration guides

---

## Dependencies & Prerequisites

### External Dependencies
- OSCAL JSON schemas from NIST
- Official OSCAL catalog files for testing
- JSON Schema validation library
- YAML processing enhancements

### Internal Prerequisites
- Phase 1 must complete before Phase 2
- Phase 3 can run parallel to Phase 2
- Phase 4 depends on Phase 2 completion
- Phase 5 requires all previous phases

---

## Risk Mitigation

### Technical Risks
- **OSCAL complexity**: Start with subset of OSCAL features
- **Performance**: Implement lazy loading early
- **Breaking changes**: Comprehensive testing at each phase

### User Experience Risks
- **Learning curve**: Maintain backward compatibility
- **Data loss**: Robust validation and backup systems
- **Workflow disruption**: Feature flags and gradual rollout

---

## Success Metrics

### Phase 1
- [ ] All existing tests pass
- [ ] Zero breaking changes to current workflow
- [ ] Adapter pattern fully functional

### Phase 2
- [ ] Successful import of official NIST OSCAL catalog
- [ ] All controls properly converted and editable
- [ ] Metadata preservation verified

### Phase 3
- [ ] Dynamic UI works with multiple schemas
- [ ] User experience equivalent to current system
- [ ] Schema switching functional

### Phase 4
- [ ] Round-trip OSCAL import/export working
- [ ] Valid OSCAL SSP generation
- [ ] At least 2 additional format adapters

### Phase 5
- [ ] Plugin system operational
- [ ] Performance acceptable with 1000+ controls
- [ ] Production-ready documentation

---

## Timeline Estimate

- **Phase 1**: 2-3 weeks (Foundation critical)
- **Phase 2**: 2-3 weeks (OSCAL research intensive)
- **Phase 3**: 2-3 weeks (UI overhaul significant)
- **Phase 4**: 2-3 weeks (Export complexity)
- **Phase 5**: 2-4 weeks (Polish and optimization)

**Total: 10-16 weeks** for complete implementation

---

## Next Steps

1. **Review and approve this plan**
2. **Begin Phase 1: Core adapter interfaces**
3. **Set up OSCAL test data and schemas**
4. **Create detailed task breakdown for Phase 1**
5. **Establish testing strategy and CI/CD updates**

This plan maintains your git-friendly approach while opening up powerful extensibility and standards compliance!