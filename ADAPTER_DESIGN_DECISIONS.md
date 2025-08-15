# Adapter Design Decisions

## Key Design Clarifications

### 1. Mappings are Internal-Only
**Mappings** (source code to control relationships) are an internal implementation detail that remains consistent regardless of the control format being used. They are NOT part of the adapter import/export pattern.

### 2. Schemas Come from Official Sources  
The **Internal YAML Adapter** should not hard-code compliance framework schemas (like NIST 800-53 field definitions). Instead:

- **Internal Adapter**: Handles the git-friendly YAML format we use for storage
- **Official Schemas**: Come from importing official sources (e.g., NIST OSCAL catalogs from https://github.com/usnistgov/oscal-content)
- **Format Adapters**: Convert between official formats and our internal storage format

## Implications

### What Adapters Handle
- **Controls Only**: Adapters only deal with importing and exporting control definitions
- **Format Conversion**: Converting between external formats (OSCAL, SOC2, etc.) and internal YAML
- **Schema Definition**: Each adapter defines its own schema for the format it handles

### What Adapters DON'T Handle
- **Mappings**: Source code mappings stay in consistent internal format
- **Implementation Details**: Mappings are created and managed separately from control imports
- **Cross-Format Mapping Migration**: No need to convert mappings between formats

## Architecture Benefits

1. **No Hard-Coded Schemas**: Official compliance frameworks are imported from authoritative sources
2. **Simplified Adapters**: No need for mapping schemas in each adapter
3. **Consistent Mapping Format**: Mappings always use the same structure regardless of control format
4. **Clean Separation**: Control definitions vs. implementation tracking are separate concerns
5. **Easier Migration**: When switching control frameworks, mappings remain intact

## Current Implementation

### Internal YAML Adapter (`internal-yaml`)
- Handles the current git-friendly YAML format used for storage
- Schema represents the internal format fields, not official NIST schema
- Import/export are pass-through operations
- Maintains backward compatibility
- No mapping handling

### Future Adapters

#### OSCAL NIST Adapter (`oscal-nist`)
- Will import from official NIST OSCAL catalogs (https://github.com/usnistgov/oscal-content)
- Will convert complex OSCAL JSON structure to simple internal YAML
- Will preserve OSCAL metadata for round-trip export
- Will NOT touch mappings at all

#### Other Framework Adapters
- SOC2, ISO 27001, etc.
- Each will import from their official sources
- All convert to the same internal YAML format

## Data Flow Example

```
OSCAL Catalog (JSON) → OSCAL Adapter → Internal YAML → Storage
                                           ↓
                                    Your Mappings (unchanged)
```

### UI Implications
- Control editing forms will be schema-driven (Phase 3)
- Mapping management remains unchanged  
- Format selection affects only control schema, not mapping interface
- Users can switch between NIST Rev 4, Rev 5, SOC2, etc. without affecting mappings

This design keeps the system simple while enabling powerful multi-format support for control definitions from official sources.