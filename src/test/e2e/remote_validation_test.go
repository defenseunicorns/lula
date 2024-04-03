package test

import (
	"context"
	"testing"
	"time"

	"github.com/defenseunicorns/lula/src/cmd/dev"
	"github.com/defenseunicorns/lula/src/pkg/message"
	"github.com/defenseunicorns/lula/src/test/util"
	corev1 "k8s.io/api/core/v1"
	"sigs.k8s.io/e2e-framework/klient/wait"
	"sigs.k8s.io/e2e-framework/klient/wait/conditions"
	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"
)

func TestDevValidation(t *testing.T) {
	featureRemoteValidation := features.New("Check dev validate").
		Setup(func(ctx context.Context, t *testing.T, config *envconf.Config) context.Context {
			/ Create the pod
			pod, err := util.GetPod("./scenarios/remote-validations/pod.pass.yaml")
			if err != nil {
				t.Fatal(err)
			}
			if err = config.Client().Resources().Create(ctx, pod); err != nil {
				t.Fatal(err)
			}
			err = wait.For(conditions.New(config.Client().Resources()).PodConditionMatch(pod, corev1.PodReady, corev1.ConditionTrue), wait.WithTimeout(time.Minute*5))
			if err != nil {
				t.Fatal(err)
			}
			ctx = context.WithValue(ctx, "pod-dev-validate", pod)

			return ctx
		}).
		Assess("Validate local validation file", func(ctx context.Context, t *testing.T, config *envconf.Config) context.Context {
			

			return ctx
		}).
		Teardown(func(ctx context.Context, t *testing.T, config *envconf.Config) context.Context {

			/ Delete the pod
			pod := ctx.Value("pod-dev-validate").(*corev1.Pod)
			if err := config.Client().Resources().Delete(ctx, pod); err != nil {
				t.Fatal(err)
			}
			return ctx
		}).Feature()

	testEnv.Test(t, featureRemoteValidation)
}
