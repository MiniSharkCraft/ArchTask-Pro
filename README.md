# ArchTask-Pro v2.0

<p align="center">
  <b>A modern Task Manager for Arch Linux</b><br>
  Built with <b>Go + React</b> using <b>Wails v2</b><br>
  Windows-11 inspired UI with Glassmorphism aesthetics.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Go-Backend-00ADD8?logo=go">
  <img src="https://img.shields.io/badge/React-Frontend-61DAFB?logo=react">
  <img src="https://img.shields.io/badge/TailwindCSS-UI-38B2AC?logo=tailwindcss">
  <img src="https://img.shields.io/badge/Wails-v2-orange">
  <img src="https://img.shields.io/badge/Platform-Arch%20Linux-blue">
</p>

---

# ArchTask-Pro

**ArchTask-Pro** is a modern, high-performance **Task Manager for Arch Linux** designed with power users in mind.

It combines a **native Go backend** with a **React + Tailwind frontend**, connected through **Wails v2**, delivering the speed of native applications with the flexibility of modern web UI.

The interface embraces a **Windows 11–inspired Glassmorphism design**, featuring translucent panels, smooth graphs, and a modern dark theme.

---

# Screenshots

> Modern Dark Mode with Glassmorphism effects.

### Dashboard

![dashboard screenshot](docs/screenshots/dashboard.png)

### Processes Manager

![processes screenshot](docs/screenshots/processes.png)

### Performance Monitoring

![performance screenshot](docs/screenshots/performance.png)

### Startup Apps Manager

![startup screenshot](docs/screenshots/startup.png)

### Systemd Services

![services screenshot](docs/screenshots/services.png)

---

# Core Features

## Processes

Advanced process management with a clean grouped interface.

Features include:

* Grouped **User Apps / System Processes**
* **Multi-select checkboxes**
* **Force Kill** capability
* Process hierarchy display
* Fast refresh powered by Go backend

Designed to provide a safer and clearer alternative to `htop` or `gnome-system-monitor`.

---

## Performance Monitoring

Real-time performance graphs powered by efficient backend polling.

Metrics include:

* **CPU Usage (per-core)**
* **RAM usage**
* **Zram usage**
* **GPU usage**

  * NVIDIA
  * AMD
* **Network activity**

Graphs are displayed as **real-time sparklines** for minimal visual noise while keeping information dense.

---

## Startup Applications Manager

ArchTask-Pro includes a fully **XDG-compliant startup manager**.

It scans the following locations:

```
~/.config/autostart/
/etc/xdg/autostart/
```

To ensure **system safety**, disabling an application **does not delete the file**.

Instead it sets:

```
Hidden=true
```

inside the `.desktop` entry, which is the **official XDG method** for disabling autostart apps.

This prevents accidental system breakage and ensures reversibility.

---

## Systemd Services Manager

ArchTask-Pro provides full control over **Systemd units**.

Supported actions:

* Start
* Stop
* Restart
* Enable
* Disable

The backend communicates directly with `systemctl` to manage services safely.

---

## GameMode Integration

Built-in integration with **Feral GameMode**.

Features:

* Toggle **GameMode**
* Switch **CPU governor**
* Optimize system for gaming sessions

Supported governors typically include:

```
performance
powersave
ondemand
schedutil
```

This allows quick system tuning without opening terminal tools like `cpupower`.

---

# Project Architecture

ArchTask-Pro follows a **clean modular architecture**.

```
ArchTask-Pro/
│
├── internal/
│   Go backend logic
│   - process management
│   - system metrics
│   - systemd control
│   - startup scanning
│
├── frontend/
│   React + Tailwind UI
│
│   └── src/
│       └── tabs/
│           UI components for:
│           - Processes
│           - Performance
│           - Startup Apps
│           - Services
│
├── polkit/
│   Security rules for privileged actions
│
├── docs/
│   Screenshots and documentation
│
└── main.go
    Wails application entry point
```

---

# How It Works

## Wails Architecture

ArchTask-Pro uses **Wails v2** to bridge Go and React.

Architecture overview:

```
React UI
   │
   │  IPC Bridge (Wails)
   ▼
Go Backend
   │
   ├── System Metrics
   ├── Process Control
   ├── Systemd Management
   └── Startup Manager
```

React calls Go functions directly through the **Wails IPC bridge**, giving:

* Native performance
* Strong typing
* Zero REST API overhead

---

## Startup Manager Logic

Startup applications follow the **XDG Autostart Specification**.

When disabling an application:

1. The `.desktop` file is located.
2. The field is added or modified:

```
Hidden=true
```

3. Desktop environments automatically ignore the entry.

Re-enabling simply sets:

```
Hidden=false
```

This approach avoids deleting files or breaking package-managed entries.

---

# Installation

## Prerequisites

Install required dependencies:

```
go
nodejs
webkit2gtk
cpupower
gamemode
```

On Arch Linux:

```bash
sudo pacman -S go nodejs webkit2gtk cpupower gamemode
```

---

# Build From Source

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/ArchTask-Pro.git
cd ArchTask-Pro
```

Build the application:

```bash
wails build
```

The compiled binary will appear in:

```
build/bin/
```

---

# Polkit Setup (Important)

Certain operations require **elevated privileges**, such as:

* Killing system processes
* Changing CPU governors
* Managing system services

To avoid repeated password prompts, install the provided **Polkit rule**.

Copy the rule:

```bash
sudo cp polkit/10-archtask-pro.rules /usr/share/polkit-1/rules.d/
```

After installation, privileged actions will work seamlessly.

---

# Security Model

ArchTask-Pro follows a **least privilege approach**:

* Read-only operations run without elevated permissions
* Privileged operations are controlled via **Polkit rules**
* Startup entries are modified safely using **XDG standards**

---

# Roadmap

Future improvements may include:

* Disk usage monitoring
* Process resource throttling
* Advanced GPU telemetry
* Plugin system
* Wayland-specific optimizations

---

# Contributing

Contributions are welcome.

Please open:

* Issues for bugs or feature requests
* Pull Requests for improvements

---

# License

MIT License

---

<p align="center">
Made for Arch Linux power users.
</p>
