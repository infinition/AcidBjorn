import * as vscode from 'vscode';
import { Client, SFTPWrapper, ConnectConfig } from 'ssh2';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { BjornTreeDataProvider, SyncStatus } from './treeDataProvider';

export class SyncEngine {
    private client: Client | null = null;
    private sftp: SFTPWrapper | null = null;
    private isSyncing: boolean = false;

    constructor(
        private outputChannel: vscode.OutputChannel,
        private treeDataProvider: BjornTreeDataProvider
    ) { }

    private getLocalRoot(): string | undefined {
        const config = vscode.workspace.getConfiguration('acidBjorn');
        const customPath = config.get<string>('localPath');
        if (customPath && customPath.trim().length > 0) {
            return customPath;
        }
        return vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    }

    private async connect(): Promise<SFTPWrapper> {
        if (this.sftp) return this.sftp;

        const config = vscode.workspace.getConfiguration('acidBjorn');
        const host = config.get<string>('remoteIp');
        const username = config.get<string>('username');
        const password = config.get<string>('password');
        let privateKeyPath = config.get<string>('privateKeyPath') || '';

        this.outputChannel.appendLine(`[SSH] Attempting to connect to ${username}@${host}...`);

        const connectConfig: ConnectConfig = {
            host,
            port: 22,
            username,
            tryKeyboard: true,
            readyTimeout: 20000
        };

        if (privateKeyPath) {
            if (privateKeyPath.startsWith('~')) {
                privateKeyPath = path.join(os.homedir(), privateKeyPath.slice(1));
            }
            if (fs.existsSync(privateKeyPath)) {
                this.outputChannel.appendLine(`[SSH] Using private key: ${privateKeyPath}`);
                connectConfig.privateKey = fs.readFileSync(privateKeyPath);
            }
        }

        if (password) {
            connectConfig.password = password;
        }

        return new Promise((resolve, reject) => {
            this.client = new Client();
            this.client.on('ready', () => {
                this.outputChannel.appendLine('[SSH] Connected! Opening SFTP session...');
                this.client!.sftp((err, sftp) => {
                    if (err) {
                        this.cleanup();
                        reject(err);
                    } else {
                        this.sftp = sftp;
                        resolve(sftp);
                    }
                });
            }).on('error', (err) => {
                this.cleanup();
                reject(err);
            }).on('close', () => {
                this.cleanup();
            }).connect(connectConfig);
        });
    }

    private cleanup() {
        this.sftp = null;
        this.client = null;
    }

    private normalizePath(p: string): string {
        return vscode.Uri.file(p).fsPath;
    }

    public async syncFile(localPath: string) {
        const config = vscode.workspace.getConfiguration('acidBjorn');
        if (!config.get<boolean>('enabled')) return;

        const remoteRoot = config.get<string>('remotePath');
        const workspaceRoot = this.getLocalRoot();

        if (!workspaceRoot || !remoteRoot) return;

        const normalizedLocalPath = this.normalizePath(localPath);
        const normalizedWorkspaceRoot = this.normalizePath(workspaceRoot);

        if (!normalizedLocalPath.startsWith(normalizedWorkspaceRoot)) return;

        const relativePath = path.relative(normalizedWorkspaceRoot, normalizedLocalPath);
        if (this.isExcluded(relativePath) || relativePath.startsWith('..')) return;

        const remotePath = path.posix.join(remoteRoot, relativePath.replace(/\\/g, '/'));

        try {
            const sftp = await this.connect();

            this.outputChannel.appendLine(`[Sync] Uploading ${relativePath}...`);
            this.treeDataProvider.setFileStatus(normalizedLocalPath, SyncStatus.Pending);

            await this.ensureRemoteDir(path.posix.dirname(remotePath));

            await new Promise<void>((resolve, reject) => {
                sftp.fastPut(normalizedLocalPath, remotePath, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            this.outputChannel.appendLine(`[Success] Uploaded ${relativePath}`);
            this.treeDataProvider.setFileStatus(normalizedLocalPath, SyncStatus.Synced);
        } catch (err: any) {
            this.outputChannel.appendLine(`[Error] Failed to upload ${relativePath}: ${err.message}`);
            this.treeDataProvider.setFileStatus(normalizedLocalPath, SyncStatus.Error);
        }
    }

    private async ensureRemoteDir(remoteDir: string): Promise<void> {
        const sftp = await this.connect();
        const parts = remoteDir.split('/').filter(p => p.length > 0);
        let currentPath = remoteDir.startsWith('/') ? '/' : '';

        for (const part of parts) {
            currentPath = path.posix.join(currentPath, part);
            try {
                await new Promise<void>((resolve, reject) => {
                    sftp.mkdir(currentPath, (err: any) => {
                        if (err && err.code !== 4) reject(err);
                        else resolve();
                    });
                });
            } catch (err) { }
        }
    }

    public async syncAll() {
        if (this.isSyncing) return;
        const config = vscode.workspace.getConfiguration('acidBjorn');
        if (!config.get<boolean>('enabled')) {
            vscode.window.showWarningMessage('Acid Bjorn is disabled. Enable it first.');
            return;
        }

        const workspaceRoot = this.getLocalRoot();
        if (!workspaceRoot) return;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Acid Bjorn: Pushing to remote...",
            cancellable: false
        }, async (progress) => {
            this.isSyncing = true;
            this.outputChannel.appendLine('[Sync] Starting full workspace push...');
            try {
                await this.uploadDir(workspaceRoot, '', progress);
                this.outputChannel.appendLine('[Success] Full push completed.');
                vscode.window.showInformationMessage('Acid Bjorn: Push completed!');
            } catch (err: any) {
                this.outputChannel.appendLine(`[Error] Push failed: ${err.message}`);
                vscode.window.showErrorMessage(`Acid Bjorn: Push failed: ${err.message}`);
            } finally {
                this.isSyncing = false;
                this.treeDataProvider.refresh();
            }
        });
    }

    private async uploadDir(localDir: string, relativePath: string, progress: vscode.Progress<{ message?: string }>) {
        if (this.isExcluded(relativePath)) return;

        const files = fs.readdirSync(localDir);
        for (const file of files) {
            const localPath = path.join(localDir, file);
            const relPath = path.join(relativePath, file).replace(/\\/g, '/');

            if (this.isExcluded(relPath)) continue;

            const stats = fs.statSync(localPath);
            if (stats.isDirectory()) {
                await this.uploadDir(localPath, relPath, progress);
            } else {
                progress.report({ message: relPath });
                await this.syncFileInternal(localPath, relPath);
            }
        }
    }

    private async syncFileInternal(localPath: string, relativePath: string) {
        const config = vscode.workspace.getConfiguration('acidBjorn');
        const remoteRoot = config.get<string>('remotePath');
        if (!remoteRoot) return;

        const remotePath = path.posix.join(remoteRoot, relativePath);
        const sftp = await this.connect();
        const normalizedLocalPath = this.normalizePath(localPath);

        try {
            const stats = fs.statSync(normalizedLocalPath);
            const remoteStats: any = await new Promise((resolve) => {
                sftp.stat(remotePath, (err, res) => resolve(err ? null : res));
            });

            if (remoteStats && remoteStats.size === stats.size && Math.abs(remoteStats.mtime - Math.floor(stats.mtimeMs / 1000)) < 2) {
                this.treeDataProvider.setFileStatus(normalizedLocalPath, SyncStatus.Synced);
                return;
            }
        } catch (e) { }

        this.treeDataProvider.setFileStatus(normalizedLocalPath, SyncStatus.Pending);
        await this.ensureRemoteDir(path.posix.dirname(remotePath));

        await new Promise<void>((resolve, reject) => {
            sftp.fastPut(normalizedLocalPath, remotePath, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        this.treeDataProvider.setFileStatus(normalizedLocalPath, SyncStatus.Synced);
    }

    public async syncPull() {
        if (this.isSyncing) {
            this.outputChannel.appendLine('[Sync] Already syncing, skipping pull.');
            return;
        }
        const config = vscode.workspace.getConfiguration('acidBjorn');
        if (!config.get<boolean>('enabled')) {
            vscode.window.showWarningMessage('Acid Bjorn is disabled. Enable it first.');
            return;
        }

        const workspaceRoot = this.getLocalRoot();
        const remoteRoot = config.get<string>('remotePath');

        if (!workspaceRoot || !remoteRoot) return;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Acid Bjorn: Pulling from remote...",
            cancellable: false
        }, async (progress) => {
            this.isSyncing = true;
            this.outputChannel.appendLine('[Sync] Starting pull from remote...');
            try {
                const sftp = await this.connect();
                await this.downloadDir(sftp, remoteRoot, workspaceRoot, progress);
                this.outputChannel.appendLine('[Success] Pull completed.');
                vscode.window.showInformationMessage('Acid Bjorn: Pull completed!');
            } catch (err: any) {
                this.outputChannel.appendLine(`[Error] Pull failed: ${err.message}`);
                vscode.window.showErrorMessage(`Acid Bjorn: Pull failed: ${err.message}`);
            } finally {
                this.isSyncing = false;
                this.treeDataProvider.refresh();
            }
        });
    }

    private async downloadDir(sftp: SFTPWrapper, remoteDir: string, localDir: string, progress: vscode.Progress<{ message?: string }>) {
        const list: any[] = await new Promise((resolve, reject) => {
            sftp.readdir(remoteDir, (err, res) => err ? reject(err) : resolve(res));
        });

        for (const item of list) {
            const remotePath = path.posix.join(remoteDir, item.filename);
            const localPath = path.join(localDir, item.filename);
            const workspaceRoot = this.getLocalRoot() || '';
            const relPath = path.relative(workspaceRoot, localPath).replace(/\\/g, '/');

            if (this.isExcluded(relPath)) continue;

            if (item.attrs.isDirectory()) {
                if (!fs.existsSync(localPath)) {
                    fs.mkdirSync(localPath, { recursive: true });
                }
                await this.downloadDir(sftp, remotePath, localPath, progress);
            } else {
                progress.report({ message: relPath });
                const normalizedLocalPath = this.normalizePath(localPath);
                this.treeDataProvider.setFileStatus(normalizedLocalPath, SyncStatus.Pending);
                try {
                    await new Promise<void>((resolve, reject) => {
                        sftp.fastGet(remotePath, normalizedLocalPath, (err) => err ? reject(err) : resolve());
                    });
                    this.outputChannel.appendLine(`[Success] Downloaded ${relPath}`);
                    this.treeDataProvider.setFileStatus(normalizedLocalPath, SyncStatus.Synced);
                } catch (err: any) {
                    this.outputChannel.appendLine(`[Error] Failed to download ${relPath}: ${err.message}`);
                    this.treeDataProvider.setFileStatus(normalizedLocalPath, SyncStatus.Error);
                }
            }
        }
    }

    private isExcluded(relativePath: string): boolean {
        const exclusions = vscode.workspace.getConfiguration('acidBjorn').get<string[]>('exclusions') || [];
        return exclusions.some(pattern => {
            if (pattern.includes('*')) {
                const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
                return regex.test(path.basename(relativePath));
            }
            return relativePath.includes(pattern);
        });
    }

    public dispose() {
        if (this.client) {
            this.client.end();
        }
        this.cleanup();
    }
}
