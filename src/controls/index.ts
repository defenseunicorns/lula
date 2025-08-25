import { registerControls } from "compliance-reporter"

export const controls = registerControls({
  "123e4567-e89b-12d3-a456-426614174001": {
    id: "AC-1",
    description: "Restrict Pods running as root",
    remarks:
      "This control ensures that no Pods are allowed to run as the root user.",
  },
  "123e4567-e89b-12d3-a456-426614174002": {
    id: "AC-2",
    description: "Restrict Pods running privileged containers",
    remarks:
      "This control ensures that no Pods are allowed to run as privileged containers.",
  },
  "123e4567-e89b-12d3-a456-426614174003": {
    id: "AC-3",
    description: "Restrict Pods running as root",
    remarks:
      "This control ensures that no Pods are allowed to run as the root user.",
  },
})
