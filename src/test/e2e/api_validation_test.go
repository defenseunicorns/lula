package test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	"sigs.k8s.io/e2e-framework/klient/wait"
	"sigs.k8s.io/e2e-framework/klient/wait/conditions"
	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	"github.com/defenseunicorns/lula/src/cmd/dev"
	"github.com/defenseunicorns/lula/src/internal/template"
	"github.com/defenseunicorns/lula/src/pkg/common/composition"
	"github.com/defenseunicorns/lula/src/pkg/common/validation"
	"github.com/defenseunicorns/lula/src/pkg/message"
	"github.com/defenseunicorns/lula/src/test/util"
)

func TestApiValidation(t *testing.T) {
	const (
		ckAPIFieldConfigMap contextKey = "api-field-configmap"
		ckApiFieldPod       contextKey = "api-field-pod"
	)
	featureTrueValidation := features.New("Check API Validation - Success").
		Setup(func(ctx context.Context, t *testing.T, config *envconf.Config) context.Context {
			// Create the configmap
			configMap, err := util.GetConfigMap("./scenarios/api-field/configmap.pass.yaml")
			if err != nil {
				t.Fatal(err)
			}
			if err = config.Client().Resources().Create(ctx, configMap); err != nil {
				t.Fatal(err)
			}
			ctx = context.WithValue(ctx, ckAPIFieldConfigMap, configMap)

			// Create the pod
			pod, err := util.GetPod("./scenarios/api-field/pod.yaml")
			if err != nil {
				t.Fatal(err)
			}
			if err = config.Client().Resources().Create(ctx, pod); err != nil {
				t.Fatal(err)
			}
			err = wait.
				For(conditions.New(config.Client().Resources()).
					PodConditionMatch(pod, corev1.PodReady, corev1.ConditionTrue),
					wait.WithTimeout(time.Minute*5))
			if err != nil {
				t.Fatal(err)
			}
			ctx = context.WithValue(ctx, ckApiFieldPod, pod)

			return ctx
		}).
		Assess("Validate API response field", func(ctx context.Context, t *testing.T, config *envconf.Config) context.Context {
			oscalPath := "./scenarios/api-field/oscal-component.yaml"
			message.NoProgress = true

			validator, err := validation.New()
			if err != nil {
				t.Errorf("error creating validation context: %v", err)
			}

			assessment, err := validator.ValidateOnPath(context.Background(), oscalPath, "")
			if err != nil {
				t.Fatal(err)
			}

			if len(assessment.Results) == 0 {
				t.Fatal("Expected greater than zero results")
			}

			result := assessment.Results[0]

			if result.Findings == nil {
				t.Fatal("Expected findings to be not nil")
			}

			for _, finding := range *result.Findings {
				state := finding.Target.Status.State
				if state != "satisfied" {
					t.Fatal("State should be satisfied, but got :", state)
				}
			}

			return ctx
		}).
		Teardown(func(ctx context.Context, t *testing.T, config *envconf.Config) context.Context {
			pod := ctx.Value(ckApiFieldPod).(*corev1.Pod)
			if err := config.Client().Resources().Delete(ctx, pod); err != nil {
				t.Fatal(err)
			}
			err := wait.
				For(conditions.New(config.Client().Resources()).
					ResourceDeleted(pod),
					wait.WithTimeout(time.Minute*5))
			if err != nil {
				t.Fatal(err)
			}

			configMap := ctx.Value(ckAPIFieldConfigMap).(*corev1.ConfigMap)
			if err := config.Client().Resources().Delete(ctx, configMap); err != nil {
				t.Fatal(err)
			}
			err = wait.
				For(conditions.New(config.Client().Resources()).
					ResourceDeleted(configMap),
					wait.WithTimeout(time.Minute*5))
			if err != nil {
				t.Fatal(err)
			}

			return ctx
		}).Feature()

	featureFalseValidation := features.New("Check API Validation - Failure").
		Setup(func(ctx context.Context, t *testing.T, config *envconf.Config) context.Context {
			configMap, err := util.GetConfigMap("./scenarios/api-field/configmap.fail.yaml")
			if err != nil {
				t.Fatal(err)
			}
			if err = config.Client().Resources().Create(ctx, configMap); err != nil {
				t.Fatal(err)
			}
			ctx = context.WithValue(ctx, ckAPIFieldConfigMap, configMap)

			pod, err := util.GetPod("./scenarios/api-field/pod.yaml")
			if err != nil {
				t.Fatal(err)
			}
			if err = config.Client().Resources().Create(ctx, pod); err != nil {
				t.Fatal(err)
			}
			err = wait.
				For(conditions.New(config.Client().Resources()).
					PodConditionMatch(pod, corev1.PodReady, corev1.ConditionTrue),
					wait.WithTimeout(time.Minute*5))
			if err != nil {
				t.Fatal(err)
			}
			ctx = context.WithValue(ctx, ckApiFieldPod, pod)
			return ctx
		}).
		Assess("Validate API response field", func(ctx context.Context, t *testing.T, config *envconf.Config) context.Context {
			oscalPath := "./scenarios/api-field/oscal-component.yaml"
			message.NoProgress = true

			validator, err := validation.New()
			if err != nil {
				t.Errorf("error creating validation context: %v", err)
			}

			assessment, err := validator.ValidateOnPath(context.Background(), oscalPath, "")
			if err != nil {
				t.Fatal(err)
			}

			if len(assessment.Results) == 0 {
				t.Fatal("Expected greater than zero results")
			}

			result := assessment.Results[0]

			if result.Findings == nil {
				t.Fatal("Expected findings to be not nil")
			}

			for _, finding := range *result.Findings {
				state := finding.Target.Status.State
				if state != "not-satisfied" {
					t.Fatal("State should be not-satisfied, but got :", state)
				}
			}

			return ctx
		}).
		Teardown(func(ctx context.Context, t *testing.T, config *envconf.Config) context.Context {
			pod := ctx.Value(ckApiFieldPod).(*corev1.Pod)
			if err := config.Client().Resources().Delete(ctx, pod); err != nil {
				t.Fatal(err)
			}
			err := wait.
				For(conditions.New(config.Client().Resources()).
					ResourceDeleted(pod),
					wait.WithTimeout(time.Minute*5))
			if err != nil {
				t.Fatal(err)
			}

			configMap := ctx.Value(ckAPIFieldConfigMap).(*corev1.ConfigMap)
			if err := config.Client().Resources().Delete(ctx, configMap); err != nil {
				t.Fatal(err)
			}
			err = wait.
				For(conditions.New(config.Client().Resources()).
					ResourceDeleted(configMap),
					wait.WithTimeout(time.Minute*5))
			if err != nil {
				t.Fatal(err)
			}

			return ctx
		}).Feature()

	testEnv.Test(t, featureTrueValidation, featureFalseValidation)
}

func TestApiValidation_templated(t *testing.T) {
	message.NoProgress = true
	dev.RunInteractively = false
	svr := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, err := w.Write([]byte(`{"pass": true}`))
		require.NoError(t, err)
	}))
	defer svr.Close()

	tmpl := "scenarios/api-validations/component-definition.yaml.tmpl"
	composer, err := composition.New(
		composition.WithModelFromLocalPath(tmpl),
		composition.WithRenderSettings("all", true),
		composition.WithTemplateRenderer("all", nil, []template.VariableConfig{
			{
				Key:     "reqUrl",
				Default: svr.URL,
			},
		}, []string{}),
	)
	require.NoError(t, err)

	validator, err := validation.New(validation.WithComposition(composer, tmpl))
	require.NoError(t, err)

	assessment, err := validator.ValidateOnPath(context.Background(), tmpl, "")
	require.NoError(t, err)
	require.GreaterOrEqual(t, len(assessment.Results), 1)

	result := assessment.Results[0]
	require.NotNil(t, result.Findings)
	for _, finding := range *result.Findings {
		state := finding.Target.Status.State
		if state != "satisfied" {
			t.Fatal("State should be satisfied, but got :", state)
		}
	}
}
