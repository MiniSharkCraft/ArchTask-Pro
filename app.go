package main

import (
	"context"
	"time"

	"github.com/user/archtask-pro/internal"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App is the Wails application struct. All exported methods are bound to JS.
type App struct {
	ctx    context.Context
	stopCh chan struct{}
}

// NewApp creates a new App instance.
func NewApp() *App {
	return &App{
		stopCh: make(chan struct{}),
	}
}

// startup is called by the Wails runtime when the app starts.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	// Start real-time metrics streaming at 500ms
	go a.streamMetrics()
}

// shutdown is called when the app is about to quit.
func (a *App) shutdown(ctx context.Context) {
	close(a.stopCh)
}

// streamMetrics emits hardware metrics to the frontend every 500ms.
func (a *App) streamMetrics() {
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-a.stopCh:
			return
		case <-ticker.C:
			metrics, err := internal.CollectMetrics()
			if err == nil {
				runtime.EventsEmit(a.ctx, "metrics:update", metrics)
			}
		}
	}
}

// ══════════════════════════════════════════════════════════════════════════════
//  PROCESSES
// ══════════════════════════════════════════════════════════════════════════════

// GetProcesses returns all running processes grouped into user and system.
func (a *App) GetProcesses() (*internal.ProcessResult, error) {
	return internal.GetProcesses()
}

// KillProcesses sends SIGTERM to the given PIDs. Uses pkexec for system PIDs.
func (a *App) KillProcesses(pids []int32, force bool) []internal.KillResult {
	return internal.KillProcesses(pids, force)
}

// ══════════════════════════════════════════════════════════════════════════════
//  STARTUP APPS
// ══════════════════════════════════════════════════════════════════════════════

// GetStartupApps scans ~/.config/autostart/ and /etc/xdg/autostart/ for .desktop files.
func (a *App) GetStartupApps() ([]internal.StartupApp, error) {
	return internal.GetStartupApps()
}

// ToggleStartupApp enables or disables a startup application by name.
// Disabling adds Hidden=true to the user-level .desktop file.
// Enabling removes that flag (or the override file entirely).
func (a *App) ToggleStartupApp(filePath string, enable bool) error {
	return internal.ToggleStartupApp(filePath, enable)
}

// ══════════════════════════════════════════════════════════════════════════════
//  SERVICES
// ══════════════════════════════════════════════════════════════════════════════

// GetServices returns all systemd service units.
func (a *App) GetServices() ([]internal.ServiceInfo, error) {
	return internal.GetServices()
}

// ServiceAction performs start/stop/restart/enable/disable on a service.
func (a *App) ServiceAction(serviceName, action string) error {
	return internal.ServiceAction(serviceName, action)
}

// ══════════════════════════════════════════════════════════════════════════════
//  GAMEMODE & CPU GOVERNOR
// ══════════════════════════════════════════════════════════════════════════════

// GetGameModeStatus checks if gamemoded is installed and running.
func (a *App) GetGameModeStatus() internal.GameModeStatus {
	return internal.CheckGameMode()
}

// GetCPUGovernor returns the current CPU frequency scaling governor.
func (a *App) GetCPUGovernor() string {
	return string(internal.GetCPUGovernor())
}

// SetCPUGovernor switches the governor for all cores via pkexec + cpupower.
func (a *App) SetCPUGovernor(mode string) error {
	return internal.SetCPUGovernor(internal.GovernorMode(mode))
}

// ApplyGameModeToProcess applies GameMode to a given PID.
func (a *App) ApplyGameModeToProcess(pid int32) error {
	return internal.ApplyGameModeToProcess(pid)
}
