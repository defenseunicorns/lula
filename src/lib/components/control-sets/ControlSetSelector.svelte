<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ControlSet } from '$lib/types';

  interface Props {
    currentSet: ControlSet;
    availableSets: ControlSet[];
  }

  let { currentSet, availableSets }: Props = $props();

  const dispatch = createEventDispatcher<{ change: string }>();

  function handleChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    dispatch('change', target.value);
  }
</script>

<div class="control-set-selector">
  <label for="control-set" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
    Control Set
  </label>
  <select
    id="control-set"
    value={currentSet.id}
    onchange={handleChange}
    class="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
  >
    {#each availableSets as set}
      <option value={set.id}>{set.name} {set.version}</option>
    {/each}
  </select>
  <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
    {currentSet.description}
  </p>
</div>

<style>
  .control-set-selector {
    margin-bottom: 1rem;
  }
</style>
