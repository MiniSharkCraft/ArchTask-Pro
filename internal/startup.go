package internal

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// StartupApp represents an autostart .desktop entry.
type StartupApp struct {
	Name        string `json:"name"`
	Command     string `json:"command"`
	Comment     string `json:"comment"`
	Icon        string `json:"icon"`
	Enabled     bool   `json:"enabled"`
	FilePath    string `json:"filePath"`    // actual file on disk
	UserPath    string `json:"userPath"`    // override path in ~/.config/autostart/
	Source      string `json:"source"`      // "user" | "system"
	IsUserLevel bool   `json:"isUserLevel"` // true = lives in user autostart dir
}

// GetStartupApps scans both autostart directories and merges the results.
// User-level entries override system-level entries with the same filename.
func GetStartupApps() ([]StartupApp, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("cannot determine home dir: %w", err)
	}

	userDir := filepath.Join(homeDir, ".config", "autostart")
	sysDir := "/etc/xdg/autostart"

	// Map filename → StartupApp (user entries override system ones)
	appMap := make(map[string]*StartupApp)

	// ── 1. Load system-level entries first ───────────────────────────────────
	if entries, err := os.ReadDir(sysDir); err == nil {
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".desktop") {
				continue
			}
			fp := filepath.Join(sysDir, e.Name())
			app, err := parseDesktopFile(fp, "system", false)
			if err != nil {
				continue
			}
			// Set the user-level override path regardless (needed for toggle)
			app.UserPath = filepath.Join(userDir, e.Name())
			appMap[e.Name()] = app
		}
	}

	// ── 2. Load (and override) user-level entries ─────────────────────────────
	if err := os.MkdirAll(userDir, 0o755); err == nil {
		if entries, err2 := os.ReadDir(userDir); err2 == nil {
			for _, e := range entries {
				if e.IsDir() || !strings.HasSuffix(e.Name(), ".desktop") {
					continue
				}
				fp := filepath.Join(userDir, e.Name())
				app, err := parseDesktopFile(fp, "user", true)
				if err != nil {
					continue
				}
				app.UserPath = fp
				appMap[e.Name()] = app
			}
		}
	}

	// ── 3. Check if any system entry is overridden as Hidden in user dir ──────
	// (GNOME Tweaks pattern: copy with Hidden=true to user dir to "disable")
	if entries, err := os.ReadDir(userDir); err == nil {
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".desktop") {
				continue
			}
			fp := filepath.Join(userDir, e.Name())
			fields := parseDesktopFields(fp)
			// If the user override is purely a "Hidden=true" disabler
			if isHiddenOnly(fields) {
				if existing, ok := appMap[e.Name()]; ok && existing.Source == "system" {
					existing.Enabled = false
					existing.UserPath = fp
				}
			}
		}
	}

	// ── 4. Flatten map → slice ────────────────────────────────────────────────
	result := make([]StartupApp, 0, len(appMap))
	for _, app := range appMap {
		if app.Name == "" {
			continue
		}
		result = append(result, *app)
	}

	// Sort: enabled first, then A-Z
	stableSort(result)
	return result, nil
}

// ToggleStartupApp enables or disables a startup entry.
//
// Strategy:
//   - User-level entry: directly add/remove Hidden=true in the file.
//   - System-level entry:
//     disable → create ~/.config/autostart/<name>.desktop with Hidden=true
//     enable  → remove the user-level override (restoring system default)
func ToggleStartupApp(filePath string, enable bool) error {
	homeDir, _ := os.UserHomeDir()
	userDir := filepath.Join(homeDir, ".config", "autostart")

	base := filepath.Base(filePath)
	userOverridePath := filepath.Join(userDir, base)

	isUserFile := strings.HasPrefix(filePath, userDir)

	if enable {
		if isUserFile {
			// Remove Hidden=true from the user file
			return removeHiddenFlag(filePath)
		}
		// System entry: remove the override file if it only disables
		if fileExists(userOverridePath) {
			fields := parseDesktopFields(userOverridePath)
			if isHiddenOnly(fields) {
				return os.Remove(userOverridePath)
			}
			// If it's a real user override, just remove Hidden from it
			return removeHiddenFlag(userOverridePath)
		}
		return nil // already enabled (no override exists)

	} else {
		// Disable
		if isUserFile {
			return addHiddenFlag(filePath)
		}
		// System entry: create override in user dir
		if err := os.MkdirAll(userDir, 0o755); err != nil {
			return fmt.Errorf("cannot create autostart dir: %w", err)
		}
		if fileExists(userOverridePath) {
			// Override already exists — just add Hidden=true to it
			return addHiddenFlag(userOverridePath)
		}
		// Create a minimal override file
		content := "[Desktop Entry]\nType=Application\nHidden=true\n"
		return os.WriteFile(userOverridePath, []byte(content), 0o644)
	}
}

// ══════════════════════════════════════════════════════════════════════════════
//  Helpers
// ══════════════════════════════════════════════════════════════════════════════

func parseDesktopFile(fp, source string, isUser bool) (*StartupApp, error) {
	fields := parseDesktopFields(fp)
	if len(fields) == 0 {
		return nil, fmt.Errorf("empty or unreadable: %s", fp)
	}

	// An app is disabled if Hidden=true OR NoDisplay=true
	hidden := strings.EqualFold(fields["Hidden"], "true")
	noDisplay := strings.EqualFold(fields["NoDisplay"], "true")
	enabled := !hidden && !noDisplay

	// OnlyShowIn / NotShowIn filtering (informational only — we still show it)
	app := &StartupApp{
		Name:        fields["Name"],
		Command:     fields["Exec"],
		Comment:     fields["Comment"],
		Icon:        fields["Icon"],
		Enabled:     enabled,
		FilePath:    fp,
		Source:      source,
		IsUserLevel: isUser,
	}
	return app, nil
}

// parseDesktopFields reads a .desktop file and returns key=value pairs
// from the [Desktop Entry] section.
func parseDesktopFields(fp string) map[string]string {
	f, err := os.Open(fp)
	if err != nil {
		return nil
	}
	defer f.Close()

	fields := make(map[string]string)
	inEntry := false
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasPrefix(line, "[") {
			inEntry = line == "[Desktop Entry]"
			continue
		}
		if !inEntry {
			continue
		}
		if idx := strings.IndexByte(line, '='); idx > 0 {
			key := strings.TrimSpace(line[:idx])
			val := strings.TrimSpace(line[idx+1:])
			// Use non-localized keys (ignore Name[xx]=…)
			if !strings.ContainsAny(key, "[]") {
				fields[key] = val
			}
		}
	}
	return fields
}

// isHiddenOnly returns true if the .desktop file only exists to disable an entry.
func isHiddenOnly(fields map[string]string) bool {
	if len(fields) == 0 {
		return false
	}
	h := strings.EqualFold(fields["Hidden"], "true")
	n := strings.EqualFold(fields["NoDisplay"], "true")
	// It's a "disabler" if Hidden/NoDisplay is set and there's no Exec
	return (h || n) && fields["Exec"] == ""
}

// addHiddenFlag adds Hidden=true to a .desktop file, creating or updating.
func addHiddenFlag(fp string) error {
	lines, err := readLines(fp)
	if err != nil {
		return err
	}
	// Check if Hidden already present
	for i, l := range lines {
		if strings.HasPrefix(strings.TrimSpace(l), "Hidden=") {
			lines[i] = "Hidden=true"
			return writeLines(fp, lines)
		}
	}
	// Append after [Desktop Entry] header
	for i, l := range lines {
		if strings.TrimSpace(l) == "[Desktop Entry]" {
			newLines := make([]string, 0, len(lines)+1)
			newLines = append(newLines, lines[:i+1]...)
			newLines = append(newLines, "Hidden=true")
			newLines = append(newLines, lines[i+1:]...)
			return writeLines(fp, newLines)
		}
	}
	// Fallback: append at end
	lines = append(lines, "Hidden=true")
	return writeLines(fp, lines)
}

// removeHiddenFlag removes Hidden=true/NoDisplay=true lines from a .desktop file.
func removeHiddenFlag(fp string) error {
	lines, err := readLines(fp)
	if err != nil {
		return err
	}
	filtered := lines[:0]
	for _, l := range lines {
		trimmed := strings.TrimSpace(l)
		if strings.HasPrefix(trimmed, "Hidden=") || strings.HasPrefix(trimmed, "NoDisplay=") {
			continue
		}
		filtered = append(filtered, l)
	}
	return writeLines(fp, filtered)
}

func readLines(fp string) ([]string, error) {
	data, err := os.ReadFile(fp)
	if err != nil {
		return nil, err
	}
	return strings.Split(string(data), "\n"), nil
}

func writeLines(fp string, lines []string) error {
	return os.WriteFile(fp, []byte(strings.Join(lines, "\n")), 0o644)
}

func fileExists(fp string) bool {
	_, err := os.Stat(fp)
	return err == nil
}

func stableSort(apps []StartupApp) {
	n := len(apps)
	for i := 0; i < n; i++ {
		for j := i + 1; j < n; j++ {
			// Enabled first, then A-Z by name
			iKey := sortKey(apps[i])
			jKey := sortKey(apps[j])
			if iKey > jKey {
				apps[i], apps[j] = apps[j], apps[i]
			}
		}
	}
}

func sortKey(a StartupApp) string {
	prefix := "b"
	if a.Enabled {
		prefix = "a"
	}
	return prefix + strings.ToLower(a.Name)
}
