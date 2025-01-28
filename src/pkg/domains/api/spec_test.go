package api

import (
	"net/url"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"
)

func TestValidateAndMutateOptions(t *testing.T) {
	var testTimeout = 10 * time.Second
	var zeroTimeout = 0 * time.Second

	tests := map[string]struct {
		input      *ApiOpts
		want       *opts
		expectErrs int
	}{
		"nil input, defaults are populated": {
			nil,
			&opts{timeout: &defaultTimeout},
			0,
		},
		"empty input, defaults are populated": {
			&ApiOpts{},
			&opts{timeout: &defaultTimeout},
			0,
		},
		"valid input, internal fields populated": {
			&ApiOpts{
				Timeout: "10s",
				Proxy:   "https://my.proxy",
				Headers: map[string]string{"cache": "no-cache"},
			},
			&opts{
				headers: map[string]string{"cache": "no-cache"},
				timeout: &testTimeout,
				proxyURL: &url.URL{
					Scheme: "https",
					Host:   "my.proxy",
				},
			},
			0,
		},
		"several errors": {
			&ApiOpts{
				Proxy:   "close//butinvalid\n\r",
				Timeout: "more nonsense",
			},
			&opts{
				timeout: &zeroTimeout, // there was an error, so this is set to zero value
			},
			2,
		},
	}

	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			got, err := validateAndMutateOptions(test.input)
			if err != nil {
				if test.expectErrs == 0 {
					t.Fatalf("expected success, got error(s) %s", err)
				} else if uw, ok := err.(interface{ Unwrap() []error }); ok {
					errs := uw.Unwrap()
					require.Equal(t, test.expectErrs, len(errs))
				} else {
					if test.expectErrs != 1 {
						t.Fatalf("expected multiple errors, got one: %s", err)
					}
				}
			} else {
				if test.expectErrs != 0 {
					t.Fatal("expected error(s), got success")
				}
			}

			if diff := cmp.Diff(test.want, got, cmp.AllowUnexported(opts{})); diff != "" {
				t.Fatalf("wrong result(-got +want):\n%s\n", diff)
			}
		})
	}
}

func TestValidateAndMutateSpec(t *testing.T) {
	healthcheckUrl, err := url.Parse("http://example.com/health")
	require.NoError(t, err)
	testParams := url.Values{}
	testParams.Add("key", "value")

	tests := map[string]struct {
		input      *ApiSpec
		want       ApiDomain
		expectErrs int
	}{
		"error: nil input": {
			nil, ApiDomain{}, 1,
		},
		"error: empty input, nil options": {
			&ApiSpec{},
			ApiDomain{
				defaults: &opts{timeout: &defaultTimeout},
			},
			1,
		},
		"success (get with params)": {
			&ApiSpec{
				Requests: []Request{
					{
						Name: "healthcheck",
						URL:  "http://example.com/health",
						Params: map[string]string{
							"key": "value",
						},
						Options: &ApiOpts{
							Headers: map[string]string{
								"cache-control": "no-hit",
							},
						},
					},
				},
			},
			ApiDomain{
				requests: []request{
					{
						name:          "healthcheck",
						reqURL:        healthcheckUrl,
						reqParameters: testParams,
						opts: &opts{
							headers: map[string]string{
								"cache-control": "no-hit",
							},
							timeout: &defaultTimeout,
						},
						method: "GET",
					},
				},
				defaults: &opts{timeout: &defaultTimeout},
			},
			0,
		},
		"success (post with body)": {
			&ApiSpec{
				Requests: []Request{
					{
						Name: "healthcheck",
						URL:  "http://example.com/health",
						Body: `{"some":"thing"}`,
						Options: &ApiOpts{
							Headers: map[string]string{
								"cache-control": "no-hit",
							},
						},
						Method: "POST",
					},
				},
			},
			ApiDomain{
				requests: []request{
					{
						name:   "healthcheck",
						body:   `{"some":"thing"}`,
						reqURL: healthcheckUrl,
						opts: &opts{
							headers: map[string]string{
								"cache-control": "no-hit",
							},
							timeout: &defaultTimeout,
						},
						method: "POST",
					},
				},
				defaults: &opts{timeout: &defaultTimeout},
			},
			0,
		},
	}

	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			got, err := validateAndMutateSpec(test.input)
			if err != nil {
				if test.expectErrs == 0 {
					t.Fatalf("expected success, got error(s) %s", err)
				} else if uw, ok := err.(interface{ Unwrap() []error }); ok {
					errs := uw.Unwrap()
					require.Equal(t, test.expectErrs, len(errs))
				} else {
					if test.expectErrs != 1 {
						t.Fatalf("expected multiple errors, got one: %s", err)
					}
				}
			} else {
				if test.expectErrs != 0 {
					t.Fatal("expected error(s), got success")
				}
			}

			if diff := cmp.Diff(test.want, got, cmp.AllowUnexported(ApiDomain{}, opts{}, request{})); diff != "" {
				t.Fatalf("wrong result(-got +want):\n%s\n", diff)
			}
		})
	}
}
