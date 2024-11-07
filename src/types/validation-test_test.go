package types_test

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/defenseunicorns/lula/src/internal/transform"
	"github.com/defenseunicorns/lula/src/pkg/providers/opa"
	"github.com/defenseunicorns/lula/src/types"
)

// TestExecuteTest tests the execution of a single LulaValidationTest
func TestExecuteTest(t *testing.T) {
	opaProvider, err := opa.CreateOpaProvider(context.Background(), &opa.OpaSpec{
		Rego: "package validate\n\nvalidate {input.test.metadata.name == \"test-resource\"}",
	})
	require.NoError(t, err)
	lulaValidation := types.LulaValidation{Provider: &opaProvider}

	t.Run("Execute test - success", func(t *testing.T) {
		resources := map[string]interface{}{
			"test": map[string]interface{}{
				"metadata": map[string]interface{}{
					"name": "test-resource",
				},
			},
		}

		validationTestData := &types.LulaValidationTestData{
			Test: &types.LulaValidationTest{
				Name: "test-modify-name",
				Changes: []types.LulaValidationTestChange{
					{
						Path:     "test.metadata.name",
						Type:     transform.ChangeTypeUpdate,
						Value:    "another-resource",
						ValueMap: nil,
					},
				},
				ExpectedResult: "not-satisfied",
			},
		}

		_, err := validationTestData.ExecuteTest(context.Background(), &lulaValidation, resources, false)
		require.NoError(t, err)

		require.Equal(t, validationTestData.Result.Pass, true)
		require.Equal(t, validationTestData.Result.Result, "not-satisfied")
	})

	t.Run("Execute test - fail", func(t *testing.T) {
		resources := map[string]interface{}{
			"different-root": map[string]interface{}{
				"metadata": map[string]interface{}{
					"name": "test-resource",
				},
			},
		}

		validationTestData := &types.LulaValidationTestData{
			Test: &types.LulaValidationTest{
				Name: "test-modify-name",
				Changes: []types.LulaValidationTestChange{
					{
						Path:     "test.metadata.name",
						Type:     transform.ChangeTypeUpdate,
						Value:    "another-resource",
						ValueMap: nil,
					},
				},
				ExpectedResult: "not-satisfied",
			},
		}

		_, err := validationTestData.ExecuteTest(context.Background(), &lulaValidation, resources, false)
		require.NoError(t, err)

		require.Equal(t, validationTestData.Result.Pass, false)
		require.Equal(t, validationTestData.Result.Result, "satisfied")
	})

	t.Run("Execute test - print resources", func(t *testing.T) {
		tmpDir := t.TempDir()
		ctx := context.WithValue(context.Background(), types.LulaValidationWorkDir, tmpDir)

		resources := map[string]interface{}{
			"test": map[string]interface{}{
				"metadata": map[string]interface{}{
					"name": "test-resource",
				},
			},
		}

		validationTestData := &types.LulaValidationTestData{
			Test: &types.LulaValidationTest{
				Name: "test-modify-name",
				Changes: []types.LulaValidationTestChange{
					{
						Path:     "test.metadata.name",
						Type:     transform.ChangeTypeUpdate,
						Value:    "another-resource",
						ValueMap: nil,
					},
				},
				ExpectedResult: "not-satisfied",
			},
		}

		validationTestData.ExecuteTest(ctx, &lulaValidation, resources, true)

		expectedFilePath := filepath.Join(tmpDir, "test-modify-name.json")
		require.Equal(t, expectedFilePath, validationTestData.Result.TestResourcesPath)

		// read the json file
		data, err := os.ReadFile(filepath.Join(tmpDir, "test-modify-name.json"))
		require.NoError(t, err)

		// compare the json data to the expected data
		expectedData, err := json.MarshalIndent(map[string]interface{}{
			"test": map[string]interface{}{
				"metadata": map[string]interface{}{
					"name": "another-resource",
				},
			},
		}, "", "  ")
		require.NoError(t, err)

		require.Equal(t, expectedData, data)
	})
}
