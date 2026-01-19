# Acid Bjorn

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/nephystos.acid-bjorn.svg)](https://marketplace.visualstudio.com/items?itemName=nephystos.acid-bjorn)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Acid Bjorn** is a VS Code extension designed for bi-directional synchronization between your local workspace and a remote project (specifically tailored for Bjorn Cyberviking projects). It allows for seamless development on your local machine while keeping a remote Raspberry Pi or server in sync.

## Features

- **Bi-directional Sync**: Push local changes to remote or pull remote changes to local.
- **Auto-Sync**: Automatically push changes to the remote server on file save.
- **Activity Bar Integration**: Dedicated sidebar for synchronization controls and status.
- **SSH Support**: Secure connection using passwords or private keys.
- **Exclusions**: Highly configurable exclusion list to skip unnecessary files (e.g., `.git`, `node_modules`).
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
| `acidBjorn.username` | `bjorn` | SSH username. |
| `acidBjorn.password` | `bjorn` | SSH password (if not using private key). |
| `acidBjorn.privateKeyPath` | `~/.ssh/id_rsa` | Path to your private SSH key. |
| `acidBjorn.remotePath` | `/home/bjorn/Bjorn` | Target path on the remote machine. |
| `acidBjorn.localPath` | `""` | Local path to sync (defaults to workspace root). |
| `acidBjorn.autoSync` | `true` | Enable automatic sync on file change. |
| `acidBjorn.exclusions` | `[...]` | List of files/directories to exclude. |

## Usage

### Sync Controls
Access the **Acid Bjorn** icon in the Activity Bar to:
- **Push to Remote**: Manually trigger a full push of local files.
- **Pull from Remote**: Fetch the latest changes from the remote server.
- **Toggle Auto-Sync**: Enable or disable automatic background synchronization.
- **Open Settings**: Quickly access the extension configuration.

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
