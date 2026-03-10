package internal

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

type GovernorMode string

const (
	GovernorPerformance GovernorMode = "performance"
	GovernorPowersave   GovernorMode = "powersave"
	GovernorSchedulutil GovernorMode = "schedutil"
	GovernorUnknown     GovernorMode = "unknown"
)

type GameModeStatus struct {
	Installed bool   `json:"installed"`
	Running   bool   `json:"running"`
	Version   string `json:"version"`
}

func CheckGameMode() GameModeStatus {
	s := GameModeStatus{}
	if _, err := exec.LookPath("gamemode-cli"); err != nil {
		if _, err2 := exec.LookPath("gamemoded"); err2 != nil {
			return s
		}
	}
	s.Installed = true
	out, err := exec.Command("gamemode-cli", "--status").Output()
	if err == nil {
		output := strings.ToLower(string(out))
		s.Running = strings.Contains(output, "active") || strings.Contains(output, "running")
	}
	ver, err := exec.Command("gamemode-cli", "--version").Output()
	if err == nil {
		s.Version = strings.TrimSpace(string(ver))
	}
	return s
}

func ApplyGameModeToProcess(pid int32) error {
	cmd := exec.Command("gamemode-cli", "-r", fmt.Sprintf("%d", pid))
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("gamemode-cli -r %d: %w (output: %s)", pid, err, string(out))
	}
	return nil
}

func GetCPUGovernor() GovernorMode {
	data, err := os.ReadFile("/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor")
	if err != nil {
		return GovernorUnknown
	}
	return GovernorMode(strings.TrimSpace(string(data)))
}

func SetCPUGovernor(mode GovernorMode) error {
	cmd := exec.Command("pkexec", "cpupower", "frequency-set", "-g", string(mode))
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("cpupower failed: %w — %s", err, string(out))
	}
	return nil
}

func IsPerformanceModeActive() bool {
	return GetCPUGovernor() == GovernorPerformance
}
