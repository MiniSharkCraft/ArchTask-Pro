package internal

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/mem"
	psnet "github.com/shirou/gopsutil/v3/net"
)

// HardwareMetrics is the full metrics snapshot streamed to the frontend.
type HardwareMetrics struct {
	Timestamp int64       `json:"timestamp"`
	CPU       CPUMetrics  `json:"cpu"`
	RAM       RAMMetrics  `json:"ram"`
	Swap      SwapMetrics `json:"swap"`
	Zram      ZramMetrics `json:"zram"`
	GPUs      []GPUMetrics `json:"gpus"` // supports multiple GPUs (dGPU + iGPU)
	Network   NetMetrics  `json:"network"`
}

type CPUMetrics struct {
	TotalPct float64   `json:"totalPct"`
	PerCore  []float64 `json:"perCore"`
	Governor string    `json:"governor"`
}

type RAMMetrics struct {
	TotalMB float64 `json:"totalMb"`
	UsedMB  float64 `json:"usedMb"`
	Pct     float64 `json:"pct"`
}

type SwapMetrics struct {
	TotalMB float64 `json:"totalMb"`
	UsedMB  float64 `json:"usedMb"`
	Pct     float64 `json:"pct"`
}

type ZramMetrics struct {
	Available    bool    `json:"available"`
	OriginalMB   float64 `json:"originalMb"`
	CompressedMB float64 `json:"compressedMb"`
	Ratio        float64 `json:"ratio"`
	Savings      float64 `json:"savings"`
}

// GPUType identifies the GPU vendor/driver
type GPUType string

const (
	GPUTypeNvidia  GPUType = "nvidia"
	GPUTypeAMDDGPU GPUType = "amd_dgpu"   // discrete AMD (rocm-smi)
	GPUTypeIntel   GPUType = "intel_igpu"  // Intel i915 / xe
	GPUTypeAMDAPU  GPUType = "amd_igpu"    // AMD Radeon Vega / RDNA iGPU
	GPUTypeGeneric GPUType = "generic"     // any other DRM device
)

type GPUMetrics struct {
	Available   bool    `json:"available"`
	Type        GPUType `json:"type"`
	Name        string  `json:"name"`
	IsIGPU      bool    `json:"isIgpu"`   // true = integrated
	UsagePct    float64 `json:"usagePct"`
	VRAMUsedMB  int64   `json:"vramUsedMb"`
	VRAMTotalMB int64   `json:"vramTotalMb"`
	VRAMPct     float64 `json:"vramPct"`
	Temp        float64 `json:"temp"`
	// iGPU-specific: shared system RAM used as VRAM
	SharedMemMB int64   `json:"sharedMemMb"`
	FreqMHz     int64   `json:"freqMhz"`     // current clock
	MaxFreqMHz  int64   `json:"maxFreqMhz"`  // max clock
	PowerW      float64 `json:"powerW"`      // power draw (watts)
	Driver      string  `json:"driver"`
}

type NetMetrics struct {
	SendRateMBs float64 `json:"sendRateMbs"`
	RecvRateMBs float64 `json:"recvRateMbs"`
	TotalSentMB float64 `json:"totalSentMb"`
	TotalRecvMB float64 `json:"totalRecvMb"`
}

var (
	prevNetSent uint64
	prevNetRecv uint64
	prevNetTime time.Time
)

// CollectMetrics gathers a full metrics snapshot.
func CollectMetrics() (*HardwareMetrics, error) {
	m := &HardwareMetrics{
		Timestamp: time.Now().UnixMilli(),
	}

	// CPU
	perCore, _ := cpu.Percent(0, true)
	total, _ := cpu.Percent(0, false)
	m.CPU.PerCore = perCore
	if len(total) > 0 {
		m.CPU.TotalPct = total[0]
	}
	m.CPU.Governor = string(GetCPUGovernor())

	// RAM
	vmStat, err := mem.VirtualMemory()
	if err == nil {
		m.RAM.TotalMB = float64(vmStat.Total) / 1024 / 1024
		m.RAM.UsedMB = float64(vmStat.Used) / 1024 / 1024
		m.RAM.Pct = vmStat.UsedPercent
	}

	// Swap
	swapStat, err := mem.SwapMemory()
	if err == nil {
		m.Swap.TotalMB = float64(swapStat.Total) / 1024 / 1024
		m.Swap.UsedMB = float64(swapStat.Used) / 1024 / 1024
		m.Swap.Pct = swapStat.UsedPercent
	}

	// Zram
	m.Zram = collectZram()

	// GPUs — detect all GPUs (dGPU + iGPU)
	m.GPUs = collectAllGPUs()

	// Network
	m.Network = collectNetwork()

	return m, nil
}

// ══════════════════════════════════════════════════════════════════════════════
//  GPU Detection — tries every known source in priority order
// ══════════════════════════════════════════════════════════════════════════════

func collectAllGPUs() []GPUMetrics {
	var gpus []GPUMetrics

	// 1. NVIDIA discrete GPU (nvidia-smi — most reliable)
	if ng := collectNvidia(); ng != nil {
		gpus = append(gpus, *ng)
	}

	// 2. AMD discrete GPU (rocm-smi)
	if ag := collectAMDDiscrete(); ag != nil {
		gpus = append(gpus, *ag)
	}

	// 3. Scan /sys/class/drm/ for integrated GPUs (Intel i915/xe, AMD APU)
	iGPUs := collectDRMGPUs()
	gpus = append(gpus, iGPUs...)

	// De-duplicate: if a device was already found via nvidia-smi/rocm-smi,
	// skip it from DRM scan (match by name fragment)
	gpus = deduplicateGPUs(gpus)

	if len(gpus) == 0 {
		gpus = append(gpus, GPUMetrics{
			Available: false,
			Name:      "No GPU detected",
			Type:      GPUTypeGeneric,
		})
	}

	return gpus
}

// ── NVIDIA (discrete) ────────────────────────────────────────────────────────

func collectNvidia() *GPUMetrics {
	out, err := exec.Command("nvidia-smi",
		"--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw",
		"--format=csv,noheader,nounits").Output()
	if err != nil {
		return nil
	}
	parts := strings.Split(strings.TrimSpace(string(out)), ", ")
	if len(parts) < 4 {
		return nil
	}
	usagePct, _  := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
	vramUsed, _  := strconv.ParseInt(strings.TrimSpace(parts[2]), 10, 64)
	vramTotal, _ := strconv.ParseInt(strings.TrimSpace(parts[3]), 10, 64)
	temp := 0.0
	if len(parts) >= 5 {
		temp, _ = strconv.ParseFloat(strings.TrimSpace(parts[4]), 64)
	}
	power := 0.0
	if len(parts) >= 6 {
		power, _ = strconv.ParseFloat(strings.TrimSpace(parts[5]), 64)
	}
	vramPct := 0.0
	if vramTotal > 0 {
		vramPct = float64(vramUsed) / float64(vramTotal) * 100
	}
	return &GPUMetrics{
		Available:   true,
		Type:        GPUTypeNvidia,
		Name:        strings.TrimSpace(parts[0]),
		IsIGPU:      false,
		UsagePct:    usagePct,
		VRAMUsedMB:  vramUsed,
		VRAMTotalMB: vramTotal,
		VRAMPct:     vramPct,
		Temp:        temp,
		PowerW:      power,
		Driver:      "nvidia",
	}
}

// ── AMD discrete (rocm-smi) ───────────────────────────────────────────────────

func collectAMDDiscrete() *GPUMetrics {
	out, err := exec.Command("rocm-smi",
		"--showuse", "--showmemuse", "--showtemp", "--showpower", "--csv").Output()
	if err != nil {
		return nil
	}
	lines := strings.Split(string(out), "\n")
	for _, line := range lines[1:] {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.Split(line, ",")
		if len(parts) < 2 {
			continue
		}
		usagePct, _ := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
		temp := 0.0
		if len(parts) >= 4 {
			temp, _ = strconv.ParseFloat(strings.TrimSpace(parts[3]), 64)
		}
		return &GPUMetrics{
			Available: true,
			Type:      GPUTypeAMDDGPU,
			Name:      "AMD Radeon (discrete)",
			IsIGPU:    false,
			UsagePct:  usagePct,
			Temp:      temp,
			Driver:    "amdgpu",
		}
	}
	return nil
}

// ── DRM sysfs scan — catches Intel iGPU, AMD APU, any other GPU ──────────────
//
// Paths used:
//   /sys/class/drm/card*/device/
//     ├── vendor            (0x8086=Intel, 0x1002=AMD, 0x10de=NVIDIA)
//     ├── driver/module/    (symlink → driver name)
//     ├── gt_cur_freq_mhz   (Intel i915 current frequency)
//     ├── gt_max_freq_mhz   (Intel i915 max frequency)
//     ├── mem_info_vram_used (AMD amdgpu VRAM used, bytes)
//     ├── mem_info_vram_total(AMD amdgpu VRAM total, bytes)
//     └── hwmon/hwmon*/
//           ├── temp1_input  (temperature in millidegrees)
//           └── power1_average (power in microwatts)
//
//   Intel GPU engine utilisation (requires i915 perf or intel_gpu_top):
//   /sys/class/drm/card*/gt/gt0/rc6_residency_ms  — inverse of busy time
//   /sys/kernel/debug/dri/*/i915_frequency_info    — freq info (needs root)
//
//   We use the safest no-root approach: read sysfs files that are
//   world-readable, fall back gracefully when not available.

func collectDRMGPUs() []GPUMetrics {
	cards, err := filepath.Glob("/sys/class/drm/card[0-9]*")
	if err != nil || len(cards) == 0 {
		return nil
	}

	seen := make(map[string]bool)
	var result []GPUMetrics

	for _, card := range cards {
		// Skip render nodes (renderD128 etc.)
		base := filepath.Base(card)
		if strings.Contains(base, "render") {
			continue
		}

		devPath := filepath.Join(card, "device")

		vendor := readSysStr(filepath.Join(devPath, "vendor"))
		driver := resolveDriverName(devPath)

		// Skip NVIDIA cards here (handled by nvidia-smi)
		if strings.Contains(strings.ToLower(driver), "nvidia") {
			continue
		}

		// Unique key to avoid duplication from symlinks
		realCard, _ := filepath.EvalSymlinks(card)
		if seen[realCard] {
			continue
		}
		seen[realCard] = true

		g := GPUMetrics{
			Available: true,
			Driver:    driver,
		}

		switch vendor {
		case "0x8086": // Intel
			g.Type   = GPUTypeIntel
			g.IsIGPU = true
			g.Name   = detectIntelGPUName()
			collectIntelMetrics(devPath, &g)

		case "0x1002": // AMD
			// Discrete AMD should be caught by rocm-smi already,
			// but APUs (iGPU) won't be. Detect by checking if VRAM is shared.
			g.Type = GPUTypeAMDAPU
			g.Name = detectAMDGPUName(devPath)
			collectAMDSysfsMetrics(devPath, &g)
			// Determine if iGPU: APU VRAM total is usually small (≤ 512 MB)
			// or reports 0 dedicated VRAM
			if g.VRAMTotalMB <= 512 {
				g.IsIGPU = true
			}

		default:
			g.Type   = GPUTypeGeneric
			g.Name   = fmt.Sprintf("GPU (%s, %s)", vendor, driver)
			g.IsIGPU = false
		}

		result = append(result, g)
	}

	return result
}

// ── Intel iGPU via i915/xe sysfs ─────────────────────────────────────────────

func collectIntelMetrics(devPath string, g *GPUMetrics) {
	cardDir := filepath.Dir(devPath) // /sys/class/drm/cardN

	// ── Frequency ────────────────────────────────────────────────────────────
	// i915 exposes these directly under the card device dir
	if freq := readSysInt(filepath.Join(cardDir, "gt_cur_freq_mhz")); freq > 0 {
		g.FreqMHz = freq
	}
	if freq := readSysInt(filepath.Join(cardDir, "gt_max_freq_mhz")); freq > 0 {
		g.MaxFreqMHz = freq
	}
	// xe driver uses a different path
	if g.FreqMHz == 0 {
		// Try gt/gt0/
		if freq := readSysInt(filepath.Join(cardDir, "gt", "gt0", "freq0", "cur_freq")); freq > 0 {
			g.FreqMHz = freq
		}
	}

	// ── GPU Usage via RC6 residency (no root needed) ──────────────────────
	// RC6 = power saving state. busyPct ≈ 100 - rc6Pct
	g.UsagePct = readIntelRC6Usage(cardDir)

	// ── VRAM — Intel iGPU uses shared system RAM, no dedicated VRAM ────────
	// We can read GTT (graphics translation table) size as approximate VRAM
	gttUsed  := readSysInt(filepath.Join(devPath, "gtt_size"))
	if gttUsed > 0 {
		g.SharedMemMB = gttUsed / 1024 / 1024
	}

	// ── Temperature via hwmon ─────────────────────────────────────────────
	g.Temp  = readHwmonTemp(devPath)
	g.PowerW = readHwmonPower(devPath)
}

// readIntelRC6Usage estimates GPU busy % from RC6 residency counter.
// RC6 is the idle state — if RC6 residency is high, GPU is mostly idle.
var (
	lastRC6Ms   int64
	lastRC6Time time.Time
)

func readIntelRC6Usage(cardDir string) float64 {
	// Try multiple kernel paths for RC6
	paths := []string{
		filepath.Join(cardDir, "gt", "gt0", "rc6_residency_ms"),
		filepath.Join(cardDir, "power", "rc6_residency_ms"),
	}
	var rc6Ms int64
	for _, p := range paths {
		if v := readSysInt(p); v > 0 {
			rc6Ms = v
			break
		}
	}
	if rc6Ms == 0 {
		// Fallback: try intel_gpu_top (if installed, no root needed)
		return readIntelGPUTopUsage()
	}

	now := time.Now()
	if lastRC6Time.IsZero() {
		lastRC6Ms = rc6Ms
		lastRC6Time = now
		return 0
	}
	dtMs := now.Sub(lastRC6Time).Milliseconds()
	if dtMs <= 0 {
		return 0
	}
	rc6Delta := rc6Ms - lastRC6Ms
	lastRC6Ms = rc6Ms
	lastRC6Time = now

	// rc6Pct = fraction of time in idle state → busyPct = 1 - rc6Pct
	rc6Pct := float64(rc6Delta) / float64(dtMs) * 100
	busy := 100.0 - rc6Pct
	if busy < 0 {
		busy = 0
	}
	if busy > 100 {
		busy = 100
	}
	return busy
}

func readIntelGPUTopUsage() float64 {
	// intel_gpu_top -J -s 100 outputs JSON. Run briefly.
	out, err := exec.Command("intel_gpu_top", "-J", "-s", "200").Output()
	if err != nil {
		return 0
	}
	// Look for "render-3d" or "Video" busy percentage in JSON output
	// Quick parse without full JSON unmarshalling
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		if strings.Contains(line, `"busy"`) {
			// Format: "busy": 12.34
			parts := strings.Split(line, ":")
			if len(parts) >= 2 {
				val, err := strconv.ParseFloat(strings.TrimSpace(strings.Trim(parts[1], `", `)), 64)
				if err == nil && val >= 0 {
					return val
				}
			}
		}
	}
	return 0
}

// ── AMD APU / iGPU via amdgpu sysfs ─────────────────────────────────────────

func collectAMDSysfsMetrics(devPath string, g *GPUMetrics) {
	// GPU usage — amdgpu exports this
	if usage := readSysInt(filepath.Join(devPath, "gpu_busy_percent")); usage >= 0 {
		g.UsagePct = float64(usage)
	}

	// VRAM
	if total := readSysInt(filepath.Join(devPath, "mem_info_vram_total")); total > 0 {
		g.VRAMTotalMB = total / 1024 / 1024
	}
	if used := readSysInt(filepath.Join(devPath, "mem_info_vram_used")); used >= 0 {
		g.VRAMUsedMB = used / 1024 / 1024
	}
	if g.VRAMTotalMB > 0 {
		g.VRAMPct = float64(g.VRAMUsedMB) / float64(g.VRAMTotalMB) * 100
	}

	// Visible (shared) RAM for APU
	if vis := readSysInt(filepath.Join(devPath, "mem_info_vis_vram_total")); vis > 0 {
		g.SharedMemMB = vis / 1024 / 1024
	}

	// Current / max GPU clock
	if freq := readSysInt(filepath.Join(devPath, "pp_dpm_sclk")); freq > 0 {
		g.FreqMHz = freq
	}

	// Temperature + power via hwmon
	g.Temp   = readHwmonTemp(devPath)
	g.PowerW = readHwmonPower(devPath)
}

// ── GPU name detection ────────────────────────────────────────────────────────

func detectIntelGPUName() string {
	// Try lspci first
	out, err := exec.Command("sh", "-c",
		`lspci 2>/dev/null | grep -i "vga\|display\|3d" | grep -i intel | head -1`).Output()
	if err == nil && len(out) > 0 {
		line := strings.TrimSpace(string(out))
		// Extract after the "Intel" part
		if idx := strings.Index(line, "Intel"); idx >= 0 {
			name := strings.TrimSpace(line[idx:])
			// Trim the [8086:xxxx] PCI ID suffix
			if bIdx := strings.LastIndex(name, "["); bIdx > 0 {
				name = strings.TrimSpace(name[:bIdx])
			}
			return name
		}
	}
	// Fallback: read CPU model and infer
	data, err := os.ReadFile("/proc/cpuinfo")
	if err == nil {
		for _, line := range strings.Split(string(data), "\n") {
			if strings.HasPrefix(line, "model name") {
				parts := strings.SplitN(line, ":", 2)
				if len(parts) == 2 {
					cpu := strings.TrimSpace(parts[1])
					return "Intel Graphics (" + cpu + ")"
				}
			}
		}
	}
	return "Intel Integrated Graphics"
}

func detectAMDGPUName(devPath string) string {
	out, err := exec.Command("sh", "-c",
		`lspci 2>/dev/null | grep -i "vga\|display\|3d" | grep -i amd | head -1`).Output()
	if err == nil && len(out) > 0 {
		line := strings.TrimSpace(string(out))
		if idx := strings.Index(line, "AMD"); idx >= 0 {
			name := strings.TrimSpace(line[idx:])
			if bIdx := strings.LastIndex(name, "["); bIdx > 0 {
				name = strings.TrimSpace(name[:bIdx])
			}
			return name
		}
	}
	return "AMD Radeon Graphics (APU)"
}

// ── hwmon helpers ─────────────────────────────────────────────────────────────

func readHwmonTemp(devPath string) float64 {
	// hwmon sits under devPath/hwmon/hwmon*/temp*_input
	pattern := filepath.Join(devPath, "hwmon", "hwmon*", "temp*_input")
	matches, _ := filepath.Glob(pattern)
	for _, m := range matches {
		if v := readSysInt(m); v > 0 {
			return float64(v) / 1000.0 // millidegrees → degrees
		}
	}
	// Also try one level up for some drivers
	pattern2 := filepath.Join(devPath, "..", "hwmon", "hwmon*", "temp*_input")
	matches2, _ := filepath.Glob(pattern2)
	for _, m := range matches2 {
		if v := readSysInt(m); v > 0 {
			return float64(v) / 1000.0
		}
	}
	return 0
}

func readHwmonPower(devPath string) float64 {
	pattern := filepath.Join(devPath, "hwmon", "hwmon*", "power*_average")
	matches, _ := filepath.Glob(pattern)
	for _, m := range matches {
		if v := readSysInt(m); v > 0 {
			return float64(v) / 1_000_000.0 // microwatts → watts
		}
	}
	return 0
}

// ── sysfs read helpers ────────────────────────────────────────────────────────

func readSysStr(path string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(data))
}

func readSysInt(path string) int64 {
	s := readSysStr(path)
	if s == "" {
		return 0
	}
	// Some sysfs files have extra info like "500 MHz" — take first word
	fields := strings.Fields(s)
	if len(fields) == 0 {
		return 0
	}
	v, _ := strconv.ParseInt(fields[0], 0, 64) // base 0 handles 0x hex prefix
	return v
}

func resolveDriverName(devPath string) string {
	driverLink := filepath.Join(devPath, "driver")
	target, err := filepath.EvalSymlinks(driverLink)
	if err != nil {
		return "unknown"
	}
	return filepath.Base(target)
}

// deduplicateGPUs removes redundant entries (e.g. AMD APU found both via
// rocm-smi and DRM sysfs).
func deduplicateGPUs(gpus []GPUMetrics) []GPUMetrics {
	// If we have an amd_dgpu entry from rocm-smi AND an amd_igpu from DRM,
	// keep both — they really are different devices.
	// If we have duplicates of the SAME type, keep the first (more detailed).
	seen := make(map[GPUType]bool)
	var result []GPUMetrics
	for _, g := range gpus {
		// Allow multiple entries of generic/intel/amd_igpu types
		// since a machine could have multiple iGPUs (rare but possible).
		// Only deduplicate discrete GPUs (nvidia, amd_dgpu).
		if g.Type == GPUTypeNvidia || g.Type == GPUTypeAMDDGPU {
			if seen[g.Type] {
				continue
			}
			seen[g.Type] = true
		}
		result = append(result, g)
	}
	return result
}

// ══════════════════════════════════════════════════════════════════════════════
//  Zram
// ══════════════════════════════════════════════════════════════════════════════

func collectZram() ZramMetrics {
	out, err := exec.Command("sh", "-c", "cat /sys/block/zram0/mm_stat 2>/dev/null").Output()
	if err != nil || strings.TrimSpace(string(out)) == "" {
		return ZramMetrics{Available: false}
	}
	fields := strings.Fields(string(out))
	if len(fields) < 3 {
		return ZramMetrics{Available: false}
	}
	orig, _ := strconv.ParseInt(fields[0], 10, 64)
	comp, _ := strconv.ParseInt(fields[2], 10, 64)
	var ratio, savings float64
	if comp > 0 {
		ratio = float64(orig) / float64(comp)
		savings = (1 - float64(comp)/float64(orig)) * 100
	}
	return ZramMetrics{
		Available:    true,
		OriginalMB:   float64(orig) / 1024 / 1024,
		CompressedMB: float64(comp) / 1024 / 1024,
		Ratio:        ratio,
		Savings:      savings,
	}
}

// ══════════════════════════════════════════════════════════════════════════════
//  Network
// ══════════════════════════════════════════════════════════════════════════════

func collectNetwork() NetMetrics {
	counters, err := psnet.IOCounters(false)
	if err != nil || len(counters) == 0 {
		return NetMetrics{}
	}
	cur := counters[0]
	now := time.Now()

	var sendRate, recvRate float64
	if !prevNetTime.IsZero() {
		dt := now.Sub(prevNetTime).Seconds()
		if dt > 0 {
			sentDelta := int64(cur.BytesSent) - int64(prevNetSent)
			recvDelta := int64(cur.BytesRecv) - int64(prevNetRecv)
			if sentDelta < 0 { sentDelta = 0 }
			if recvDelta < 0 { recvDelta = 0 }
			sendRate = float64(sentDelta) / dt / 1024 / 1024
			recvRate = float64(recvDelta) / dt / 1024 / 1024
		}
	}
	prevNetSent = cur.BytesSent
	prevNetRecv = cur.BytesRecv
	prevNetTime = now

	return NetMetrics{
		SendRateMBs: sendRate,
		RecvRateMBs: recvRate,
		TotalSentMB: float64(cur.BytesSent) / 1024 / 1024,
		TotalRecvMB: float64(cur.BytesRecv) / 1024 / 1024,
	}
}

// FormatMB returns a human-readable size string.
func FormatMB(mb float64) string {
	if mb >= 1024 {
		return fmt.Sprintf("%.1f GB", mb/1024)
	}
	return fmt.Sprintf("%.0f MB", mb)
}
