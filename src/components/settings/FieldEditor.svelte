<script lang="ts">
  import type { FieldDefinition, SchemaGroup } from '$lib/adapters/types.js';

  interface Props {
    fields: FieldDefinition[];
    groups: SchemaGroup[];
    onConfigChange?: (config: FieldConfig) => void;
  }

  interface FieldConfig {
    visibleFields: string[];
    fieldOrder: string[];
    groupOrder: string[];
    groupVisibility: Record<string, boolean>;
  }

  let { fields, groups, onConfigChange }: Props = $props();

  // State for drag and drop
  let draggedField: FieldDefinition | null = $state(null);
  let draggedGroup: SchemaGroup | null = $state(null);
  let dragOverTarget: string | null = $state(null);

  // Configuration state
  let config: FieldConfig = $state({
    visibleFields: fields.map(f => f.id),
    fieldOrder: fields.map(f => f.id), 
    groupOrder: groups.map(g => g.id),
    groupVisibility: Object.fromEntries(groups.map(g => [g.id, true]))
  });

  // Grouped fields for display
  let groupedFields = $derived(() => {
    const grouped = new Map<string, FieldDefinition[]>();
    
    config.groupOrder.forEach(groupId => {
      grouped.set(groupId, []);
    });
    
    config.fieldOrder.forEach(fieldId => {
      const field = fields.find(f => f.id === fieldId);
      if (field && config.visibleFields.includes(fieldId)) {
        const groupFields = grouped.get(field.group || 'default') || [];
        groupFields.push(field);
        grouped.set(field.group || 'default', groupFields);
      }
    });
    
    return grouped;
  });

  // Drag handlers for fields
  function handleFieldDragStart(field: FieldDefinition) {
    draggedField = field;
    draggedGroup = null;
  }

  function handleFieldDragEnd() {
    draggedField = null;
    dragOverTarget = null;
  }

  function handleFieldDragOver(e: DragEvent, targetFieldId: string) {
    e.preventDefault();
    dragOverTarget = targetFieldId;
  }

  function handleFieldDrop(e: DragEvent, targetFieldId: string) {
    e.preventDefault();
    
    if (!draggedField) return;
    
    const draggedIndex = config.fieldOrder.indexOf(draggedField.id);
    const targetIndex = config.fieldOrder.indexOf(targetFieldId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    const newOrder = [...config.fieldOrder];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedField.id);
    
    config.fieldOrder = newOrder;
    dragOverTarget = null;
    onConfigChange?.(config);
  }

  // Group drag handlers
  function handleGroupDragStart(group: SchemaGroup) {
    draggedGroup = group;
    draggedField = null;
  }

  function handleGroupDragEnd() {
    draggedGroup = null;
    dragOverTarget = null;
  }

  function handleGroupDragOver(e: DragEvent, targetGroupId: string) {
    e.preventDefault();
    dragOverTarget = targetGroupId;
  }

  function handleGroupDrop(e: DragEvent, targetGroupId: string) {
    e.preventDefault();
    
    if (!draggedGroup) return;
    
    const draggedIndex = config.groupOrder.indexOf(draggedGroup.id);
    const targetIndex = config.groupOrder.indexOf(targetGroupId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    const newOrder = [...config.groupOrder];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedGroup.id);
    
    config.groupOrder = newOrder;
    dragOverTarget = null;
    onConfigChange?.(config);
  }

  // Visibility toggles
  function toggleFieldVisibility(fieldId: string) {
    if (config.visibleFields.includes(fieldId)) {
      config.visibleFields = config.visibleFields.filter(id => id !== fieldId);
    } else {
      config.visibleFields = [...config.visibleFields, fieldId];
    }
    onConfigChange?.(config);
  }

  function toggleGroupVisibility(groupId: string) {
    config.groupVisibility[groupId] = !config.groupVisibility[groupId];
    onConfigChange?.(config);
  }
</script>

<div class="field-editor space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h3 class="text-lg font-medium text-gray-900 dark:text-white">Field Configuration</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Configure which fields are visible and their order
      </p>
    </div>
    <button
      class="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
      onclick={() => {
        // Reset to defaults
        config = {
          visibleFields: fields.map(f => f.id),
          fieldOrder: fields.map(f => f.id),
          groupOrder: groups.map(g => g.id),
          groupVisibility: Object.fromEntries(groups.map(g => [g.id, true]))
        };
        onConfigChange?.(config);
      }}
    >
      Reset to Defaults
    </button>
  </div>

  <!-- Groups and Fields -->
  <div class="space-y-4">
    {#each config.groupOrder as groupId}
      {#if groups.find(g => g.id === groupId)}
        {@const group = groups.find(g => g.id === groupId)}
        {@const groupFields = groupedFields().get(groupId) || []}
        {#if group}
          <div 
            class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            class:ring-2={dragOverTarget === groupId}
            class:ring-blue-500={dragOverTarget === groupId}
          >
            <!-- Group Header -->
            <div 
              class="bg-gray-50 dark:bg-gray-900 px-4 py-3 cursor-move select-none"
              class:opacity-50={draggedGroup?.id === groupId}
              draggable="true"
              role="button"
              tabindex="0"
              aria-label="Drag to reorder group"
              ondragstart={() => handleGroupDragStart(group)}
              ondragend={handleGroupDragEnd}
              ondragover={(e) => handleGroupDragOver(e, groupId)}
              ondrop={(e) => handleGroupDrop(e, groupId)}
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <div class="flex items-center space-x-2">
                    <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
                    </svg>
                    <span class="font-medium text-gray-900 dark:text-white">{group.label}</span>
                  </div>
                  <span class="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                    {groupFields.length} fields
                  </span>
                </div>
              
              <label class="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.groupVisibility[groupId]}
                  onchange={() => toggleGroupVisibility(groupId)}
                  class="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                />
                <span class="text-sm text-gray-600 dark:text-gray-400">Visible</span>
              </label>
            </div>
          </div>

          <!-- Fields in Group -->
          {#if config.groupVisibility[groupId]}
            <div class="divide-y divide-gray-200 dark:divide-gray-700">
              {#each groupFields as field}
                <div 
                  class="px-4 py-3 cursor-move select-none hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                  class:opacity-50={draggedField?.id === field.id}
                  class:ring-2={dragOverTarget === field.id}
                  class:ring-blue-500={dragOverTarget === field.id}
                  class:bg-gray-100={!config.visibleFields.includes(field.id)}
                  class:dark:bg-gray-900={!config.visibleFields.includes(field.id)}
                  draggable="true"
                  role="button"
                  tabindex="0"
                  aria-label="Drag to reorder field"
                  ondragstart={() => handleFieldDragStart(field)}
                  ondragend={handleFieldDragEnd}
                  ondragover={(e) => handleFieldDragOver(e, field.id)}
                  ondrop={(e) => handleFieldDrop(e, field.id)}
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                      <svg class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4"></path>
                      </svg>
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center space-x-2">
                          <span class="font-medium text-gray-900 dark:text-white">
                            {field.label}
                          </span>
                          {#if field.required}
                            <span class="text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded">
                              Required
                            </span>
                          {/if}
                        </div>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {field.helpText || `${field.type} field`}
                        </p>
                      </div>
                    </div>
                    
                    <label class="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.visibleFields.includes(field.id)}
                        onchange={() => toggleFieldVisibility(field.id)}
                        class="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                      />
                      <span class="text-sm text-gray-600 dark:text-gray-400">Show</span>
                    </label>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
          </div>
        {/if}
      {/if}
    {/each}
  </div>

  <!-- Hidden Fields -->
  {#if fields.filter(f => !config.visibleFields.includes(f.id)).length > 0}
    {@const hiddenFields = fields.filter(f => !config.visibleFields.includes(f.id))}
    <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <h4 class="font-medium text-gray-900 dark:text-white mb-3">Hidden Fields</h4>
      <div class="space-y-2">
        {#each hiddenFields as field}
          <div class="flex items-center justify-between py-2 px-3 bg-gray-100 dark:bg-gray-900 rounded-md">
            <span class="text-sm text-gray-700 dark:text-gray-300">{field.label}</span>
            <button
              onclick={() => toggleFieldVisibility(field.id)}
              class="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              Show
            </button>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .field-editor :global(.dragging) {
    opacity: 0.5;
  }
</style>
