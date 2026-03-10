package internal

import (
	"fmt"
	"os/exec"
	"sort"
	"strings"

	"github.com/shirou/gopsutil/v3/process"
)

// ProcessInfo holds all relevant data for a single process.
type ProcessInfo struct {
	PID      int32   `json:"pid"`
	Name     string  `json:"name"`
	CPU      float64 `json:"cpu"`
	MemMB    float32 `json:"memMb"`
	Status   string  `json:"status"`
	Username string  `json:"username"`
	UID      uint32  `json:"uid"`
	IsSystem bool    `json:"isSystem"`
	CmdLine  string  `json:"cmdLine"`
}

// ProcessResult bundles user and system processes.
type ProcessResult struct {
	UserProcs []ProcessInfo `json:"userProcs"`
	SysProcs  []ProcessInfo `json:"sysProcs"`
}

// KillResult reports the outcome for a single PID.
type KillResult struct {
	PID     int32  `json:"pid"`
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

// GetProcesses fetches all running processes and splits them into two groups.
func GetProcesses() (*ProcessResult, error) {
	procs, err := process.Processes()
	if err != nil {
		return nil, err
	}

	var userProcs, sysProcs []ProcessInfo

	for _, p := range procs {
		name, _ := p.Name()
		if name == "" {
			name = fmt.Sprintf("<pid%d>", p.Pid)
		}

		cpuPct, _ := p.CPUPercent()
		memInfo, _ := p.MemoryInfo()
		statusSlice, _ := p.Status()
		username, _ := p.Username()
		uids, _ := p.Uids()
		cmdline, _ := p.Cmdline()

		status := "S"
		if len(statusSlice) > 0 {
			status = statusSlice[0]
		}

		var memMB float32
		if memInfo != nil {
			memMB = float32(memInfo.RSS) / 1024.0 / 1024.0
		}

		var uid uint32
		isSystem := true
		if len(uids) > 0 {
			uid = uint32(uids[0])
			if uid >= 1000 {
				isSystem = false
			}
		}

		if len(cmdline) > 120 {
			cmdline = cmdline[:120] + "…"
		}

		info := ProcessInfo{
			PID:      p.Pid,
			Name:     name,
			CPU:      cpuPct,
			MemMB:    memMB,
			Status:   strings.ToUpper(status),
			Username: username,
			UID:      uid,
			IsSystem: isSystem,
			CmdLine:  cmdline,
		}

		if isSystem {
			sysProcs = append(sysProcs, info)
		} else {
			userProcs = append(userProcs, info)
		}
	}

	byName := func(procs []ProcessInfo) {
		sort.Slice(procs, func(i, j int) bool {
			return strings.ToLower(procs[i].Name) < strings.ToLower(procs[j].Name)
		})
	}
	byName(userProcs)
	byName(sysProcs)

	return &ProcessResult{UserProcs: userProcs, SysProcs: sysProcs}, nil
}

// KillProcesses terminates processes. System PIDs are killed via pkexec.
func KillProcesses(pids []int32, force bool) []KillResult {
	results := make([]KillResult, 0, len(pids))
	for _, pid := range pids {
		r := KillResult{PID: pid}
		sig := "-15"
		if force {
			sig = "-9"
		}
		// Try direct first, then escalate to pkexec for system processes
		out, err := exec.Command("kill", sig, fmt.Sprintf("%d", pid)).CombinedOutput()
		if err != nil {
			// Escalate
			out2, err2 := exec.Command("pkexec", "kill", sig, fmt.Sprintf("%d", pid)).CombinedOutput()
			if err2 != nil {
				r.Error = fmt.Sprintf("%s (pkexec: %s)", string(out), string(out2))
			} else {
				r.Success = true
				_ = out2
			}
		} else {
			r.Success = true
			_ = out
		}
		results = append(results, r)
	}
	return results
}
