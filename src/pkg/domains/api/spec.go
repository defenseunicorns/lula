package api

import (
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"
)

var defaultTimeout = 30 * time.Second

const (
	HTTPMethodGet  string = "GET"
	HTTPMethodPost string = "POST"
)

// validateAndMutateSpec validates the spec values and applies any defaults or
// other mutations or normalizations necessary. The original values are not modified.
// validateAndMutateSpec will validate the entire object and may return multiple
// errors.
func validateAndMutateSpec(spec *ApiSpec) (api ApiDomain, errs error) {
	if spec == nil {
		return api, errors.New("spec is required")
	}
	if len(spec.Requests) == 0 {
		errs = errors.Join(errs, errors.New("some requests must be specified"))
	}

	defaults, err := validateAndMutateOptions(spec.Options)
	if err != nil {
		errs = errors.Join(errs, err)
	}
	api.defaults = defaults

	reqs := make([]request, len(spec.Requests))
	for i := range spec.Requests {
		if spec.Requests[i].Name == "" {
			errs = errors.Join(errs, errors.New("request name cannot be empty"))
		} else {
			reqs[i].name = spec.Requests[i].Name
		}

		if spec.Requests[i].URL == "" {
			errs = errors.Join(errs, errors.New("request url cannot be empty"))
		}
		reqUrl, err := url.Parse(spec.Requests[i].URL)
		if err != nil {
			errs = errors.Join(errs, errors.New("invalid request url"))
		} else {
			reqs[i].reqURL = reqUrl
		}

		if spec.Requests[i].Params != nil {
			queryParameters := url.Values{}
			for k, v := range spec.Requests[i].Params {
				queryParameters.Add(k, v)
			}
			reqs[i].reqParameters = queryParameters
		}

		reqs[i].body = spec.Requests[i].Body

		if spec.Requests[i].Options != nil {
			opts, err := validateAndMutateOptions(spec.Requests[i].Options)
			if err != nil {
				errs = errors.Join(errs, err)
			}
			reqs[i].opts = opts
		}

		switch m := spec.Requests[i].Method; strings.ToLower(m) {
		case "post":
			reqs[i].method = HTTPMethodPost
		case "get", "":
			fallthrough
		default:
			reqs[i].method = HTTPMethodGet
		}

		if !api.executable { // we only need to set this once
			if spec.Requests[i].Executable {
				api.executable = true
			}
		}
	}
	if len(reqs) > 0 {
		api.requests = reqs
	}
	return api, errs
}

func validateAndMutateOptions(apiOpts *ApiOpts) (*opts, error) {
	if apiOpts == nil {
		return &opts{timeout: &defaultTimeout}, nil
	}
	options := &opts{}
	var errs error

	if apiOpts.Timeout != "" {
		duration, err := time.ParseDuration(apiOpts.Timeout)
		if err != nil {
			errs = errors.Join(errs, fmt.Errorf("invalid wait timeout string: %s", apiOpts.Timeout))
		}
		options.timeout = &duration
	}

	if options.timeout == nil {
		options.timeout = &defaultTimeout
	}

	if apiOpts.Proxy != "" {
		proxyURL, err := url.Parse(apiOpts.Proxy)
		if err != nil {
			errs = errors.Join(errs, fmt.Errorf("invalid proxy string %s", proxyURL.Redacted()))
		}
		options.proxyURL = proxyURL
	}

	if apiOpts.Headers != nil {
		options.headers = apiOpts.Headers
	}

	return options, errs
}
