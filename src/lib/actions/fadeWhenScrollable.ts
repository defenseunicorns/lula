// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

// Action to apply or remove the 'no-fade' class based on when an element is scrollable (overflow-y-scroll)
// Our 'scrollable-container' class uses a CSS pseudo-element to apply a fade effect at the bottom of the container
// The 'no-fade' class removes that effect
export function fadeWhenScrollable(node: HTMLElement) {
  // `check` adds “no-fade” if there is NO vertical overflow,
  // removes it once overflow appears.
  function check() {
    if (node.scrollHeight > node.clientHeight) {
      node.classList.remove('no-fade')
    } else {
      node.classList.add('no-fade')
    }
  }

  // 1) watch for size/box changes (e.g. window resize, parent CSS changes, etc.)
  const resizeObs = new ResizeObserver(check)
  resizeObs.observe(node)

  // 2) watch for DOM mutations under `node` (e.g. new rows inserted into a table)
  const mutationObs = new MutationObserver(check)
  mutationObs.observe(node, { childList: true, subtree: true })

  // 3) also re-check on window resize
  window.addEventListener('resize', check)

  // initial check
  check()

  return {
    destroy() {
      resizeObs.disconnect()
      mutationObs.disconnect()
      window.removeEventListener('resize', check)
    },
  }
}
