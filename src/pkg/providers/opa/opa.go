package opa

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"

	kube "github.com/defenseunicorns/lula/src/pkg/common/kubernetes"
	"github.com/defenseunicorns/lula/src/types"
	"github.com/mitchellh/mapstructure"

	"github.com/open-policy-agent/opa/ast"
	"github.com/open-policy-agent/opa/rego"
	rego_types "github.com/open-policy-agent/opa/types"
)

// TODO: What is the new version of the information we are displaying on the command line?

func Validate(ctx context.Context, domain string, data map[string]interface{}, opaCommon map[string]types.Validation) (types.Result, error) {

	if domain == "kubernetes" {
		var payload types.Payload
		err := mapstructure.Decode(data, &payload)
		if err != nil {
			return types.Result{}, err
		}

		err = kube.EvaluateWait(payload.Wait)
		if err != nil {
			return types.Result{}, err
		}

		collection, err := kube.QueryCluster(ctx, payload.Resources)
		if err != nil {
			return types.Result{}, err
		}

		// TODO: Add logging optionality for understanding what resources are actually being validated
		results, err := GetValidatedAssets(ctx, payload.Rego, collection, opaCommon)
		if err != nil {
			return types.Result{}, err
		}

		return results, nil

	} else if domain == "api" {
		var payload types.PayloadAPI
		err := mapstructure.Decode(data, &payload)
		if err != nil {
			return types.Result{}, err
		}

		collection := make(map[string]interface{}, 0)

		for _, request := range payload.Requests {
			transport := &http.Transport{}
			client := &http.Client{Transport: transport}

			resp, err := client.Get(request.URL)
			if err != nil {
				return types.Result{}, err
			}
			if resp.StatusCode != 200 {
				return types.Result{},
					fmt.Errorf("expected status code 200 but got %d\n", resp.StatusCode)
			}

			defer resp.Body.Close()
			body, err := io.ReadAll(resp.Body)
			if err != nil {
				return types.Result{}, err
			}

			contentType := resp.Header.Get("Content-Type")
			if contentType == "application/json" {

				var prettyBuff bytes.Buffer
				json.Indent(&prettyBuff, body, "", "  ")
				prettyJson := prettyBuff.String()

				var tempData interface{}
				err = json.Unmarshal([]byte(prettyJson), &tempData)
				if err != nil {
					return types.Result{}, err
				}
				collection[request.Name] = tempData

			} else {
				return types.Result{}, fmt.Errorf("content type %s is not supported", contentType)
			}
		}

		results, err := GetValidatedAssets(ctx, payload.Rego, collection, opaCommon)
		if err != nil {
			return types.Result{}, err
		}
		return results, nil

	}

	return types.Result{}, fmt.Errorf("domain %s is not supported", domain)
}

type ResultData struct {
	Failed   []string `json:"failed"`
	Passed   []string `json:"passed"`
	Validate bool     `json:"validate"`
}

// GetValidatedAssets performs the validation of the dataset against the given rego policy
func GetValidatedAssets(ctx context.Context, regoPolicy string, dataset map[string]interface{}, opaCommon map[string]types.Validation) (types.Result, error) {
	var matchResult types.Result

	if len(dataset) == 0 {
		// Not an error but no entries to validate
		// TODO: add a warning log
		return matchResult, nil
	}

	// Add modules
	modules := make(map[string]string, 0)
	modules["validate.rego"] = regoPolicy
	for _, module := range opaCommon {
		var payload types.Payload
		err := mapstructure.Decode(module.Description["payload"], &payload)
		if err != nil {
			return types.Result{}, err
		}
		modules[payload.Resources[0].Name+".rego"] = payload.Rego
	}

	compiler, err := ast.CompileModules(modules)
	if err != nil {
		log.Fatal(err)
		return matchResult, fmt.Errorf("failed to compile rego policy: %w", err)
	}

	regoCalc := rego.New(
		rego.Query("data.validate"),
		rego.Compiler(compiler),
		rego.Input(dataset),
	)

	resultSet, err := regoCalc.Eval(ctx)

	if err != nil || resultSet == nil || len(resultSet) == 0 {
		return matchResult, fmt.Errorf("failed to evaluate rego policy: %w", err)
	}

	for _, result := range resultSet {
		for _, expression := range result.Expressions {
			expressionBytes, err := json.Marshal(expression.Value)
			if err != nil {
				return matchResult, fmt.Errorf("failed to marshal expression: %w", err)
			}

			var expressionMap map[string]interface{}
			err = json.Unmarshal(expressionBytes, &expressionMap)
			if err != nil {
				return matchResult, fmt.Errorf("failed to unmarshal expression: %w", err)
			}

			// resultBytes, err := json.Marshal(expressionMap["result"])
			// if err != nil {
			// 	return matchResult, fmt.Errorf("failed to marshal expression: %w", err)
			// }

			// var resultMap map[string]interface{}
			// err = json.Unmarshal(resultBytes, &resultMap)
			// if err != nil {
			// 	return matchResult, fmt.Errorf("failed to unmarshal expression: %w", err)
			// }

			// fmt.Println(string(resultBytes))

			var buf bytes.Buffer
			if err := json.NewEncoder(&buf).Encode(expressionMap["result"]); err != nil {
				return matchResult, fmt.Errorf("unable to encode: %w", err)
			}

			var data ResultData
			if err := json.NewDecoder(&buf).Decode(&data); err != nil {
				return matchResult, fmt.Errorf("unable to decode: %w", err)
			}

			// TODO: add logging optionality here for developer experience
			if data.Validate {
				// TODO: Is there a way to determine how many resources failed?
				// matchResult.Passing += 1
				matchResult.Passing = len(data.Passed)
				matchResult.PassingList = data.Passed
			} else {
				// matchResult.Failing += 1
				matchResult.Failing = len(data.Failed)
				matchResult.FailingList = data.Failed
			}
		}
	}

	return matchResult, nil
}

// Messing with running functions in go... but not currently implemented
// RegoGetExemptions returns the rego function to get the exemptions for a resource
func RegoGetExemptions() func(*rego.Rego) {
	return rego.Function3(
		&rego.Function{
			Name: "get_exemptions",
			Decl: rego_types.NewFunction(rego_types.Args(rego_types.A, rego_types.S, rego_types.S), rego_types.B),
		},
		func(bctx rego.BuiltinContext, exemptions, namespace, name *ast.Term) (*ast.Term, error) {
			exempts := []string{}
			if err := json.Unmarshal([]byte(exemptions.Value.String()), &exempts); err != nil {
				return nil, fmt.Errorf("unmarshal rego exemptions data: %v", err)
			}
			if matchesRegexInSlice(namespace.Value.String()+"/"+name.Value.String(), exempts) {
				return ast.BooleanTerm(true), nil
			} else {
				return ast.BooleanTerm(false), nil
			}
		},
	)
}

// matchesRegexInSlice checks if a value matches any regex pattern in the provided slice
func matchesRegexInSlice(value string, slice []string) bool {
	for _, item := range slice {
		// Compile the pattern
		pattern, err := regexp.Compile(item)
		if err != nil {
			fmt.Printf("Invalid regex pattern \"%s\": %v\n", item, err)
			continue // Skip invalid patterns
		}
		// Check if the value matches the pattern
		if pattern.MatchString(value) {
			return true
		}
	}
	return false
}
