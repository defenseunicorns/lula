# 8. Support for Configuration Data

Date: 2024-07-22

## Status

Proposed

## Context

There is an identified need to pull in extra information into various artifacts that Lula operates on. For example
* Adding metadata information to OSCAL documents during Lula Generation methods
* Adding variables and/or secrets into Lula Validation manifests
* Templating component definitions with version numbers

Each of these possible operations may require a distinct input `configuration` file that provides the data, however it is desirable that the underlying libraries and methods support all these possible use cases.

### Detailed Use Case Exploration

1. User wants to have composed OSCAL model, but keep configuration separate, templated at run-time

  -> Validation config is added as a separate back-matter artifact, and extracted from the back-matter when validating. (how do you merge multiple, which get precedence?)

2. User wants to have composed OSCAL model, WITH validations templated at compose time 
  
  -> Validation config is NOT added in the back-matter

>[!NOTE] I think you do want to support both - the first use case is probably where the "composed" file is taken to different locations, where you don't want to have to port around all the individual validations but may need to operate on them and want the config still broken out. The second use case is more relevant to the "composed" file being an artifact of the `lula validate` command, where you'd want that file to possibly evaluate after the run (thinking in CI scenario)

3. Environment variables are going to be templated values.

  -> We can't pull this in as config, need to identify the environment variables specifically as something that should be injected at runtime (`lula validate`). These aren't secrets, so could be added in a `composed` component-definition that is provided as an artifact of the `lula validate` command.

4. Secrets are going to be templated values.

  -> This is trickier... they'd probably be injected the same way as environment variables, but would need to be obfuscated in the OSCAL artifact.

5. User wants to have a templated OSCAL model, e.g., some links may be templated if root path changes

6. OSCAL is created based on the aggregation of different information, e.g., a partial SSP and externally sourced metadata.

7. Validation configuration values can be --set at the command line, e.g., `lula validate -f ./component-definition.yaml --set .some-value=abc123`

  -> In `dev validate` this should support .env and .secret values as well, since those most likely will need to be mocked out for testing.

#### Use Cases 1 & 2: Sample Lula Validation and associated config that could be templated at build-time

Addition of system-specific values that are not secrets, but just items that might be changing between system design iterations.

Validation with template values, currently structured in go-template syntax:
```yaml
metadata:
  name: istio-metrics-logging-configured
  uuid: 70d99754-2918-400c-ac9a-319f874fff90
domain:
  type: kubernetes
  kubernetes-spec:
    resources:
    - name: istioConfig
      resource-rule:
        resource: configmaps
        namespaces:
        - "{{ .istio.namespace }}"
        version: v1
        name: "{{ .istio.config-name }}"
        field:
          jsonpath: .data.mesh
          type: yaml
provider:
  type: opa
  opa-spec:
    rego: |
      package validate
      import rego.v1

      # Default values
      default validate := false
      default msg := "Not evaluated"

      # Validate Istio configuration for metrics logging support
      validate if {
        check_metrics_enabled.result
      }
      msg = check_metrics_enabled.msg

      check_metrics_enabled = { "result": false, "msg": msg } if {
        input.istioConfig.{{ .istio.prometheus-merge }} == false
        msg := "Metrics logging not supported."
      } else = { "result": true, "msg": msg } if {
        msg := "Metrics logging supported."
      }
    output:
      validation: validate.validate
      observations:
      - validate.msg
```

Validation configuration file (variable schema, based on how it's called in the go-template syntax):
```yaml
istio:
  namespace: istio-system
  config-name: istio-config
  prometheus-merge: enablePrometheusMerge
```
^^ This is assuming we are using go-template under the hood. A different, more regid structure might be needed if a different templating method is used.

With a component definition that links the above validation, run:
```shell
lula t compose -f ./component-definition.yaml --config ./my-config.yaml
```

This adds the templated validation to the `back-matter` of the composed component-definition OR templates the validation and omits the config from the back-matter.

#### Use Case 3 & 4: Run-time template of variables

Addition of deployment-specific variables that are subject to change across deployments of a system. 

Templating should happen at run-time since these values are likely dependant on the environment and/or possibly an output of some other process therein.

Example: Creating a custom host/API token for a given application, e.g., Keycloak
```yaml
metadata:
  name: check-keycloak-api
  uuid: bf0aeb97-6e37-4bf4-b976-5f6af6fa81a3
domain:
  type: api
  api-spec:
    name: keycloakAdmin
    endpoint: http://{{ .env.KEYCLOAK_HOST }}:8080/auth/admin/realms/master
    method: GET
    headers:
      Authorization: Bearer {{ .secret.KEYCLOAK_TOKEN }}
provider:
  type: opa
  opa-spec:
    rego: |
      package validate
      import rego.v1

      # Some validation logic here...
```

Here, no config is required, the `env` and `secret` values are provided by the environment. The .env values are persisted in the OSCAL artifact, while the .secret values are not. (somehow?)

#### Use Case 5: Template of OSCAL data

Aside from templating entire sections of OSCAL, maybe some overrides with respect to a linked path might be needed:

```yaml
component-definition:
  components:
    - # ... list of components
      control-implementations:
        - # ... list of control implementations
          implemented-requirements:
            - # ... list of implemented requirements
              links:
                - href: '{{ .rootUrl }}/validations/istio/healthcheck/validation.yaml'
                  rel: lula
                  text: Check that Istio is healthy
```

#### Use Case 6: Lula OSCAL Generation

Need to add additional information to OSCAL documents, in this use case specifically looking at SSP generation.

We have some metadata which is constant/managed external to Lula:
```yaml
metadata:
  title: "System Security Plan for UDS Core"
  last-modified: 2024-07-22Z12:00:00
  oscal-version: 1.1.2
```

We have some auto-generated content, e.g., created from the component-definition model
```yaml
system-security-plan:
  system-characteristics:
    system-name: "UDS Core"
  system-implementation:
    components:
      - uuid: f2b245ea-f149-45cf-a740-86081fdb2922
        title: Istio
      - uuid: d1ce0ed3-d678-4bf0-b9f4-330bacd97473
        title: Grafana
```

## (Proposed) Decision

Two separate Lula Config files for the OSCAL (`lula gen`) use cases vs. Validation configuration (`lula validate`/`lula t compose`) use cases

### Lula Generation

Define a configuration file that when provided to a `generate` command will inject some data into the specified OscalModelSchema jsonpath:

```yaml
kind: LulaOscalConfig

# Map substitutions
maps:
  - name: ssp-metadata
    oscal-key: system-security-plan.metadata
    file: ./metadata.yaml # file OR content specified
    content: |
      title: "System Security Plan for UDS Core"
      last-modified: 2024-07-22Z12:00:00
      oscal-version: 1.1.2
```

Underlying libraries/implementation will be the k8s.io kustomization/kyaml module and map merge functions to identify the path given by `oscal-key` in the OscalModelSchema and inject the contents of `file` or `content` into the schema. Presumably this will manifest as:

```bash
lula gen ssp --config config-file.yaml --component component-defintion.yaml
```
where the gen ssp uses the component-definition to generate the auto-portions and reads from the map substitutions in `LulaOscalConfig` to inject relevant data where specified.

### Variable substitution

Define a configuration file that when provided to a `validate` (or `compose` or `assess`) command will configure a viper engine to substitute the data:

```yaml
kind: LulaValidationConfig

# Constants substition - gets subbed during composition
constants:
  - name: ...
    value: ...

# Variables - gets subbed at runtime.. from env vars?
variables:
  - name: ...
    value: ...
```

The `constants` are subbed at build-time, whereas the `variables` are subbed during the runtime processes.

## Consequences