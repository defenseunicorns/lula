<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import type { Control, FieldSchema } from '$lib/types';
	import { EditableFieldRenderer } from '../renderers';

	interface Props {
		control: Control;
		fieldSchema: Record<string, FieldSchema>;
		onFieldChange: (fieldName: string, value: any) => void;
	}

	let { control, fieldSchema, onFieldChange }: Props = $props();

	// Get fields for custom tab
	function getCustomFields(): Array<[string, FieldSchema]> {
		return Object.entries(fieldSchema)
			.filter(([_, field]) => {
				const fieldTab = field.tab || getDefaultTabForCategory(field.category);
				return fieldTab === 'custom' && field.visible;
			})
			.sort((a, b) => a[1].display_order - b[1].display_order);
	}

	function getDefaultTabForCategory(category: string): 'overview' | 'implementation' | 'custom' {
		switch (category) {
			case 'core':
			case 'metadata':
				return 'overview';
			case 'compliance':
			case 'content':
				return 'implementation';
			default:
				return 'custom';
		}
	}

	// Helper to determine field layout class based on field type
	function getFieldLayoutClass(field: FieldSchema): string {
		// Textareas and long text fields get full width
		if (field.ui_type === 'textarea' || field.ui_type === 'long_text') {
			return 'col-span-full';
		}
		// Medium text fields also get full width
		if (field.ui_type === 'medium_text' && field.max_length && field.max_length > 100) {
			return 'col-span-full';
		}
		// Dropdowns and short fields can be side by side
		if (
			field.ui_type === 'select' ||
			field.ui_type === 'multiselect' ||
			field.ui_type === 'boolean' ||
			field.ui_type === 'date' ||
			field.ui_type === 'number' ||
			(field.ui_type === 'short_text' && field.max_length && field.max_length <= 50)
		) {
			return 'col-span-1';
		}
		// Default to full width for everything else
		return 'col-span-full';
	}

	// Helper to group fields by layout type
	function groupFieldsForLayout(fields: Array<[string, FieldSchema]>) {
		const groups: Array<Array<[string, FieldSchema]>> = [];
		let currentGroup: Array<[string, FieldSchema]> = [];

		for (const field of fields) {
			const layoutClass = getFieldLayoutClass(field[1]);

			if (layoutClass === 'col-span-full') {
				// Full width fields go in their own group
				if (currentGroup.length > 0) {
					groups.push(currentGroup);
					currentGroup = [];
				}
				groups.push([field]);
			} else {
				// Half width fields can be grouped
				currentGroup.push(field);
				if (currentGroup.length === 2) {
					groups.push(currentGroup);
					currentGroup = [];
				}
			}
		}

		// Add any remaining fields
		if (currentGroup.length > 0) {
			groups.push(currentGroup);
		}

		return groups;
	}

	const customFields = $derived(getCustomFields());
	const fieldGroups = $derived(groupFieldsForLayout(customFields));
</script>

<div class="space-y-8">
	{#if customFields.length > 0}
		<div class="space-y-4">
			<div class="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-6">
				<div class="text-sm text-gray-500 dark:text-gray-400 mb-4">
					Additional fields specific to your organization
				</div>
				<div class="space-y-8">
					{#each fieldGroups as fieldGroup, index (index)}
						<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
							{#each fieldGroup as [fieldName, field], index (index)}
								<div class={getFieldLayoutClass(field)}>
									<EditableFieldRenderer 
										{fieldName} 
										{field} 
										bind:value={control[fieldName]}
										onChange={() => onFieldChange(fieldName, control[fieldName])}
									/>
								</div>
							{/each}
						</div>
					{/each}
				</div>
			</div>
		</div>
	{:else}
		<div class="text-center py-12">
			<p class="text-gray-500 dark:text-gray-400">No custom fields configured</p>
		</div>
	{/if}
</div>
