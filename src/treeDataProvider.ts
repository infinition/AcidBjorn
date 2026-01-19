import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export enum SyncStatus {
    Synced = 'synced',
    Pending = 'pending',
    Modified = 'modified',
    Error = 'error',
    None = 'none'
}

export class BjornFileItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly resourceUri: vscode.Uri,
        public readonly isDirectory: boolean,
        public status: SyncStatus = SyncStatus.None
    ) {
        super(label, collapsibleState);

        this.tooltip = `${this.label} - ${this.status}`;
        this.description = this.status === SyncStatus.None ? '' : this.status;

        if (!this.isDirectory) {
            this.command = {
                command: 'acid-bjorn.openFile',
                title: 'Open File',
                arguments: [this.resourceUri]
            };
            this.contextValue = 'file';
        } else {
            this.contextValue = 'folder';
        }

        this.updateIcon();
    }

    public updateStatus(status: SyncStatus) {
        this.status = status;
        this.updateIcon();
    }

    private updateIcon() {
        if (this.isDirectory) {
            // For folders, we show a status icon if it's not None
            switch (this.status) {
                case SyncStatus.Pending:
                    this.iconPath = new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('testing.iconQueued'));
                    break;
                case SyncStatus.Modified:
                    this.iconPath = new vscode.ThemeIcon('edit', new vscode.ThemeColor('charts.yellow'));
                    break;
                case SyncStatus.Error:
                    this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
                    break;
                default:
                    this.iconPath = vscode.ThemeIcon.Folder;
                    break;
            }
            return;
        }

        switch (this.status) {
            case SyncStatus.Synced:
                this.iconPath = new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('testing.iconPassed'));
                break;
            case SyncStatus.Pending:
                this.iconPath = new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('testing.iconQueued'));
                break;
            case SyncStatus.Modified:
                this.iconPath = new vscode.ThemeIcon('edit', new vscode.ThemeColor('charts.yellow'));
                break;
            case SyncStatus.Error:
                this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
                break;
            default:
                this.iconPath = vscode.ThemeIcon.File;
                break;
        }
    }
}

export class BjornTreeDataProvider implements vscode.TreeDataProvider<BjornFileItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<BjornFileItem | undefined | void> = new vscode.EventEmitter<BjornFileItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<BjornFileItem | undefined | void> = this._onDidChangeTreeData.event;

    private fileStatuses: Map<string, SyncStatus> = new Map();

    constructor(private workspaceRoot: string | undefined) { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    updateWorkspaceRoot(root: string | undefined) {
        this.workspaceRoot = root;
        this.refresh();
    }

    private normalizePath(p: string): string {
        return vscode.Uri.file(p).fsPath;
    }

    public setFileStatus(filePath: string, status: SyncStatus) {
        const normalizedPath = this.normalizePath(filePath);
        this.fileStatuses.set(normalizedPath, status);

        // Propagate status to parents if needed (Pending, Error, Modified)
        if (status === SyncStatus.Pending || status === SyncStatus.Error || status === SyncStatus.Modified) {
            let parent = path.dirname(normalizedPath);
            while (this.workspaceRoot && parent.startsWith(this.workspaceRoot)) {
                const currentParentStatus = this.fileStatuses.get(parent);
                // Don't overwrite Error with Pending/Modified
                if (currentParentStatus !== SyncStatus.Error) {
                    this.fileStatuses.set(parent, status);
                }
                if (parent === this.workspaceRoot) break;
                const newParent = path.dirname(parent);
                if (newParent === parent) break;
                parent = newParent;
            }
        }

        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: BjornFileItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: BjornFileItem): Thenable<BjornFileItem[]> {
        if (!this.workspaceRoot) {
            return Promise.resolve([]);
        }

        const folderPath = element ? element.resourceUri.fsPath : this.workspaceRoot;

        try {
            if (!fs.existsSync(folderPath)) return Promise.resolve([]);

            const files = fs.readdirSync(folderPath);
            const items = files.map(file => {
                const itemPath = path.join(folderPath, file);
                const normalizedItemPath = this.normalizePath(itemPath);
                const stats = fs.statSync(itemPath);
                const isDirectory = stats.isDirectory();
                const collapsibleState = isDirectory
                    ? vscode.TreeItemCollapsibleState.Collapsed
                    : vscode.TreeItemCollapsibleState.None;

                const status = this.fileStatuses.get(normalizedItemPath) || SyncStatus.None;
                return new BjornFileItem(file, collapsibleState, vscode.Uri.file(itemPath), isDirectory, status);
            });

            // Sort: Directories first, then files
            return Promise.resolve(items.sort((a, b) => {
                if (a.isDirectory === b.isDirectory) {
                    return a.label.toString().localeCompare(b.label.toString());
                }
                return a.isDirectory ? -1 : 1;
            }));
        } catch (err) {
            return Promise.resolve([]);
        }
    }
}
