package internal

import (
	"fmt"
	"os/exec"
	"strings"
)

type ServiceStatus string

const (
	ServiceActive   ServiceStatus = "active"
	ServiceInactive ServiceStatus = "inactive"
	ServiceFailed   ServiceStatus = "failed"
	ServiceUnknown  ServiceStatus = "unknown"
)

type ServiceInfo struct {
	Name        string        `json:"name"`
	LoadState   string        `json:"loadState"`
	ActiveState ServiceStatus `json:"activeState"`
	SubState    string        `json:"subState"`
	Description string        `json:"description"`
}

func GetServices() ([]ServiceInfo, error) {
	cmd := exec.Command("systemctl", "list-units",
		"--type=service", "--all", "--no-pager", "--no-legend", "--plain")
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("systemctl list-units: %w", err)
	}

	var services []ServiceInfo
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(strings.TrimLeft(line, "● "))
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 4 {
			continue
		}
		desc := ""
		if len(fields) > 4 {
			desc = strings.Join(fields[4:], " ")
		}
		services = append(services, ServiceInfo{
			Name:        strings.TrimSuffix(fields[0], ".service"),
			LoadState:   fields[1],
			ActiveState: ServiceStatus(fields[2]),
			SubState:    fields[3],
			Description: desc,
		})
	}
	return services, nil
}

func ServiceAction(serviceName, action string) error {
	fullName := serviceName
	if !strings.HasSuffix(fullName, ".service") {
		fullName += ".service"
	}
	switch action {
	case "start", "stop", "restart", "enable", "disable":
		cmd := exec.Command("pkexec", "systemctl", action, fullName)
		out, err := cmd.CombinedOutput()
		if err != nil {
			return fmt.Errorf("systemctl %s %s: %w\n%s", action, fullName, err, string(out))
		}
		return nil
	default:
		return fmt.Errorf("unknown action: %s", action)
	}
}
