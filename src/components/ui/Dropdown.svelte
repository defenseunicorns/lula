<!-- SPDX-License-Identifier: LicenseRef-Defense-Unicorns-Commercial -->

<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { fade } from 'svelte/transition'

  import { ChevronDown } from 'carbon-icons-svelte'
  import { twMerge } from 'tailwind-merge'

  type Props = HTMLAttributes<HTMLDivElement> & {
    buttonLabel?: string
    buttonLabelClass?: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buttonIcon?: any
    buttonClass?: string
    dropdownClass?: string
    iconClass?: string
    expandIconClass?: string
    isOpen?: boolean
    buttonContents?: Snippet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    children?: any
    class?: string
  }

  let {
    buttonLabel = '',
    buttonLabelClass = 'min-w-0 truncate',
    buttonIcon = undefined,
    buttonClass = '',
    dropdownClass = '',
    iconClass = '',
    expandIconClass = '',
    isOpen = $bindable(false),
    children,
    buttonContents,
    class: propsClass = '',
    ...restProps
  }: Props = $props()

  // Toggle dropdown open/closed
  function toggleDropdown() {
    isOpen = !isOpen
  }
</script>

<div
  class={twMerge(
    'relative min-w-0 flex-shrink-0 text-left',
    dropdownClass?.includes('inline-block') ? '' : 'block',
    propsClass,
  )}
  {...restProps}
>
  <button
    onclick={toggleDropdown}
    class={twMerge(
      'btn relative flex   w-full items-center justify-between rounded-lg bg-gray-800 px-2 py-1 text-white hover:bg-gray-700 focus:bg-gray-700 md:px-4 md:py-2',
      buttonClass,
    )}
    data-testid="dropdown-button"
    aria-label={buttonLabel}
  >
    {#if buttonContents}
      {@render buttonContents()}
    {:else}
      <div class="flex min-w-0 items-center">
        {#if buttonIcon}
          {@const SvelteComponent = buttonIcon}
          <div class={twMerge('mr-2 flex h-5 w-5 items-center justify-center', iconClass)}>
            <SvelteComponent />
          </div>
        {/if}
        <span class={buttonLabelClass}>{buttonLabel}</span>
      </div>
      <ChevronDown class={twMerge('ml-2 h-[12px] w-[12px]', expandIconClass)} />
    {/if}
  </button>

  {#if isOpen}
    <!-- full-screen invisible button mask - closes when clicking off dropdown without clicking underlying element -->
    <button
      class="fixed inset-0 z-40 m-0 border-none bg-transparent p-0"
      aria-label="Close dropdown"
      onclick={(e) => {
        isOpen = false
        e.stopPropagation()
      }}
      onkeydown={(e) => {
        // close on Enter, Space or Escape
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
          isOpen = false
          e.preventDefault()
          e.stopPropagation()
        }
      }}
    ></button>
    <div
      transition:fade={{ duration: 100 }}
      class={`absolute right-0 z-100 mt-2 min-w-60 origin-top-right rounded-lg border border-gray-700 bg-gray-800 p-2 shadow-lg focus:outline-none ${dropdownClass}`}
    >
      {@render children?.()}
    </div>
  {/if}
</div>
