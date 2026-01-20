import { Capability, a } from "pepr";
const name = "hello-pepr-ns-all";
export const HelloPeprNamespace = new Capability({
  name: name,
  description: name,
  namespaces: [],
});
const { When } = HelloPeprNamespace;
When(a.ConfigMap)
  .IsCreated()
  .InNamespace("default")
  .Mutate(function mutateDef(request) {
    request.SetAnnotation("def", "seen");
  });
/**
 * This policy mutates Pods by setting a ns=seen annotation when they are created in any namespace.
 *
 * @related https://docs.pepr.dev
 *
 * @lulaStart 123e4567-e89b-12d3-a456-426614174000
 */
When(a.ConfigMap)
  .IsCreated()
  .InNamespace(name)
  .Mutate(function mutateNs(request) {
    // Set the ns=seen annotation
    request.SetAnnotation("ns", "seen");
    // do something else here
  });
/**
 * @lulaEnd 123e4567-e89b-12d3-a456-426614174000
 */

/**
 * This policy mutates ConfigMaps by setting a non=seen annotation when they are created in any namespace.
 *
 * @related https://docs.pepr.dev
 *
 * @lulaStart 987e4567-e89b-12d3-a456-426614174777
 */
When(a.ConfigMap)
  .IsCreated()
  .Mutate(function mutateNon(request) {
    // change inserted here
    request.SetAnnotation("non", "seen");
  });
// @lulaEnd 987e4567-e89b-12d3-a456-426614174777
