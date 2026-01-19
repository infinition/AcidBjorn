import * as vscode from 'vscode';
import { SyncEngine } from './syncEngine';
import { BjornTreeDataProvider, SyncStatus } from './treeDataProvider';

let syncEngine: SyncEngine;
let statusBarItem: vscode.StatusBarItem;
let treeDataProvider: BjornTreeDataProvider;

export function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel('Acid Bjorn');

    // Tree View
    const config = vscode.workspace.getConfiguration('acidBjorn');
    const customPath = config.get<string>('localPath');
    const workspaceRoot = (customPath && customPath.trim().length > 0)
        ? customPath
        : vscode.workspace.workspaceFolders?.[0].uri.fsPath;

    treeDataProvider = new BjornTreeDataProvider(workspaceRoot);
    vscode.window.registerTreeDataProvider('acidBjornExplorer', treeDataProvider);

    syncEngine = new SyncEngine(outputChannel, treeDataProvider);

    outputChannel.appendLine('Acid Bjorn activated!');

    // Status Bar
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'acid-bjorn.toggleEnabled';
    updateStatusBar();
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    function updateStatusBar() {
        const enabled = vscode.workspace.getConfiguration('acidBjorn').get<boolean>('enabled');
        if (enabled) {
            statusBarItem.text = '$(zap) Acid Bjorn: ON';
            statusBarItem.color = new vscode.ThemeColor('testing.iconPassed');
            statusBarItem.tooltip = 'Acid Bjorn is Active. Click to Disable.';
        } else {
            statusBarItem.text = '$(circle-slash) Acid Bjorn: OFF';
            statusBarItem.color = new vscode.ThemeColor('testing.iconFailed');
            statusBarItem.tooltip = 'Acid Bjorn is Disabled. Click to Enable.';
        }
    }

    // Commands
    let toggleEnabled = vscode.commands.registerCommand('acid-bjorn.toggleEnabled', () => {
        const config = vscode.workspace.getConfiguration('acidBjorn');
        const current = config.get<boolean>('enabled');
        config.update('enabled', !current, vscode.ConfigurationTarget.Global);
    });

    let syncNowCommand = vscode.commands.registerCommand('acid-bjorn.syncNow', async () => {
        outputChannel.appendLine('[Command] Push to Remote triggered');
        await syncEngine.syncAll();
    });

    let syncPullCommand = vscode.commands.registerCommand('acid-bjorn.syncPull', async () => {
        outputChannel.appendLine('[Command] Pull from Remote triggered');
        await syncEngine.syncPull();
    });

    let openSettingsCommand = vscode.commands.registerCommand('acid-bjorn.openSettings', () => {
        outputChannel.appendLine('[Command] Open Settings triggered');
        vscode.commands.executeCommand('workbench.action.openSettings', 'acidBjorn');
    });

    let openFileCommand = vscode.commands.registerCommand('acid-bjorn.openFile', (resource: vscode.Uri) => {
        vscode.window.showTextDocument(resource);
    });

    let toggleAutoSync = vscode.commands.registerCommand('acid-bjorn.toggleAutoSync', () => {
        const config = vscode.workspace.getConfiguration('acidBjorn');
        const current = config.get<boolean>('autoSync');
        config.update('autoSync', !current, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Acid Bjorn: Auto-sync ${!current ? 'enabled' : 'disabled'}`);
    });

    context.subscriptions.push(syncNowCommand, syncPullCommand, openSettingsCommand, openFileCommand, toggleAutoSync, toggleEnabled);

    // File Watcher
    const watcher = vscode.workspace.createFileSystemWatcher('**/*');
    watcher.onDidChange(uri => {
        const config = vscode.workspace.getConfiguration('acidBjorn');
        if (config.get<boolean>('enabled') && config.get<boolean>('autoSync')) {
            syncEngine.syncFile(uri.fsPath);
        }
    });
    watcher.onDidCreate(uri => {
        const config = vscode.workspace.getConfiguration('acidBjorn');
        if (config.get<boolean>('enabled') && config.get<boolean>('autoSync')) {
            syncEngine.syncFile(uri.fsPath);
        }
    });

    // Watch for dirty state (unsaved changes)
    const dirtyListener = vscode.workspace.onDidChangeTextDocument(e => {
        const config = vscode.workspace.getConfiguration('acidBjorn');
        if (config.get<boolean>('enabled') && e.document.isDirty) {
            treeDataProvider.setFileStatus(e.document.uri.fsPath, SyncStatus.Modified);
        }
    });

    context.subscriptions.push(watcher, dirtyListener);
    context.subscriptions.push(syncEngine);

    // Watch for config changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('acidBjorn.localPath')) {
            const config = vscode.workspace.getConfiguration('acidBjorn');
            const customPath = config.get<string>('localPath');
            treeDataProvider.updateWorkspaceRoot(customPath || vscode.workspace.workspaceFolders?.[0].uri.fsPath);
        }
        if (e.affectsConfiguration('acidBjorn.enabled')) {
            updateStatusBar();
        }
    }));
}

export function deactivate() {
    if (syncEngine) {
        syncEngine.dispose();
    }
}
