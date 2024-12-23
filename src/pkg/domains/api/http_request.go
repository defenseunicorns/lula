package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/defenseunicorns/lula/src/pkg/message"
)

func doHTTPReq(ctx context.Context, client http.Client, method string, url url.URL, body io.Reader, headers map[string]string, queryParameters url.Values) (*APIResponse, error) {
	// append any query parameters
	q := url.Query()
	for k, v := range queryParameters {
		// using Add instead of set in case the input URL already had a query encoded
		q.Add(k, strings.Join(v, ","))
	}
	// set the query to the encoded parameters
	url.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, method, url.String(), body)
	if err != nil {
		return nil, err
	}
	// add each header to the request
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	// log the request
	message.Debug("%q %s", method, req.URL.Redacted())

	// do the thing
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	if res == nil {
		return nil, fmt.Errorf("error: calling %s returned empty response", url.Redacted())
	}
	defer res.Body.Close()

	responseData, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}

	var respObj APIResponse
	respObj.Raw = responseData
	respObj.Status = res.StatusCode
	err = json.Unmarshal(responseData, &respObj.Response)
	return &respObj, err
}

func clientFromOpts(opts *ApiOpts) http.Client {
	transport := &http.Transport{}
	if opts.proxyURL != nil {
		transport.Proxy = http.ProxyURL(opts.proxyURL)
	}
	c := http.Client{Transport: transport}
	if opts.timeout != nil {
		c.Timeout = *opts.timeout
	}
	return c
}
