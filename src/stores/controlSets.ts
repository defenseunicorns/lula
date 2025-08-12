import { writable } from 'svelte/store';
import type { ControlSet, ControlSetInfo } from '$lib/types';

const NIST_800_53_REV4: ControlSet = {
  id: 'nist-800-53-rev4',
  name: 'NIST SP 800-53',
  version: 'Revision 4',
  description: 'Security and Privacy Controls for Federal Information Systems and Organizations',
  published: '2013-04-30',
  created: '2025-08-01T08:00:00.000Z',
  lastModified: '2025-08-01T08:00:00.000Z'
};

const availableSets: ControlSet[] = [NIST_800_53_REV4];

const initialControlSetInfo: ControlSetInfo = {
  currentSet: NIST_800_53_REV4,
  availableSets
};

export const controlSetInfo = writable<ControlSetInfo>(initialControlSetInfo);

export function selectControlSet(setId: string) {
  controlSetInfo.update(info => {
    const selectedSet = info.availableSets.find(set => set.id === setId);
    if (selectedSet) {
      return {
        ...info,
        currentSet: selectedSet
      };
    }
    return info;
  });
}