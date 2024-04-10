package common

import (
	"crypto/md5"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/defenseunicorns/lula/src/pkg/message"
	goversion "github.com/hashicorp/go-version"
)

func ReadFileToBytes(path string) ([]byte, error) {
	var data []byte
	_, err := os.Stat(path)
	if os.IsNotExist(err) {
		return data, fmt.Errorf("Path: %v does not exist - unable to digest document", path)
	}
	data, err = os.ReadFile(path)
	if err != nil {
		return data, err
	}

	return data, nil
}

// Returns version validity
func IsVersionValid(versionConstraint string, version string) (bool, error) {
	if version == "unset" {
		// Default cli version is "unset", enabling users to run directly from source code
		// This is not a valid version, but we want to allow it for development purposes
		return true, nil
	}

	currentVersion, err := goversion.NewVersion(version)
	if err != nil {
		return false, err
	}
	constraints, err := goversion.NewConstraint(versionConstraint)
	if err != nil {
		return false, err
	}
	if constraints.Check(currentVersion) {
		return true, nil
	}
	return false, nil
}

// SwitchCwd takes a path and changes the current working directory to the directory of the path
// It returns a function to change the current working directory back to the original directory
func SwitchCwd(path string) (resetFunc func(), err error) {
	dir := filepath.Dir(path)
	// Save the current working directory
	originalDir, err := os.Getwd()
	if err != nil {
		return resetFunc, err
	}

	// Change the current working directory
	message.Infof("changing cwd to %s", dir)
	err = os.Chdir(dir)
	if err != nil {
		return resetFunc, err
	}

	resetFunc = func() {
		err = os.Chdir(originalDir)
		if err != nil {
			message.Warnf("unable to change cwd back to %s: %v", originalDir, err)
		}
	}

	// Change back to the original working directory when done
	return resetFunc, err
}

// ValidateChecksum validates a given checksum against a given []bytes.
// Supports MD5, SHA-1, SHA-256, and SHA-512.
// Returns an error if the hash does not match.
func ValidateChecksum(data []byte, expectedChecksum string) error {
	var actualChecksum string
	switch len(expectedChecksum) {
	case md5.Size * 2:
		hash := md5.Sum(data)
		actualChecksum = hex.EncodeToString(hash[:])
	case sha1.Size * 2:
		hash := sha1.Sum(data)
		actualChecksum = hex.EncodeToString(hash[:])
	case sha256.Size * 2:
		hash := sha256.Sum256(data)
		actualChecksum = hex.EncodeToString(hash[:])
	case sha512.Size * 2:
		hash := sha512.Sum512(data)
		actualChecksum = hex.EncodeToString(hash[:])
	default:
		return errors.New("unsupported checksum type")
	}

	if actualChecksum != expectedChecksum {
		return errors.New("checksum validation failed")
	}

	return nil
}
