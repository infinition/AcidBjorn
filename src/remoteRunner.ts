import * as vscode from 'vscode';
import { getWorkspaceTarget } from './core/Config';
import { ConnectionManager } from './core/ConnectionManager';
import { Logger } from './core/Logger';

function shellEscape(value: string): string {
    return `'${value.replace(/'/g, `'"'"'`)}'`;
}

export class RemoteRunner {
    constructor(private readonly output: vscode.OutputChannel, private readonly logger: Logger) {}

    public async runPython(resource?: vscode.Uri): Promise<void> {
        const target = getWorkspaceTarget(resource);
        if (!target || !target.settings.enabled) {
            vscode.window.showWarningMessage('Acid Bjorn is disabled.');
            return;
        }

        const editor = vscode.window.activeTextEditor;
        const fileUri = resource ?? editor?.document.uri;
        if (!fileUri) {
            vscode.window.showWarningMessage('No file selected to run remotely.');
            return;
        }

        const relativePath = vscode.workspace.asRelativePath(fileUri, false).replace(/\\/g, '/');
        const remoteFile = `${target.settings.remotePath}/${relativePath}`;

        const argsInput = await vscode.window.showInputBox({
            prompt: 'Python arguments',
            placeHolder: '--flag value',
            value: ''
        });
        if (argsInput === undefined) {
            return;
        }

        const sudoChoice = await vscode.window.showQuickPick(['No sudo', 'Use sudo'], {
            placeHolder: 'Execution mode'
        });
        if (!sudoChoice) {
            return;
        }

        const args = argsInput.trim().length > 0 ? ` ${argsInput}` : '';
        const baseCmd = `${shellEscape(target.settings.pythonPath)} ${shellEscape(remoteFile)}${args}`;
        const cmd = sudoChoice === 'Use sudo' ? `sudo -n ${baseCmd}` : baseCmd;

        const manager = ConnectionManager.getOrCreate(
            {
                host: target.settings.host,
                port: target.settings.port,
                username: target.settings.username,
                remotePath: target.settings.remotePath
            },
            target.settings,
            this.logger
        );

        await manager.getSftp();

        const terminal = vscode.window.createTerminal({
            name: 'Acid Bjorn Remote Python'
        });
        terminal.show(true);

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Acid Bjorn: Running Python remotely',
                cancellable: false
            },
            async () => {
                const result = await manager.execStreaming(
                    cmd,
                    target.settings.operationTimeoutMs,
                    (stdoutChunk) => {
                        const text = stdoutChunk.replace(/\r?\n$/, '');
                        if (text.length > 0) {
                            this.output.appendLine(text);
                            terminal.sendText(`echo ${shellEscape(text)}`, true);
                        }
                    },
                    (stderrChunk) => {
                        const text = stderrChunk.replace(/\r?\n$/, '');
                        if (text.length > 0) {
                            this.output.appendLine(text);
                            terminal.sendText(`echo ${shellEscape(text)}`, true);
                        }
                    }
                );

                if ((result.code ?? 1) !== 0) {
                    vscode.window.showErrorMessage('Acid Bjorn: Remote Python execution failed.', 'Open Output Logs').then((action) => {
                        if (action === 'Open Output Logs') {
                            this.output.show(true);
                        }
                    });
                    return;
                }

                vscode.window.showInformationMessage('Acid Bjorn: Remote Python execution completed.');
            }
        );
    }

    public async runServiceAction(action: 'start' | 'stop' | 'restart' | 'status' | 'enable' | 'disable' | 'tail'): Promise<void> {
        const target = getWorkspaceTarget();
        if (!target || !target.settings.enabled) {
            vscode.window.showWarningMessage('Acid Bjorn is disabled.');
            return;
        }

        const services = target.settings.services;
        if (services.length === 0) {
            vscode.window.showWarningMessage('Configure acidBjorn.services first.');
            return;
        }

        const selected = await vscode.window.showQuickPick(services, {
            placeHolder: 'Select service'
        });
        if (!selected) {
            return;
        }

        const manager = ConnectionManager.getOrCreate(
            {
                host: target.settings.host,
                port: target.settings.port,
                username: target.settings.username,
                remotePath: target.settings.remotePath
            },
            target.settings,
            this.logger
        );
        await manager.getSftp();

        const command = action === 'tail'
            ? `journalctl -fu ${shellEscape(selected)}`
            : `sudo -n systemctl ${action} ${shellEscape(selected)}`;

        let stdout = '';
        let stderr = '';
        const result = await manager.execStreaming(
            command,
            action === 'tail' ? 120000 : target.settings.operationTimeoutMs,
            (chunk) => {
                stdout += chunk;
                const text = chunk.replace(/\r?\n$/, '');
                if (text.length > 0) {
                    this.output.appendLine(text);
                }
            },
            (chunk) => {
                stderr += chunk;
                const text = chunk.replace(/\r?\n$/, '');
                if (text.length > 0) {
                    this.output.appendLine(text);
                }
            }
        );

        if ((result.code ?? 1) !== 0) {
            vscode.window.showErrorMessage(`Acid Bjorn: Service ${action} failed for ${selected}.`, 'Open Output Logs').then((choice) => {
                if (choice === 'Open Output Logs') {
                    this.output.show(true);
                }
            });
            return;
        }

        if (stdout.trim().length > 0 || stderr.trim().length > 0) {
            this.logger.debug(`Service ${action} output captured for ${selected}`);
        }
        vscode.window.showInformationMessage(`Acid Bjorn: Service ${selected} ${action} done.`);
    }
}
