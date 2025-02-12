package api

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/defenseunicorns/lula/src/types"
)

type APIResponse struct {
	StatusCode int
	Status     string
	Raw        any
	Response   any
}

func (a ApiDomain) makeRequests(ctx context.Context) (types.DomainResources, error) {
	select {
	case <-ctx.Done():
		return nil, fmt.Errorf("canceled: %s", ctx.Err())
	default:
		collection := make(map[string]interface{}, 0)

		// configure the default HTTP client using any top-level Options. Individual
		// requests with overrides (in request.Options.Headers) will get bespoke clients.
		defaultClient := clientFromOpts(a.defaults)
		var errs error
		for _, request := range a.requests {
			var r io.Reader
			if request.body != "" {
				r = bytes.NewBufferString(request.body)
			}

			var headers map[string]string
			var client http.Client

			if request.opts == nil {
				headers = a.defaults.headers
				client = defaultClient
			} else {
				headers = request.opts.headers
				client = clientFromOpts(request.opts)
			}

			response, err := doHTTPReq(ctx, client, request.method, *request.reqURL, r, headers, request.reqParameters)
			if err != nil {
				errs = errors.Join(errs, err)
			}
			if response != nil {
				dr := types.DomainResources{
					"status":     response.Status,
					"statuscode": response.StatusCode,
					"raw":        response.Raw,
					"response":   response.Response,
				}
				collection[request.name] = dr
			} else {
				// If the entire response is empty, return a validly empty resource
				collection[request.name] = types.DomainResources{"status": 0}
			}
		}
		return collection, errs
	}
}
