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
		input, want *ApiOpts
		expectErrs  int
	}{
		"error: nil input": {
			nil,
			nil,
			1,
		},
		"empty input, defaults are populated": {
			&ApiOpts{},
			&ApiOpts{
				timeout: &defaultTimeout,
			},
			0,
		},
		"valid input, internal fields populated": {
			&ApiOpts{
				Timeout: "10s",
				Proxy:   "https://my.proxy",
			},
			&ApiOpts{
				Timeout: "10s",
				Proxy:   "https://my.proxy",
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
			&ApiOpts{
				Proxy:   "close//butinvalid\n\r",
				Timeout: "more nonsense",
				timeout: &zeroTimeout, // there was an error, so this is set to zero value
			},
			2,
		},
	}

	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			err := validateAndMutateOptions(test.input)
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

			if diff := cmp.Diff(test.want, test.input, cmp.AllowUnexported(ApiOpts{})); diff != "" {
				t.Fatalf("wrong result(-got +want):\n%s\n", diff)
			}
		})
	}
}

func TestValidateAndMutateSpec(t *testing.T) {
	tests := map[string]struct {
		input, want *ApiSpec
		expectErrs  int
	}{
		"error: nil input": {
			nil, nil, 1,
		},
		"error: empty input, nil options": {
			&ApiSpec{},
			&ApiSpec{
				Options: &ApiOpts{timeout: &defaultTimeout},
			},
			1,
		},
	}

	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			err := validateAndMutateSpec(test.input)
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

			if diff := cmp.Diff(test.want, test.input, cmp.AllowUnexported(ApiSpec{}, ApiOpts{})); diff != "" {
				t.Fatalf("wrong result(-got +want):\n%s\n", diff)
			}
		})
	}
}
