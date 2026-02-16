<img width="128" height="128" alt="IDLE" src="https://github.com/user-attachments/assets/b2e2e2ba-e4b3-4b3c-ba8a-a6b9f7566c88" />

# Acid Bjorn

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/nephystos.acid-bjorn.svg)](https://marketplace.visualstudio.com/items?itemName=nephystos.acid-bjorn)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Acid Bjorn** is a VS Code extension designed for bi-directional synchronization between your local workspace and a remote project (specifically tailored for Bjorn Cyberviking projects). It allows for seamless development on your local machine while keeping a remote Raspberry Pi or server in sync.



## Features

- **Sync Engine v2**: Persistent SSH/SFTP connection, retries with backoff, debounced autosync, and transfer queue with bounded concurrency.
- **Bi-directional Sync**: Push local changes to remote or pull remote changes to local.
- **Auto-Sync**: Automatically push changes to the remote server on file save (debounced).
- **Activity Bar Integration**: Dedicated sidebar for synchronization controls and status.
- **SSH Support**: Password or key auth with persistent session handling.
- **Remote Dev Tools**: Run Python remotely, manage systemd services, and tail service logs.
- **Scope Control**: Include/exclude globs with `mirror` or `selective` sync mode.
- **Master Toggle**: Easily enable or disable synchronization globally.

## Installation

1. Open **VS Code**.
2. Go to the **Extensions** view (`Ctrl+Shift+X`).
3. Search for **Acid Bjorn**.
4. Click **Install**.

## Configuration

You can configure Acid Bjorn in your VS Code settings (`settings.json`) or via the extension's settings UI:

| Setting | Default | Description |
|---------|---------|-------------|
| `acidBjorn.enabled` | `false` | Master switch to enable/disable synchronization. |
| `acidBjorn.remoteIp` | `192.168.1.15` | IP address of the remote machine. |
| `acidBjorn.port` | `22` | SSH port. |
| `acidBjorn.username` | `bjorn` | SSH username. |
| `acidBjorn.password` | `bjorn` | SSH password (if not using private key). |
| `acidBjorn.privateKeyPath` | `~/.ssh/id_rsa` | Path to your private SSH key. |
| `acidBjorn.remotePath` | `/home/bjorn/Bjorn` | Target path on the remote machine. |
| `acidBjorn.localPath` | `""` | Local path to sync. If empty, Acid Bjorn auto-creates and uses `.acid-bjorn/Bjorn_YYYYMMDD_HHMMSS` inside the workspace. |
| `acidBjorn.autoSync` | `true` | Enable automatic sync on file change. |
| `acidBjorn.exclusions` | `[...]` | List of files/directories to exclude. |
| `acidBjorn.includes` | `["**/*"]` | Include globs used by selective mode. |
| `acidBjorn.syncMode` | `"mirror"` | `mirror` or `selective`. |
| `acidBjorn.maxConcurrency` | `3` | Maximum parallel transfers (Pi Zero friendly). |
| `acidBjorn.maxRetries` | `3` | Retries per transfer job. |
| `acidBjorn.connectTimeoutMs` | `20000` | SSH connect timeout in milliseconds. |
| `acidBjorn.operationTimeoutMs` | `30000` | SFTP operation timeout in milliseconds. |
| `acidBjorn.pollingIntervalSec` | `10` | Polling fallback interval (future remote watcher mode). |
| `acidBjorn.pythonPath` | `/usr/bin/python3` | Remote Python interpreter path. |
| `acidBjorn.sudoByDefault` | `false` | Use sudo by default for remote tooling. |
| `acidBjorn.services` | `[]` | List of systemd services for service commands. |

## Usage

### Sync Controls
Access the **Acid Bjorn** icon in the Activity Bar to:
- **Push to Remote**: Manually trigger a full push of local files.
- **Pull from Remote**: Fetch the latest changes from the remote server.
- **Toggle Auto-Sync**: Enable or disable automatic background synchronization.
- **Open Settings**: Quickly access the extension configuration.

### Explorer Context Actions
- **Acid Bjorn: Sync This File/Folder**
- **Acid Bjorn: Download Remote Version**
- **Acid Bjorn: Add to Sync Scope (include)**
- **Acid Bjorn: Exclude from Sync**
- **Acid Bjorn: Run Python File Remotely**

### Status Bar
A status bar item indicates whether synchronization is active and provides a quick toggle to enable/disable the extension.

## Development

To build and run the extension locally:

1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Run `npm run compile` to build the extension.
4. Press `F5` in VS Code to open a new window with the extension loaded.

## License

This project is licensed under the [MIT License](https://github.com/infinition/AcidBjorn/blob/main/LICENSE).
