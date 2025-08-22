<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import type { Control } from '$lib/types.js';
	import type { ControlSchema, ValidationResult } from '$lib/form-types.js';
	import DynamicField from './DynamicField.svelte';

	interface Props {
		control: Control;
		schema: ControlSchema;
		readonly?: boolean;
		onValidation?: (result: ValidationResult) => void;
		onChange?: () => void;
	}

	let { 
		control = $bindable(),
		schema,
		readonly = false,
		onValidation,
		onChange
	}: Props = $props();

	// Track validation errors for each field
	let fieldErrors = $state<Record<string, string>>({});

	// Group fields for better layout
	const fieldGroups = $derived.by(() => {
		const groups: { [key: string]: typeof schema.fields } = {};
		
		schema.fields.forEach(field => {
			const group = field.group || 'general';
			if (!groups[group]) {
				groups[group] = [];
			}
			groups[group].push(field);
		});
		
		return groups;
	});

	function handleFieldChange(fieldId: string) {
		// Run field-specific validation
		validateField(fieldId);
		onChange?.();
	}

	function validateField(fieldId: string) {
		const field = schema.fields.find(f => f.id === fieldId);
		if (!field) return;

		const value = control[fieldId];
		let error = '';

		// Required field validation
		if (field.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
			error = `${field.label} is required`;
		}

		// Custom validation rules
		if (field.validation && value) {
			for (const rule of field.validation) {
				if (rule.type === 'minLength' && typeof value === 'string' && value.length < rule.value) {
					error = rule.message || `${field.label} must be at least ${rule.value} characters`;
					break;
				}
				if (rule.type === 'maxLength' && typeof value === 'string' && value.length > rule.value) {
					error = rule.message || `${field.label} must be no more than ${rule.value} characters`;
					break;
				}
				if (rule.type === 'pattern' && typeof value === 'string' && !new RegExp(rule.pattern!).test(value)) {
					error = rule.message || `${field.label} format is invalid`;
					break;
				}
			}
		}

		// Update field errors
		if (error) {
			fieldErrors[fieldId] = error;
		} else {
			delete fieldErrors[fieldId];
		}
		
		// Trigger validation callback
		const hasErrors = Object.keys(fieldErrors).length > 0;
		const validationResult: ValidationResult = {
			valid: !hasErrors,
			errors: Object.entries(fieldErrors).map(([field, message]) => ({ field, message })),
			warnings: []
		};
		
		onValidation?.(validationResult);
	}

	// Only validate on explicit changes, not on control object changes
	let isInitialized = $state(false);
	
	$effect(() => {
		if (control && !isInitialized) {
			isInitialized = true;
			// Initial validation without triggering callbacks
			schema.fields.forEach(field => {
				if (control[field.id] !== undefined) {
					const fieldId = field.id;
					const fieldDef = schema.fields.find(f => f.id === fieldId);
					if (!fieldDef) return;

					const value = control[fieldId];
					let error = '';

					// Required field validation
					if (fieldDef.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
						error = `${fieldDef.label} is required`;
					}

					// Update field errors without triggering validation callback
					if (error) {
						fieldErrors[fieldId] = error;
					} else {
						delete fieldErrors[fieldId];
					}
				}
			});
		}
	});
</script>

<div class="space-y-8">
	{#each Object.entries(fieldGroups) as [groupName, fields]}
		<div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
			{#if groupName !== 'general'}
				<!-- Group Header -->
				<div class="border-b border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-6 py-4">
					<h3 class="text-lg font-medium text-gray-900 dark:text-white capitalize">
						{groupName.replace(/([A-Z])/g, ' $1').trim()}
					</h3>
				</div>
			{/if}
			
			<!-- Form Content -->
			<div class="p-6">
				<!-- Grid layout for better organization -->
				<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
					{#each fields as field}
						{#if field.type !== 'textarea'}
							<DynamicField
								{field}
								bind:value={control[field.id]}
								{readonly}
								error={fieldErrors[field.id]}
								onChange={() => handleFieldChange(field.id)}
							/>
						{/if}
					{/each}
				</div>
				
				<!-- Full-width fields (textareas, etc.) -->
				<div class="space-y-6">
					{#each fields as field}
						{#if field.type === 'textarea'}
							<DynamicField
								{field}
								bind:value={control[field.id]}
								{readonly}
								error={fieldErrors[field.id]}
								onChange={() => handleFieldChange(field.id)}
							/>
						{/if}
					{/each}
				</div>
			</div>
		</div>
	{/each}
</div>
